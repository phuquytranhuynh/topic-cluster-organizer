import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Lets `npm run dev` (Vite on :5173) call the Express API (separately run on :4000) without
    // dealing with CORS — the browser only ever sees same-origin /api requests. In production the
    // same Express process serves the built frontend itself, so no proxy is involved there.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
