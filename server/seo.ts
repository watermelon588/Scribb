import { Router, type Response } from 'express'
import { profileAvatar } from './creator.js'
import { sql, UUID, type Row } from './db.js'

/** Crawlable pages for search engines and AI assistants: profiles (/@name), public books (/@name/<id>), Explore and
 * the sitemap. The app's own index.html is the template, so people get the full app and crawlers get real text,
 * titles, Open Graph and JSON-LD before any JavaScript runs. Only public data is ever rendered. */
export const seo = Router()

export const SITE = (process.env.APP_ORIGIN ?? 'https://scribb.xyz').replace(/\/$/, '')
const HANDLE = /^[a-z0-9._]{3,30}$/
// Public by design: IndexNow engines check it at /<key>.txt (public/).
const INDEXNOW_KEY = '3993b7c515f95c11164991fc69b98fc0'

/** Tell IndexNow search engines (Bing and the assistants built on it, Yandex, Seznam) that these pages changed.
 * Production only, so tests and previews never announce anything; a failure never affects the caller. */
export async function indexNow(paths: string[]) {
  if (process.env.VERCEL_ENV !== 'production') return
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(2000),
      body: JSON.stringify({ host: new URL(SITE).host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: paths.map(p => SITE + p) }),
    })
  } catch { /* best effort: the sitemap still lists the page */ }
}
const LIST = 100

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const abs = (src: string) => (src.startsWith('https://') ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const day = (d: unknown) => (d ? new Date(String(d)).toISOString().slice(0, 10) : undefined)
const longDay = (d: unknown) => new Date(String(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`
const nameOf = (p: Row) => String(p.display_name || p.handle)
const titleOf = (b: Row) => String(b.title || (b.kind === 'journal' ? 'Untitled journal' : 'Untitled sketchbook'))
const bookUrl = (b: Row) => `${SITE}/@${b.handle}/${b.id}`
const artworks = (b: Row) => (Array.isArray(b.pages) ? b.pages : []).filter((p: Row) => p?.src && !p.blank)
const coverOf = (b: Row) => (typeof b.design?.coverImage === 'string' && b.design.coverImage) || artworks(b)[0]?.src || ''
const summaryOf = (b: Row) => String((b.kind === 'journal' ? b.design?.journal?.about : b.design?.caption) ?? '').trim()

// The built index.html, fetched from the app on the same origin. ponytail: 10-minute cache per instance; a deploy starts fresh instances.
let template: { html: string; at: number } | null = null
async function appShell(): Promise<string | null> {
  if (template && Date.now() - template.at < 600_000) return template.html
  try {
    const res = await fetch(`${SITE}/`, { signal: AbortSignal.timeout(3000) })
    const html = await res.text()
    if (res.ok && html.includes('<!--seo-->') && html.includes('<!--app-->')) template = { html, at: Date.now() }
  } catch { /* fall back to the last good template, or a plain page */ }
  return template?.html ?? null
}

interface Page { status?: number; title: string; description: string; path: string; image?: string; type?: string; noindex?: boolean; data?: object[]; body: string }
const json = (data: object[]) => JSON.stringify({ '@context': 'https://schema.org', '@graph': data }).replace(/</g, '\\u003c')
const crumbs = (items: [string, string][]) => ({
  '@type': 'BreadcrumbList', itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
})

async function send(res: Response, page: Page) {
  const url = `${SITE}${page.path}`, image = page.image ? abs(page.image) : `${SITE}/brand/og-card.jpg`
  const head = `<title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}" />
    <link rel="canonical" href="${esc(url)}" />${page.noindex ? '\n    <meta name="robots" content="noindex" />' : ''}
    <meta property="og:type" content="${page.type ?? 'website'}" />
    <meta property="og:site_name" content="Scribb" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:title" content="${esc(page.title)}" />
    <meta property="og:description" content="${esc(page.description)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(page.title)}" />
    <meta name="twitter:description" content="${esc(page.description)}" />
    <meta name="twitter:image" content="${esc(image)}" />${page.data ? `\n    <script type="application/ld+json">${json(page.data)}</script>` : ''}`
  const shell = await appShell()
  const html = shell
    ? shell.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head).replace(/<!--app-->[\s\S]*?<!--\/app-->/, page.body)
    : `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />${head}</head><body>${page.body}<p><a href="/">Open Scribb</a></p></body></html>`
  res.status(page.status ?? 200).set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600').type('html').send(html)
}

// Every user page ends with the same short answer to "what is Scribb?", so assistants can place it.
const ABOUT = '<h2>About Scribb</h2><p>Scribb is a free home for digital sketchbooks and journals with real page turns, covers and bindings. Every book is private until its owner publishes it. <a href="/about/">More about Scribb</a> · <a href="/explore">Explore</a> · <a href="/">Start your own book</a></p>'

const missing = (res: Response, what: string) => send(res, {
  status: 404, noindex: true, path: '/explore', title: 'Not found · Scribb', description: `${what} is private or does not exist.`,
  body: `<main class="seo-page"><h1>Not found</h1><p>${esc(what)} is private or does not exist.</p><p><a href="/explore">Explore sketchbooks and journals</a></p></main>`,
})

const bookLine = (b: Row) => {
  const count = b.kind === 'journal' ? plural(Number(b.entries ?? 0), 'entry', 'entries') : plural(artworks(b).length, 'artwork')
  return `<li><a href="/@${b.handle}/${b.id}">${esc(titleOf(b))}</a> · ${b.kind} by <a href="/@${b.handle}">${esc(nameOf(b))}</a> · ${count} · published <time datetime="${day(b.published_at)}">${longDay(b.published_at)}</time></li>`
}
const workJson = (b: Row) => ({ '@type': b.kind === 'journal' ? 'CreativeWork' : 'VisualArtwork', name: titleOf(b), url: bookUrl(b) })

seo.get('/explore', async (_req, res) => {
  const rows = await sql()`select * from (select b.id, b.kind, b.title, b.design, b.pages, b.published_at, p.handle, p.display_name,
      (select count(*)::int from journal_entries j where j.book_id = b.id and j.word_count > 0) as entries
    from books b join profiles p on p.user_id = b.user_id where b.visibility = 'public') b order by published_at desc limit ${LIST}`
  const intro = `Explore the newest public sketchbooks and journals on Scribb: ${plural(rows.length, 'book')} made by hand and shared by artists and writers. Open a book to turn its pages, or visit an artist's profile to see everything they have published.`
  await send(res, {
    path: '/explore', title: 'Explore sketchbooks and journals · Scribb', description: clip(intro, 160),
    data: [
      { '@type': 'CollectionPage', '@id': `${SITE}/explore`, url: `${SITE}/explore`, name: 'Explore sketchbooks and journals', description: intro, isPartOf: { '@id': `${SITE}/#website` } },
      { '@type': 'ItemList', numberOfItems: rows.length, itemListElement: rows.map((b, i) => ({ '@type': 'ListItem', position: i + 1, url: bookUrl(b), name: titleOf(b) })) },
      crumbs([['Scribb', `${SITE}/`], ['Explore', `${SITE}/explore`]]),
    ],
    body: `<main class="seo-page"><h1>Explore sketchbooks and journals</h1><p>${esc(intro)}</p><h2>Newest books</h2>${rows.length ? `<ul>${rows.map(bookLine).join('')}</ul>` : '<p>No public books yet.</p>'}${ABOUT}</main>`,
  })
})

