/* global bgapp, chrome */
export async function updateDNRRules() {
    if (!globalThis.bgapp || !globalThis.bgapp.mainStorage) {
        console.warn("bgapp or mainStorage not initialized yet");
        return;
    }

    try {
        const domains = await globalThis.bgapp.mainStorage.getAll();
        const addRules = [];
        let ruleIdCounter = 1;

        const isExtensionOn = globalThis.bgapp.getSetting("isExtensionOn") !== "false";

        if (isExtensionOn) {
            domains.forEach(domainObj => {
            if (!domainObj.on) return;
            
            const rules = domainObj.rules || [];
            rules.forEach(ruleObj => {
                if (!ruleObj.on) return;

                if (ruleObj.type === "normalOverride") {
                    const isRegex = ruleObj.match.length > 2 && ruleObj.match.startsWith('/') && ruleObj.match.endsWith('/');
                    
                    let condition = {};
                    let action = {
                        type: "redirect"
                    };

                    if (isRegex) {
                        condition.regexFilter = ruleObj.match.substring(1, ruleObj.match.length - 1);
                        
                        // DNR regexSubstitution requires a valid string, fail fast if empty
                        if (!ruleObj.replace) {
                             return; // Skip this rule
                        }

                        // Convert $1 to \1 for DNR regexSubstitution
                        action.redirect = {
                            regexSubstitution: ruleObj.replace.replace(/\$([0-9]+)/g, '\\$1')
                        };
                    } else {
                        // Fallback to basic urlFilter if not a regex. 
                        condition.urlFilter = ruleObj.match;

                        // Chrome DNR strictly requires action.redirect.url to be a valid absolute URL 
                        // or a valid relative URL (starting with /). It cannot be empty.
                        if (!ruleObj.replace || (!ruleObj.replace.startsWith('http') && !ruleObj.replace.startsWith('/'))) {
                            return; // Skip this incomplete/invalid rule to prevent crashing the whole DNR update
                        }

                        action.redirect = {
                            url: ruleObj.replace
                        };
                    }

                    // Only apply to the specific domain match if it's not '*'
                    if (domainObj.matchUrl && domainObj.matchUrl !== "*") {
                        // Very basic conversion of tab match url to requestDomains
                        // DNR condition.initiatorDomains or requestDomains might be needed
                        // But for simplicity and broad matching, we'll omit it or set it if possible.
                        // For now, we apply it globally, but you might want to scope it.
                    }

                    // Resource types
                    condition.resourceTypes = [
                        "main_frame", "sub_frame", "stylesheet", "script", "image", 
                        "font", "object", "xmlhttprequest", "ping", "csp_report", 
                        "media", "websocket", "other"
                    ];

                    addRules.push({
                        id: ruleIdCounter++,
                        priority: 100,
                        action: action,
                        condition: condition
                    });
                } else if (ruleObj.type === "headerRule") {
                    const isRegex = ruleObj.match.length > 2 && ruleObj.match.startsWith('/') && ruleObj.match.endsWith('/');
                    
                    let condition = {};
                    if (isRegex) {
                        condition.regexFilter = ruleObj.match.substring(1, ruleObj.match.length - 1);
                    } else if (ruleObj.match === "*" || ruleObj.match === "") {
                        // DNR uses '*' to match everything, but it's better to just leave urlFilter undefined for 'match all'
                    } else {
                        condition.urlFilter = ruleObj.match;
                    }

                    condition.resourceTypes = [
                        "main_frame", "sub_frame", "stylesheet", "script", "image", 
                        "font", "object", "xmlhttprequest", "ping", "csp_report", 
                        "media", "websocket", "other"
                    ];

                    let action = {
                        type: "modifyHeaders",
                        requestHeaders: [],
                        responseHeaders: []
                    };

                    if (ruleObj.requestRules && ruleObj.requestRules.length > 0) {
                        ruleObj.requestRules.forEach(req => {
                            if (!req.header) return;
                            const headerMod = { header: req.header, operation: req.operation };
                            if (req.operation !== "remove") {
                                headerMod.value = req.value || "";
                            }
                            action.requestHeaders.push(headerMod);
                        });
                    }

                    if (ruleObj.responseRules && ruleObj.responseRules.length > 0) {
                        ruleObj.responseRules.forEach(res => {
                            if (!res.header) return;
                            const headerMod = { header: res.header, operation: res.operation };
                            if (res.operation !== "remove") {
                                headerMod.value = res.value || "";
                            }
                            action.responseHeaders.push(headerMod);
                        });
                    }

                    // Clean up empty arrays to avoid DNR validation errors
                    if (action.requestHeaders.length === 0) delete action.requestHeaders;
                    if (action.responseHeaders.length === 0) delete action.responseHeaders;

                    if (action.requestHeaders || action.responseHeaders) {
                        addRules.push({
                            id: ruleIdCounter++,
                            priority: 100,
                            action: action,
                            condition: condition
                        });
                    }
                } else if (ruleObj.type === "fileOverride") {
                    if (!ruleObj.match) return; // Skip if no match url

                    const isRegex = ruleObj.match.length > 2 && ruleObj.match.startsWith('/') && ruleObj.match.endsWith('/');
                    
                    let condition = {};
                    if (isRegex) {
                        condition.regexFilter = ruleObj.match.substring(1, ruleObj.match.length - 1);
                    } else if (ruleObj.match !== "*") {
                        condition.urlFilter = ruleObj.match;
                    }

                    condition.resourceTypes = [
                        "main_frame", "sub_frame", "stylesheet", "script", "image", 
                        "font", "object", "xmlhttprequest", "ping", "csp_report", 
                        "media", "websocket", "other"
                    ];

                    const mimeAndFile = globalThis.bgapp.extractMimeType(ruleObj.match, ruleObj.file || "");
                    
                    // Convert the file contents to a base64 encoded data URI
                    const dataUri = "data:" + mimeAndFile.mime + ";charset=UTF-8;base64," + 
                        btoa(unescape(encodeURIComponent(mimeAndFile.file)));

                    addRules.push({
                        id: ruleIdCounter++,
                        priority: 100,
                        action: {
                            type: "redirect",
                            redirect: {
                                url: dataUri
                            }
                        },
                        condition: condition
                    });
                }
            });
        });
        } // Close isExtensionOn block

        // Get existing rules to remove them
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = existingRules.map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: removeRuleIds,
            addRules: addRules
        });

        console.log(`DNR rules updated. Added ${addRules.length} rules.`);
    } catch (e) {
        console.error("Error updating DNR rules:", e);
    }
}
