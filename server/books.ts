import { Router, type Request, type Response } from 'express'
import sanitizeHtml from 'sanitize-html'
import { journalLayouts, sectionOf, slotWordLimits, wordLimits, type LayoutId, type SlotKind } from '../src/data/journal.js'
import { currentUser, fail, requireUser, text } from './auth.js'
import { decodeCursor, encodeCursor, limit, sql, UUID, type Row } from './db.js'
import { indexNow } from './seo.js'

/** Books (sketchbooks and journals), journal entries, the feed, likes and saves.
 * A private book answers 404 to everyone but its owner, and so do its entries. */
export const books = Router()

const FEED_PAGE = 24, ENTRY_PAGE = 50
const MAX_PAGES = 80, MAX_ARTWORKS = 40, MAX_ENTRIES = 200
const DESIGN_BYTES = 64 * 1024, PAGES_BYTES = 128 * 1024, EXTRAS_BYTES = 32 * 1024

const me = async (req: Request) => ((await currentUser(req))?.id ?? null) as string | null
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value))
const isObject = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value)
const tooMany = (res: Response) => fail(res, 429, 'rate_limited', 'Slow down a little and try again.')
const notFound = (res: Response) => fail(res, 404, 'not_found', 'This book is private or does not exist.')

// Images are drawn only from Scribb's own files or our Cloudinary account, never from data: or other sites.
const safeSrc = (src: unknown) => src === '' || (typeof src === 'string' && src.length <= 300 &&
  (/^\/(?!\/)[\w\-./]+$/.test(src) || src.startsWith('https://res.cloudinary.com/')))
/** Every value under a src, coverImage or image key, at any depth, must be a safe image source. */
function srcsSafe(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(srcsSafe)
  if (!isObject(value)) return true
  return Object.entries(value).every(([key, v]) => (['src', 'coverImage', 'image'].includes(key) ? safeSrc(v) : srcsSafe(v)))
}

const bookJson = (b: Row, withPages: boolean) => ({
  id: b.id, kind: b.kind, title: b.title, visibility: b.visibility, category: b.category, design: b.design,
  ...(withPages || b.pages ? { pages: b.pages } : {}), ...(b.latest ? { latest: entryJson(b.latest) } : {}),
  likeCount: b.like_count, saveCount: b.save_count, version: b.version, publishedAt: b.published_at, updatedAt: b.updated_at,
  owner: { username: b.handle, displayName: b.display_name, avatar: b.avatar }, liked: b.liked, saved: b.saved,
})
/** One page of book cards plus the cursor for the next page. Rows must carry `at` (the sort value as text). */
function bookPage(rows: Row[], size: number) {
  const more = rows.length > size, shown = rows.slice(0, size)
  return { books: shown.map(b => bookJson(b, false)), next: more ? encodeCursor(shown.at(-1)!.at, shown.at(-1)!.id) : null }
}

// ---- Books
books.get('/books/:id', async (req, res) => {
  if (!UUID.test(String(req.params.id))) return notFound(res)
  const user = await me(req)
  const [book] = await sql()`
    select b.*, p.handle, p.display_name, p.avatar,
           exists (select 1 from likes where user_id = ${user}::uuid and book_id = b.id) as liked,
           exists (select 1 from saves where user_id = ${user}::uuid and book_id = b.id) as saved
    from books b join profiles p on p.user_id = b.user_id
    where b.id = ${req.params.id} and (b.visibility = 'public' or b.user_id = ${user}::uuid)`
  if (!book) return notFound(res)
  res.json({ book: bookJson(book, true) })
})

/** Create or replace a whole book. `version` is the version the client last saw (0 for a new book);
 * a stale version answers 409 so a second device never overwrites newer work. */
