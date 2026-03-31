import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxies /api/* and /queries/* to the backend in dev
      // Set VITE_API_URL in .env for production
      '/queries':          { target: 'http://localhost:3000', changeOrigin: true },
      '/api':              { target: 'http://localhost:3000', changeOrigin: true },
      '/api/masterdb':     { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
