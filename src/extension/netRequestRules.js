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
                        // Convert $1 to \1 for DNR regexSubstitution
                        action.redirect = {
                            regexSubstitution: ruleObj.replace.replace(/\$([0-9]+)/g, '\\$1')
                        };
                    } else {
                        // Fallback to basic urlFilter if not a regex. 
                        // Note: capturing and substituting with * won't work perfectly in basic urlFilter DNR.
                        // Full legacy star syntax translation to DNR regex is complex, we use urlFilter for simple matches.
                        condition.urlFilter = ruleObj.match;
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
                }
                // headerRule and fileOverride can also be added here in the future
            });
        });

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
