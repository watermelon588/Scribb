import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrate, migrationFiles, sql } from './db.js'
import { testDatabase } from './testdb.js'

test('migrations apply once, and the AI role sees only the ticket user\'s entries', async () => {
  const pg = await testDatabase()
  assert.deepEqual(await migrate(async text => (await pg.exec(text)).at(-1), migrationFiles()), [], 'a second run applies nothing')

  const [a] = await sql()`insert into users default values returning id`
  const [b] = await sql()`insert into users default values returning id`
  for (const owner of [a.id, b.id]) {
    const book = crypto.randomUUID()
    await sql()`insert into books (id, user_id, kind) values (${book}, ${owner}, 'journal')`
    await sql()`insert into journal_entries (id, book_id, user_id, entry_date, layout, plain_text) values (${crypto.randomUUID()}, ${book}, ${owner}, '2027-01-12', 'writing', 'painted the river')`
  }

  await pg.exec('set role scribb_ai')
  assert.equal((await pg.query('select id from journal_entries')).rows.length, 0, 'no user set: no rows')
  await pg.query(`select set_config('app.user_id', $1, false)`, [a.id])
  const rows = (await pg.query<{ user_id: string }>('select user_id from journal_entries')).rows
  assert.deepEqual(rows.map(r => r.user_id), [a.id])
  await assert.rejects(pg.query('select texts from journal_entries'), 'formatted text and image ids are not readable')
  await assert.rejects(pg.query('select * from users'), 'other tables are not readable')
  await pg.exec('reset role')
})
