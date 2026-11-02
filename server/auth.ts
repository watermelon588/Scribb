import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose'
import { limit, pgCode, sql, type Row } from './db.js'
import { isCreator, profileAvatar } from './creator.js'
import { passwordResetEmail, verificationEmail, verifiedEmail } from './emails.js'

/** Minimal accounts: username + password or Google. Email is optional and only unlocks password reset (and AI). */
export const auth = Router()

export function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } })
}
const tooMany = (res: Response) => fail(res, 429, 'rate_limited', 'Too many attempts. Please wait a little and try again.')

// ---- Passwords: scrypt from the standard library, OWASP's N=2^17, r=8, p=1. Parameters are stored with each hash.
const COST = { N: 2 ** 17, r: 8, p: 1 }
function derive(password: string, salt: Buffer, cost: typeof COST) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 32, { ...cost, maxmem: 256 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))))
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString('base64')}$${(await derive(password, salt, COST)).toString('base64')}`
}
let dummy: Promise<string> | undefined
/** Unknown users and Google-only accounts still pay for one hash, so timing does not reveal which usernames exist. */
export async function verifyPassword(password: string, stored: string | null) {
  const [, N, r, p, salt, hash] = (stored ?? (await (dummy ??= hashPassword('not a real password')))).split('$')
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: +N, r: +r, p: +p })
  return timingSafeEqual(key, Buffer.from(hash, 'base64')) && stored !== null
}

// ---- Input rules
const USERNAME = /^[a-z0-9._]{3,30}$/
const RESERVED = new Set(['admin', 'administrator', 'api', 'app', 'auth', 'explore', 'feed', 'help', 'login', 'logout', 'me', 'new', 'root', 'scribb', 'settings', 'signin', 'signup', 'studio', 'support', 'system'])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const validPassword = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && value.length <= 128
export const validUsername = (name: string) => USERNAME.test(name) && !RESERVED.has(name)

// ---- Sessions: a 30-day HS256 JWT in an HttpOnly cookie, checked against token_version on every request.
const COOKIE = '__Host-scribb'
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const
function sessionKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.')
  return new TextEncoder().encode(secret)
}
async function startSession(res: Response, user: Row) {
  const jwt = await new SignJWT({ tv: user.token_version }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id).setIssuedAt().setExpirationTime('30d').sign(sessionKey())
  res.cookie(COOKIE, jwt, { ...COOKIE_OPTIONS, maxAge: 30 * 24 * 60 * 60 * 1000 })
}

async function loadUser(id: string, tokenVersion?: number) {
  const [user] = await sql()`
    select u.id, u.email, u.email_verified_at, u.token_version, u.ai_consent_at, u.password_hash is not null as has_password,
           p.handle, p.display_name, p.avatar
    from users u join profiles p on p.user_id = u.id
    where u.id = ${id} and (${tokenVersion ?? null}::int is null or u.token_version = ${tokenVersion ?? null}::int)`
  return user as Row | undefined
}
export const publicUser = (u: Row) => ({
  id: u.id, username: u.handle, displayName: u.display_name, avatar: profileAvatar(u), isCreator: isCreator(u),
  email: u.email, emailVerified: Boolean(u.email_verified_at), hasPassword: u.has_password, aiConsent: Boolean(u.ai_consent_at),
})

export async function currentUser(req: Request) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)__Host-scribb=([^;]+)/)?.[1]
  if (!token) return undefined
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] })
    return typeof payload.sub === 'string' && typeof payload.tv === 'number' ? await loadUser(payload.sub, payload.tv) : undefined
  } catch {
    return undefined
  }
}
/** Route guard: puts the signed-in user on res.locals.user, or answers 401. */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = await currentUser(req)
  if (!user) return fail(res, 401, 'signed_out', 'Please sign in.')
  res.locals.user = user
  next()
}

// ---- Email: optional, only for verification and resets. Without RESEND_API_KEY, development prints the message instead.
export const mailer = {
  async send(to: string, subject: string, body: string, html?: string) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      if (process.env.NODE_ENV === 'production') throw new Error('RESEND_API_KEY is not set.')
      return console.log(`\n[mail to ${to}] ${subject}\n${body}\n`)
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? 'Scribb <hello@scribb.xyz>', to, subject, text: body, html }),
    })
    if (!res.ok) throw new Error(`Resend answered ${res.status}`)
  },
}
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const origin = (req: Request) => process.env.APP_ORIGIN ?? `${req.protocol}://${req.headers.host}`
async function issueToken(userId: string, purpose: 'verify' | 'reset', email: string, seconds: number) {
  const token = randomBytes(32).toString('base64url')
  await sql()`insert into email_tokens (token_hash, user_id, purpose, email, expires_at)
              values (${sha256(token)}, ${userId}, ${purpose}, ${email}, now() + ${seconds}::int * interval '1 second')`
  return token
}

