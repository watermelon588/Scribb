import dns from 'node:dns'
try { dns.setDefaultResultOrder('ipv4first') } catch { /* ignore */ }
import { testDatabase } from './testdb.js'
import { getUsersSummary, printUsersReport } from './activity.js'

// Backend command to view all users and user count in the terminal or backend logs.
// Run from project root:
//   npm run users          (checks DATABASE_URL if reachable, falls back to local database)
//   npm run users -- --local (forces inspection of local .data/pglite)
//   npm run users -- --json  (outputs JSON)
try { process.loadEnvFile() } catch { /* No .env file */ }

let pg: { close?: () => Promise<void> } | undefined

const forceLocal = process.argv.includes('--local') || Boolean(process.env.LOCAL_ONLY)
const pgliteDir = process.env.PGLITE_DIR ?? '.data/pglite'

if (forceLocal || !process.env.DATABASE_URL) {
  console.log(`Using local database in ${pgliteDir}`)
  pg = await testDatabase(pgliteDir)
} else {
  try {
    const { sql } = await import('./db.js')
    await sql()`select 1`
    console.log('Connected to remote database.')
  } catch (err) {
    console.warn(`Remote DATABASE_URL unreachable (${(err as Error).message}).\nFalling back to local database in ${pgliteDir}...`)
    pg = await testDatabase(pgliteDir)
  }
}

try {
  if (process.argv.includes('--json')) {
    const summary = await getUsersSummary()
    console.log(JSON.stringify(summary, null, 2))
  } else {
    await printUsersReport()
  }
} catch (err) {
  console.error('Failed to load users report:', (err as Error).message)
  process.exit(1)
} finally {
  if (pg?.close) await pg.close()
  process.exit(0)
}
