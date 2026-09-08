/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api to the backend so the browser only ever talks to one origin.
    // Without this the SPA is on :5173 and the API on :5116 — two origins, which
    // means CORS, preflights, and SameSite=None cookies in every environment
    // except this one. Proxying makes local development behave the way nginx
    // and the production edge do, so there is one shape to reason about.
    proxy: {
      '/api': {
        target: 'http://localhost:5116',
        // Rewrite the Host header to the target. Kestrel does not require it,
        // but a proxy that lies about Host breaks anything doing host-based
        // routing or absolute redirect URLs, so set it deliberately.
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
