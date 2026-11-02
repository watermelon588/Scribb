import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import app from './app.js'
import { testDatabase } from './testdb.js'

process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough'

let pg: PGlite, base = ''
const server = app.listen(0)
before(async () => { pg = await testDatabase(); base = `http://localhost:${(server.address() as AddressInfo).port}` })
beforeEach(async () => { await pg.exec('delete from rate_limits') })
after(() => { server.close() })

type Reply = { status: number; body: any; cookie: string } // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown, cookie = ''): Promise<Reply> {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const set = res.headers.getSetCookie().find(c => c.startsWith('__Host-scribb='))
  return { status: res.status, body: res.status === 204 ? null : await res.json(), cookie: set ? set.split(';')[0] : cookie }
}
const signup = async (username: string) => (await call('POST', '/auth/register', { username, password: 'first password' })).cookie
const sketchbook = (extra: Record<string, unknown> = {}) => ({
  kind: 'sketchbook', title: 'Monsoon', design: { color: '#5d6b4a', coverImage: '/covers/olive.png' }, pages: [{ id: 'a1', src: 'https://res.cloudinary.com/scribb/a1.jpg' }], ...extra,
})

test('profiles: preset avatars, links, username changes', async () => {
  const mira = await signup('mira')
  assert.equal((await call('GET', '/users/mira')).body.profile.avatar, 'a01', 'everyone starts on the first preset')
  assert.equal((await call('PATCH', '/me/profile', { avatar: 'a13' }, mira)).body.error.code, 'bad_avatar')
  assert.equal((await call('PATCH', '/me/profile', { links: { website: 'javascript:alert(1)' } }, mira)).body.error.code, 'bad_link')
  assert.equal((await call('PATCH', '/me/profile', { bio: 'x'.repeat(301) }, mira)).body.error.code, 'too_long')
  const done = await call('PATCH', '/me/profile', { displayName: 'Mira R', avatar: 'a07', links: { instagram: 'https://instagram.com/mira', other: 'https://x.y' } }, mira)
  assert.equal(done.status, 200)
  assert.deepEqual(done.body.profile.links, { instagram: 'https://instagram.com/mira' }, 'unknown link keys are dropped')
  assert.equal(done.body.profile.own, true)

  await signup('leo')
  assert.equal((await call('PATCH', '/me/profile', { username: 'leo' }, mira)).body.error.code, 'username_taken')
  assert.equal((await call('PATCH', '/me/profile', { username: 'mira.paints' }, mira)).body.profile.username, 'mira.paints')
  assert.equal((await call('GET', '/users/mira')).status, 404)
  assert.equal((await call('GET', '/users/mira.paints')).body.profile.displayName, 'Mira R')
  assert.equal((await call('PATCH', '/me/profile', { bio: 'hi' })).status, 401)
})

