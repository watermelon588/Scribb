import { Pool } from '@neondatabase/serverless'
import { migrate, migrationFiles } from './db.js'

// npm run migrate: applies new files from db/migrations to DATABASE_URL.
// A WebSocket pool is used because the HTTP driver runs one statement per request.
try { process.loadEnvFile() } catch { /* Use the environment as it is. */ }
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const applied = await migrate(text => pool.query(text), migrationFiles())
  console.log(applied.length ? `Applied ${applied.join(', ')}` : 'Database is up to date.')
} finally {
  await pool.end()
}
