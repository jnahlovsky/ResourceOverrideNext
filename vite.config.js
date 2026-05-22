import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

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
export default defineConfig(async () => {
  const { default: ui } = await import('@nuxt/ui/vite');

  return {
    plugins: [
      stripNuxtUiInlineScripts(),
      vue(),
      ui(),
      crx({ manifest }),
    ],
    resolve: {
      alias: {
        '@': '/src',
      }
    },
    build: {
      modulePreload: false
    }
  };
});
