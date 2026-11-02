import {randomUUID} from 'node:crypto'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import type {ReadableStream} from 'node:stream/web'
import {Router,type Request,type Response} from 'express'
import {SignJWT} from 'jose'
import {fail,requireUser} from './auth.js'
import {limit,sql,type Row} from './db.js'

/** Only this API service calls private Python AI over the runtime AI_URL binding.
 * Tickets and internal URLs never reach the browser. No provider calls occur on app load. */
export const ai=Router()
export const aiTransport={request:(url:URL,init?:RequestInit)=>fetch(url,init)}
const PAID_TIER_ONLY=new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH'.split(' '))
const number=(name:string,fallback:number)=>Number(process.env[name])||fallback

function serviceUrl(path:'health'|'ask'){
  // Read at request time: bindings do not exist during builds or in browser code.
  const base=new URL(process.env.AI_URL!)
  if(!['http:','https:'].includes(base.protocol))throw new Error('Invalid AI service binding.')
  if(!base.pathname.endsWith('/'))base.pathname+='/'
  return new URL(path,base)
}
function available(req:Request,res:Response){
  const user=res.locals.user as Row,secret=process.env.AI_TICKET_SECRET
  if(process.env.AI_ENABLED==='false'||!process.env.AI_URL||!secret||secret.length<32){fail(res,503,'ai_unavailable','Scribb AI is switched off right now.');return false}
  if(!user.email_verified_at){fail(res,403,'email_required','Verify your email in Settings to use Scribb AI.');return false}
  if(!user.ai_consent_at){fail(res,403,'consent_required','Turn on Scribb AI first.');return false}
  const country=req.headers['x-vercel-ip-country']
  if(typeof country==='string'&&PAID_TIER_ONLY.has(country.toUpperCase())){fail(res,403,'region_unavailable','Scribb AI is not available in your region yet.');return false}
  return true
}
ai.post('/ai/consent',requireUser,async(_req,res)=>{
  await sql()`update users set ai_consent_at = now() where id = ${(res.locals.user as Row).id}`
  res.json({ok:true})
})
ai.delete('/ai/consent',requireUser,async(_req,res)=>{
  await sql()`update users set ai_consent_at = null where id = ${(res.locals.user as Row).id}`
  res.json({ok:true})
})
ai.get('/ai/status',requireUser,(req,res)=>{if(available(req,res))res.json({ok:true})})
ai.get('/ai/health',requireUser,async(req,res)=>{
  if(!available(req,res))return
  try{
    const upstream=await aiTransport.request(serviceUrl('health'),{signal:AbortSignal.timeout(8000),redirect:'error'})
    const health=await upstream.json() as {ok?:unknown}
    const healthy=upstream.ok&&health.ok===true
    if(healthy)res.json({ok:true})
    else fail(res,503,'ai_waking','The AI service is starting. Please try again in a moment.')
  }catch{fail(res,503,'ai_waking','The AI service is starting. Please try again in a moment.')}
})

type HistoryTurn={role:'user'|'assistant';text:string}
function questionOf(value:unknown):{question:string;today:string;history:HistoryTurn[]}|null{
  if(!value||typeof value!=='object')return null
  const {question,today,history=[]}=value as Record<string,unknown>
  if(typeof question!=='string'||!question.trim()||question.length>500||typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today)||!Array.isArray(history)||history.length>6)return null
  const date=new Date(`${today}T00:00:00Z`)
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==today)return null
  const turns:HistoryTurn[]=[]
  for(const turn of history){
    if(!turn||typeof turn!=='object'||!['user','assistant'].includes(turn.role)||typeof turn.text!=='string'||turn.text.length>2000)return null
    turns.push({role:turn.role,text:turn.text})
  }
  return {question:question.trim(),today,history:turns}
}

ai.post('/ai/ask',requireUser,async(req,res)=>{
  if(!available(req,res))return
  const body=questionOf(req.body)
  if(!body)return fail(res,400,'bad_question','Ask a question up to 500 characters with a valid date and recent conversation.')
  const user=res.locals.user as Row
  if(!(await limit(`ai:${user.id}`,number('AI_DAILY_QUOTA',20),86400)))return fail(res,429,'quota_used','You have used today’s Scribb AI allowance. It resets every day at 5:30 AM IST.')
  if(!(await limit('ai:all',number('AI_GLOBAL_DAILY',300),86400)))return fail(res,429,'ai_resting','Scribb AI is resting for today. Please try again tomorrow.')
  const ticket=await new SignJWT({mode:'ask'}).setProtectedHeader({alg:'HS256'}).setSubject(user.id).setAudience('scribb-ai')
    .setJti(randomUUID()).setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(process.env.AI_TICKET_SECRET!))
  const cancelled=new AbortController(),onClose=()=>{if(!res.writableFinished)cancelled.abort()}
  res.on('close',onClose)
  try{
    const upstream=await aiTransport.request(serviceUrl('ask'),{method:'POST',redirect:'error',signal:AbortSignal.any([cancelled.signal,AbortSignal.timeout(40_000)]),
      headers:{'content-type':'application/json',accept:'text/event-stream',authorization:`Bearer ${ticket}`},body:JSON.stringify(body)})
    if(!upstream.ok){
      await upstream.body?.cancel()
      // Do not expose internal URLs, stack traces or provider configuration in error bodies.
      const status=[400,401,403,422,429,503,504].includes(upstream.status)?upstream.status:502
      return fail(res,status,'ai_unavailable','The AI service could not complete this answer. Please try again.')
    }
    const type=upstream.headers.get('content-type')??''
    if(!upstream.body||(!type.includes('text/event-stream')&&!type.includes('application/json'))){
      await upstream.body?.cancel()
      return fail(res,502,'bad_ai_response','The AI service returned an unreadable answer. Please try again.')
    }
    res.status(200).set('Content-Type',type.includes('text/event-stream')?'text/event-stream; charset=utf-8':'application/json').set('X-Accel-Buffering','no')
    await pipeline(Readable.fromWeb(upstream.body as unknown as ReadableStream),res,{signal:cancelled.signal})
  }catch{
    if(cancelled.signal.aborted)return
    if(res.headersSent)res.destroy()
    else fail(res,503,'ai_unavailable','The AI service could not be reached. Please try again.')
  }finally{res.off('close',onClose)}
})
