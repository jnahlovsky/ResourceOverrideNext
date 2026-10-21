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
import './activityLog.js';
import { connectDevReload } from './devReload.js';

globalThis.bgapp.updateDNRRules = updateDNRRules;

// `npm run watch` only; null in other builds.
if (__DEV_RELOAD__) connectDevReload(__DEV_RELOAD__);

// Chrome doesn't run content scripts in tabs that were already open when the extension
// is installed, updated or reloaded. Those tabs would have no HUD, or an old one cut off
// from the extension that ignores Settings (e.g. "Reset to top center").
const reinjectHud = async () => {
    const hudScript = chrome.runtime.getManifest().content_scripts
        ?.flatMap(script => script.js || [])
        .find(file => file.includes('hud'));
    if (!hudScript) return;
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    tabs.forEach(tab => {
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [hudScript] }).catch(() => {});
    });
};

chrome.runtime.onInstalled.addListener(({ reason }) => {
    console.log("Resource Override MV3 Service Worker installed.");
    updateDNRRules();
    if (reason === 'install' || reason === 'update') reinjectHud();

    chrome.contextMenus.create({
        id: "open_in_tab",
        title: "Open Resource Override in New Tab",
        contexts: ["action"]
    });
});

// Keeps the rules and the page HUD's list in sync after a browser restart.
chrome.runtime.onStartup.addListener(() => {
    updateDNRRules();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open_in_tab") {
        chrome.tabs.create({ url: chrome.runtime.getURL("index.html?tab=true") });
    }
});