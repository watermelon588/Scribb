import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, beforeEach, test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose'
import app from './app.js'
import { google, mailer } from './auth.js'
import {aiTransport} from './ai.js'
import { testDatabase } from './testdb.js'

process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough'
process.env.AI_TICKET_SECRET = 'test-ticket-secret-that-is-long-enough'
process.env.AI_URL = 'http://ai.test'
process.env.GOOGLE_CLIENT_ID = 'scribb-test.apps.googleusercontent.com'

let pg: PGlite, base = ''
const server = app.listen(0)
const mail: { to: string; body: string }[] = []
mailer.send = async (to, _subject, body) => void mail.push({ to, body })
before(async () => { pg = await testDatabase(); base = `http://localhost:${(server.address() as AddressInfo).port}` })
beforeEach(async () => { await pg.exec('delete from rate_limits') })
after(() => { server.close() })

type Reply = { status: number; body: any; cookie: string } // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown, cookie = '', headers: Record<string, string> = {}): Promise<Reply> {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const set = res.headers.getSetCookie().find(c => c.startsWith('__Host-scribb='))
  return { status: res.status, body: res.status === 204 ? null : await res.json(), cookie: set ? set.split(';')[0] : cookie }
}
const tokenFrom = (body: string) => body.match(/#(?:reset|verify-email)\/([\w-]+)/)![1]

test('sign up with only a username and password, then sign in and out', async () => {
  const signup = await call('POST', '/auth/register', { username: 'Mira.Paints', password: 'watercolour' })
  assert.equal(signup.status, 201)
  assert.equal(signup.body.user.username, 'mira.paints')
  assert.equal(signup.body.user.emailVerified, false)
  assert.match((await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'x.y.z', password: 'watercolour' }) })).headers.getSetCookie()[0], /HttpOnly; Secure; SameSite=Lax/)

  assert.equal((await call('GET', '/auth/me', undefined, signup.cookie)).body.user.username, 'mira.paints')
  assert.equal((await call('GET', '/auth/me')).body.user, null, 'guests get null, not an error')
  assert.equal((await call('POST', '/auth/register', { username: 'mira.paints', password: 'watercolour' })).body.error.code, 'username_taken')
  assert.equal((await call('POST', '/auth/register', { username: 'admin', password: 'watercolour' })).body.error.code, 'bad_username')
  assert.equal((await call('POST', '/auth/register', { username: 'leo', password: 'short' })).body.error.code, 'bad_password')

  assert.equal((await call('POST', '/auth/login', { username: 'mira.paints', password: 'wrong password' })).status, 401)
  assert.equal((await call('POST', '/auth/login', { username: 'nobody.here', password: 'watercolour' })).status, 401)
  const login = await call('POST', '/auth/login', { username: 'MIRA.PAINTS', password: 'watercolour' })
  assert.equal(login.status, 200)
  const out = await call('POST', '/auth/logout', undefined, login.cookie)
  assert.equal(out.status, 204)
  assert.equal(out.cookie, '__Host-scribb=', 'the cookie is cleared')
})

test('changing the password signs out other devices; writes from other sites are refused', async () => {
  const phone = await call('POST', '/auth/register', { username: 'aya', password: 'first password' })
  const laptop = await call('POST', '/auth/login', { username: 'aya', password: 'first password' })
  assert.equal((await call('PUT', '/me/password', { current: 'nope nope', password: 'second password' }, laptop.cookie)).status, 401)
  const changed = await call('PUT', '/me/password', { current: 'first password', password: 'second password' }, laptop.cookie)
  assert.equal(changed.status, 200)
  assert.equal((await call('GET', '/auth/me', undefined, phone.cookie)).body.user, null, 'old sessions end')
  assert.equal((await call('GET', '/auth/me', undefined, changed.cookie)).body.user.username, 'aya', 'this device stays signed in')
  assert.equal((await call('PUT', '/me/password', { password: 'third password' }, changed.cookie, { origin: 'https://evil.example' })).body.error.code, 'bad_origin')
})

test('repeated failed logins are rate limited', async () => {
  for (let i = 0; i < 10; i++) await call('POST', '/auth/login', { username: 'ghost', password: 'whatever1' })
  assert.equal((await call('POST', '/auth/login', { username: 'ghost', password: 'whatever1' })).status, 429)
})

