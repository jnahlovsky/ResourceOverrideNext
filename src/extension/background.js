import './init.js';
import './keyvalDB.js';
import './mainStorage.js';
import { updateDNRRules } from './netRequestRules.js';

chrome.runtime.onInstalled.addListener(() => {
    console.log("Resource Override MV3 Service Worker installed.");
    updateDNRRules();
});