/* global bgapp, chrome */
import { buildUrlMatch, applyDomainFilters, getTargetPort, getTargetHost, getSiteLists, buildSiteBlockConditions, buildSiteVariants } from './urlPattern.js';
import { canEditRulePort } from '../lib/ruleLabels.js';
import { setActivityRules } from './activityLog.js';

const RESOURCE_TYPES = [
    "main_frame", "sub_frame", "stylesheet", "script", "image",
    "font", "object", "xmlhttprequest", "ping", "csp_report",
    "media", "websocket", "other"
];

const buildHeaderMods = (headerRules) => (headerRules || [])
    .filter(rule => rule.header)
    .map(rule => {
        const headerMod = { header: rule.header, operation: rule.operation };
        if (rule.operation !== "remove") {
            headerMod.value = rule.value || "";
        }
        return headerMod;
    });

// Returns the DNR action for a rule, or null when it has nothing to register.
const buildAction = (ruleObj, urlMatch) => {
    if (ruleObj.type === "normalOverride") {
        return { type: "redirect", redirect: urlMatch.redirect };
    }

    if (ruleObj.type === "headerRule") {
        const action = { type: "modifyHeaders" };
        const requestHeaders = buildHeaderMods(ruleObj.requestRules);
        const responseHeaders = buildHeaderMods(ruleObj.responseRules);
        // Empty arrays fail DNR validation.
        if (requestHeaders.length > 0) action.requestHeaders = requestHeaders;
        if (responseHeaders.length > 0) action.responseHeaders = responseHeaders;
        return action.requestHeaders || action.responseHeaders ? action : null;
    }

    if (ruleObj.type === "fileOverride") {
        const mimeAndFile = globalThis.bgapp.extractMimeType(ruleObj.match, ruleObj.file || "");

        // Convert the file contents to a base64 encoded data URI
        const dataUri = "data:" + mimeAndFile.mime + ";charset=UTF-8;base64," +
            btoa(unescape(encodeURIComponent(mimeAndFile.file)));

        return { type: "redirect", redirect: { url: dataUri } };
    }

    return null;
};

// The page HUD (src/inject/hud.js) reads this list straight from storage. It lists every
// complete redirect, also the switched-off ones, so they can be switched on from the page.
// Empty while the extension is paused, which hides the HUD.
const publishHudRedirects = (domains, isExtensionOn, errors) => {
    const hudRedirects = !isExtensionOn ? [] : domains
        .filter(domainObj => domainObj.on)
        .flatMap(domainObj => domainObj.rules || [])
        .filter(rule => rule.type === "normalOverride" && buildUrlMatch(rule))
        .map(rule => ({
            id: rule.id,
            name: rule.name || getTargetHost(rule.replace) || "URL Redirect",
            port: getTargetPort(rule.replace),
            canEditPort: canEditRulePort(rule),
            on: !!rule.on,
            error: (rule.on && errors[rule.id]) || ""
        }));
    return chrome.storage.local.set({ hudRedirects });
};

// Chrome's messages name its own rule id ("Rule with id 3 ...") and DNR keys, which mean
// nothing in the UI; the common ones get a plain explanation.
const describeRejection = (err) => {
    const message = String(err?.message || err).replace(/^Rule with id \d+ /, "");
    if (message.includes("regexSubstitution")) {
        return "The destination isn't a valid URL, or uses a group ($1–$9) the pattern doesn't have.";
    }
    if (message.includes("redirect.url")) return "The destination isn't a valid URL.";
    if (message.includes("header name")) return "A header name isn't valid (letters, digits and dashes only).";
    if (message.includes("Domains")) return "One of the domain filters isn't a valid domain.";
    return message.charAt(0).toUpperCase() + message.slice(1);
};

// Chrome rejects the whole update when any one rule is invalid, which would leave every
// rule unregistered. In that case they are added one entry at a time (a rule can take
// more than one DNR rule), so only the bad ones are left out.
// Returns the entries that were registered and the errors by entry key.
const registerRules = async (entries) => {
    let nextId = 1;
    entries.forEach(entry => entry.dnrRules.forEach(dnrRule => { dnrRule.id = nextId++; }));
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: entries.flatMap(entry => entry.dnrRules) });
        return { registered: entries, errors: {} };
    } catch (batchError) {
        console.warn("Some rules were rejected, adding them one by one:", batchError);
    }

    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    const registered = [];
    const errors = {};
    for (const entry of entries) {
        try {
            await chrome.declarativeNetRequest.updateDynamicRules({ addRules: entry.dnrRules });
            registered.push(entry);
        } catch (err) {
            errors[entry.key] = describeRejection(err);
            console.warn("Rule rejected by Chrome:", entry, err);
        }
    }
    return { registered, errors };
};