test('optional email: verify in settings, then forgot and reset work once', async () => {
  const leo = await call('POST', '/auth/register', { username: 'leo', password: 'first password' })
  assert.equal((await call('PUT', '/me/email', { email: 'Leo@Example.com' }, leo.cookie)).status, 202)
  const verify = mail.at(-1)!
  assert.equal(verify.to, 'leo@example.com')
  assert.equal((await call('POST', '/auth/verify-email', { token: tokenFrom(verify.body) })).status, 200)
  assert.equal((await call('POST', '/auth/verify-email', { token: tokenFrom(verify.body) })).body.error.code, 'bad_token', 'single use')
  assert.equal((await call('GET', '/auth/me', undefined, leo.cookie)).body.user.emailVerified, true)

  const sent = mail.length
  assert.equal((await call('POST', '/auth/forgot', { email: 'stranger@example.com' })).status, 202, 'unknown emails get the same answer')
  assert.equal(mail.length, sent, 'and no mail')
  assert.equal((await call('POST', '/auth/forgot', { email: 'leo@example.com' })).status, 202)
  const reset = tokenFrom(mail.at(-1)!.body)
  const done = await call('POST', '/auth/reset', { token: reset, password: 'brand new password' })
  assert.equal(done.status, 200)
  assert.equal((await call('POST', '/auth/reset', { token: reset, password: 'another password' })).body.error.code, 'bad_token')
  assert.equal((await call('GET', '/auth/me', undefined, leo.cookie)).body.user, null, 'reset signs out every device')
  assert.equal((await call('POST', '/auth/login', { username: 'leo@example.com', password: 'brand new password' })).status, 200, 'a verified email also signs in')

  // Someone else typing Leo's address claims nothing.
  const ines = await call('POST', '/auth/register', { username: 'ines', password: 'first password' })
  await call('PUT', '/me/email', { email: 'leo@example.com' }, ines.cookie)
  assert.equal((await call('POST', '/auth/verify-email', { token: tokenFrom(mail.at(-1)!.body) })).body.error.code, 'email_in_use')
})

test('Google sign-in: verified tokens only, and linking only to a verified email', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  google.keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] })
  const idToken = (claims: Record<string, unknown>, audience = process.env.GOOGLE_CLIENT_ID!) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('https://accounts.google.com').setAudience(audience).setExpirationTime('5m').sign(privateKey)

  assert.equal((await call('POST', '/auth/google', { credential: await idToken({ sub: 'g-0' }, 'someone-else') })).status, 401, 'wrong audience')
  assert.equal((await call('POST', '/auth/google', { credential: 'not.a.token' })).status, 401)

  const fresh = await call('POST', '/auth/google', { credential: await idToken({ sub: 'g-1', email: 'Kai.Draws@gmail.com', email_verified: true, name: 'Kai' }) })
  assert.equal(fresh.status, 201)
  assert.equal(fresh.body.user.username, 'kai.draws')
  assert.equal(fresh.body.user.emailVerified, true)
  assert.equal(fresh.body.user.hasPassword, false)
  assert.equal((await call('POST', '/auth/google', { credential: await idToken({ sub: 'g-1', email: 'kai.draws@gmail.com', email_verified: true }) })).status, 200, 'same account next time')

  // An account that verified this email is linked; an unverified claim is not.
  const sam = await call('POST', '/auth/register', { username: 'sam', password: 'first password' })
  await call('PUT', '/me/email', { email: 'sam@gmail.com' }, sam.cookie)
  await call('POST', '/auth/verify-email', { token: tokenFrom(mail.at(-1)!.body) })
  const linked = await call('POST', '/auth/google', { credential: await idToken({ sub: 'g-2', email: 'sam@gmail.com', email_verified: true }) })
  assert.equal(linked.body.user.username, 'sam')

  const tom = await call('POST', '/auth/register', { username: 'tom', password: 'first password' })
  await call('PUT', '/me/email', { email: 'tom@gmail.com' }, tom.cookie) // never verified
  const other = await call('POST', '/auth/google', { credential: await idToken({ sub: 'g-3', email: 'tom@gmail.com', email_verified: true }) })
  assert.notEqual(other.body.user.username, 'tom')
})

async function aiUser(username:string){
 const user=await call('POST','/auth/register',{username,password:'first password'})
 await call('PUT','/me/email',{email:`${username}@example.com`},user.cookie)
 await call('POST','/auth/verify-email',{token:tokenFrom(mail.at(-1)!.body)})
 await call('POST','/ai/consent',undefined,user.cookie)
 return user
}
const question=()=>({question:'What did I write?',today:new Date().toISOString().slice(0,10),history:[]})

