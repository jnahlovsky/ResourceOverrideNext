// The pages' side of the rules' version history (src/extension/backups.js).
const send = (message) => new Promise((resolve) => {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    resolve({});
    return;
  }
  chrome.runtime.sendMessage(message, (response) => resolve(response || {}));
});

// The list of backups (id, time, label, ruleCount), newest first.
export const BACKUPS_INDEX_KEY = 'ruleBackupsIndex';

/** Saves a snapshot of all rules now, e.g. "Before import". */
export const snapshotRules = (label) => send({ action: 'snapshotRules', label });

export const restoreBackup = (id) => send({ action: 'restoreBackup', id });

export const getBackup = (id) => send({ action: 'getBackup', id });

export const deleteBackup = (id) => send({ action: 'deleteBackup', id });
