import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // These packages enter through the lazy spreadsheet preview. Discover them at
    // startup so opening the wizard cannot invalidate dependency URLs mid-session.
    include: ['@tanstack/react-table', '@tanstack/react-virtual'],
  },
  server: {
    // Forward API calls to the Express backend so cookies stay same-origin in development.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5000', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:5000', changeOrigin: true },
    },
  },
})
