import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the API runs separately (npm run dev:api); Vercel serves both from one origin.
// changeOrigin stays false so the API sees the app's Host and its same-origin check passes.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': { target: `http://127.0.0.1:${Number(process.env.API_PORT) || 3001}`, changeOrigin: false } } } })
