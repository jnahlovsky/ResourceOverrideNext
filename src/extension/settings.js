/* global bgapp, chrome */
{
    bgapp.settings = {
        isExtensionOn: "true"
    };

    chrome.storage.local.get(["isExtensionOn"], function(result) {
        if (result.isExtensionOn !== undefined) bgapp.settings.isExtensionOn = result.isExtensionOn;
    });

    bgapp.getSetting = function(setting) {
        return bgapp.settings[setting];
    };

    bgapp.setSetting = function(setting, value) {
        bgapp.settings[setting] = value;
        const obj = {};
        obj[setting] = value;
        chrome.storage.local.set(obj);

        if (setting === "isExtensionOn" && typeof bgapp.updateActionState === "function") {
            bgapp.updateActionState(value !== "false");
        }
    };
}
