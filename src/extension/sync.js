/* global bgapp, chrome */
// Sync across computers: the rules (without preset rules, which each computer loads from
// their URL) and the preset URLs, in chrome.storage.sync, split into chunks to fit its
// limits. Changes are sent a moment after an edit; changes from another computer are
// applied here, after a backup. Settings → Sync turns it on and shows its state.
import { splitForSync, syncBytes, contentHash, SYNC_TOTAL_BYTES } from '../lib/syncChunks.js';
import { getPresetUrls, setPresetUrls } from './presets.js';

const ENABLED_KEY = 'syncEnabled';
export const SYNC_STATE_KEY = 'syncState'; // { lastSyncedAt, direction, bytes, error, appliedAt, hash }
const DEVICE_KEY = 'syncDeviceId';
const META_KEY = 'rules.meta';
const chunkKey = (index) => `rules.${index}`;
const PUSH_DELAY_MS = 2000;

let enabled = false;
let applying = false;
let pushTimer = null;

const ready = chrome.storage.local.get(ENABLED_KEY).then(result => {
  enabled = result[ENABLED_KEY] === true;
}).catch(() => {});

const readState = async () => (await chrome.storage.local.get(SYNC_STATE_KEY))[SYNC_STATE_KEY] || {};
const setState = async (fields) => chrome.storage.local.set({ [SYNC_STATE_KEY]: { ...(await readState()), ...fields } });

const deviceId = async () => {
  const stored = (await chrome.storage.local.get(DEVICE_KEY))[DEVICE_KEY];
  if (stored) return stored;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [DEVICE_KEY]: id });
  return id;
};

// What's synced: the user's own rules and the preset URLs.
const localContent = async () => {
  const domains = (await bgapp.mainStorage.getAll()).map(domain => ({
    ...domain,
    rules: (domain.rules || []).filter(rule => !rule.presetUrl)
  }));
  return JSON.stringify({ domains, presets: await getPresetUrls() });
};

const push = async () => {
  if (!enabled || applying) return;
  try {
    const content = await localContent();
    const hash = contentHash(content);
    if ((await readState()).hash === hash) return; // Already there.
    const chunks = splitForSync(content, chunkKey);
    const bytes = syncBytes(chunks, chunkKey);
    if (bytes > SYNC_TOTAL_BYTES - 1024) {
      await setState({ error: `Your rules are too big to sync: ${Math.ceil(bytes / 1024)} KB of about 100 KB. File overrides, injections and mocks with long contents take the most room.`, bytes });
      return;
    }
    const previous = (await chrome.storage.sync.get(META_KEY))[META_KEY];
    const meta = { chunks: chunks.length, updatedAt: Date.now(), deviceId: await deviceId(), hash, bytes };
    await chrome.storage.sync.set({ ...Object.fromEntries(chunks.map((chunk, index) => [chunkKey(index), chunk])), [META_KEY]: meta });
    const stale = Array.from({ length: Math.max(0, (previous?.chunks || 0) - chunks.length) }, (_, i) => chunkKey(chunks.length + i));
    if (stale.length > 0) await chrome.storage.sync.remove(stale);
    await setState({ lastSyncedAt: Date.now(), direction: 'up', bytes, error: '', hash, appliedAt: meta.updatedAt });
  } catch (err) {
    await setState({ error: `Couldn't sync: ${err.message}` });
  }
};

// Applies what another computer synced; `force` also takes this computer's own data back.
const pull = async (force = false) => {
  if (!enabled) return;
  try {
    const items = await chrome.storage.sync.get(null);
    const meta = items[META_KEY];
    if (!meta) return;
    const state = await readState();
    if (!force && (meta.deviceId === await deviceId() || meta.updatedAt <= (state.appliedAt || 0) || meta.hash === state.hash)) return;
    const chunks = Array.from({ length: meta.chunks }, (_, i) => items[chunkKey(i)]);
    if (chunks.some(chunk => typeof chunk !== 'string')) return; // Still arriving; the last chunk's change comes next.
    const content = chunks.join('');
    const { domains, presets } = JSON.parse(content);
    applying = true;
    await bgapp.backups.snapshot('Before sync');
    // This computer's preset rules stay; they come from the preset URLs.
    const local = await bgapp.mainStorage.getAll();
    const presetRules = local.flatMap(domain => (domain.rules || []).filter(rule => rule.presetUrl));
    const merged = domains.map(domain => (domain.matchUrl === '*' ? { ...domain, rules: [...(domain.rules || []), ...presetRules] } : domain));
    await bgapp.backups.replaceAll(merged);
    await setState({ lastSyncedAt: Date.now(), direction: 'down', bytes: meta.bytes, error: '', hash: meta.hash, appliedAt: meta.updatedAt });
    bgapp.updateDNRRules?.();
    chrome.runtime.sendMessage({ action: 'dataUpdated' }).catch(() => {});
    await setPresetUrls(presets || []);
  } catch (err) {
    await setState({ error: `Couldn't apply synced rules: ${err.message}` });
  } finally {
    applying = false;
  }
};

const schedulePush = () => {
  if (!enabled || applying) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, PUSH_DELAY_MS);
};

// Turning it on: rules already synced from another computer win (a backup keeps the local
// ones); otherwise this computer's rules are sent.
const start = async () => {
  const meta = (await chrome.storage.sync.get(META_KEY))[META_KEY];
  if (meta && meta.deviceId !== await deviceId()) await pull(true);
  else await push();
};

bgapp.sync = { schedulePush };

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[META_KEY]) ready.then(() => pull());
  if (area === 'local' && changes[ENABLED_KEY]) {
    enabled = changes[ENABLED_KEY].newValue === true;
    if (enabled) start();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'syncNow') {
    ready.then(async () => {
      await pull();
      await push();
      sendResponse(await readState());
    });
    return true;
  }
});

ready.then(() => pull());
