import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite does not put .env values on process.env for this file; load them explicitly.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiProxy = { '/api': { target: env.VITE_API_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true } }

  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      // These packages enter through the lazy spreadsheet preview. Discover them at
      // startup so opening the wizard cannot invalidate dependency URLs mid-session.
      include: ['@tanstack/react-table', '@tanstack/react-virtual'],
    },
    server: {
      // Wait for editors and code generators to finish saving before transforming.
      // Otherwise a briefly truncated TSX file can be cached as an empty module.
      watch: {
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      },
      // Forward API calls to the Express backend so cookies stay same-origin in development.
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  }
})
