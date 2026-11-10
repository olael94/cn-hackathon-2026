import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      ...(process.env.ROOMPASS_DEV_LIVE_BACKEND ? {
        '/api/talks': { target: process.env.ROOMPASS_DEV_LIVE_BACKEND, changeOrigin: true },
      } : {}),
      '/api': process.env.ROOMPASS_DEV_BACKEND ?? 'http://localhost:8000',
    },
  },
})