test('creator profile picture and badge require the verified owner email', async () => {
  const ordinary = await signup('ordinary.artist'), claimant = await signup('creator.claim'), owner = await signup('true.creator')
  assert.equal((await call('GET', '/auth/me', undefined, ordinary)).body.user.isCreator, false)
  assert.equal((await call('PATCH', '/me/profile', { avatar: 'mine', isCreator: true }, ordinary)).status, 403)
  assert.equal((await call('PATCH', '/me/profile', { isCreator: true }, ordinary)).body.profile.isCreator, false, 'a client cannot grant the badge')
  assert.equal((await call('PATCH', '/me/profile', { avatar: '/avatars/mine.png' }, ordinary)).status, 400)
  assert.equal((await call('PATCH', '/me/profile', { avatar: { id: 'mine' } }, ordinary)).status, 400)

  await pg.query(`update users set email = $1 where id = (select user_id from profiles where handle = $2)`, ['maityrohit021@gmail.com', 'creator.claim'])
  assert.equal((await call('GET', '/auth/me', undefined, claimant)).body.user.isCreator, false, 'an unverified email is not ownership')
  assert.equal((await call('PATCH', '/me/profile', { avatar: 'mine' }, claimant)).status, 403)

  await pg.query(`update users set email = $1, email_verified_at = now() where id = (select user_id from profiles where handle = $2)`, ['maityrohit021@gmail.com', 'true.creator'])
  const creator = (await call('GET', '/auth/me', undefined, owner)).body.user
  assert.equal(creator.isCreator, true)
  assert.equal(creator.avatar, 'mine', 'the verified creator gets the reserved default PFP')
  const publicProfile = (await call('GET', '/users/true.creator')).body.profile
  assert.equal(publicProfile.isCreator, true)
  assert.equal(publicProfile.avatar, 'mine')
  assert.equal(publicProfile.email, undefined, 'the creator email stays private')
  assert.equal((await call('PATCH', '/me/profile', { avatar: 'mine' }, owner)).status, 200)
  assert.equal((await call('PATCH', '/me/profile', { avatar: 'a07' }, owner)).body.profile.avatar, 'a07', 'the creator can still choose a public PFP')
  await call('PATCH', '/me/profile', { avatar: 'mine' }, owner)

  await pg.query(`update users set email_verified_at = null where id = $1`, [creator.id])
  const revoked = (await call('GET', '/auth/me', undefined, owner)).body.user
  assert.equal(revoked.isCreator, false)
  assert.equal(revoked.avatar, 'a01', 'losing verified ownership removes the reserved avatar')
  assert.equal((await call('GET', '/users/true.creator')).body.profile.isCreator, false)
  assert.equal((await call('GET', '/users/true.creator')).body.profile.avatar, 'a01')
  assert.equal((await call('PATCH', '/me/profile', { avatar: 'mine' }, owner)).status, 403)
})

test('books: private by default, versions, safe images', async () => {
  const ana = await signup('ana'), ben = await signup('ben'), id = randomUUID()
  assert.equal((await call('PUT', `/books/${id}`, sketchbook(), ana)).status, 201)
  assert.equal((await call('GET', `/books/${id}`)).status, 404, 'new books are private')
  assert.equal((await call('GET', `/books/${id}`, undefined, ben)).status, 404)
  const own = await call('GET', `/books/${id}`, undefined, ana)
  assert.equal(own.body.book.pages.length, 1)
  assert.equal(own.body.book.version, 1)

  assert.equal((await call('PUT', `/books/${id}`, sketchbook({ visibility: 'public', version: 1 }), ana)).body.version, 2)
  assert.equal((await call('PUT', `/books/${id}`, sketchbook({ title: 'old tab', version: 1 }), ana)).body.error.code, 'stale_version')
  assert.equal((await call('PUT', `/books/${id}`, sketchbook({ version: 2 }), ben)).status, 404, 'someone else cannot overwrite it')
  assert.equal((await call('GET', `/books/${id}`)).body.book.owner.username, 'ana', 'guests read public books')

  for (const bad of [{ design: { coverImage: 'data:image/png;base64,AAAA' } }, { pages: [{ src: 'https://evil.example/a.png' }] }, { design: { journal: { cover: { image: '//evil.example/x' } } } }])
    assert.equal((await call('PUT', `/books/${randomUUID()}`, sketchbook(bad), ana)).body.error.code, 'bad_image')
  assert.equal((await call('PUT', `/books/${randomUUID()}`, sketchbook({ pages: Array.from({ length: 41 }, (_, i) => ({ src: `/art/${i}.png` })) }), ana)).body.error.code, 'too_many_artworks')

  assert.equal((await call('DELETE', `/books/${id}`, undefined, ben)).status, 404)
  assert.equal((await call('DELETE', `/books/${id}`, undefined, ana)).status, 204)
})