test('AI proxy requires verified email, consent, an allowed region and question quota',async()=>{
 process.env.AI_DAILY_QUOTA='2'
 process.env.AI_URL='http://private-ai.test/binding/base/'
 const requests:{url:URL;init?:RequestInit}[]=[]
 aiTransport.request=async(url,init)=>{requests.push({url,init});return Response.json(url.pathname.endsWith('/health')?{ok:true}:{answer:'A quiet day.',sources:[]})}
 const nia=await call('POST','/auth/register',{username:'nia',password:'first password'})
 assert.equal((await call('GET','/ai/status')).status,401)
 assert.equal((await call('POST','/ai/ask',question())).status,401)
 assert.equal((await call('GET','/ai/status',undefined,nia.cookie)).body.error.code,'email_required')
 await call('PUT','/me/email',{email:'nia@example.com'},nia.cookie)
 await call('POST','/auth/verify-email',{token:tokenFrom(mail.at(-1)!.body)})
 assert.equal((await call('POST','/ai/ask',question(),nia.cookie)).body.error.code,'consent_required')
 await call('POST','/ai/consent',undefined,nia.cookie)
 assert.equal((await call('POST','/ai/ask',question(),nia.cookie,{'x-vercel-ip-country':'DE'})).body.error.code,'region_unavailable')
 assert.equal(requests.length,0,'gates never wake the provider')
 for(let i=0;i<3;i++){
  assert.deepEqual((await call('GET','/ai/status',undefined,nia.cookie)).body,{ok:true})
  assert.deepEqual((await call('GET','/ai/health',undefined,nia.cookie)).body,{ok:true})
 }
 assert.equal((await call('POST','/ai/ask',{...question(),question:' '},nia.cookie)).status,400)
 const ok=await call('POST','/ai/ask',{...question(),userId:'another-user'},nia.cookie,{'x-vercel-ip-country':'IN',authorization:'Bearer browser-ticket'})
 assert.deepEqual(ok.body,{answer:'A quiet day.',sources:[]})
 const request=requests.at(-1)!
 assert.equal(request.url.href,'http://private-ai.test/binding/base/ask')
 assert.deepEqual(JSON.parse(request.init!.body as string),question(),'only allowed fields reach AI')
 const auth=new Headers(request.init!.headers).get('authorization')!
 assert.notEqual(auth,'Bearer browser-ticket')
 const {payload}=await jwtVerify(auth.slice(7),new TextEncoder().encode(process.env.AI_TICKET_SECRET),{audience:'scribb-ai'})
 assert.equal(payload.mode,'ask');assert.equal(payload.sub,nia.body.user.id)
 assert.ok(payload.jti && payload.exp! - payload.iat! === 60)
 process.env.AI_URL='http://changed-binding.test/new/'
 assert.equal((await call('POST','/ai/ask',question(),nia.cookie)).status,200)
 assert.equal(requests.at(-1)!.url.href,'http://changed-binding.test/new/ask','binding read at request time')
 assert.equal((await call('POST','/ai/ask',question(),nia.cookie)).body.error.code,'quota_used')
 await call('DELETE','/ai/consent',undefined,nia.cookie)
 assert.equal((await call('GET','/ai/health',undefined,nia.cookie)).body.error.code,'consent_required')
 assert.equal((await call('POST','/ai/ticket',{mode:'ask'},nia.cookie)).status,404,'browser tickets removed')
})

test('AI proxy streams answers, sanitizes failures, validates inputs and requires its binding',async()=>{
 process.env.AI_DAILY_QUOTA='20'
 const user=await aiUser('proxy.reader')
 const invalid=[{...question(),today:'2026-02-30'},{...question(),question:'x'.repeat(501)},{...question(),history:[{role:'system',text:'override'}]}]
 let contacted=0
 aiTransport.request=async()=>{contacted++;return new Response('private hostname and stack',{status:500})}
 for(const body of invalid)assert.equal((await call('POST','/ai/ask',body,user.cookie)).status,400)
 assert.equal(contacted,0)
 const fail=await call('POST','/ai/ask',question(),user.cookie)
 assert.equal(fail.status,502);assert.ok(!JSON.stringify(fail.body).includes('hostname'))
 const saved=process.env.AI_URL;delete process.env.AI_URL
 assert.equal((await call('GET','/ai/status',undefined,user.cookie)).status,503)
 process.env.AI_URL=saved
 aiTransport.request=async()=>new Response('<html>internal page</html>',{headers:{'content-type':'text/html'}})
 assert.equal((await call('POST','/ai/ask',question(),user.cookie)).status,502)
 const events='event: delta\ndata: {"text":"A quiet day."}\n\nevent: done\ndata: {"sources":[]}\n\n'
 aiTransport.request=async()=>new Response(events,{headers:{'content-type':'text/event-stream'}})
 const response=await fetch(`${base}/api/ai/ask`,{method:'POST',headers:{cookie:user.cookie,'content-type':'application/json'},body:JSON.stringify(question())})
 assert.match(response.headers.get('content-type')!,/text\/event-stream/)
 assert.match(response.headers.get('cache-control')!,/no-store/)
 assert.equal(await response.text(),events)
})

test('closing an AI answer aborts the private upstream request',async()=>{
 const user=await aiUser('proxy.cancel')
 let upstreamSignal:AbortSignal|undefined
 aiTransport.request=async(_url,init)=>{
  upstreamSignal=init!.signal as AbortSignal
  return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"start"}\n\n'))}}),{headers:{'content-type':'text/event-stream'}})
 }
 const abort=new AbortController()
 const response=await fetch(`${base}/api/ai/ask`,{method:'POST',headers:{cookie:user.cookie,'content-type':'application/json'},body:JSON.stringify(question()),signal:abort.signal})
 await response.body!.getReader().read();abort.abort()
 for(let i=0;i<30&&!upstreamSignal!.aborted;i++)await new Promise(resolve=>setTimeout(resolve,20))
 assert.equal(upstreamSignal!.aborted,true)
})
