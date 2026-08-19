import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Server exposes its API under /api (see server/src/app.ts), so no path
// rewrite is needed here — the proxy target's port must just match the
// server's PORT env var (defaults to 3001 on both sides).
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