test('journal entries: private journals stay private, HTML is sanitized, limits hold', async () => {
  const kit = await signup('kit'), guest = await signup('guest.user'), book = randomUUID(), entry = randomUUID()
  await call('PUT', `/books/${book}`, { kind: 'journal', title: 'Diary', design: { journal: { font: 'book', entries: [{ id: 'x' }] } } }, kit)
  assert.equal((await call('GET', `/books/${book}`, undefined, kit)).body.book.design.journal.entries, undefined, 'entries are stored separately')

  const put = (body: Record<string, unknown>, cookie = kit, id = entry) => call('PUT', `/entries/${id}`, { bookId: book, date: '2026-10-30', layout: 'writing', ...body }, cookie)
  const saved = await put({ texts: { p0: '<p>Rain <b>again</b> <script>alert(1)</script><a href="javascript:x">bad</a> <a href="https://scribb.xyz">ok</a> &amp; tea</p>' }, extras: { stickers: [{ id: 's', src: '/stickers/nature/leaf.png' }], evil: 1 } })
  assert.equal(saved.status, 201)
  assert.equal(saved.body.texts.p0, 'Rain <b>again</b> bad <a href="https://scribb.xyz" target="_blank" rel="noopener noreferrer nofollow">ok</a> &amp; tea')
  const [row] = (await pg.query<{ plain_text: string; extras: object }>(`select plain_text, extras from journal_entries where id = $1`, [entry])).rows
  assert.equal(row.plain_text, 'Rain again bad ok & tea')
  assert.equal('evil' in row.extras, false, 'only known extras are kept')
  assert.equal((await call('GET', `/books/${book}/entries`, undefined, kit)).body.entries[0].stickers[0].src, '/stickers/nature/leaf.png', 'the owner reads them back')

  assert.equal((await call('GET', `/books/${book}/entries`)).status, 404, 'a private journal hides its entries')
  assert.equal((await call('GET', `/books/${book}/entries`, undefined, guest)).status, 404)
  assert.equal((await put({ texts: {} }, guest)).status, 404, 'only the owner writes')
  assert.equal((await call('DELETE', `/entries/${entry}`, undefined, guest)).status, 404)

  assert.equal((await put({ texts: { p0: 'word '.repeat(1001) } }, kit, randomUUID())).body.error.code, 'too_many_words')
  assert.equal((await put({ texts: { t0: 'one two three four five six seven eight nine' } }, kit, randomUUID())).body.error.code, 'too_many_words')
  assert.equal((await put({ images: { i0: 'https://evil.example/a.png' } }, kit, randomUUID())).body.error.code, 'bad_image')
  assert.equal((await put({ layout: 'nope' }, kit, randomUUID())).body.error.code, 'bad_layout')
  assert.equal((await put({ date: '2026-02-30' }, kit, randomUUID())).body.error.code, 'bad_date')
  assert.equal((await put({ texts: { p0: 'later' }, version: 0 })).body.error.code, 'stale_version')
  assert.equal((await put({ texts: { p0: 'later' }, version: 1 })).body.version, 2)

  await call('PUT', `/books/${book}`, { kind: 'journal', title: 'Diary', visibility: 'public', version: 1 }, kit)
  for (const date of ['2026-10-01', '2026-10-15']) await put({ date }, kit, randomUUID())
  const list = await call('GET', `/books/${book}/entries?from=2026-10-10`)
  assert.deepEqual(list.body.entries.map((e: { date: string }) => e.date), ['2026-10-15', '2026-10-30'])
  assert.equal(list.body.entries[1].texts.p0, 'later')

  await pg.query(`insert into journal_entries (id, book_id, user_id, entry_date, layout)
                  select gen_random_uuid(), $1, user_id, '2026-01-01', 'writing' from books, generate_series(1, 197) where id = $1`, [book])
  assert.equal((await put({}, kit, randomUUID())).body.error.code, 'journal_full')
  assert.equal((await put({ texts: { p0: 'still editable' }, version: 2 })).status, 200, 'existing entries stay editable')
})

