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
    chunkSizeWarningLimit: 1500,
  },
});
