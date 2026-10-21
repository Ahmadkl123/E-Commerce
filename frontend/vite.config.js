import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api and /health are proxied to the Express backend so the
// browser talks to a single origin. Override the target with BACKEND_URL.
const backend = process.env.BACKEND_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/health': backend,
    },
  },
});