books.put('/books/:id', requireUser, async (req, res) => {
  const user = res.locals.user as Row, id = String(req.params.id), b = req.body ?? {}
  if (!UUID.test(id)) return fail(res, 400, 'bad_id', 'Book ids are UUIDs.')
  const kind = b.kind, title = text(b.title), category = text(b.category) || null, version = Number(b.version ?? 0)
  const visibility = b.visibility ?? 'private', design = b.design ?? {}, pages = b.pages ?? []
  if (kind !== 'sketchbook' && kind !== 'journal') return fail(res, 400, 'bad_kind', 'A book is a sketchbook or a journal.')
  if (visibility !== 'private' && visibility !== 'public') return fail(res, 400, 'bad_visibility', 'A book is private or public.')
  if (title.length > 80 || (category?.length ?? 0) > 40) return fail(res, 400, 'bad_title', 'Titles are up to 80 characters.')
  if (!Number.isInteger(version) || version < 0) return fail(res, 400, 'bad_version', 'Missing book version.')
  if (!isObject(design) || bytes(design) > DESIGN_BYTES) return fail(res, 400, 'bad_design', 'The book design is too large.')
  if (!Array.isArray(pages) || pages.length > MAX_PAGES || bytes(pages) > PAGES_BYTES || !pages.every(isObject)) return fail(res, 400, 'bad_pages', `A book holds up to ${MAX_PAGES} pages.`)
  if (pages.filter(p => p.src).length > MAX_ARTWORKS) return fail(res, 400, 'too_many_artworks', `A book holds up to ${MAX_ARTWORKS} artworks.`)
  if (!srcsSafe(design) || !srcsSafe(pages)) return fail(res, 400, 'bad_image', 'Images must be uploaded to Scribb.')
  if (isObject(design.journal)) delete design.journal.entries // entries live in their own table
  if (!(await limit(`books:${user.id}`, 600, 3600))) return tooMany(res)
  const [row] = await sql()`
    insert into books (id, user_id, kind, title, visibility, category, design, pages, published_at)
    values (${id}, ${user.id}, ${kind}, ${title}, ${visibility}, ${category}, ${JSON.stringify(design)}::jsonb, ${JSON.stringify(pages)}::jsonb,
            case when ${visibility} = 'public' then now() end)
    on conflict (id) do update set
      title = excluded.title, visibility = excluded.visibility, category = excluded.category, design = excluded.design, pages = excluded.pages,
      published_at = case when excluded.visibility = 'public' then coalesce(books.published_at, now()) else books.published_at end,
      version = books.version + 1, updated_at = now()
    where books.user_id = ${user.id} and books.kind = excluded.kind and books.version = ${version}
    returning version, (xmax = 0) as created`
  if (row) {
    if (visibility === 'public') await indexNow([`/@${user.handle}/${id}`, `/@${user.handle}`, '/explore'])
    return void res.status(row.created ? 201 : 200).json({ version: row.version })
  }
  const [current] = await sql()`select version from books where id = ${id} and user_id = ${user.id}`
  if (!current) return notFound(res)
  fail(res, 409, 'stale_version', 'This book changed on another device. Your draft is kept.')
})

books.delete('/books/:id', requireUser, async (req, res) => {
  if (!UUID.test(String(req.params.id))) return notFound(res)
  // ponytail: Cloudinary images of the book are not deleted yet; do it with the media routes (Task 8).
  const [row] = await sql()`delete from books where id = ${req.params.id} and user_id = ${(res.locals.user as Row).id} returning id`
  if (!row) return notFound(res)
  res.status(204).end()
})

// ---- Lists: the feed, a person's books, saved books