test('feed, likes, saves, follows and notifications', async () => {
  const ivy = await signup('ivy'), max = await signup('max'), ids = [randomUUID(), randomUUID(), randomUUID()]
  for (const id of ids) await call('PUT', `/books/${id}`, sketchbook({ visibility: 'public' }), ivy)
  const hidden = randomUUID()
  await call('PUT', `/books/${hidden}`, sketchbook(), ivy)

  const feed = await call('GET', '/feed')
  assert.ok(feed.body.books.length >= 3)
  assert.ok(!feed.body.books.some((b: { id: string }) => b.id === hidden), 'private books never reach the feed')
  assert.equal(feed.body.books[0].pages.length, 1, 'sketchbook cards carry their pages, to open at the newest one')
  assert.equal((await call('GET', '/feed?cursor=nonsense')).body.error.code, 'bad_cursor')
  assert.equal((await call('GET', '/feed?tab=following')).status, 401)
  assert.equal((await call('GET', '/feed?tab=following', undefined, max)).body.books.length, 0)

  assert.equal((await call('PUT', `/books/${ids[0]}/like`)).status, 401, 'guests cannot like')
  assert.equal((await call('PUT', `/books/${hidden}/like`, undefined, max)).status, 404)
  for (let i = 0; i < 2; i++) assert.equal((await call('PUT', `/books/${ids[0]}/like`, undefined, max)).body.likeCount, 1, 'liking twice counts once')
  await call('DELETE', `/books/${ids[0]}/like`, undefined, max)
  assert.equal((await call('PUT', `/books/${ids[0]}/like`, undefined, max)).body.likeCount, 1)
  assert.equal((await call('PUT', `/books/${ids[1]}/save`, undefined, max)).body.saveCount, 1)
  const saved = await call('GET', '/me/saved', undefined, max)
  assert.deepEqual(saved.body.books.map((b: { id: string }) => b.id), [ids[1]])
  assert.equal((await call('GET', `/books/${ids[0]}`, undefined, max)).body.book.liked, true)

  assert.equal((await call('PUT', '/users/max/follow', undefined, max)).body.error.code, 'self_follow')
  assert.equal((await call('PUT', '/users/nobody/follow', undefined, max)).status, 404)
  await call('PUT', '/users/ivy/follow', undefined, max)
  await call('DELETE', '/users/ivy/follow', undefined, max)
  await call('PUT', '/users/ivy/follow', undefined, max)
  assert.equal((await call('GET', '/users/ivy', undefined, max)).body.profile.followers, 1)
  assert.equal((await call('GET', '/users/ivy', undefined, max)).body.profile.followed, true)
  assert.equal((await call('GET', '/feed?tab=following', undefined, max)).body.books.length, 3)

  const inbox = await call('GET', '/notifications', undefined, ivy)
  assert.equal(inbox.body.unread, 2, 'one like and one follow, however often they were toggled')
  assert.deepEqual(inbox.body.notifications.map((n: { type: string }) => n.type).sort(), ['follow', 'like'])
  await call('POST', '/notifications/read', undefined, ivy)
  assert.equal((await call('GET', '/notifications', undefined, ivy)).body.unread, 0)

  const page = await call('GET', '/users/ivy/books')
  assert.equal(page.body.books.length, 3, 'guests see only public books')
  assert.equal((await call('GET', '/users/ivy/books', undefined, ivy)).body.books.length, 4, 'the owner sees private ones too')
})

test('keyset paging walks every public book exactly once', async () => {
  const zoe = await signup('zoe')
  for (let i = 0; i < 30; i++) await call('PUT', `/books/${randomUUID()}`, sketchbook({ visibility: 'public' }), zoe)
  const seen = new Set<string>()
  let next = '', pages = 0
  do {
    const res = await call('GET', `/users/zoe/books${next ? `?cursor=${next}` : ''}`)
    for (const b of res.body.books) seen.add(b.id)
    next = res.body.next ?? ''
    pages++
  } while (next)
  assert.equal(seen.size, 30)
  assert.equal(pages, 2)
})

test('deleting an account removes its data and uncounts its likes', async () => {
  const owner = await signup('owen'), fan = await signup('fan.one'), book = randomUUID(), own = randomUUID()
  await call('PUT', `/books/${book}`, sketchbook({ visibility: 'public' }), owner)
  await call('PUT', `/books/${own}`, sketchbook({ visibility: 'public' }), fan)
  await call('PUT', `/books/${book}/like`, undefined, fan)
  await call('PUT', `/books/${book}/save`, undefined, fan)
  await call('PUT', '/users/owen/follow', undefined, fan)

  assert.equal((await call('DELETE', '/me', { password: 'wrong one!' }, fan)).body.error.code, 'bad_password')
  const gone = await call('DELETE', '/me', { password: 'first password' }, fan)
  assert.equal(gone.status, 204)
  assert.equal(gone.cookie, '__Host-scribb=')
  assert.equal((await call('GET', '/users/fan.one')).status, 404)
  assert.equal((await call('GET', `/books/${own}`)).status, 404, 'their books are gone')
  const left = (await call('GET', `/books/${book}`)).body.book
  assert.equal(left.likeCount, 0)
  assert.equal(left.saveCount, 0)
  assert.equal((await call('GET', '/users/owen')).body.profile.followers, 0)
  assert.equal((await call('GET', '/notifications', undefined, owner)).body.notifications.length, 0, 'their notifications go too')
})

