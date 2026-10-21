import { ref } from 'vue';

// Whether rule changes are being saved, shared by the headers of the editor and of the
// popup / side panel ("Saving…", then "Saved" for a moment). Set by useRules().saveDomain.
const status = ref('idle'); // 'idle' | 'saving' | 'saved' | 'error'
let pendingSaves = 0;
let resetTimer = null;

export function useSaveStatus() {
  return { status };
}

export function markSaving() {
  pendingSaves++;
  clearTimeout(resetTimer);
  status.value = 'saving';
}

export function markSaved(error) {
  pendingSaves = Math.max(0, pendingSaves - 1);
  if (pendingSaves > 0) return;
  status.value = error ? 'error' : 'saved';
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => { status.value = 'idle'; }, error ? 4000 : 1600);
}
