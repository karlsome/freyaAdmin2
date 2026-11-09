import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Standalone build of the 3D factory twin -> ../Kurachi/factory3D.html + ../Kurachi/factory3D-assets/
// Usage: VITE_API_URL=<kurachi backend url> npm run build:factory3d
export default defineConfig({
  root: path.resolve(__dirname, 'standalone'),
  base: './',
  plugins: [react()],
  css: { postcss: path.resolve(__dirname) },
  build: {
    outDir: path.resolve(__dirname, '../Kurachi'),
    emptyOutDir: false,
    assetsDir: 'factory3D-assets',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { input: path.resolve(__dirname, 'standalone/factory3D.html') },
  },
})
