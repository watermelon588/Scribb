import {useEffect,useRef,useState} from 'react'
import {ArrowUp,ArrowCounterClockwise,Stop} from '@phosphor-icons/react'
import {api,message,type User} from '../lib/api'
import {askJournal,type Source,type Turn} from '../lib/journal-ai'

type Reply={question:string;answer:string;sources:Source[];complete:boolean}
type Mood='calm'|'curious'|'sleepy'|'thinking'|'worried'
// The journal companion is one character drawn from the PFP cutouts and expression stickers.
const FACES:Record<Mood,string>={calm:'/persona/calm.webp',curious:'/stickers/expressions/girl-dreaming.png',sleepy:'/stickers/expressions/girl-sighing.png',thinking:'/persona/thinking.webp',worried:'/persona/worried.webp'}

/** Every face is stacked and cross-faded, so a mood change never waits for an image to load. */
export function Persona({mood,className=''}:{mood:Mood;className?:string}){
 return <span className={`persona ${className}`} aria-hidden="true">{(Object.keys(FACES) as Mood[]).map(m=><img key={m} src={FACES[m]} alt="" draggable={false} className={m===mood?'on':''}/>)}</span>
}

/** The floating companion that opens Ask my journal from anywhere in the app. */
export function JournalCompanion({hidden,onOpen}:{hidden:boolean;onOpen:()=>void}){
 return <a className="companion" href="#ask" hidden={hidden} aria-label="Ask my journal" onClick={e=>{e.preventDefault();onOpen()}}>
  <span className="companion-bubble" aria-hidden="true">Ask my journal</span>
  <span className="companion-body"><span className="persona"><img className="on" src={FACES.calm} alt="" draggable={false}/></span><img className="companion-star" src="/stickers/cutesy/chrome-star-small.png" alt=""/></span>
  <i className="companion-shadow" aria-hidden="true"/>
 </a>
}