test('image upload checks the real file type, the size and the quota', async () => {
  const cookie = await signup('uma')
  const send = (body: Buffer, kind = 'artwork', type = 'image/webp') => fetch(`${base}/api/media?kind=${kind}`, { method: 'POST', headers: { 'content-type': type, cookie }, body: new Uint8Array(body) })
  const webp = Buffer.concat([Buffer.from('RIFF    WEBPVP8 '), Buffer.alloc(64)])
  assert.equal((await fetch(`${base}/api/media?kind=artwork`, { method: 'POST', headers: { 'content-type': 'image/webp' }, body: new Uint8Array(webp) })).status, 401)
  assert.equal((await send(Buffer.from('<svg onload=alert(1)>'))).status, 400, 'a renamed non-image is refused')
  assert.equal((await send(Buffer.concat([webp, Buffer.alloc(300 * 1024)]), 'journal')).status, 413, 'journal pictures stay under 200 KB')
  assert.equal((await send(Buffer.concat([webp, Buffer.alloc(1100 * 1024)]))).status, 413)
  const ok = await send(webp)
  assert.equal(ok.status, 201)
  const { url } = await ok.json() as { url: string }
  assert.match(url, /^\/api\/media\/[0-9a-f-]{36}\.webp$/)
  assert.deepEqual(Buffer.from(await (await fetch(`${base}${url}`)).arrayBuffer()), webp, 'development serves the stored file')
  assert.equal((await call('PUT', `/books/${randomUUID()}`, sketchbook({ pages: [{ src: url }] }), cookie)).status, 201, 'books accept uploaded images')
})

test('feed cards carry the newest post: sketchbook pages and the newest written journal entry', async () => {
  const noor = await signup('noor')
  const book = randomUUID(), journal = randomUUID()
  assert.equal((await call('PUT', `/books/${book}`, { ...sketchbook({ visibility: 'public' }), version: 0 }, noor)).status, 201)
  assert.equal((await call('PUT', `/books/${journal}`, { kind: 'journal', title: 'Days', visibility: 'public', design: { journal: { font: 'book' } }, pages: [], version: 0 }, noor)).status, 201)
  const entry = (date: string, texts: Record<string, string>) => call('PUT', `/entries/${randomUUID()}`, { bookId: journal, date, layout: 'writing', texts, images: {}, version: 0 }, noor)
  assert.equal((await entry('2026-01-02', { p0: '<b>Rain</b> on the window' })).status, 201)
  assert.equal((await entry('2026-01-01', { p0: 'Older' })).status, 201)
  assert.equal((await entry('2026-01-03', { p0: '<b> </b>' })).status, 201, 'an empty newer entry is not the newest post')

  const cards = (await call('GET', '/feed')).body.books as { id: string; pages?: unknown[]; latest?: { date: string; texts: Record<string, string>; bookId: string } }[]
  const sketch = cards.find(c => c.id === book)!, days = cards.find(c => c.id === journal)!
  assert.equal(sketch.pages?.length, 1)
  assert.equal(sketch.latest, undefined)
  assert.equal(days.pages, undefined, 'journal cards do not carry pages')
  assert.equal(days.latest?.date, '2026-01-02')
  assert.match(days.latest!.texts.p0, /Rain/)
  await call('PUT', `/books/${journal}/save`, undefined, noor)
  assert.equal((await call('GET', '/me/saved', undefined, noor)).body.books[0].latest.date, '2026-01-02', 'saved cards open the same way')
})
