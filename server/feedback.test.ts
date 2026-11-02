import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import app from './app.js'
import { mailer } from './auth.js'
import { testDatabase } from './testdb.js'

process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough'

let base = ''
const server = app.listen(0)
before(async () => { await testDatabase(); base = `http://localhost:${(server.address() as AddressInfo).port}` })
after(() => { server.close() })

const send = (body: unknown) => fetch(`${base}/api/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('feedback mails the founder a rating and a note, and checks its input', async () => {
  const sent: { to: string; subject: string; body: string }[] = []
  mailer.send = async (to, subject, body) => { sent.push({ to, subject, body }) }
  assert.equal((await send({ rating: 0, message: 'hi' })).status, 400)
  assert.equal((await send({ rating: 4, message: 'x'.repeat(2001) })).status, 400)
  assert.equal((await send({ rating: 4, message: 'Love the page turns. Add a dark cover?', page: '/explore' })).status, 204)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'maityrohit021@gmail.com')
  assert.match(sent[0].subject, /★★★★☆ from a guest/)
  assert.match(sent[0].body, /Rating: 4\/5[\s\S]*Page: \/explore[\s\S]*Love the page turns/)
})
