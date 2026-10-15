import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Council audit #3 (A-39): split React and the large council data tables out of the
        // main chunk so app updates do not re-download them.
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (/src\/data\/(jevModuleTasks|jevLibrary|constructionPhases)\.js/.test(id)) return 'jev-data';
          return undefined;
        },
      },
    },
  },
});
