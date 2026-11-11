import app from './app.js'
import { testDatabase } from './testdb.js'
import { getUsersSummary } from './activity.js'

// Local development only: Vite on 5173 proxies /api here.
try { process.loadEnvFile() } catch { /* No .env yet. */ }
// Browser tests set LOCAL_ONLY so they never touch the real database, image host, mail or AI named in .env.
if (process.env.LOCAL_ONLY) for (const key of ['DATABASE_URL', 'CLOUDINARY_API_SECRET', 'RESEND_API_KEY', 'AI_URL']) delete process.env[key]
// Without .env the API still runs: a Postgres kept in .data/pglite, images in .data/uploads, a fixed dev secret.
process.env.SESSION_SECRET ||= 'local-development-only-session-secret'
if (!process.env.DATABASE_URL) {
  process.env.RATE_LIMITS ??= 'off' // browser tests sign up a fresh account per test
  await testDatabase(process.env.PGLITE_DIR ?? '.data/pglite')
  console.log('No DATABASE_URL: using the local database in .data/pglite')
}
const port = Number(process.env.API_PORT ?? 3001)
app.listen(port, async () => {
  console.log(`Scribb API on http://localhost:${port}`)
  try {
    const summary = await getUsersSummary()
    console.log(`[users] ${summary.totalUsers} registered user(s) in database`)
  } catch { /* database may be unconfigured */ }
})
