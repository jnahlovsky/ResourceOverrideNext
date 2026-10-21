/* global chrome */
// Client for the `npm run watch` auto reload (scripts/watch.mjs).
// Only active in watch builds: everywhere else __DEV_RELOAD__ is null and the bundler
// drops the call.

const RELOAD_TABS_KEY = 'devReloadTabs';
const SYNCED_SESSION_KEY = 'devReloadSession';
const MAX_RETRY_MS = 10000;

// Content scripts in open pages belong to the old extension instance; refresh the tab the
// developer is looking at so the new ones run.
const reloadActiveTabsAfterRestart = async () => {
  const { [RELOAD_TABS_KEY]: pending } = await chrome.storage.local.get(RELOAD_TABS_KEY);
  if (!pending) return;
  await chrome.storage.local.remove(RELOAD_TABS_KEY);
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  tabs.filter(tab => /^https?:/.test(tab.url || '')).forEach(tab => chrome.tabs.reload(tab.id));
};

const reloadExtension = async (reloadTabs) => {
  if (reloadTabs) await chrome.storage.local.set({ [RELOAD_TABS_KEY]: true });
  chrome.runtime.reload();
};

/**
 * @param {{ port: number, buildId: string }} config  the __DEV_RELOAD__ define
 * @param {{ reloadPage?: () => void }} options  pages pass location.reload; the
 *   background worker passes nothing.
 */
export function connectDevReload(config, { reloadPage } = {}) {
  if (!config) return;
  if (!reloadPage) reloadActiveTabsAfterRestart().catch(() => {});

  let retryMs = 1000;
  const connect = () => {
    const socket = new WebSocket(`ws://127.0.0.1:${config.port}`);
    socket.onopen = () => {
      retryMs = 1000;
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'hello' && message.buildId !== config.buildId) {
        // Built by an older watch session: pick up the current build, once per session
        // so a build that can't match (e.g. a manual one) doesn't reload in a loop.
        chrome.storage.local.get(SYNCED_SESSION_KEY).then(({ [SYNCED_SESSION_KEY]: synced }) => {
          if (synced === message.buildId) return;
          chrome.storage.local.set({ [SYNCED_SESSION_KEY]: message.buildId }).then(() => reloadExtension(false));
        });
      } else if (message.type === 'reload') {
        if (message.scope === 'extension') {
          reloadExtension(message.reloadTabs);
        } else if (reloadPage) {
          reloadPage();
        }
      }
    };
    // Not running `npm run watch` (yet): keep trying quietly.
    socket.onclose = () => {
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    };
  };
  connect();
}
