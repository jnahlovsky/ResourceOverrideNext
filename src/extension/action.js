/* global bgapp, chrome */
{
    bgapp.updateActionState = function(isOn) {
        chrome.action.setTitle({
            title: isOn ? "Resource Override (ON)" : "Resource Override (OFF)"
        });
        chrome.action.setBadgeText({ text: "" });
        chrome.action.setIcon({
            path: isOn ? {
                "16": "icons/icon-16x16.png",
                "48": "icons/icon-48x48.png",
                "128": "icons/icon-128x128.png"
            } : {
                "16": "icons/icon-disabled-16x16.png",
                "48": "icons/icon-disabled-48x48.png",
                "128": "icons/icon-disabled-128x128.png"
            }
        });
    };

    // Set initial title based on state on load (Background worker still needs to handle initial badge)
    chrome.storage.local.get(["isExtensionOn"], function(result) {
        const isOn = result.isExtensionOn !== "false";
        bgapp.updateActionState(isOn);
    });
}

