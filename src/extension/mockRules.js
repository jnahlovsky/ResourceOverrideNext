/* global bgapp, chrome */
// Mock rules: the page's bridge (src/inject/mockBridge.js) asks here which mocks apply to
// its frame, and passes them to the page's mock script (src/inject/mockShim.js).
import { getSiteLists } from './urlPattern.js';
import { selectMocks } from '../lib/mocks.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'getMocks' || !sender.tab) return;
  Promise.all([bgapp.mainStorage.getAll(), chrome.storage.local.get(['isExtensionOn', 'siteAllowlist', 'siteBlocklist'])])
    .then(([domains, settings]) => {
      sendResponse(settings.isExtensionOn === 'false' ? [] : selectMocks(domains, sender.url, getSiteLists(settings)));
    })
    .catch(() => sendResponse([]));
  return true; // async
});
