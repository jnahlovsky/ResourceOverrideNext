/* global bgapp, chrome */
import { buildUrlMatch, applyDomainFilters, getTargetPort, getTargetHost } from './urlPattern.js';
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
// rule unregistered. In that case they are added one at a time, so only the bad ones are
// left out. Returns the rules that were registered and the errors by rule id.
const registerRules = async (entries) => {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);
    const addRules = entries.map(entry => entry.dnrRule);
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
        return { registered: entries.map(entry => entry.ruleObj), errors: {} };
    } catch (batchError) {
        console.warn("Some rules were rejected, adding them one by one:", batchError);
    }

    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    const registered = [];
    const errors = {};
    for (const { ruleObj, dnrRule } of entries) {
        try {
            await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [dnrRule] });
            registered.push(ruleObj);
        } catch (err) {
            errors[ruleObj.id] = describeRejection(err);
            console.warn("Rule rejected by Chrome:", ruleObj, err);
        }
    }
    return { registered, errors };
};

export async function updateDNRRules() {
    if (!globalThis.bgapp || !globalThis.bgapp.mainStorage) {
        console.warn("bgapp or mainStorage not initialized yet");
        return;
    }

    try {
        const domains = await globalThis.bgapp.mainStorage.getAll();
        const entries = [];
        const skippedErrors = {};

        const isExtensionOn = globalThis.bgapp.getSetting("isExtensionOn") !== "false";

        if (isExtensionOn) {
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
                    if (regex) {
                        const support = await chrome.declarativeNetRequest.isRegexSupported({ regex });
                        if (!support.isSupported) {
                            console.warn(`Skipping rule with unsupported regex (${support.reason}):`, regex);
                            skippedErrors[ruleObj.id] = support.reason === "memoryLimitExceeded"
                                ? "The pattern is too complex for Chrome."
                                : "Chrome can't use this regular expression (RE2 syntax, no lookarounds or backreferences).";
                            continue;
                        }
                    }

                    const condition = applyDomainFilters({ ...urlMatch.condition, resourceTypes: RESOURCE_TYPES }, ruleObj);

                    entries.push({
                        ruleObj,
                        dnrRule: {
                            id: entries.length + 1,
                            priority: 100,
                            action: action,
                            condition: condition
                        }
                    });
                }
            }
        }

        const { registered, errors } = await registerRules(entries);

        // Shown on the rule cards and in the popup / side panel (useRuleErrors).
        const ruleErrors = { ...skippedErrors, ...errors };
        await chrome.storage.local.set({ ruleErrors });
        // The activity log attributes requests to the rules that are actually in effect.
        setActivityRules(!isExtensionOn ? [] : domains
            .filter(domainObj => domainObj.on)
            .flatMap(domainObj => domainObj.rules || [])
            .filter(rule => rule.on && !ruleErrors[rule.id]));
        await publishHudRedirects(domains, isExtensionOn, ruleErrors);

        console.log(`DNR rules updated. Added ${registered.length} of ${entries.length} rules.`);
    } catch (e) {
        console.error("Error updating DNR rules:", e);
    }
}
