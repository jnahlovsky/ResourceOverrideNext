/* global bgapp, chrome */
import { buildUrlMatch, applyDomainFilters, getTargetPort, getTargetHost } from './urlPattern.js';

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

// The page HUD (src/inject/hud.js) reads this list straight from storage.
const publishHudRedirects = (rules) => {
    const hudRedirects = rules
        .filter(rule => rule.type === "normalOverride")
        .map(rule => ({
            name: rule.name || getTargetHost(rule.replace) || "URL Redirect",
            port: getTargetPort(rule.replace)
        }));
    return chrome.storage.local.set({ hudRedirects });
};

export async function updateDNRRules() {
    if (!globalThis.bgapp || !globalThis.bgapp.mainStorage) {
        console.warn("bgapp or mainStorage not initialized yet");
        return;
    }

    try {
        const domains = await globalThis.bgapp.mainStorage.getAll();
        const addRules = [];
        const activeRules = [];

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
                            continue;
                        }
                    }

                    const condition = applyDomainFilters({ ...urlMatch.condition, resourceTypes: RESOURCE_TYPES }, ruleObj);

                    addRules.push({
                        id: addRules.length + 1,
                        priority: 100,
                        action: action,
                        condition: condition
                    });
                    activeRules.push(ruleObj);
                }
            }
        }

        // Get existing rules to remove them
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = existingRules.map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: removeRuleIds,
            addRules: addRules
        });

        await publishHudRedirects(activeRules);

        console.log(`DNR rules updated. Added ${addRules.length} rules.`);
    } catch (e) {
        console.error("Error updating DNR rules:", e);
    }
}
