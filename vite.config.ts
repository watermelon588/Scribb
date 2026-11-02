import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the API runs separately (npm run dev:api); Vercel serves both from one origin.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:3001' } } })