books.get('/feed', async (req, res) => {
  const user = await me(req), tab = req.query.tab ?? 'explore', cursor = decodeCursor(req.query.cursor)
  const kind = req.query.kind ? String(req.query.kind) : null, category = req.query.category ? String(req.query.category) : null
  if (tab !== 'explore' && tab !== 'following') return fail(res, 400, 'bad_tab', 'Unknown feed.')
  if (cursor === undefined) return fail(res, 400, 'bad_cursor', 'That page link is broken.')
  if (tab === 'following' && !user) return fail(res, 401, 'signed_out', 'Please sign in.')
  const [at, after] = cursor ?? [null, null]
  const rows = await sql()`
    select b.id, b.kind, b.title, b.visibility, b.category, b.design, b.like_count, b.save_count, b.version, b.published_at, b.updated_at,
           b.published_at::text as at, p.handle, p.display_name, p.avatar,
           -- Cards open on the newest post: all of a sketchbook's pages, or a journal's newest entry with something on it (the one the book opens at).
           case when b.kind = 'sketchbook' then b.pages end as pages,
           (select to_jsonb(e) from (select id, book_id, entry_date::text as date, layout, texts, images, extras, version from journal_entries j
              where j.book_id = b.id and (j.images <> '{}' or jsonb_array_length(coalesce(j.extras->'scribbles', '[]')) > 0 or jsonb_array_length(coalesce(j.extras->'stickers', '[]')) > 0
                or exists (select 1 from jsonb_each_text(j.texts) t where regexp_replace(t.value, '<[^>]*>', '', 'g') ~ '[^[:space:]]'))
              order by entry_date desc, id desc limit 1) e) as latest,
           exists (select 1 from likes where user_id = ${user}::uuid and book_id = b.id) as liked,
           exists (select 1 from saves where user_id = ${user}::uuid and book_id = b.id) as saved
    from books b join profiles p on p.user_id = b.user_id
    where b.visibility = 'public'
      and (${tab} = 'explore' or b.user_id in (select followee_id from follows where follower_id = ${user}::uuid))
      and (${kind}::text is null or b.kind = ${kind}) and (${category}::text is null or b.category = ${category})
      and (${at}::timestamptz is null or (b.published_at, b.id) < (${at}::timestamptz, ${after}::uuid))
    order by b.published_at desc, b.id desc
    limit ${FEED_PAGE + 1}`
  res.json(bookPage(rows, FEED_PAGE))
})

books.get('/users/:handle/books', async (req, res) => {
  const user = await me(req), cursor = decodeCursor(req.query.cursor)
  if (cursor === undefined) return fail(res, 400, 'bad_cursor', 'That page link is broken.')
  const [at, after] = cursor ?? [null, null]
  const rows = await sql()`
    select b.id, b.kind, b.title, b.visibility, b.category, b.design, b.like_count, b.save_count, b.version, b.published_at, b.updated_at,
           b.created_at::text as at, p.handle, p.display_name, p.avatar,
           exists (select 1 from likes where user_id = ${user}::uuid and book_id = b.id) as liked,
           exists (select 1 from saves where user_id = ${user}::uuid and book_id = b.id) as saved
    from books b join profiles p on p.user_id = b.user_id
    where p.handle = ${String(req.params.handle).toLowerCase()} and (b.visibility = 'public' or b.user_id = ${user}::uuid)
      and (${at}::timestamptz is null or (b.created_at, b.id) < (${at}::timestamptz, ${after}::uuid))
    order by b.created_at desc, b.id desc
    limit ${FEED_PAGE + 1}`
  res.json(bookPage(rows, FEED_PAGE))
})