seo.get('/@:handle', async (req, res) => {
  const raw = String(req.params.handle), handle = raw.toLowerCase()
  if (!HANDLE.test(handle)) return missing(res, 'This profile')
  if (raw !== handle) return res.redirect(301, `/@${handle}`)
  const [p] = await sql()`select p.*, u.email, u.email_verified_at, (select count(*)::int from follows where followee_id = p.user_id) as followers
    from profiles p join users u on u.id = p.user_id where p.handle = ${handle}`
  if (!p) return missing(res, 'This profile')
  const list = await sql()`select * from (select b.id, b.kind, b.title, b.design, b.pages, b.published_at, b.updated_at, p.handle, p.display_name,
      (select count(*)::int from journal_entries j where j.book_id = b.id and j.word_count > 0) as entries
    from books b join profiles p on p.user_id = b.user_id where b.visibility = 'public' and p.handle = ${handle}) b order by published_at desc limit ${LIST}`
  const name = nameOf(p), path = `/@${handle}`, url = `${SITE}${path}`, avatar = `/avatars/${profileAvatar(p)}.png`
  const links = Object.values((p.links ?? {}) as Record<string, string>).filter(l => /^https:\/\//.test(l))
  const sketchbooks = list.filter(b => b.kind === 'sketchbook').length, journals = list.length - sketchbooks
  const about = p.bio ? String(p.bio) : `${name} keeps ${plural(sketchbooks, 'sketchbook')} and ${plural(journals, 'journal')} on Scribb.`
  const lead = `${name} (@${handle}) has published ${plural(sketchbooks, 'sketchbook')} and ${plural(journals, 'journal')} on Scribb${p.city ? ` from ${p.city}` : ''}, and has been a member since ${longDay(p.created_at)}.${p.bio ? ` ${p.bio}` : ''}`
  const counts = [plural(sketchbooks, 'sketchbook'), plural(journals, 'journal'), plural(Number(p.followers), 'follower')].join(' · ')
  await send(res, {
    path, type: 'profile', image: list.map(coverOf).find(Boolean) || avatar, noindex: !list.length && !p.bio,
    title: `${name} (@${handle}) · Sketchbooks and journals on Scribb`,
    description: clip(`${about} ${counts}.`, 160),
    data: [
      {
        '@type': 'ProfilePage', '@id': url, url, name: `${name} on Scribb`, dateCreated: day(p.created_at), dateModified: day(list[0]?.updated_at),
        isPartOf: { '@id': `${SITE}/#website` },
        mainEntity: {
          '@type': 'Person', '@id': `${url}#person`, name, alternateName: `@${handle}`, identifier: handle, url, image: abs(avatar),
          ...(p.bio ? { description: p.bio } : {}), ...(p.city ? { homeLocation: { '@type': 'Place', name: p.city } } : {}), ...(links.length ? { sameAs: links } : {}),
          interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: Number(p.followers) },
          agentInteractionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/WriteAction', userInteractionCount: list.length },
        },
        hasPart: list.map(workJson),
      },
      crumbs([['Scribb', `${SITE}/`], [name, url]]),
    ],
    body: `<main class="seo-page"><nav><a href="/">Scribb</a> · <a href="/explore">Explore</a></nav><h1>${esc(name)}</h1><p>${esc(lead)}</p><p>${counts}</p>`
      + `<h2>Sketchbooks and journals</h2>${list.length ? `<ul>${list.map(bookLine).join('')}</ul>` : `<p>${esc(name)} has not published a book yet.</p>`}`
      + (links.length ? `<h2>Elsewhere</h2><ul>${links.map(l => `<li><a href="${esc(l)}" rel="me nofollow ugc">${esc(l.replace(/^https:\/\/(www\.)?/, ''))}</a></li>`).join('')}</ul>` : '')
      + `${ABOUT}</main>`,
  })
})

