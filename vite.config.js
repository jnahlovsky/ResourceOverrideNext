import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

const DEV_PORT = 5173;
// `npm run watch` (scripts/watch.mjs): the extension connects here to reload itself
// after each rebuild.
const RELOAD_PORT = 5174;

const stripNuxtUiInlineScripts = () => ({
  name: 'strip-nuxt-ui-inline-scripts',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('@nuxt/ui')) {
      // Remove inline script injection from colors plugin
      // Matches: headData.script = [{ innerHTML: "..." }];
      code = code.replace(/headData\.script\s*=\s*\[[\s\S]*?\];/g, '');

      // Remove inline script injection from Banner component
      // Matches: script: [{ key: '...', innerHTML: `...` }],
      code = code.replace(/script:\s*\[\s*\{\s*key:\s*`prehydrate-banner-[^\]]*\}\s*\],?/g, '');
    }
    return code;
  }
});

// Use async function to dynamically import ESM modules
export default defineConfig(async ({ mode }) => {
  const { default: ui } = await import('@nuxt/ui/vite');
  const devReload = mode === 'watch'
    ? { port: RELOAD_PORT, buildId: process.env.RESOURCED_DEV_SESSION || 'standalone' }
    : null;

  return {
    plugins: [
      stripNuxtUiInlineScripts(),
      vue(),
      // The UI is light-only; color mode would add `.dark` from the OS
      // preference and flip Nuxt UI tokens (e.g. input text) to dark values.
      ui({ colorMode: false }),
      crx({ manifest }),
    ],
    define: {
      __DEV_RELOAD__: JSON.stringify(devReload)
    },
    resolve: {
      alias: {
        '@': '/src',
      }
    },
    server: {
      // `npm run dev` writes loaders into dist/ that point at this port, so it must not
      // drift to another one when 5173 is taken.
      port: DEV_PORT,
      strictPort: true,
      // Extension pages load from chrome-extension://, which has no port for Vite's HMR
      // client to fall back on; without this it dials ws://localhost/ and keeps reloading.
      hmr: {
        host: 'localhost',
        port: DEV_PORT
      }
    },
    build: {
      modulePreload: false
    }
  };
});
