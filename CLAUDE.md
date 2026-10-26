Project overview: @GEMINI.md

## After every change: tell the user what to reload

Chrome loads the unpacked extension from `dist/`, but not every part picks up a rebuild by
itself. When you finish a change, end your message with what the user has to reload (or say
that nothing needs reloading):

| Changed | User has to |
|---|---|
| Vue UI only (`src/components/`, `src/App.vue`, styles, …) | Reopen the popup / reload the open editor or side panel page. Nothing if `npm run watch` runs. |
| Background or anything it imports (`src/extension/`, and `src/lib/` files it imports), `manifest.json`, `vite.config.js` | Reload the extension in `chrome://extensions`. |
| Page scripts (`src/inject/`, `public/inject/`) | Reload the extension, then reload the web pages they should run on. |

- `npm run watch` (scripts/watch.mjs) rebuilds and reloads automatically, except: `src/lib/`
  changes don't reload the background worker, only the active tab gets its page scripts
  refreshed, and a worker that was disconnected during a rebuild keeps its old code.
- `npm run build` writes into the same `dist/` without the auto-reload code; after one, the
  user always has to reload the extension.
