import express, { type NextFunction, type Request, type Response } from 'express'
import { ai } from './ai.js'
import { auth, fail } from './auth.js'
import { books } from './books.js'
import { sql } from './db.js'
import { media } from './media.js'
import { people } from './people.js'

/** The Scribb core API. Vercel runs it as one function behind /api (api/index.ts); dev.ts runs it locally. */
const app = express()
app.disable('x-powered-by')
// Private account and journal responses must never be stored by a shared cache.
app.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
// On Vercel the edge sets X-Forwarded-For, so req.ip is the visitor. Locally the header is not trusted.
if (process.env.VERCEL) app.set('trust proxy', true)
app.use(express.json({ limit: '256kb' }))

// The app and API share one origin, so a write from any other site is refused (SameSite cookies are the first line).
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (req.method === 'GET' || req.method === 'HEAD' || !origin) return next()
  try {
    if (new URL(origin).host === req.headers.host) return next()
  } catch { /* fall through */ }
  fail(res, 403, 'bad_origin', 'Requests must come from Scribb.')
})

app.get('/api/health', async (_req, res) => {
  if (!process.env.DATABASE_URL) return void res.json({ ok: true, db: 'unconfigured' })
  try {
    await sql()`select 1`
    res.json({ ok: true, db: 'ok' })
  } catch {
    res.status(503).json({ ok: false, db: 'down' })
  }
})
app.use('/api', auth, people, books, media, ai)

app.use((_req, res) => fail(res, 404, 'not_found', 'No such endpoint.'))

// Express 5 forwards rejected promises here. Never send internals to the client, and never log request bodies.
app.use((err: Error & { type?: string }, req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.too.large') return fail(res, 413, 'too_large', 'Request body is too large.')
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'bad_json', 'Request body is not valid JSON.')
  console.error(`${req.method} ${req.path} failed:`, err.message)
  fail(res, 500, 'internal', 'Something went wrong. Please try again.')
})

export default app