books.get('/me/saved', requireUser, async (req, res) => {
  const user = (res.locals.user as Row).id, cursor = decodeCursor(req.query.cursor)
  if (cursor === undefined) return fail(res, 400, 'bad_cursor', 'That page link is broken.')
  const [at, after] = cursor ?? [null, null]
  // A saved book that its owner made private drops out of the list until it is public again.
  const rows = await sql()`
    select b.id, b.kind, b.title, b.visibility, b.category, b.design, b.like_count, b.save_count, b.version, b.published_at, b.updated_at,
           s.created_at::text as at, p.handle, p.display_name, p.avatar,
           -- Cards open on the newest post: all of a sketchbook's pages, or a journal's newest entry with something on it (the one the book opens at).
           case when b.kind = 'sketchbook' then b.pages end as pages,
           (select to_jsonb(e) from (select id, book_id, entry_date::text as date, layout, texts, images, extras, version from journal_entries j
              where j.book_id = b.id and (j.images <> '{}' or jsonb_array_length(coalesce(j.extras->'scribbles', '[]')) > 0 or jsonb_array_length(coalesce(j.extras->'stickers', '[]')) > 0
                or exists (select 1 from jsonb_each_text(j.texts) t where regexp_replace(t.value, '<[^>]*>', '', 'g') ~ '[^[:space:]]'))
              order by entry_date desc, id desc limit 1) e) as latest,
           exists (select 1 from likes where user_id = ${user} and book_id = b.id) as liked, true as saved
    from saves s join books b on b.id = s.book_id join profiles p on p.user_id = b.user_id
    where s.user_id = ${user} and (b.visibility = 'public' or b.user_id = ${user})
      and (${at}::timestamptz is null or (s.created_at, s.book_id) < (${at}::timestamptz, ${after}::uuid))
    order by s.created_at desc, s.book_id desc
    limit ${FEED_PAGE + 1}`
  res.json(bookPage(rows, FEED_PAGE))
})

// ---- Likes and saves. Counts change in the same statement as the row, so they never drift.
// A like notifies the owner once per person and book, however often it is toggled.
async function react(req: Request, res: Response, action: 'like' | 'unlike' | 'save' | 'unsave') {
  const user = (res.locals.user as Row).id, id = req.params.id
  if (!UUID.test(String(id))) return notFound(res)
  if (!(await limit(`social:${user}`, 300, 3600))) return tooMany(res)
  const [found] = await sql()`select id from books where id = ${id} and (visibility = 'public' or user_id = ${user})`
  if (!found) return notFound(res)
  let row: Row
  if (action === 'like') [row] = await sql()`
    with ins as (insert into likes (user_id, book_id) values (${user}, ${id}) on conflict do nothing returning book_id),
         upd as (update books set like_count = like_count + 1 where id in (select book_id from ins) returning like_count, user_id),
         note as (insert into notifications (user_id, actor_id, type, book_id)
                  select user_id, ${user}, 'like', ${id} from upd
                  where user_id <> ${user} and not exists (select 1 from notifications where actor_id = ${user} and book_id = ${id} and type = 'like'))
    select coalesce((select like_count from upd), (select like_count from books where id = ${id})) as likes,
           (select save_count from books where id = ${id}) as saves`
  else if (action === 'unlike') [row] = await sql()`
    with del as (delete from likes where user_id = ${user} and book_id = ${id} returning book_id),
         upd as (update books set like_count = like_count - 1 where id in (select book_id from del) returning like_count)
    select coalesce((select like_count from upd), (select like_count from books where id = ${id})) as likes,
           (select save_count from books where id = ${id}) as saves`
  else if (action === 'save') [row] = await sql()`
    with ins as (insert into saves (user_id, book_id) values (${user}, ${id}) on conflict do nothing returning book_id),
         upd as (update books set save_count = save_count + 1 where id in (select book_id from ins) returning save_count)
    select (select like_count from books where id = ${id}) as likes,
           coalesce((select save_count from upd), (select save_count from books where id = ${id})) as saves`
  else [row] = await sql()`
    with del as (delete from saves where user_id = ${user} and book_id = ${id} returning book_id),
         upd as (update books set save_count = save_count - 1 where id in (select book_id from del) returning save_count)
    select (select like_count from books where id = ${id}) as likes,
           coalesce((select save_count from upd), (select save_count from books where id = ${id})) as saves`
  res.json({ likeCount: row.likes, saveCount: row.saves })
}
books.put('/books/:id/like', requireUser, (req, res) => react(req, res, 'like'))
books.delete('/books/:id/like', requireUser, (req, res) => react(req, res, 'unlike'))
books.put('/books/:id/save', requireUser, (req, res) => react(req, res, 'save'))
books.delete('/books/:id/save', requireUser, (req, res) => react(req, res, 'unsave'))

