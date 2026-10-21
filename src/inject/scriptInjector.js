/* global chrome */
// File injections: asks the background which ones apply to this frame and, at each one's
// timing, has it run them (src/extension/fileInjection.js). The injecting itself happens
// there: in Manifest V3 a <script> added from a content script is blocked by the
// extension's own CSP. No imports, so crxjs keeps this a plain document_start script.
(function() {
    "use strict";

    var whenReady = {
        start: function(run) {
            run();
        },
        ready: function(run) {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", run, { once: true });
            } else {
                run();
            }
        },
        loaded: function(run) {
            if (document.readyState === "complete") {
                run();
            } else {
                window.addEventListener("load", run, { once: true });
            }
        }
    };

    // One at a time, so injections with the same timing run in the rules' order.
    var queue = Promise.resolve();
    var inject = function(ruleId) {
        queue = queue.then(function() {
            return chrome.runtime.sendMessage({ action: "injectFile", ruleId: ruleId });
        }).catch(function() {});
    };

    chrome.runtime.sendMessage({ action: "getInjections" }).then(function(injections) {
        (injections || []).forEach(function(injection) {
            (whenReady[injection.timing] || whenReady.start)(function() {
                inject(injection.id);
            });
        });
    }).catch(function() {});
})();
