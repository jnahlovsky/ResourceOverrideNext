/* global bgapp, chrome */
// Records what the rules did to real requests, for the side panel's Activity view
// (src/sidepanel/ActivityLog.vue): redirects and file overrides (webRequest
// onBeforeRedirect), the header rules that applied to a request, and file injections
// (reported by src/inject/scriptInjector.js).
// It also drives the toolbar icon's badge: how many rules did something on each tab's page.
// The log is kept in chrome.storage.session: it survives the service worker being
// stopped, and is gone when the browser closes.
import { compileRules, attributeRedirect, attributeBlock, matchHeaderRules, describeHeaderChanges, statusBucket } from '../lib/activity.js';
import { getRuleSummary, getRuleDisplayName } from '../lib/ruleLabels.js';
import { getSiteLists, siteIsEnabled } from './urlPattern.js';

const LOG_KEY = 'activityLog';
// When each tab's current page started loading, by tab id; the badge counts from there.
const PAGE_STARTS_KEY = 'badgePageStarts';
// Off while the user has paused recording in the Activity view.
const RECORDING_KEY = 'activityRecording';
// "Keep the log after the browser closes": a copy in chrome.storage.local, loaded back when
// the session's log starts empty.
const KEEP_KEY = 'activityKeep';
const KEPT_LOG_KEY = 'activityLogKept';
const MAX_ENTRIES = 1000;
const FLUSH_DELAY_MS = 400;
// Long data: URLs (file overrides) are shortened to their type.
const MAX_URL_LENGTH = 2048;

let log = [];
let isRecording = true;
let isKept = false;
let compiled = null;
let sites = getSiteLists({});
let flushTimer = null;
let nextId = Date.now();
// Redirected requests waiting for their final status, by webRequest requestId.
const pending = new Map();
let pageStarts = {};

const ready = Promise.all([
  chrome.storage.session.get([LOG_KEY, PAGE_STARTS_KEY]).then(result => {
    log = (result[LOG_KEY] || []).concat(log);
    pageStarts = { ...result[PAGE_STARTS_KEY], ...pageStarts };
  }),
  chrome.storage.local.get([RECORDING_KEY, KEEP_KEY, KEPT_LOG_KEY]).then(result => {
    isRecording = result[RECORDING_KEY] !== false;
    isKept = result[KEEP_KEY] === true;
    return result;
  })
]).then(([, settings]) => {
  // A new browser session: bring the kept log back.
  if (isKept && log.length === 0 && Array.isArray(settings[KEPT_LOG_KEY])) {
    log = settings[KEPT_LOG_KEY];
    chrome.storage.session.set({ [LOG_KEY]: log }).catch(() => {});
  }
}).catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[RECORDING_KEY]) isRecording = changes[RECORDING_KEY].newValue !== false;
  if (changes[KEEP_KEY]) {
    isKept = changes[KEEP_KEY].newValue === true;
    if (isKept) chrome.storage.local.set({ [KEPT_LOG_KEY]: log }).catch(() => {});
    else chrome.storage.local.remove(KEPT_LOG_KEY).catch(() => {});
  }
});

const flush = () => {
  flushTimer = null;
  chrome.storage.session.set({ [LOG_KEY]: log }).catch(err => console.warn('Could not save the activity log:', err));
  if (isKept) chrome.storage.local.set({ [KEPT_LOG_KEY]: log }).catch(err => console.warn('Could not keep the activity log:', err));
};

const scheduleFlush = () => {
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
};

const addEntry = (entry) => {
  entry.id = String(nextId++);
  log.push(entry);
  if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
  scheduleFlush();
  updateBadges(entry);
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

// The tabs an entry belongs to: its own, or every tab of the site for a service worker's.
const tabsOf = async (entry) => {
  if (entry.tabId >= 0) return [entry.tabId];
  if (!entry.initiator) return [];
  const tabs = await chrome.tabs.query({});
  return tabs.filter(tab => originOf(tab.url) === entry.initiator).map(tab => tab.id);
};

const notifyHud = async (entry) => {
  if (entry.type !== 'redirect') return;
  const message = { action: 'hudActivity', entry: hudSummary(entry) };
  (await tabsOf(entry)).forEach(tabId => chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {}));
};

