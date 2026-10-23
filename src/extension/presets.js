/* global bgapp, chrome */
// Team presets: a rules file at a URL (any format Import understands), loaded into the rule
// list and refreshed every hour, so a team can share and update rules in one place.
// Settings → Team presets adds, refreshes and removes them.
import { importRulesFrom } from '../lib/importers.js';
import { mergePresetRules, presetName } from '../lib/presets.js';

export const PRESETS_KEY = 'rulePresets'; // [{ url, name, ruleCount, skipped, updatedAt, error }]
const ALARM = 'refresh-presets';
const REFRESH_MINUTES = 60;

const readPresets = async () => (await chrome.storage.local.get(PRESETS_KEY))[PRESETS_KEY] || [];
const writePresets = (presets) => chrome.storage.local.set({ [PRESETS_KEY]: presets });

const updatePreset = async (url, fields) => {
  const presets = await readPresets();
  await writePresets(presets.map(preset => (preset.url === url ? { ...preset, ...fields } : preset)));
};

// The list shown in the editor: the domain matching every page.
const ruleListOf = (domains) => domains.find(domain => domain.matchUrl === '*') || { id: `d${Date.now()}`, matchUrl: '*', on: true, rules: [] };

const fetchPreset = async (url) => {
  let response;
  try {
    response = await fetch(url, { cache: 'no-cache', credentials: 'omit' });
  } catch (err) {
    throw new Error(`Couldn't load it (${err.message}).`);
  }
  if (!response.ok) throw new Error(`The server answered ${response.status}.`);
  let data;
  try {
    data = JSON.parse(await response.text());
  } catch (err) {
    throw new Error("It isn't valid JSON.");
  }
  return importRulesFrom(data);
};

const refreshPreset = async (url) => {
  try {
    const result = await fetchPreset(url);
    const domains = await bgapp.mainStorage.getAll();
    const list = ruleListOf(domains);
    list.rules = mergePresetRules(list.rules || [], url, result.rules);
    await bgapp.mainStorage.put(list);
    await updatePreset(url, { ruleCount: result.rules.length, skipped: result.skipped.length, source: result.source, updatedAt: Date.now(), error: '' });
    bgapp.notifyRulesChanged();
    return { ok: true, ruleCount: result.rules.length };
  } catch (err) {
    await updatePreset(url, { error: err.message, checkedAt: Date.now() });
    return { error: err.message };
  }
};

const refreshAll = async () => {
  for (const preset of await readPresets()) await refreshPreset(preset.url);
};

const ensureAlarm = async () => {
  const presets = await readPresets();
  if (presets.length === 0) {
    await chrome.alarms.clear(ALARM);
  } else if (!(await chrome.alarms.get(ALARM))) {
    await chrome.alarms.create(ALARM, { periodInMinutes: REFRESH_MINUTES });
  }
};

const addPreset = async (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { error: "That isn't a URL." };
  }
  if (!/^https?:$/.test(parsed.protocol)) return { error: 'Use an http:// or https:// URL.' };
  const presets = await readPresets();
  if (!presets.some(preset => preset.url === parsed.href)) {
    await writePresets([...presets, { url: parsed.href, name: presetName(parsed.href), ruleCount: 0, updatedAt: 0, error: '' }]);
  }
  await ensureAlarm();
  return refreshPreset(parsed.href);
};

const removePreset = async (url) => {
  await writePresets((await readPresets()).filter(preset => preset.url !== url));
  const domains = await bgapp.mainStorage.getAll();
  const list = ruleListOf(domains);
  if ((list.rules || []).some(rule => rule.presetUrl === url)) {
    list.rules = list.rules.filter(rule => rule.presetUrl !== url);
    await bgapp.mainStorage.put(list);
    bgapp.notifyRulesChanged();
  }
  await ensureAlarm();
  return { ok: true };
};

// Synced from another computer (sync.js): fetch the presets this one doesn't have yet.
export async function setPresetUrls(urls) {
  const presets = await readPresets();
  const missing = urls.filter(url => !presets.some(preset => preset.url === url));
  for (const url of missing) await addPreset(url);
}

export async function getPresetUrls() {
  return (await readPresets()).map(preset => preset.url);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) refreshAll();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'presetAdd') {
    addPreset(String(request.url || '').trim()).then(sendResponse);
    return true;
  }
  if (request.action === 'presetRefresh') {
    (request.url ? refreshPreset(request.url) : refreshAll().then(() => ({ ok: true }))).then(sendResponse);
    return true;
  }
  if (request.action === 'presetRemove') {
    removePreset(request.url).then(sendResponse);
    return true;
  }
});

ensureAlarm().catch(() => {});
