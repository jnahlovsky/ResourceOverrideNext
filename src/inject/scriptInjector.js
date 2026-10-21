(function() {
    "use strict";

    // Same rules as hostPassesDomainFilters in src/extension/urlPattern.js. Inlined because
    // an import makes crxjs load this script asynchronously, delaying document_start injection.
    var parseDomainList = function(value) {
        return String(value || "").split(/[\s,;]+/).map(function(entry) {
            return entry.trim().toLowerCase()
                .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                .replace(/[\/?#].*$/, "")
                .replace(/:\d+$/, "")
                .replace(/^\*\./, "")
                .replace(/\.$/, "");
        }).filter(Boolean);
    };

    var hostPassesDomainFilters = function(rule, host) {
        if (!rule.domainFiltersOn) return true;
        var matches = function(domain) {
            return host === domain || host.endsWith("." + domain);
        };
        var include = parseDomainList(rule.includeDomains);
        if (parseDomainList(rule.excludeDomains).some(matches)) return false;
        return include.length === 0 || include.some(matches);
    };

    var fileTypeToTag = {
        js: "script",
        css: "style"
    };

    var processDomain = function(domain) {
        var rules = domain.rules || [];
        rules.forEach(function(rule) {
            if (rule.on && rule.type === "fileInject" && hostPassesDomainFilters(rule, location.hostname)) {
                var newEl = document.createElement(fileTypeToTag[rule.fileType] || "script");
                
                if (rule.fileName) {
                    newEl.setAttribute("id", "resourced-inject-" + rule.fileName.replace(/[^a-zA-Z0-9_-]/g, ''));
                }

                if (rule.fileType === "js" && rule.fileName) {
                    // Inject JS via a blob URL if a filename is provided (acts as external script)
                    // The filename is used to uniquely identify the injection
                    const blob = new Blob([rule.file], { type: 'application/javascript' });
                    newEl.src = URL.createObjectURL(blob);
                    
                    newEl.onload = function() {
                        URL.revokeObjectURL(newEl.src);
                    };
                } else {
                    // Default inline injection (how it worked before). 
                    // Note: Chrome Extensions page will occasionally log a CSP warning for this, 
                    // but it often still works depending on the target site's strictness.
                    newEl.appendChild(document.createTextNode(rule.file));
                }

                if (rule.injectLocation === "head") {
                    var firstEl = document.head.children[0];
                    if (firstEl) {
                        document.head.insertBefore(newEl, firstEl);
                    } else {
                        document.head.appendChild(newEl);
                    }
                } else {
                    if (document.body) {
                        document.body.appendChild(newEl);
                    } else {
                        document.addEventListener("DOMContentLoaded", function() {
                            document.body.appendChild(newEl);
                        });
                    }
                }
            }
        });
    };

    chrome.runtime.sendMessage({action: "getDomains"}, function(domains) {
        domains = domains || [];
        domains.forEach(function(domain) {
            if (domain.on) {
                chrome.runtime.sendMessage({
                    action: "match",
                    domainUrl: domain.matchUrl,
                    windowUrl: location.href
                }, function(result) {
                    if (result) {
                        processDomain(domain);
                    }
                });
            }
        });
    });

    chrome.runtime.onMessage.addListener(function(msg) {
        if (msg.action === 'log') {
            var logStyle = "color: #007182; font-weight: bold;";
            if (msg.important) {
                logStyle += "background: #AAFFFF;";
            }
            console.log("%c[Resource Override] " + msg.message, logStyle);
        }
    });
})();