// ---- Journal entries
const DATE = /^\d{4}-\d{2}-\d{2}$/
const validDate = (d: unknown): d is string => typeof d === 'string' && DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d)
const LAYOUTS = new Set<string>(journalLayouts.map(l => l.id))
const TEXT_SLOT = /^[thpcqsb]\d{1,2}$/, IMAGE_SLOT = /^[a-z]\d{1,2}$/

/** The same allow-list as src/lib/richtext.ts: b, i, u, mark, br and web links that open in a new tab. */
const clean = (html: string) => sanitizeHtml(html, {
  allowedTags: ['b', 'i', 'u', 'mark', 'br', 'a'], allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https'], allowProtocolRelative: false,
  transformTags: {
    strong: 'b', em: 'i',
    // A link that is not a web link keeps its words and loses the link, as in the editor.
    a: (_tag, { href = '' }): sanitizeHtml.Tag => (/^https?:\/\//i.test(href) ? { tagName: 'a', attribs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' } } : { tagName: 'a', attribs: {} }),
  },
}).replace(/<a>(.*?)<\/a>/g, '$1').replace(/(<br \/>|<br>)+$/, '').replace(/<br \/>/g, '<br>')
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
/** Plain text for search and Scribb AI. */
const plain = (html: string) => html.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m)
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

const entryJson = (e: Row) => ({ id: e.id, bookId: e.book_id, date: e.date, layout: e.layout, texts: e.texts, images: e.images, ...e.extras, version: e.version })

books.get('/books/:id/entries', async (req, res) => {
  if (!UUID.test(String(req.params.id))) return notFound(res)
  const user = await me(req), cursor = decodeCursor(req.query.cursor)
  const from = req.query.from ?? null, to = req.query.to ?? null
  if (cursor === undefined || (cursor && !validDate(cursor[0]))) return fail(res, 400, 'bad_cursor', 'That page link is broken.')
  if ((from !== null && !validDate(from)) || (to !== null && !validDate(to))) return fail(res, 400, 'bad_date', 'Dates are YYYY-MM-DD.')
  const [book] = await sql()`select id from books where id = ${req.params.id} and kind = 'journal' and (visibility = 'public' or user_id = ${user}::uuid)`
  if (!book) return notFound(res)
  const [at, after] = cursor ?? [null, null]
  const rows = await sql()`
    select id, book_id, entry_date::text as date, layout, texts, images, extras, version from journal_entries
    where book_id = ${book.id}
      and entry_date between coalesce(${from}::date, '-infinity') and coalesce(${to}::date, 'infinity')
      and (${at}::date is null or (entry_date, id) > (${at}::date, ${after}::uuid))
    order by entry_date, id
    limit ${ENTRY_PAGE + 1}`
  const more = rows.length > ENTRY_PAGE, shown = rows.slice(0, ENTRY_PAGE)
  res.json({ entries: shown.map(entryJson), next: more ? encodeCursor(shown.at(-1)!.date, shown.at(-1)!.id) : null })
})