const STARTERS=['What have I been writing about this week?','When did I last feel inspired?','What did I write about last month?']
export default function AskJournal({user,onUser,onSignIn,onSettings}:{user:User|null|undefined;onUser:(u:User)=>void;onSignIn:()=>void;onSettings:()=>void}){
 const [agreed,setAgreed]=useState(false),[consenting,setConsenting]=useState(false),[consentError,setConsentError]=useState('')
 const [question,setQuestion]=useState(''),[replies,setReplies]=useState<Reply[]>([]),[error,setError]=useState(''),[phase,setPhase]=useState<'idle'|'waking'|'answering'>('idle')
 const controller=useRef<AbortController|null>(null),mounted=useRef(true),input=useRef<HTMLTextAreaElement>(null)
 const busy=phase!=='idle'
 const mood:Mood=phase==='waking'?'sleepy':phase==='answering'?'thinking':error?'worried':question.trim()?'curious':'calm'
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();controller.current=null}},[])
 async function consent(enabled:boolean){
  if(!user)return
  setConsenting(true);setConsentError('')
  if(!enabled){controller.current?.abort();controller.current=null;setPhase('idle')}
  try{await api(enabled?'POST':'DELETE','/ai/consent');if(mounted.current){onUser({...user,aiConsent:enabled});if(!enabled){setReplies([]);setError('');setAgreed(false)}}}catch(e){if(mounted.current)setConsentError(message(e))}finally{if(mounted.current)setConsenting(false)}
 }
 async function submit(value=question,retry=false){
  const text=value.trim();if(!user?.aiConsent||!user.emailVerified||!text||busy)return
  const abort=new AbortController();controller.current=abort;setError('');setPhase('waking')
  const previous=retry?replies.slice(0,-1):replies
  const history:Turn[]=previous.filter(r=>r.complete).flatMap(r=>[{role:'user' as const,text:r.question},{role:'assistant' as const,text:r.answer}])
  setReplies([...previous,{question:text,answer:'',sources:[],complete:false}]);setQuestion('')
  const update=(fn:(r:Reply)=>Reply)=>{if(controller.current!==abort)return;setReplies(all=>all.map((r,i)=>i===all.length-1?fn(r):r))}
  try{
   await askJournal(text,history,abort.signal,v=>{if(controller.current===abort)setPhase(v)},{delta:chunk=>update(r=>({...r,answer:r.answer+chunk})),sources:sources=>update(r=>({...r,sources}))})
   update(r=>({...r,complete:true}))
  }catch(e){if(controller.current===abort&&!abort.signal.aborted)setError(e instanceof DOMException&&e.name==='TimeoutError'?'The AI service took too long. Please try again.':e instanceof TypeError?'The AI service could not be reached. Check your connection and try again.':message(e,'The answer could not be completed. Please try again.'))}
  finally{if(controller.current===abort){controller.current=null;setPhase('idle')}}
 }
 function stop(){controller.current?.abort();controller.current=null;setPhase('idle');setError('Answer stopped. You can retry your question.')}
 const ready=Boolean(user?.aiConsent&&user.emailVerified)
 return <main className={`ask-page ${replies.length?'is-talking':''}`}>
  <header className="ask-hero">
   <div className="ask-persona"><img className="ask-sticker sticker-spiral" src="/stickers/cutesy/olive-spiral-tiny.png" alt=""/><Persona mood={mood}/><img className="ask-sticker sticker-star" src="/stickers/cutesy/chrome-star-small.png" alt=""/><img className="ask-sticker sticker-walker" src="/stickers/cutesy/walking-star.png" alt=""/></div>
   <h1>Ask my journal.</h1>
   {!replies.length&&<p>A thought to revisit. A pattern to notice.<br/>Start with something you’ve written.</p>}
  </header>
  {user===undefined?<p className="ask-status" role="status">Opening your space…</p>:!user?<div className="ask-gate"><p>Sign in to reflect on your saved journals.</p><button className="button-primary" onClick={onSignIn}>Sign in</button></div>:<>
   {!user.aiConsent?<section className="ai-consent" aria-labelledby="ai-notice-heading"><h2 id="ai-notice-heading">Your words, and where they go</h2><p>This optional feature sends your question, recent conversation and relevant saved journal text to Google Gemini through our AI service. Unsaved drafts and pictures are left out.</p><p>We use Gemini’s free tier. Google may use inputs and answers to improve its products, and human reviewers may process them. Do not use this with sensitive, confidential or personal information in your journals.</p><p>AI can make mistakes. You can turn it off here at any time. <a href="#privacy">Read the privacy notice</a> or <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini’s terms</a>.</p><label className="consent-check"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I’m 18 or over and understand how my journal text will be processed.</span></label><button className="button-primary" disabled={!agreed||consenting||!user.emailVerified} onClick={()=>void consent(true)}>{consenting?'Turning on…':'Turn on Ask my journal'}</button></section>:null}
   {!user.emailVerified&&<div className="email-gate"><p>Verify an email in Settings before using Ask my journal.</p><button className="button-secondary" onClick={onSettings}>Open Settings</button></div>}
   {consentError&&<p className="form-error" role="alert">{consentError}</p>}
   {ready&&<>
    {!replies.length&&<div className="ask-starters"><p>Where would you like to begin?</p><div>{STARTERS.map(text=><button key={text} onClick={()=>{setQuestion(text);input.current?.focus()}}><span>{text}</span><ArrowUp size={15}/></button>)}</div></div>}
    <div className="ask-conversation" aria-label="Journal conversation" aria-busy={busy}>{replies.map((reply,i)=>{
     const live=i===replies.length-1&&busy
     return <article className="ask-turn" key={i}><h2>{reply.question}</h2>{(reply.answer||live)&&<div className="ask-reply"><Persona mood={live?(phase==='waking'?'sleepy':'thinking'):'calm'} className="persona-small"/><div>{reply.answer?<p className="ask-answer">{reply.answer}</p>:<span className="ask-typing" aria-hidden="true"><i/><i/><i/></span>}{reply.sources.length>0&&reply.complete&&<div className="ask-sources"><span>From your journal</span>{Array.from(new Set(reply.sources.map(s=>s.date))).map(date=><time key={date} dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</time>)}</div>}{!reply.complete&&!busy&&reply.answer&&<small className="partial-answer">Incomplete answer</small>}</div></div>}</article>})}</div>
    <p className="ask-status" role="status" aria-live="polite">{phase==='waking'?'Waking up your journal companion. This can take a minute…':phase==='answering'?'Reading your journal and writing an answer…':replies.at(-1)?.complete?'Answer complete.':''}</p>
    {error&&<div className="ask-error"><p className="form-error" role="alert">{error}</p><button className="button-secondary" onClick={()=>void submit(replies.at(-1)?.question??'',true)}><ArrowCounterClockwise size={16}/> Retry question</button></div>}
    <form className="ask-composer" onSubmit={e=>{e.preventDefault();void submit()}}><label className="sr-only" htmlFor="journal-question">Ask about your journal</label><textarea ref={input} id="journal-question" maxLength={500} rows={2} value={question} placeholder="What’s on your mind?" onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy)void submit()}}}/><div className="composer-bottom"><span>Saved journals only · {question.length}/500</span>{busy?<button type="button" className="ask-send" aria-label="Stop answer" data-hint="Stop" onClick={stop}><Stop size={18}/></button>:<button className="ask-send" aria-label="Send question" data-hint="Send" disabled={!question.trim()}><ArrowUp size={19}/></button>}</div></form>
   </>}
   {user.aiConsent&&<div className="ask-footnote"><p>Answers use saved journal text and Gemini’s free tier. AI can get things wrong; your words are the source. <a href="#privacy">Privacy notice</a></p><div>{replies.length>0&&<button className="button-link" onClick={()=>{controller.current?.abort();controller.current=null;setPhase('idle');setReplies([]);setError('');input.current?.focus()}}>Clear conversation</button>}<button className="button-link" disabled={consenting} onClick={()=>void consent(false)}>{consenting?'Turning off…':'Turn off AI'}</button></div></div>}
  </>}
 </main>
}
