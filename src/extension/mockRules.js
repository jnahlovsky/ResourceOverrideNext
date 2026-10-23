/* global bgapp, chrome */
// Mock rules. Their page scripts (public/inject/mockShim.js in the page's own world, and
// mockBridge.js on the extension's side) are registered with Chrome only while the
// extension is on and a mock rule is switched on: they wrap the page's fetch() and
// XMLHttpRequest, which every page shouldn't pay for (and DevTools would show them as the
// initiator of every request). The bridge asks here which mocks apply to its frame.
import { getSiteLists, buildUrlMatch } from './urlPattern.js';
import { selectMocks } from '../lib/mocks.js';

const SCRIPTS = [
  { id: 'resourced-mock-shim', js: ['inject/mockShim.js'], matches: ['*://*/*'], runAt: 'document_start', allFrames: true, world: 'MAIN' },
  { id: 'resourced-mock-bridge', js: ['inject/mockBridge.js'], matches: ['*://*/*'], runAt: 'document_start', allFrames: true }
];
const IDS = SCRIPTS.map(script => script.id);

const hasActiveMocks = (domains) => (domains || []).some(domain => domain.on && (domain.rules || [])
  .some(rule => rule.on && rule.type === 'mockRule' && buildUrlMatch(rule)));

// Rule updates can overlap; registering twice would fail, so they queue up.
let queue = Promise.resolve();

/** Registers or removes the mock scripts to match the rules (called by updateDNRRules). */
export function syncMockScripts(domains, isExtensionOn) {
  const wanted = isExtensionOn && hasActiveMocks(domains);
  queue = queue.then(async () => {
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: IDS });
    if (wanted && registered.length === IDS.length) return;
    if (!wanted && registered.length === 0) return;
    if (registered.length > 0) await chrome.scripting.unregisterContentScripts({ ids: registered.map(script => script.id) });
    if (wanted) await chrome.scripting.registerContentScripts(SCRIPTS);
  }).catch(err => console.warn('Could not update the mock scripts:', err));
  return queue;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'getMocks' || !sender.tab) return;
  Promise.all([bgapp.mainStorage.getAll(), chrome.storage.local.get(['isExtensionOn', 'siteAllowlist', 'siteBlocklist'])])
    .then(([domains, settings]) => {
      sendResponse(settings.isExtensionOn === 'false' ? [] : selectMocks(domains, sender.url, getSiteLists(settings)));
    })
    .catch(() => sendResponse([]));
  return true; // async
});
