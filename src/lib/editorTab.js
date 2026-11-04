/* global chrome */
// The editor (index.html) opened as a tab. There's only ever one: opening it again brings
// the open one forward, and a second copy that opens anyway (e.g. "Extension options" in
// chrome://extensions, a restored tab) closes itself (see App.vue).

const editorUrl = () => chrome.runtime.getURL('index.html');

const FILE_EDIT_KEY = 'pendingFileEdit';
// A request the editor didn't get to (it failed to open) doesn't pop up much later.
const FILE_EDIT_MAX_AGE = 30_000;

// Every tab showing the editor, oldest first (tab ids only grow).
export async function findEditorTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter(tab => (tab.url || tab.pendingUrl || '').startsWith(editorUrl()))
    .sort((a, b) => a.id - b.id);
}

export async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

// `editFile`: a rule id whose File Content editor the editor tab should open. It's left in
// chrome.storage.session, so a tab that's still loading (or reloading) finds it too; see
// takeFileEditRequests.
export async function openEditor({ editFile } = {}) {
  if (editFile) await chrome.storage.session.set({ [FILE_EDIT_KEY]: { ruleId: editFile, time: Date.now() } });
  const [existing] = await findEditorTabs();
  if (existing) await focusTab(existing);
  else await chrome.tabs.create({ url: `${editorUrl()}?tab=true` });
}

// For the editor itself: when an older editor tab is open, brings it forward, closes this
// tab and returns true. Each copy only gives way to older ones, so two opening at once
// keep one.
export async function yieldToOlderEditor() {
  const self = await chrome.tabs.getCurrent();
  // Not a tab: the DevTools panel, which may be open next to the editor.
  if (!self) return false;
  const older = (await findEditorTabs()).find(tab => tab.id < self.id);
  if (!older) return false;
  await focusTab(older);
  await chrome.tabs.remove(self.id);
  return true;
}

// For the editor tab: calls onRequest(ruleId) for the File Content request openEditor left,
// now and whenever a new one comes. Only an editor tab takes them, not the DevTools panel,
// which runs the same page.
export async function takeFileEditRequests(onRequest) {
  if (!(await chrome.tabs.getCurrent())) return;
  const take = async () => {
    const { [FILE_EDIT_KEY]: request } = await chrome.storage.session.get(FILE_EDIT_KEY);
    if (!request) return;
    await chrome.storage.session.remove(FILE_EDIT_KEY);
    if (Date.now() - request.time <= FILE_EDIT_MAX_AGE) onRequest(request.ruleId);
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[FILE_EDIT_KEY]?.newValue) take();
  });
  await take();
}
