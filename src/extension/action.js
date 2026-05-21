/* global bgapp, chrome */
{
    // Set initial title based on state on load (Background worker still needs to handle initial badge)
    chrome.storage.local.get(["isExtensionOn"], function(result) {
        const isOn = result.isExtensionOn !== "false";
        chrome.action.setTitle({
            title: isOn ? "Resource Override (ON)" : "Resource Override (OFF)"
        });
        chrome.action.setBadgeText({ text: isOn ? "" : "OFF" });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    });
}
