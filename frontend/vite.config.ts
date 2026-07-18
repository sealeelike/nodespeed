import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev: proxy /api to the central backend so the frontend is same-origin with it.
// Node measurement calls go cross-origin directly to each node (nodes send CORS *).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
})
