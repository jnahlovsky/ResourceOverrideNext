/* global bgapp, chrome */
// Version history of the rules, in chrome.storage.local: a snapshot of all rules taken
// automatically before a change (at most every AUTO_INTERVAL_MS), and on demand before an
// import or a restore. Settings → Backups lists, restores and downloads them.
const BACKUPS_KEY = 'ruleBackups';
const MAX_BACKUPS = 30;
const AUTO_INTERVAL_MS = 10 * 60 * 1000;

const countRules = (domains) => (domains || []).reduce((sum, domain) => sum + (domain.rules || []).length, 0);

const readBackups = async () => (await chrome.storage.local.get(BACKUPS_KEY))[BACKUPS_KEY] || [];

const snapshot = async (label) => {
  const domains = await bgapp.mainStorage.getAll();
  if (countRules(domains) === 0) return null;
  const backups = await readBackups();
  const backup = { id: `b${Date.now().toString(36)}`, time: Date.now(), label, ruleCount: countRules(domains), domains };
  await chrome.storage.local.set({ [BACKUPS_KEY]: [backup, ...backups].slice(0, MAX_BACKUPS) });
  return backup;
};

// Called before rules are saved: keeps the state from before this round of edits.
const beforeChange = async () => {
  try {
    const [latest] = await readBackups();
    if (!latest || Date.now() - latest.time >= AUTO_INTERVAL_MS) await snapshot('Automatic');
  } catch (err) {
    console.warn('Could not back up the rules:', err);
  }
};

const restore = async (id) => {
  const backup = (await readBackups()).find(b => b.id === id);
  if (!backup) throw new Error('That backup no longer exists.');
  await snapshot('Before restore');
  const current = await bgapp.mainStorage.getAll();
  await Promise.all((current || []).map(domain => bgapp.mainStorage.delete(domain.id)));
  await Promise.all(backup.domains.map(domain => bgapp.mainStorage.put(domain)));
  bgapp.ruleDomains = Object.fromEntries(backup.domains.map(domain => [domain.id, domain]));
  bgapp.updateDNRRules?.();
  chrome.runtime.sendMessage({ action: 'dataUpdated' }).catch(() => {});
  return backup;
};

bgapp.backups = { beforeChange, snapshot };

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'snapshotRules') {
    snapshot(request.label || 'Manual').then(backup => sendResponse({ ok: true, backup })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === 'restoreBackup') {
    restore(request.id).then(backup => sendResponse({ ok: true, ruleCount: backup.ruleCount })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === 'deleteBackup') {
    readBackups()
      .then(backups => chrome.storage.local.set({ [BACKUPS_KEY]: backups.filter(b => b.id !== request.id) }))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});
