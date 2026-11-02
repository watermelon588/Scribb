import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import app from './app.js'

let base = ''
const server = app.listen(0)
before(() => { base = `http://localhost:${(server.address() as AddressInfo).port}` })
after(() => { server.close() })

test('health answers without a database', async () => {
  const saved = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  try {
    const res = await fetch(`${base}/api/health`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true, db: 'unconfigured' })
  } finally {
    if (saved !== undefined) process.env.DATABASE_URL = saved
  }
})

test('unknown routes and bad bodies return JSON errors, never HTML', async () => {
  const missing = await fetch(`${base}/api/nope`)
  assert.equal(missing.status, 404)
  assert.equal(((await missing.json()) as { error: { code: string } }).error.code, 'not_found')

  const bad = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })
  assert.equal(bad.status, 400)
  assert.equal(((await bad.json()) as { error: { code: string } }).error.code, 'bad_json')

  const big = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'x'.repeat(300_000) }) })
  assert.equal(big.status, 413)
})
