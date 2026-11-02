import { readdirSync, readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

/** Tagged-template SQL: values are always sent as parameters, never spliced into the text. */
export type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>

// One HTTP client per process, created on first use so the app starts without a database.
let client: Sql | undefined
export function sql(): Sql {
  if (client) return client
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.')
  return (client = neon(process.env.DATABASE_URL) as unknown as Sql)
}
/** Tests swap in an in-process Postgres. */
export function useSql(next: Sql) { client = next }

/** Postgres error code, e.g. 23505 for a unique violation. */
export const pgCode = (err: unknown) => (err as { code?: string })?.code

/** Applies db/migrations/*.sql in name order, each file once and inside its own transaction.
 * `exec` must accept several statements in one string. */
export async function migrate(exec: (text: string) => Promise<unknown>, files: { name: string; text: string }[]) {
  await exec('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())')
  const done = new Set(((await exec('select name from schema_migrations')) as { rows: { name: string }[] }).rows.map(r => r.name))
  const applied: string[] = []
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(file.name)) continue
    // Names come from our own files, never from requests.
    await exec(`begin;\n${file.text}\ninsert into schema_migrations (name) values ('${file.name.replace(/'/g, "''")}');\ncommit;`)
    applied.push(file.name)
  }
  return applied
}

export const migrationFiles = (dir = 'db/migrations') =>
  readdirSync(dir).filter(f => f.endsWith('.sql')).map(name => ({ name, text: readFileSync(`${dir}/${name}`, 'utf8') }))

/** Fixed-window counter: true while `key` has been used at most `max` times in the current window.
 * ponytail: old windows are never deleted; add a daily cleanup once the table grows. */
export async function limit(key: string, max: number, windowSeconds: number) {
  const [row] = await sql()`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}::int) * ${windowSeconds}::int), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`
  return row.count <= max
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Keyset cursors: the sort value and id of the last row, as opaque base64url. `null` means start, `undefined` means invalid. */
export const encodeCursor = (at: string, id: string) => Buffer.from(JSON.stringify([at, id])).toString('base64url')
export function decodeCursor(value: unknown): [string, string] | null | undefined {
  if (value === undefined || value === '') return null
  try {
    const [at, id] = JSON.parse(Buffer.from(String(value), 'base64url').toString())
    return typeof at === 'string' && at.length < 64 && UUID.test(id) ? [at, id] : undefined
  } catch {
    return undefined
  }
}
