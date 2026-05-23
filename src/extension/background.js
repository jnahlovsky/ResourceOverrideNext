import './init.js';
import './util.js';
import './keyvalDB.js';
import './mainStorage.js';
import './settings.js';
import './match.js';
import './extractMime.js';
import './messageListener.js';
import './action.js';
import { updateDNRRules } from './netRequestRules.js';

globalThis.bgapp.updateDNRRules = updateDNRRules;

chrome.runtime.onInstalled.addListener(() => {
    console.log("Resource Override MV3 Service Worker installed.");
    updateDNRRules();

    chrome.contextMenus.create({
        id: "open_in_tab",
        title: "Open Resource Override in New Tab",
        contexts: ["action"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open_in_tab") {
        chrome.tabs.create({ url: chrome.runtime.getURL("index.html?tab=true") });
    }
});