const regexError = async (regex) => {
    const support = await chrome.declarativeNetRequest.isRegexSupported({ regex });
    if (support.isSupported) return "";
    console.warn(`Skipping unsupported regex (${support.reason}):`, regex);
    return support.reason === "memoryLimitExceeded"
        ? "The pattern is too complex for Chrome."
        : "Chrome can't use this regular expression (RE2 syntax, no lookarounds or backreferences).";
};

// Above every rule of the extension, so the blocklist's pages are left alone.
const SITE_BLOCK_PRIORITY = 1000;

export async function updateDNRRules() {
    if (!globalThis.bgapp || !globalThis.bgapp.mainStorage) {
        console.warn("bgapp or mainStorage not initialized yet");
        return;
    }

    try {
        const domains = await globalThis.bgapp.mainStorage.getAll();
        const entries = [];
        const skippedErrors = {};
        const siteErrors = {};

        const isExtensionOn = globalThis.bgapp.getSetting("isExtensionOn") !== "false";
        // Settings → Sites: where the rules apply at all.
        const sites = getSiteLists(await chrome.storage.local.get(["siteAllowlist", "siteBlocklist"]));

        if (isExtensionOn) {
            const blockConditions = buildSiteBlockConditions(sites);
            for (const [index, condition] of blockConditions.entries()) {
                const pattern = sites.block[index].pattern;
                const error = await regexError(condition.regexFilter);
                if (error) {
                    siteErrors[pattern] = error;
                    continue;
                }
                entries.push({
                    key: "site:" + pattern,
                    site: pattern,
                    dnrRules: [{ priority: SITE_BLOCK_PRIORITY, action: { type: "allowAllRequests" }, condition }]
                });
            }

            for (const domainObj of domains) {
                if (!domainObj.on) continue;

                for (const ruleObj of domainObj.rules || []) {
                    if (!ruleObj.on) continue;

                    // Skip incomplete/invalid rules to prevent crashing the whole DNR update
                    const urlMatch = buildUrlMatch(ruleObj);
                    if (!urlMatch) continue;
                    const action = buildAction(ruleObj, urlMatch);
                    if (!action) continue;

                    const regex = urlMatch.condition.regexFilter;
                    const error = regex ? await regexError(regex) : "";
                    if (error) {
                        skippedErrors[ruleObj.id] = error;
                        continue;
                    }

                    const condition = applyDomainFilters({ ...urlMatch.condition, resourceTypes: RESOURCE_TYPES }, ruleObj);
                    const conditions = buildSiteVariants(condition, sites);
                    if (conditions.length === 0) {
                        skippedErrors[ruleObj.id] = "None of this rule's domains are among the allowed sites (Settings → Sites).";
                        continue;
                    }

                    entries.push({
                        key: ruleObj.id,
                        ruleObj,
                        dnrRules: conditions.map(variant => ({ priority: 100, action: action, condition: variant }))
                    });
                }
            }
        }

        const { registered, errors } = await registerRules(entries);

        // Shown on the rule cards and in the popup / side panel (useRuleErrors), and for the
        // site lists in Settings.
        const ruleErrors = { ...skippedErrors };
        Object.keys(errors).forEach(key => {
            const entry = entries.find(e => String(e.key) === String(key));
            if (entry?.site) siteErrors[entry.site] = errors[key];
            else ruleErrors[key] = errors[key];
        });
        await chrome.storage.local.set({ ruleErrors, siteErrors });
        // The activity log attributes requests to the rules that are actually in effect.
        setActivityRules(!isExtensionOn ? [] : domains
            .filter(domainObj => domainObj.on)
            .flatMap(domainObj => domainObj.rules || [])
            .filter(rule => rule.on && !ruleErrors[rule.id]), sites);
        await publishHudRedirects(domains, isExtensionOn, ruleErrors);

        console.log(`DNR rules updated. Added ${registered.length} of ${entries.length} rules and site filters.`);
    } catch (e) {
        console.error("Error updating DNR rules:", e);
    }
}
