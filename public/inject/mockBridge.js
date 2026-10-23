/* global chrome */
// The extension's side of mock responses: gets the mocks for this frame from the background
// (src/extension/mockRules.js) and hands them to the page's mock script
// (src/inject/mockShim.js), which can't use extension APIs; reports the mocks it used.
// No imports: crxjs keeps this a plain document_start script.
(function() {
    "use strict";

    var CONFIG_EVENT = "resourced:mocks";
    var REQUEST_EVENT = "resourced:mocks-request";
    var USED_EVENT = "resourced:mock-used";

    var config = null;
    var ruleIds = {};

    var deliver = function() {
        if (config !== null) document.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: config }));
    };

    // The page script may start before or after this one; it asks when it's ready.
    document.addEventListener(REQUEST_EVENT, deliver);

    chrome.runtime.sendMessage({ action: "getMocks" }).then(function(mocks) {
        (mocks || []).forEach(function(mock) {
            ruleIds[mock.id] = true;
        });
        config = JSON.stringify(mocks || []);
        deliver();
    }).catch(function() {
        config = "[]";
        deliver();
    });

    // Page scripts can fire this event too; only reports for this frame's mocks count.
    document.addEventListener(USED_EVENT, function(event) {
        var used;
        try {
            used = JSON.parse(event.detail);
        } catch (e) {
            return;
        }
        if (!used || !ruleIds[used.ruleId]) return;
        chrome.runtime.sendMessage({
            action: "mockUsed",
            ruleId: used.ruleId,
            url: used.url,
            method: used.method,
            status: used.status,
            delay: used.delay,
            error: used.error
        }).catch(function() {});
    });
})();
