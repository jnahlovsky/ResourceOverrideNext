// `npm run watch`: rebuilds dist/ on every change and tells the loaded extension to reload.
//
// Chrome doesn't notice when dist/ is rebuilt: open extension pages keep their old code,
// and the background worker and content scripts only change when the extension reloads.
// The extension connects to the WebSocket server below (src/extension/devReload.js) and
// reloads pages, itself and the active tab as needed.
//
// Each change runs a fresh full build instead of `vite build --watch`: @crxjs/vite-plugin
// only registers content scripts on the first watch build, so incremental rebuilds fail.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { WebSocketServer } from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep in sync with RELOAD_PORT in vite.config.js.
const RELOAD_PORT = 5174;
// Extension workers are suspended after ~30s without activity; a periodic message keeps
// the connection (and the worker) alive.
const KEEPALIVE_MS = 20000;
const DEBOUNCE_MS = 150;

const WATCHED = ['src', 'public', 'manifest.json', 'index.html', 'popup.html', 'sidepanel.html', 'devtools.html', 'icons', 'vite.config.js'];
// Changes here need the extension itself reloaded; anything else is UI-only.
const EXTENSION_PATHS = ['manifest.json', 'vite.config.js', 'src/extension/', 'src/inject/', 'public/inject/'];
const CONTENT_SCRIPT_PATHS = ['src/inject/', 'public/inject/'];

// Read by vite.config.js; an extension built in an earlier session reloads on connect.
const sessionId = String(Date.now());
process.env.RESOURCED_DEV_SESSION = sessionId;

const wss = new WebSocketServer({ host: '127.0.0.1', port: RELOAD_PORT });
const broadcast = (message) => {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
};
wss.on('connection', (socket) => socket.send(JSON.stringify({ type: 'hello', buildId: sessionId })));
wss.on('error', (err) => {
  console.error(`Auto-reload server failed (${err.message}); is another "npm run watch" running?`);
  process.exit(1);
});
setInterval(() => broadcast({ type: 'keepalive' }), KEEPALIVE_MS).unref();

const time = () => new Date().toLocaleTimeString();
let building = false;
let pending = new Set();
let timer = null;

const runBuild = async (changedFiles) => {
  building = true;
  const started = Date.now();
  try {
    await build({ root, mode: 'watch', logLevel: 'warn' });
    const reloadsExtension = changedFiles.some((file) => EXTENSION_PATHS.some((p) => file === p || file.startsWith(p)));
    const reloadTabs = changedFiles.some((file) => CONTENT_SCRIPT_PATHS.some((p) => file.startsWith(p)));
    if (changedFiles.length > 0) {
      broadcast({ type: 'reload', scope: reloadsExtension ? 'extension' : 'pages', reloadTabs });
    }
    const what = changedFiles.length === 0 ? 'initial build'
      : `reload ${reloadsExtension ? 'extension' : 'pages'}${reloadTabs ? ' + active tab' : ''}`;
    console.log(`${time()}  built in ${Date.now() - started}ms → ${what}${changedFiles.length ? ` (${changedFiles.join(', ')})` : ''}`);
  } catch (err) {
    // Keep the last good build loaded; the next save retries.
    console.error(`${time()}  build failed, extension not reloaded:\n${err.message}`);
  } finally {
    building = false;
    if (pending.size > 0) schedule();
  }
};

const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (building) return;
    const files = [...pending];
    pending = new Set();
    runBuild(files);
  }, DEBOUNCE_MS);
};

// macOS also reports metadata-only events (e.g. extended attributes being read), so a
// file only counts as changed when its modification time moves.
const lastModified = new Map();
const hasChanged = (rel) => {
  let stat;
  try {
    stat = fs.statSync(path.join(root, rel));
  } catch {
    return lastModified.delete(rel) || true; // deleted or renamed away
  }
  if (stat.isDirectory()) return false;
  if (lastModified.get(rel) === stat.mtimeMs) return false;
  lastModified.set(rel, stat.mtimeMs);
  return true;
};

const recordAll = (dir) => {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const rel = `${dir}/${name}`;
    const stat = fs.statSync(path.join(root, rel));
    if (stat.isDirectory()) recordAll(rel);
    else lastModified.set(rel, stat.mtimeMs);
  }
};

for (const entry of WATCHED) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) continue;
  const isDir = fs.statSync(full).isDirectory();
  if (isDir) recordAll(entry);
  else lastModified.set(entry, fs.statSync(full).mtimeMs);
  fs.watch(full, { recursive: isDir }, (_event, filename) => {
    if (!filename) return;
    const rel = (isDir ? path.join(entry, filename.toString()) : entry).split(path.sep).join('/');
    // Editor swap/backup files.
    if (/(~|\.swp|\.tmp)$/.test(rel) || rel.includes('/.')) return;
    if (!hasChanged(rel)) return;
    pending.add(rel);
    schedule();
  });
}

console.log(`Watching ${WATCHED.join(', ')}; auto-reload on ws://127.0.0.1:${RELOAD_PORT}`);
await runBuild([]);