books.put('/entries/:id', requireUser, async (req, res) => {
  const user = (res.locals.user as Row).id, id = String(req.params.id), b = req.body ?? {}
  const version = Number(b.version ?? 0), texts = b.texts ?? {}, images = b.images ?? {}, extras = b.extras ?? {}
  if (!UUID.test(id) || !UUID.test(String(b.bookId))) return fail(res, 400, 'bad_id', 'Entry and book ids are UUIDs.')
  if (!validDate(b.date)) return fail(res, 400, 'bad_date', 'Dates are YYYY-MM-DD.')
  if (!LAYOUTS.has(b.layout)) return fail(res, 400, 'bad_layout', 'Unknown layout.')
  if (!Number.isInteger(version) || version < 0) return fail(res, 400, 'bad_version', 'Missing entry version.')
  if (!isObject(texts) || Object.keys(texts).length > 24 || !Object.entries(texts).every(([k, v]) => TEXT_SLOT.test(k) && typeof v === 'string' && v.length <= 20000))
    return fail(res, 400, 'bad_texts', 'Entry text is not in the expected shape.')
  if (!isObject(images) || Object.keys(images).length > 24 || !Object.entries(images).every(([k, v]) => IMAGE_SLOT.test(k) && safeSrc(v)))
    return fail(res, 400, 'bad_image', 'Images must be uploaded to Scribb.')
  if (!isObject(extras) || bytes(extras) > EXTRAS_BYTES || !srcsSafe(extras)) return fail(res, 400, 'bad_extras', 'Entry decorations are too large.')
  const kept = { grid: extras.grid, focus: extras.focus, scribbles: extras.scribbles, stickers: extras.stickers, align: extras.align }

  // Word limits match the editor: titles and captions per box, body boxes share the layout's allowance.
  const html: Record<string, string> = {}
  let body = 0
  for (const [slot, value] of Object.entries(texts as Record<string, string>)) {
    html[slot] = clean(value)
    const kind = slot[0].toUpperCase() as SlotKind, count = words(plain(html[slot])), most = slotWordLimits[kind]
    if (most !== undefined && count > most) return fail(res, 400, 'too_many_words', 'A box has more words than it allows.')
    if (most === undefined) body += count
  }
  if (body > wordLimits[sectionOf(b.layout as LayoutId)]) return fail(res, 400, 'too_many_words', 'This entry has more words than its layout allows.')
  const text = Object.values(html).map(plain).filter(t => t.trim()).join('\n\n')
  if (!(await limit(`entries:${user}`, 1200, 3600))) return tooMany(res)

  const [row] = await sql()`
    insert into journal_entries (id, book_id, user_id, entry_date, layout, texts, images, extras, plain_text, word_count)
    select ${id}, bk.id, ${user}, ${b.date}::date, ${b.layout}, ${JSON.stringify(html)}::jsonb, ${JSON.stringify(images)}::jsonb,
           ${JSON.stringify(kept)}::jsonb, ${text}, ${words(text)}
    from books bk
    where bk.id = ${b.bookId} and bk.user_id = ${user} and bk.kind = 'journal'
      and ((select count(*) from journal_entries where book_id = bk.id) < ${MAX_ENTRIES} or exists (select 1 from journal_entries where id = ${id}))
    on conflict (id) do update set
      entry_date = excluded.entry_date, layout = excluded.layout, texts = excluded.texts, images = excluded.images, extras = excluded.extras,
      plain_text = excluded.plain_text, word_count = excluded.word_count, version = journal_entries.version + 1, updated_at = now()
    where journal_entries.user_id = ${user} and journal_entries.book_id = excluded.book_id and journal_entries.version = ${version}
    returning version, (xmax = 0) as created`
  if (row) return void res.status(row.created ? 201 : 200).json({ version: row.version, texts: html })
  const [state] = await sql()`
    select (select user_id from journal_entries where id = ${id}) as entry_owner,
           exists (select 1 from books where id = ${b.bookId} and user_id = ${user} and kind = 'journal') as own_book`
  if (!state.own_book || (state.entry_owner && state.entry_owner !== user)) return notFound(res)
  if (!state.entry_owner) return fail(res, 409, 'journal_full', `A journal holds up to ${MAX_ENTRIES} entries. Start a new volume.`)
  fail(res, 409, 'stale_version', 'This entry changed on another device. Your draft is kept.')
})

books.delete('/entries/:id', requireUser, async (req, res) => {
  if (!UUID.test(String(req.params.id))) return notFound(res)
  const [row] = await sql()`delete from journal_entries where id = ${req.params.id} and user_id = ${(res.locals.user as Row).id} returning id`
  if (!row) return notFound(res)
  res.status(204).end()
})