// ---- Routes
auth.get('/auth/me', async (req, res) => {
  const user = await currentUser(req)
  res.json({ user: user ? publicUser(user) : null })
})

auth.post('/auth/register', async (req, res) => {
  const username = text(req.body?.username).toLowerCase(), password = req.body?.password
  if (!validUsername(username)) return fail(res, 400, 'bad_username', 'Usernames are 3 to 30 lowercase letters, numbers, dots or underscores.')
  if (!validPassword(password)) return fail(res, 400, 'bad_password', 'Passwords are 8 to 128 characters.')
  if (!(await limit(`register:${req.ip}`, 5, 3600))) return tooMany(res)
  const hash = await hashPassword(password)
  let id: string
  try {
    // One statement, so a taken username never leaves an orphaned user row.
    const [row] = await sql()`
      with u as (insert into users (password_hash) values (${hash}) returning id)
      insert into profiles (user_id, handle, display_name) select id, ${username}, ${username} from u returning user_id`
    id = row.user_id
  } catch (err) {
    if (pgCode(err) === '23505') return fail(res, 409, 'username_taken', 'That username is taken.')
    throw err
  }
  const user = (await loadUser(id))!
  await startSession(res, user)
  res.status(201).json({ user: publicUser(user) })
})

auth.post('/auth/login', async (req, res) => {
  const login = text(req.body?.username).toLowerCase(), password = req.body?.password
  if (!login || typeof password !== 'string' || password.length > 128) return fail(res, 400, 'bad_login', 'Enter your username and password.')
  if (!(await limit(`login-ip:${req.ip}`, 30, 900)) || !(await limit(`login:${login}`, 10, 900))) return tooMany(res)
  const [found] = await sql()`
    select u.id, u.password_hash from users u join profiles p on p.user_id = u.id
    where p.handle = ${login} or (u.email = ${login} and u.email_verified_at is not null) limit 1`
  if (!(await verifyPassword(password, found?.password_hash ?? null))) return fail(res, 401, 'bad_login', 'That username and password do not match.')
  const user = (await loadUser(found.id))!
  await startSession(res, user)
  res.json({ user: publicUser(user) })
})

export const google: { keys: JWTVerifyGetKey } = { keys: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')) }
auth.post('/auth/google', async (req, res) => {
  const audience = process.env.GOOGLE_CLIENT_ID
  if (!audience) return fail(res, 503, 'google_unavailable', 'Google sign-in is not set up yet.')
  if (!(await limit(`google:${req.ip}`, 30, 900))) return tooMany(res)
  let claims
  try {
    ({ payload: claims } = await jwtVerify(text(req.body?.credential), google.keys, { audience, issuer: ['https://accounts.google.com', 'accounts.google.com'] }))
  } catch {
    return fail(res, 401, 'bad_google_token', 'Google sign-in failed. Please try again.')
  }
  const sub = claims.sub
  if (!sub) return fail(res, 401, 'bad_google_token', 'Google sign-in failed. Please try again.')
  const email = claims.email_verified === true && typeof claims.email === 'string' ? claims.email.toLowerCase() : null
  let [row] = await sql()`select id from users where google_sub = ${sub}`
  // Link only to an email the Scribb user has verified, so claiming an address never takes over an account.
  if (!row && email) [row] = await sql()`update users set google_sub = ${sub} where email = ${email} and email_verified_at is not null and google_sub is null returning id`
  const id = row?.id ?? (await createGoogleUser(sub, email, typeof claims.name === 'string' ? claims.name.slice(0, 60) : ''))
  const user = (await loadUser(id))!
  await startSession(res, user)
  res.status(row ? 200 : 201).json({ user: publicUser(user) })
})
async function createGoogleUser(sub: string, email: string | null, name: string) {
  const base = (email?.split('@')[0] ?? '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24)
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = attempt === 0 && base.length >= 3 && validUsername(base) ? base : `${base.length >= 3 ? base : 'artist'}${Math.floor(1000 + Math.random() * 9000)}`
    try {
      const [row] = await sql()`
        with u as (insert into users (google_sub, email, email_verified_at)
                   values (${sub}, ${email}, case when ${email}::text is null then null else now() end) returning id)
        insert into profiles (user_id, handle, display_name) select id, ${handle}, ${name || handle} from u returning user_id`
      return row.user_id as string
    } catch (err) {
      if (pgCode(err) !== '23505') throw err
      if ((err as { constraint?: string }).constraint === 'users_verified_email') email = null // already verified on another account
    }
  }
  throw new Error('Could not choose a free username.')
}

export const endSession = (res: Response) => void res.clearCookie(COOKIE, COOKIE_OPTIONS)
auth.post('/auth/logout', (_req, res) => {
  endSession(res)
  res.status(204).end()
})

// Always the same answer, so it never reveals which emails have accounts.
auth.post('/auth/forgot', async (req, res) => {
  const email = text(req.body?.email).toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) return fail(res, 400, 'bad_email', 'Enter a valid email address.')
  if (!(await limit(`forgot-ip:${req.ip}`, 5, 3600)) || !(await limit(`forgot:${email}`, 3, 3600))) return tooMany(res)
  const [user] = await sql()`select id from users where email = ${email} and email_verified_at is not null`
  if (user) {
    const token = await issueToken(user.id, 'reset', email, 3600)
    const content = passwordResetEmail(origin(req), token)
    await mailer.send(email, content.subject, content.text, content.html)
  }
  res.status(202).json({ ok: true })
})

