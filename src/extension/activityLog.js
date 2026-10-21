/* global bgapp, chrome */
// Records what the rules did to real requests, for the side panel's Activity view
// (src/sidepanel/ActivityLog.vue): redirects and file overrides (webRequest
// onBeforeRedirect), the header rules that applied to a request, and file injections
// (reported by src/inject/scriptInjector.js).
// The log is kept in chrome.storage.session: it survives the service worker being
// stopped, and is gone when the browser closes.
import { compileRules, attributeRedirect, matchHeaderRules, describeHeaderChanges, statusBucket } from '../lib/activity.js';
import { getRuleSummary } from '../lib/ruleLabels.js';

const LOG_KEY = 'activityLog';
// Off while the user has paused recording in the Activity view.
const RECORDING_KEY = 'activityRecording';
const MAX_ENTRIES = 1000;
const FLUSH_DELAY_MS = 400;
// Long data: URLs (file overrides) are shortened to their type.
const MAX_URL_LENGTH = 2048;

let log = [];
let isRecording = true;
let compiled = null;
let flushTimer = null;
let nextId = Date.now();
// Redirected requests waiting for their final status, by webRequest requestId.
const pending = new Map();

const ready = Promise.all([
  chrome.storage.session.get(LOG_KEY).then(result => {
    log = (result[LOG_KEY] || []).concat(log);
  }),
  chrome.storage.local.get(RECORDING_KEY).then(result => {
    isRecording = result[RECORDING_KEY] !== false;
  })
]).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[RECORDING_KEY]) isRecording = changes[RECORDING_KEY].newValue !== false;
});

const flush = () => {
  flushTimer = null;
  chrome.storage.session.set({ [LOG_KEY]: log }).catch(err => console.warn('Could not save the activity log:', err));
};

const scheduleFlush = () => {
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
};

const addEntry = (entry) => {
  entry.id = String(nextId++);
  log.push(entry);
  if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
  scheduleFlush();
  return entry;
};

// The page HUD (src/inject/hud.js) counts what each redirect did on its page: it's told
// about every redirect in its tab, and asks for the earlier ones when it starts.
const hudSummary = (entry) => ({ id: entry.id, ruleId: entry.ruleId, time: entry.time, failed: statusBucket(entry) === 'error' });

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch (e) {
    return '';
  }
};

// Requests a site's service worker makes belong to no tab (tabId -1); they count for every
// tab showing that site.
const isForPage = (entry, tabId, origin) =>
  entry.tabId === tabId || (entry.tabId < 0 && !!entry.initiator && entry.initiator === origin);

const notifyHud = async (entry) => {
  if (entry.type !== 'redirect') return;
  const message = { action: 'hudActivity', entry: hudSummary(entry) };
  let tabIds = [entry.tabId];
  if (!(entry.tabId >= 0)) {
    if (!entry.initiator) return;
    const tabs = await chrome.tabs.query({});
    tabIds = tabs.filter(tab => originOf(tab.url) === entry.initiator).map(tab => tab.id);
  }
  tabIds.forEach(tabId => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {}));
};

const shortUrl = (url) => (url && url.length > MAX_URL_LENGTH ? url.slice(0, MAX_URL_LENGTH) + '…' : url);

// The switched-on rules Chrome accepted. Set by updateDNRRules; after the service worker
// was stopped it's read from storage again.
export function setActivityRules(rules) {
  compiled = compileRules(rules);
}

const getCompiledRules = async () => {
  if (compiled) return compiled;
  const [domains, settings] = await Promise.all([
    bgapp.mainStorage.getAll(),
    chrome.storage.local.get(['isExtensionOn', 'ruleErrors'])
  ]);
  if (settings.isExtensionOn === 'false') {
    compiled = [];
  } else {
    const rejected = settings.ruleErrors || {};
    compiled = compileRules((domains || [])
      .filter(domain => domain.on)
      .flatMap(domain => domain.rules || [])
      .filter(rule => !rejected[rule.id]));
  }
  return compiled;
};

const baseEntry = (details, type, ruleEntry) => ({
  type,
  time: details.timeStamp || Date.now(),
  tabId: details.tabId,
  ruleId: ruleEntry.rule.id,
  ruleName: ruleEntry.name,
  rulePattern: getRuleSummary(ruleEntry.rule),
  method: details.method,
  resourceType: details.type,
  url: shortUrl(details.url),
  initiator: details.initiator || ''
});

chrome.webRequest.onBeforeRedirect.addListener(async (details) => {
  await ready;
  if (!isRecording) return;
  const match = attributeRedirect(await getCompiledRules(), details.url, details.redirectUrl);
  if (!match) return;
  const entry = baseEntry(details, match.type, match.entry);
  entry.redirectUrl = match.type === 'file'
    ? details.redirectUrl.slice(0, details.redirectUrl.indexOf(';') > 0 ? details.redirectUrl.indexOf(';') : 40)
    : shortUrl(details.redirectUrl);
  if (match.type === 'file') {
    // webRequest doesn't report data: URLs, so there's no completion to wait for.
    entry.inline = true;
    addEntry(entry);
    return;
  }
  entry.status = null;
  pending.set(details.requestId, addEntry(entry));
  notifyHud(entry);
}, { urls: ['<all_urls>'] });

const finish = async (details, error) => {
  await ready;
  const entry = pending.get(details.requestId);
  if (entry) {
    pending.delete(details.requestId);
    entry.duration = Math.max(0, Math.round((details.timeStamp || Date.now()) - entry.time));
    if (error) {
      entry.error = error;
    } else {
      entry.status = details.statusCode;
      entry.fromCache = !!details.fromCache;
      if (details.ip) entry.ip = details.ip;
      // The final URL, when the destination redirected again.
      if (details.url !== entry.redirectUrl && !entry.redirectUrl.startsWith('data:')) entry.finalUrl = shortUrl(details.url);
    }
    scheduleFlush();
    notifyHud(entry);
  }

  if (!isRecording) return;
  const headerRules = matchHeaderRules(await getCompiledRules(), details.url);
  headerRules.forEach(ruleEntry => {
    const record = baseEntry(details, 'headers', ruleEntry);
    record.headers = describeHeaderChanges(ruleEntry.rule);
    if (error) record.error = error;
    else record.status = details.statusCode;
    addEntry(record);
  });
};

chrome.webRequest.onCompleted.addListener(details => finish(details, null), { urls: ['<all_urls>'] });
chrome.webRequest.onErrorOccurred.addListener(details => finish(details, details.error), { urls: ['<all_urls>'] });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'activityInject') {
    ready.then(async () => {
      if (!isRecording) return;
      const ruleEntry = (await getCompiledRules()).find(e => e.rule.id === request.ruleId);
      if (!ruleEntry) return;
      const entry = baseEntry({ tabId: sender.tab?.id ?? -1, url: request.url, method: '', type: 'main_frame' }, 'inject', ruleEntry);
      entry.resourceType = (ruleEntry.rule.fileType || 'js') === 'css' ? 'stylesheet' : 'script';
      entry.detail = getRuleSummary(ruleEntry.rule);
      addEntry(entry);
    });
  } else if (request.action === 'hudGetActivity') {
    ready.then(() => {
      const tabId = sender.tab?.id;
      const origin = originOf(sender.tab?.url);
      sendResponse(log.filter(entry => entry.type === 'redirect' && isForPage(entry, tabId, origin)).map(hudSummary));
    });
    return true; // async
  } else if (request.action === 'activityClear') {
    log = [];
    pending.clear();
    flush();
    sendResponse();
  }
});
