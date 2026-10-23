/* global bgapp, chrome */
// Version history of the rules, in chrome.storage.local: a snapshot of all rules taken
// automatically before a change (at most every AUTO_INTERVAL_MS), and on demand (before an
// import, a restore or a sync). Settings → Backups lists, restores and downloads them.
// A small index lists them; each snapshot is stored under its own key, so listing them
// doesn't load every copy.
const INDEX_KEY = 'ruleBackupsIndex';
const backupKey = (id) => `ruleBackup:${id}`;
const MAX_BACKUPS = 30;
const AUTO_INTERVAL_MS = 10 * 60 * 1000;

const countRules = (domains) => (domains || []).reduce((sum, domain) => sum + (domain.rules || []).length, 0);

const readIndex = async () => (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] || [];

const snapshot = async (label) => {
  const domains = await bgapp.mainStorage.getAll();
  if (countRules(domains) === 0) return null;
  const entry = { id: `b${Date.now().toString(36)}`, time: Date.now(), label, ruleCount: countRules(domains) };
  const index = [entry, ...(await readIndex())];
  const dropped = index.slice(MAX_BACKUPS);
  await chrome.storage.local.set({ [backupKey(entry.id)]: domains, [INDEX_KEY]: index.slice(0, MAX_BACKUPS) });
  if (dropped.length > 0) await chrome.storage.local.remove(dropped.map(b => backupKey(b.id)));
  return entry;
};

// Called before rules are saved: keeps the state from before this round of edits.
const beforeChange = async () => {
  try {
    const [latest] = await readIndex();
    if (!latest || Date.now() - latest.time >= AUTO_INTERVAL_MS) await snapshot('Automatic');
  } catch (err) {
    console.warn('Could not back up the rules:', err);
  }
};

const readBackup = async (id) => (await chrome.storage.local.get(backupKey(id)))[backupKey(id)];

// Replaces every rule with the given domains (a backup, or rules synced from elsewhere).
const replaceAll = async (domains) => {
  const current = await bgapp.mainStorage.getAll();
  await Promise.all((current || []).map(domain => bgapp.mainStorage.delete(domain.id)));
  await Promise.all(domains.map(domain => bgapp.mainStorage.put(domain)));
  bgapp.ruleDomains = Object.fromEntries(domains.map(domain => [domain.id, domain]));
};

const restore = async (id) => {
  const domains = await readBackup(id);
  if (!domains) throw new Error('That backup no longer exists.');
  await snapshot('Before restore');
  await replaceAll(domains);
  bgapp.notifyRulesChanged();
  return countRules(domains);
};

const remove = async (id) => {
  const index = await readIndex();
  await chrome.storage.local.set({ [INDEX_KEY]: index.filter(b => b.id !== id) });
  await chrome.storage.local.remove(backupKey(id));
};

// Backups made before the index existed: one list with the snapshots inside.
chrome.storage.local.get('ruleBackups').then(async ({ ruleBackups }) => {
  if (!Array.isArray(ruleBackups)) return;
  const index = await readIndex();
  const moved = ruleBackups.filter(b => !index.some(i => i.id === b.id));
  const items = Object.fromEntries(moved.map(b => [backupKey(b.id), b.domains]));
  const merged = [...index, ...moved.map(({ id, time, label, ruleCount }) => ({ id, time, label, ruleCount }))]
    .sort((a, b) => b.time - a.time).slice(0, MAX_BACKUPS);
  await chrome.storage.local.set({ ...items, [INDEX_KEY]: merged });
  await chrome.storage.local.remove('ruleBackups');
}).catch(() => {});

bgapp.backups = { beforeChange, snapshot, replaceAll };

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'snapshotRules') {
    snapshot(request.label || 'Manual').then(backup => sendResponse({ ok: true, backup })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === 'restoreBackup') {
    restore(request.id).then(ruleCount => sendResponse({ ok: true, ruleCount })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === 'getBackup') {
    readBackup(request.id).then(domains => sendResponse({ ok: !!domains, domains })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === 'deleteBackup') {
    remove(request.id).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
});
