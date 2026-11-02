import { PGlite } from '@electric-sql/pglite'
import { migrate, migrationFiles, useSql } from './db.js'

/** In-process Postgres for tests and for local development without DATABASE_URL:
 * the real migrations, the same tagged-template interface as Neon. `dataDir` keeps it on disk. */
export async function testDatabase(dataDir?: string) {
  const pg = new PGlite(dataDir)
  await migrate(async text => (await pg.exec(text)).at(-1), migrationFiles())
  useSql((strings, ...values) => pg.query(strings.reduce((text, part, i) => `${text}$${i}${part}`), values).then(r => r.rows as Record<string, unknown>[]))
  return pg
}