seo.get('/@:handle/:id', async (req, res) => {
  const handle = String(req.params.handle).toLowerCase(), id = String(req.params.id)
  if (!UUID.test(id)) return missing(res, 'This book')
  const [b] = await sql()`select * from (select b.id, b.kind, b.title, b.category, b.design, b.pages, b.like_count, b.save_count, b.published_at, b.updated_at,
      p.handle, p.display_name, b.user_id from books b join profiles p on p.user_id = b.user_id where b.visibility = 'public') b where id = ${id}`
  if (!b) return missing(res, 'This book')
  if (b.handle !== req.params.handle) return res.redirect(301, `/@${b.handle}/${b.id}`) // a renamed owner or a mistyped case
  const entries = b.kind === 'journal'
    ? await sql()`select entry_date::text as date, plain_text from journal_entries where book_id = ${id} and word_count > 0 order by entry_date desc, id desc limit 30`
    : []
  const more = await sql()`select * from (select b.id, b.kind, b.title, b.design, b.pages, b.published_at, p.handle, p.display_name, 0 as entries
    from books b join profiles p on p.user_id = b.user_id where b.visibility = 'public' and b.user_id = ${b.user_id} and b.id <> ${id}) b order by published_at desc limit 6`
  const name = nameOf(b), title = titleOf(b), path = `/@${handle}/${id}`, url = `${SITE}${path}`, art = artworks(b), summary = summaryOf(b)
  const what = b.kind === 'journal' ? 'journal' : 'sketchbook'
  const count = b.kind === 'journal' ? plural(entries.length, 'entry', 'entries') : plural(art.length, 'artwork')
  const lead = `${title} is a ${what} by ${name} on Scribb${b.category ? `, filed under ${b.category}` : ''}, with ${count}. ${summary || `Open it to turn the pages ${name} has filled by hand.`}`
  const stats = `${plural(Number(b.like_count), 'like')} · ${plural(Number(b.save_count), 'save')} · published ${longDay(b.published_at)}`
  const images = art.slice(0, 20).map((a: Row) => abs(String(a.src)))
  await send(res, {
    path, type: 'article', image: coverOf(b) || undefined,
    title: `${title} — a ${what} by ${name} · Scribb`, description: clip(lead, 160),
    data: [
      {
        '@type': b.kind === 'journal' ? 'CreativeWork' : 'VisualArtwork', '@id': url, url, name: title, description: lead,
        ...(b.kind === 'journal' ? { genre: 'Journal' } : { artform: 'Sketchbook' }), ...(b.category ? { keywords: b.category } : {}),
        image: coverOf(b) ? [abs(coverOf(b)), ...images] : images, datePublished: day(b.published_at), dateModified: day(b.updated_at),
        creator: { '@type': 'Person', '@id': `${SITE}/@${handle}#person`, name, url: `${SITE}/@${handle}` }, isPartOf: { '@id': `${SITE}/#website` },
        interactionStatistic: [
          { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: Number(b.like_count) },
          { '@type': 'InteractionCounter', interactionType: 'https://schema.org/BookmarkAction', userInteractionCount: Number(b.save_count) },
        ],
        ...(art.length ? { hasPart: art.slice(0, 40).map((a: Row) => ({ '@type': 'VisualArtwork', name: a.title || title, image: abs(String(a.src)), ...(a.medium ? { artMedium: a.medium } : {}) })) } : {}),
      },
      crumbs([['Scribb', `${SITE}/`], [name, `${SITE}/@${handle}`], [title, url]]),
    ],
    body: `<main class="seo-page"><nav><a href="/">Scribb</a> · <a href="/@${handle}">${esc(name)}</a> · <a href="/explore">Explore</a></nav><h1>${esc(title)}</h1><p>${esc(lead)}</p><p>${stats}</p>`
      + (art.length ? `<h2>Artworks</h2><ol>${art.slice(0, 40).map((a: Row, i: number) => `<li>${esc(a.title || `Page ${i + 1}`)}${a.medium ? ` · ${esc(a.medium)}` : ''}</li>`).join('')}</ol>` : '')
      + (entries.length ? `<h2>Entries</h2>${entries.map(e => `<article><h3><time datetime="${e.date}">${longDay(e.date)}</time></h3><p>${esc(clip(String(e.plain_text), 600))}</p></article>`).join('')}` : '')
      + `<h2>More from ${esc(name)}</h2><ul>${more.map(m => `<li><a href="/@${m.handle}/${m.id}">${esc(titleOf(m))}</a> · ${m.kind}</li>`).join('')}<li><a href="/@${handle}">Every book by ${esc(name)}</a></li></ul>`
      + `${ABOUT}</main>`,
  })
})

seo.get('/sitemap.xml', async (_req, res) => {
  const people = await sql()`select p.handle, max(b.updated_at) as at from profiles p join books b on b.user_id = p.user_id
    where b.visibility = 'public' group by p.handle order by at desc limit 10000`
  const list = await sql()`select b.id, b.updated_at, p.handle from books b join profiles p on p.user_id = b.user_id
    where b.visibility = 'public' order by b.updated_at desc limit 40000`
  const url = (loc: string, at?: unknown) => `<url><loc>${esc(SITE + loc)}</loc>${at ? `<lastmod>${day(at)}</lastmod>` : ''}</url>`
  const newest = list[0]?.updated_at
  const urls = [url('/'), url('/explore', newest), url('/about/'),
    ...people.map(p => url(`/@${p.handle}`, p.at)), ...list.map(b => url(`/@${b.handle}/${b.id}`, b.updated_at))]
  res.set('Cache-Control', 'public, max-age=0, s-maxage=3600').type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`)
})
