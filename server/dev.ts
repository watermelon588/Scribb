import app from './app.js'

// Local development only: Vite on 5173 proxies /api here.
try { process.loadEnvFile() } catch { /* No .env yet: the API runs without a database. */ }
const port = Number(process.env.API_PORT ?? 3001)
app.listen(port, () => console.log(`Scribb API on http://localhost:${port}`))
