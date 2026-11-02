import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { testDatabase } from './testdb.js'

process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough'
process.env.APP_ORIGIN = 'http://127.0.0.1:9' // nothing listens: pages fall back to the plain template, never the real site
const { default: app } = await import('./app.js')

let base = ''
const server = app.listen(0)
before(async () => { await testDatabase(); base = `http://localhost:${(server.address() as AddressInfo).port}` })
after(() => { server.close() })

async function call(method: string, path: string, body?: unknown, cookie = '') {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  return res.headers.getSetCookie().find(c => c.startsWith('__Host-scribb='))?.split(';')[0] ?? cookie
}
const page = (path: string) => fetch(`${base}${path}`, { redirect: 'manual' })
const ld = (html: string) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)![1])['@graph']

test('crawlable profile, book, Explore and sitemap pages show public books only', async () => {
  const mira = await call('POST', '/auth/register', { username: 'mira', password: 'first password' })
  await call('PATCH', '/me/profile', { displayName: 'Mira <R>', bio: 'Ink & rain studies.' }, mira)
  const open = randomUUID(), hidden = randomUUID()
  const sketchbook = { kind: 'sketchbook', version: 0, design: { caption: 'Monsoon walks', coverImage: '/covers/olive.png' }, pages: [{ id: 'a1', src: 'https://res.cloudinary.com/scribb/a1.jpg', title: 'Wet street', medium: 'Ink' }] }
  await call('PUT', `/books/${open}`, { ...sketchbook, title: 'Monsoon', visibility: 'public' }, mira)
  await call('PUT', `/books/${hidden}`, { ...sketchbook, title: 'Secret diary' }, mira)

  const profile = await page('/@mira'), html = await profile.text()
  assert.equal(profile.status, 200)
  assert.match(html, /<h1>Mira &#60;R&#62;<\/h1>/, 'names are escaped')
  assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:9\/@mira" \/>/)
  assert.match(html, new RegExp(`href="/@mira/${open}"`))
  assert.doesNotMatch(html, /Secret diary/, 'private books never appear')
  assert.equal(ld(html)[0].mainEntity.name, 'Mira <R>')

  const book = await (await page(`/@mira/${open}`)).text()
  assert.match(book, /<h1>Monsoon<\/h1>/)
  assert.match(book, /Wet street · Ink/)
  assert.equal(ld(book)[0]['@type'], 'VisualArtwork')
  assert.equal(ld(book)[0].creator.url, 'http://127.0.0.1:9/@mira')

  assert.equal((await page(`/@mira/${hidden}`)).status, 404)
  assert.equal((await page('/@nobody')).status, 404)
  const moved = await page(`/@MIRA/${open}`)
  assert.equal(moved.status, 301)
  assert.equal(moved.headers.get('location'), `/@mira/${open}`)

  assert.match(await (await page('/explore')).text(), new RegExp(`href="/@mira/${open}">Monsoon</a>`))
  const sitemap = await (await page('/sitemap.xml')).text()
  assert.match(sitemap, new RegExp(`<loc>http://127.0.0.1:9/@mira/${open}</loc>`))
  assert.doesNotMatch(sitemap, new RegExp(hidden))
})
