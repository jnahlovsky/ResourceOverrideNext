/* global bgapp, chrome */
// File injections (fileInject rules). The content script src/inject/scriptInjector.js asks
// which ones apply to its frame and, at each one's timing, asks for it to be run.
// They run from here because in Manifest V3 a <script> added by a content script is
// blocked by the extension's own CSP: JS runs in the page's own world instead (like a
// script the page added itself, so only the page's CSP applies), CSS goes in with
// insertCSS, which no CSP blocks.
import { getSiteLists } from './urlPattern.js';
import { selectInjections } from '../lib/injections.js';
import { recordInjection } from './activityLog.js';

// Runs in the page. Adds the code as a <script> and reports whether it ran: an inline
// script runs right when it's added, unless the page's CSP blocks it.
function runInPage(code, fileName, location) {
  const script = document.createElement('script');
  if (fileName) script.id = 'resourced-inject-' + fileName.replace(/[^a-zA-Z0-9_-]/g, '');
  script.textContent = 'document.currentScript.dataset.resourcedRan = "1";\n' + code +
    // Lists it under its file name in DevTools → Sources.
    (fileName ? '\n//# sourceURL=resourced://' + fileName.replace(/[^\w.\-/]/g, '_') : '');
  if (location === 'body' && document.body) {
    document.body.appendChild(script);
  } else {
    const parent = document.head || document.documentElement;
    parent.insertBefore(script, parent.firstChild);
  }
  return script.dataset.resourcedRan === '1';
}

const findRuleIn = (domains, ruleId) => {
  for (const domain of domains || []) {
    const rule = (domain.rules || []).find(r => r.id === ruleId);
    if (rule) return rule;
  }
  return null;
};

const findRule = async (ruleId) => findRuleIn(await bgapp.mainStorage.getAll(), ruleId);

const inject = async (rule, sender) => {
  if (!rule || !rule.on || rule.type !== 'fileInject' || !rule.file) return;
  const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
  let error = '';
  try {
    if (rule.fileType === 'css') {
      await chrome.scripting.insertCSS({ target, css: rule.file, origin: 'AUTHOR' });
    } else {
      const [result] = await chrome.scripting.executeScript({
        target,
        world: 'MAIN',
        injectImmediately: true,
        func: runInPage,
        args: [rule.file, rule.fileName || '', rule.injectLocation || 'head']
      });
      if (!result?.result) error = "Blocked by the page's Content Security Policy";
    }
  } catch (err) {
    error = err.message || String(err);
  }
  if (error) console.warn(`Injection "${rule.fileName || rule.id}" failed on ${sender.url}:`, error);
  recordInjection(rule, sender, error);
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getInjections') {
    if (!sender.tab) return;
    Promise.all([bgapp.mainStorage.getAll(), chrome.storage.local.get(['isExtensionOn', 'siteAllowlist', 'siteBlocklist'])])
      .then(async ([domains, settings]) => {
        const injections = settings.isExtensionOn === 'false' ? [] : selectInjections(domains, sender.url, getSiteLists(settings));
        // "Page start" ones run right away, without another round trip to the page; the
        // content script waits for the others.
        for (const injection of injections.filter(i => i.timing === 'start')) {
          await inject(findRuleIn(domains, injection.id), sender);
        }
        sendResponse(injections.filter(i => i.timing !== 'start'));
      })
      .catch(() => sendResponse([]));
    return true; // async
  }
  if (request.action === 'injectFile' && sender.tab) {
    findRule(request.ruleId).then(rule => inject(rule, sender)).finally(() => sendResponse());
    return true; // async
  }
});