/*
 * Toolbar badge: the number of rules that did something on the tab's current page
 * (redirected, served a file, changed headers, injected), green, or red when one of them
 * failed. The tooltip names them. It starts over when the tab loads a new page.
 */
const BADGE_OK_COLOR = '#16a34a';
const BADGE_FAILED_COLOR = '#dc2626';
const DEFAULT_TITLE = 'Resourced';
const badgeTimers = new Map();

const renderBadge = async (tabId) => {
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    return; // Closed meanwhile.
  }
  const origin = originOf(tab.url);
  const since = pageStarts[tabId] || 0;
  const rules = new Map();
  log.forEach(entry => {
    if (entry.time < since || !isForPage(entry, tabId, origin)) return;
    const rule = rules.get(entry.ruleId) || { name: entry.ruleName, failed: false };
    if (statusBucket(entry) === 'error') rule.failed = true;
    rules.set(entry.ruleId, rule);
  });
  const failed = [...rules.values()].filter(rule => rule.failed).length;
  const names = [...rules.values()].map(rule => rule.name + (rule.failed ? ' (failed)' : '')).join(', ');
  chrome.action.setBadgeText({ tabId, text: rules.size > 0 ? String(rules.size) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: failed > 0 ? BADGE_FAILED_COLOR : BADGE_OK_COLOR }).catch(() => {});
  chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' }).catch(() => {});
  chrome.action.setTitle({
    tabId,
    title: rules.size === 0 ? DEFAULT_TITLE
      : `${DEFAULT_TITLE}: ${rules.size} rule${rules.size === 1 ? '' : 's'} active on this page${failed ? `, ${failed} failing` : ''}\n${names}`
  }).catch(() => {});
};

// Requests come in bursts; one update per tab is enough.
const scheduleBadge = (tabId) => {
  if (badgeTimers.has(tabId)) return;
  badgeTimers.set(tabId, setTimeout(() => {
    badgeTimers.delete(tabId);
    renderBadge(tabId);
  }, 150));
};

const updateBadges = async (entry) => {
  (await tabsOf(entry)).forEach(scheduleBadge);
};

const clearBadges = async (title = DEFAULT_TITLE) => {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId: tab.id, title }).catch(() => {});
  });
};

// A new page in a tab starts its count over.
chrome.webRequest.onBeforeRequest.addListener((details) => {
  if (details.tabId < 0) return;
  ready.then(() => {
    pageStarts[details.tabId] = details.timeStamp;
    chrome.storage.session.set({ [PAGE_STARTS_KEY]: pageStarts }).catch(() => {});
    renderBadge(details.tabId);
  });
}, { urls: ['<all_urls>'], types: ['main_frame'] });

chrome.tabs.onRemoved.addListener((tabId) => {
  ready.then(() => {
    delete pageStarts[tabId];
    chrome.storage.session.set({ [PAGE_STARTS_KEY]: pageStarts }).catch(() => {});
  });
});

// Pausing every rule clears the badges; the title matches src/extension/action.js.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.isExtensionOn) return;
  clearBadges(changes.isExtensionOn.newValue === 'false' ? `${DEFAULT_TITLE} (paused)` : DEFAULT_TITLE);
});

const shortUrl = (url) => (url && url.length > MAX_URL_LENGTH ? url.slice(0, MAX_URL_LENGTH) + '…' : url);

// The switched-on rules Chrome accepted. Set by updateDNRRules; after the service worker
// was stopped it's read from storage again.
export function setActivityRules(rules, siteLists) {
  compiled = compileRules(rules);
  sites = siteLists || getSiteLists({});
}

