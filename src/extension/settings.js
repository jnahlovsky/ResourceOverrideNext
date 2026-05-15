/* global bgapp, chrome */
{
    bgapp.settings = {
        devTools: "true",
        showSuggestions: "true",
        showLogs: "false"
    };

    chrome.storage.local.get(["devTools", "showSuggestions", "showLogs"], function(result) {
        if (result.devTools !== undefined) bgapp.settings.devTools = result.devTools;
        if (result.showSuggestions !== undefined) bgapp.settings.showSuggestions = result.showSuggestions;
        if (result.showLogs !== undefined) bgapp.settings.showLogs = result.showLogs;
    });

    bgapp.getSetting = function(setting) {
        return bgapp.settings[setting];
    };

    bgapp.setSetting = function(setting, value) {
        bgapp.settings[setting] = value;
        const obj = {};
        obj[setting] = value;
        chrome.storage.local.set(obj);
    };
}
