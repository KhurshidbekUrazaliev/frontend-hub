import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import content from './plugins/content.js';

const root = import.meta.dirname;

export default defineConfig({
  // Relative asset paths, so the build works from any folder or sub-path.
  base: './',
  // Several real pages, no client-side router: an unknown URL is a 404, not the home page.
  appType: 'mpa',
  plugins: [content()],
  server: {
    watch: {
      // Saving a design must never reload the admin panel mid-edit.
      ignored: [resolve(root, 'content/**'), resolve(root, '.trash/**')],
    },
  },
  build: {
    target: 'es2022',
    // Three.js is one ~540 kB chunk, loaded on demand and only where a scene needs it.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // admin.html is deliberately absent: the admin panel is a local tool
      // served by the dev server only, and is never part of a deployed build.
      input: {
        home: resolve(root, 'index.html'),
        library: resolve(root, 'library.html'),
        designs: resolve(root, 'designs.html'),
      },
    },
  },
});