const getCompiledRules = async () => {
  if (compiled) return compiled;
  const [domains, settings] = await Promise.all([
    bgapp.mainStorage.getAll(),
    chrome.storage.local.get(['isExtensionOn', 'ruleErrors', 'siteAllowlist', 'siteBlocklist'])
  ]);
  sites = getSiteLists(settings);
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

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
};

// Settings → Sites: the page a request belongs to is its initiator, or itself for a page load.
const isOnEnabledSite = (details) =>
  siteIsEnabled(sites, details.type === 'main_frame' ? hostOf(details.url) : hostOf(details.initiator));

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
    // A failure turns the badge red.
    updateBadges(entry);
  }

  if (!isRecording) return;
  // Chrome cancels blocked requests without a redirect; this one's own rule, if any.
  if (error === 'net::ERR_BLOCKED_BY_CLIENT' && isOnEnabledSite(details)) {
    const blocker = attributeBlock(await getCompiledRules(), details.url);
    if (blocker) {
      const record = baseEntry(details, 'block', blocker);
      record.blocked = true;
      addEntry(record);
      return;
    }
  }
  const headerRules = matchHeaderRules(await getCompiledRules(), details.url);
  if (headerRules.length > 0 && !isOnEnabledSite(details)) return;
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

// Called by src/extension/fileInjection.js for every injection it ran (or that failed).
export async function recordInjection(rule, sender, error) {
  await ready;
  if (!isRecording) return;
  const entry = baseEntry({ tabId: sender.tab?.id ?? -1, url: sender.url, method: '', type: 'main_frame' }, 'inject', {
    rule,
    name: getRuleDisplayName(rule)
  });
  entry.resourceType = (rule.fileType || 'js') === 'css' ? 'stylesheet' : 'script';
  entry.initiator = originOf(sender.url);
  entry.detail = getRuleSummary(rule);
  if (error) entry.error = error;
  addEntry(entry);
}

// Reported by the page's mock script (src/inject/mockShim.js, through mockBridge.js) for
// every fetch / XHR call a mock rule answered; there's no network request to observe.
const recordMock = async (request, sender) => {
  await ready;
  if (!isRecording) return;
  const ruleEntry = (await getCompiledRules()).find(e => e.rule.id === request.ruleId && e.rule.type === 'mockRule');
  if (!ruleEntry) return;
  const entry = baseEntry({
    tabId: sender.tab?.id ?? -1,
    url: String(request.url || ''),
    method: String(request.method || 'GET').toUpperCase(),
    type: 'xmlhttprequest',
    initiator: originOf(sender.url),
    timeStamp: Date.now()
  }, 'mock', ruleEntry);
  entry.duration = Math.max(0, Number(request.delay) || 0);
  if (ruleEntry.rule.mockMode === 'delay') {
    entry.detail = `real response, delayed ${entry.duration} ms`;
    entry.status = Number(request.status) || null;
    if (request.error) entry.error = String(request.error);
  } else {
    entry.mocked = true;
    entry.status = Number(request.status) || 200;
    entry.detail = `mocked ${ruleEntry.rule.contentType || 'response'}`;
  }
  addEntry(entry);
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'mockUsed' && sender.tab) {
    recordMock(request, sender);
  } else if (request.action === 'hudGetActivity') {
    ready.then(() => {
      const tabId = sender.tab?.id;
      const origin = originOf(sender.tab?.url);
      sendResponse(log.filter(entry => entry.type === 'redirect' && isForPage(entry, tabId, origin)).map(hudSummary));
    });
    return true; // async
  } else if (request.action === 'hudGetRuleActivity') {
    // The HUD's log for one redirect: its requests on the asking page, newest last.
    ready.then(() => {
      const tabId = sender.tab?.id;
      const origin = originOf(sender.tab?.url);
      const since = Number(request.since) || 0;
      sendResponse(log
        .filter(entry => entry.ruleId === request.ruleId && entry.time >= since && isForPage(entry, tabId, origin))
        .slice(-200));
    });
    return true; // async
  } else if (request.action === 'activityClear') {
    log = [];
    pending.clear();
    flush();
    clearBadges();
    sendResponse();
  }
});
