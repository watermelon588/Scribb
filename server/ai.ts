import { randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { SignJWT } from 'jose'
import { fail, requireUser } from './auth.js'
import { limit, sql, type Row } from './db.js'

/** Express decides who may use Scribb AI. The browser then shows Render a 60-second, one-time ticket;
 * Render never decides identity itself. Nothing here contacts Render, so Scribb works while it sleeps. */
export const ai = Router()

// Google requires its paid tier for users in the EEA, the UK and Switzerland, and Scribb uses the free tier.
const PAID_TIER_ONLY = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH'.split(' '))
const MODES = ['ask', 'listen', 'call'] as const
const number = (name: string, fallback: number) => Number(process.env[name]) || fallback

ai.post('/ai/consent', requireUser, async (_req, res) => {
  await sql()`update users set ai_consent_at = now() where id = ${(res.locals.user as Row).id}`
  res.json({ ok: true })
})
ai.delete('/ai/consent', requireUser, async (_req, res) => {
  await sql()`update users set ai_consent_at = null where id = ${(res.locals.user as Row).id}`
  res.json({ ok: true })
})

function available(req: Request, res: Response) {
  const user = res.locals.user as Row
  const secret = process.env.AI_TICKET_SECRET
  if (process.env.AI_ENABLED === 'false' || !process.env.AI_URL || !secret || secret.length < 32) { fail(res, 503, 'ai_unavailable', 'Scribb AI is switched off right now.'); return false }
  if (!user.email_verified_at) { fail(res, 403, 'email_required', 'Verify your email in Settings to use Scribb AI.'); return false }
  if (!user.ai_consent_at) { fail(res, 403, 'consent_required', 'Turn on Scribb AI first.'); return false }
  const country = req.headers['x-vercel-ip-country']
  if (typeof country === 'string' && PAID_TIER_ONLY.has(country.toUpperCase())) { fail(res, 403, 'region_unavailable', 'Scribb AI is not available in your region yet.'); return false }
  return true
}
// Opening the panel makes no external call. Waking the service does not spend a daily turn.
ai.get('/ai/status', requireUser, (req, res) => {
  if (available(req, res)) res.json({ url: process.env.AI_URL })
})
ai.post('/ai/ticket', requireUser, async (req, res) => {
  const user = res.locals.user as Row, mode = req.body?.mode
  if (!MODES.includes(mode)) return fail(res, 400, 'bad_mode', 'Unknown AI mode.')
  if (!available(req, res)) return
  const secret = process.env.AI_TICKET_SECRET!
  // Daily windows start at 00:00 UTC (05:30 in India). ponytail: a refused global check still spends one user turn.
  const own = mode === 'call' ? limit(`ai-call:${user.id}`, number('AI_DAILY_CALLS', 3), 86400) : limit(`ai:${user.id}`, number('AI_DAILY_QUOTA', 20), 86400)
  if (!(await own)) return fail(res, 429, 'quota_used', 'You have used today\'s Scribb AI allowance. It resets every day at 5:30 AM IST.')
  if (!(await limit('ai:all', number('AI_GLOBAL_DAILY', 300), 86400))) return fail(res, 429, 'ai_resting', 'Scribb AI is resting for today. Please try again tomorrow.')
  const ticket = await new SignJWT({ mode }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setAudience('scribb-ai')
    .setJti(randomUUID()).setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(secret))
  res.json({ url: process.env.AI_URL, ticket, expiresIn: 60 })
})
