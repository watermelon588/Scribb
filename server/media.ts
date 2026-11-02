import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import express, { Router } from 'express'
import { fail, requireUser } from './auth.js'
import { limit, sql, type Row } from './db.js'

/** Image upload. The browser has already checked and re-encoded the picture; Express checks the size,
 * the real file type and the user's quota, then stores it in Cloudinary.
 * Without Cloudinary keys, development keeps files in .data/uploads and serves them from /api/media. */
export const media = Router()

const MAX_BYTES = { artwork: 1024 * 1024, cover: 1024 * 1024, journal: 200 * 1024 } as const
const QUOTA_BYTES = (Number(process.env.MEDIA_QUOTA_MB) || 300) * 1024 * 1024
const LOCAL_DIR = '.data/uploads'

/** The type from the file's first bytes, never from its name or headers. */
function imageType(b: Buffer) {
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  return null
}

async function toCloudinary(file: Buffer, type: string, folder: string, id: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!, key = process.env.CLOUDINARY_API_KEY!, secret = process.env.CLOUDINARY_API_SECRET!
  const params: Record<string, string> = { folder, public_id: id, timestamp: String(Math.floor(Date.now() / 1000)) }
  const signed = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  const form = new FormData()
  for (const [k, v] of Object.entries(params)) form.set(k, v)
  form.set('api_key', key)
  form.set('signature', createHash('sha1').update(signed + secret).digest('hex'))
  form.set('file', new Blob([new Uint8Array(file)], { type: `image/${type === 'jpg' ? 'jpeg' : type}` }))
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Cloudinary answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const body = await res.json() as { secure_url: string; public_id: string }
  return { url: body.secure_url, publicId: body.public_id }
}

media.post('/media', requireUser, express.raw({ type: ['image/webp', 'image/jpeg', 'image/png'], limit: '1mb' }), async (req, res) => {
  const user = res.locals.user as Row, kind = String(req.query.kind) as keyof typeof MAX_BYTES
  if (!(kind in MAX_BYTES)) return fail(res, 400, 'bad_kind', 'Unknown image kind.')
  const file = req.body
  if (!Buffer.isBuffer(file) || !file.length) return fail(res, 400, 'bad_image', 'Send a JPG, PNG or WebP image.')
  if (file.length > MAX_BYTES[kind]) return fail(res, 413, 'too_large', kind === 'journal' ? 'Journal pictures are up to 200 KB.' : 'Images are up to 1 MB.')
  const type = imageType(file)
  if (!type) return fail(res, 400, 'bad_image', 'This file is not a JPG, PNG or WebP image.')
  if (!(await limit(`media:${user.id}`, 200, 3600))) return fail(res, 429, 'rate_limited', 'Too many uploads. Please wait a little.')
  const [{ used }] = await sql()`select coalesce(sum(bytes), 0)::bigint as used from media where user_id = ${user.id}`
  if (Number(used) + file.length > QUOTA_BYTES) return fail(res, 413, 'quota_full', 'Your image storage is full. Remove some books or pictures first.')

  const id = randomUUID()
  let stored: { url: string; publicId: string | null }
  if (process.env.CLOUDINARY_API_SECRET) stored = await toCloudinary(file, type, `scribb/${user.id}`, id)
  else if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    await mkdir(LOCAL_DIR, { recursive: true })
    await writeFile(`${LOCAL_DIR}/${id}.${type}`, file)
    stored = { url: `/api/media/${id}.${type}`, publicId: null }
  } else return fail(res, 503, 'media_unavailable', 'Image upload is not set up yet.')
  // ponytail: images are never deleted from Cloudinary yet; delete by public_id when books and accounts are removed.
  await sql()`insert into media (id, user_id, kind, bytes, url, public_id) values (${id}, ${user.id}, ${kind}, ${file.length}, ${stored.url}, ${stored.publicId})`
  res.status(201).json({ url: stored.url })
})

// Development only: serves the files saved above. Names are a UUID and an extension, so no path escapes the folder.
media.get('/media/:file', async (req, res) => {
  const name = String(req.params.file), match = /^[0-9a-f-]{36}\.(webp|jpg|png)$/.exec(name)
  if (process.env.VERCEL || !match) return fail(res, 404, 'not_found', 'No such image.')
  try {
    res.type(match[1]).set('cache-control', 'public, max-age=31536000, immutable').send(await readFile(`${LOCAL_DIR}/${name}`))
  } catch {
    fail(res, 404, 'not_found', 'No such image.')
  }
})
