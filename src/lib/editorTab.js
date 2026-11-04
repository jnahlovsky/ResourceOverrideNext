/* global chrome */
// The editor (index.html) opened as a tab. There's only ever one: opening it again brings
// the open one forward, and a second copy that opens anyway (e.g. "Extension options" in
// chrome://extensions, a restored tab) closes itself (see App.vue).

const editorUrl = () => chrome.runtime.getURL('index.html');

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

export async function openEditor() {
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
