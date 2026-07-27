import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: { env: Record<string, string | undefined> };

// GitHub Pages serves project sites from /<repo>/, so allow overriding the
// base path at build time (e.g. `VITE_BASE=/leetvision/ npm run build`).
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split large vendors into their own long-cacheable chunks so the
        // initial payload is parallelized and doesn't churn on app changes.
        manualChunks: {
          react: ['react', 'react-dom'],
          codemirror: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/lang-javascript',
            '@codemirror/lang-python',
            '@codemirror/theme-one-dark',
          ],
        },
      },
    },
  },
});
