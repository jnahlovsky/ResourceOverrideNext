import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// Use async function to dynamically import ESM modules
export default defineConfig(async () => {
  const { default: ui } = await import('@nuxt/ui/vite');
  
  return {
    plugins: [
      vue(),
      ui(),
      crx({ manifest }),
    ],
    resolve: {
      alias: {
        '@': '/src',
      }
    }
  };
});