auth.post('/auth/reset', async (req, res) => {
  const token = text(req.body?.token), password = req.body?.password
  if (!validPassword(password)) return fail(res, 400, 'bad_password', 'Passwords are 8 to 128 characters.')
  if (!(await limit(`reset-ip:${req.ip}`, 10, 3600))) return tooMany(res)
  const hash = await hashPassword(password)
  // Using the token, setting the password and signing out every device happen in one statement.
  const [row] = await sql()`
    with t as (update email_tokens set used_at = now()
               where token_hash = ${sha256(token)} and purpose = 'reset' and used_at is null and expires_at > now() returning user_id)
    update users set password_hash = ${hash}, token_version = token_version + 1 where id = (select user_id from t) returning id`
  if (!row) return fail(res, 400, 'bad_token', 'This link has expired or was already used.')
  const user = (await loadUser(row.id))!
  await startSession(res, user)
  res.json({ user: publicUser(user) })
})

auth.post('/auth/verify-email', async (req, res) => {
  const token = text(req.body?.token)
  if (!(await limit(`verify-ip:${req.ip}`, 20, 3600))) return tooMany(res)
  let verifiedAddress: string
  try {
    const [row] = await sql()`
      with t as (update email_tokens set used_at = now()
                 where token_hash = ${sha256(token)} and purpose = 'verify' and used_at is null and expires_at > now() returning user_id, email)
      update users u set email = t.email, email_verified_at = now() from t where u.id = t.user_id returning u.id, u.email`
    if (!row) return fail(res, 400, 'bad_token', 'This link has expired or was already used.')
    verifiedAddress = row.email
  } catch (err) {
    if (pgCode(err) === '23505') return fail(res, 409, 'email_in_use', 'That email is already linked to another account.')
    throw err
  }
  // A delivery problem must never undo verification or turn a consumed link into a failed screen.
  try {
    const content = verifiedEmail(origin(req))
    await mailer.send(verifiedAddress, content.subject, content.text, content.html)
  } catch { console.error('Email verified, but the confirmation email could not be delivered.') }
  res.json({ ok: true })
})

// The current email stays until the new one is verified, so a typo never locks anyone out of resets.
auth.put('/me/email', requireUser, async (req, res) => {
  const user = res.locals.user as Row, email = text(req.body?.email).toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) return fail(res, 400, 'bad_email', 'Enter a valid email address.')
  if (!(await limit(`email:${user.id}`, 5, 3600))) return tooMany(res)
  if (email === user.email && user.email_verified_at) return void res.json({ ok: true, alreadyVerified: true })
  const token = await issueToken(user.id, 'verify', email, 24 * 3600)
  const content = verificationEmail(origin(req), user.handle, token)
  await mailer.send(email, content.subject, content.text, content.html)
  res.status(202).json({ ok: true })
})

auth.put('/me/password', requireUser, async (req, res) => {
  const user = res.locals.user as Row, password = req.body?.password
  if (!validPassword(password)) return fail(res, 400, 'bad_password', 'Passwords are 8 to 128 characters.')
  if (!(await limit(`password:${user.id}`, 10, 3600))) return tooMany(res)
  if (user.has_password) {
    const [row] = await sql()`select password_hash from users where id = ${user.id}`
    const current = req.body?.current
    if (typeof current !== 'string' || current.length > 128 || !(await verifyPassword(current, row.password_hash))) return fail(res, 401, 'bad_password', 'Your current password is not right.')
  }
  const hash = await hashPassword(password)
  await sql()`update users set password_hash = ${hash}, token_version = token_version + 1 where id = ${user.id}`
  const fresh = (await loadUser(user.id))!
  await startSession(res, fresh) // this device stays signed in; every other device is signed out
  res.json({ user: publicUser(fresh) })
})
