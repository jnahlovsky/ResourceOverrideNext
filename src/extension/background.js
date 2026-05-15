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

chrome.runtime.onInstalled.addListener(() => {
    console.log("Resource Override MV3 Service Worker installed.");
    updateDNRRules();
});