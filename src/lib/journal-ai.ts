import {api,ApiError} from './api'

export type Turn={role:'user'|'assistant';text:string}
export type Source={entryId:string;date:string}
type Events={delta:(text:string)=>void;sources:(sources:Source[])=>void}
// AI_URL is a same-origin path on Vercel (/ai) or an absolute address when the service runs elsewhere.
function serviceUrl(value:string){const url=new URL(value,location.origin);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('The AI service address is not valid.');return url.href.replace(/\/$/,'')}
async function problem(res:Response){const data=await res.json().catch(()=>null);return new ApiError(res.status,data?.error?.code??'ai_error',data?.error?.message??'The AI service could not answer. Please try again.')}
function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{signal.throwIfAborted();const abort=()=>{clearTimeout(timer);reject(signal.reason)};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},ms);signal.addEventListener('abort',abort,{once:true})})

/** Wake before minting the one-time ticket: cold starts must not consume a turn or expire its ticket. */
export async function askJournal(question:string,history:Turn[],signal:AbortSignal,phase:(value:'waking'|'answering')=>void,events:Events){
 phase('waking')
 const status=await api<{url:string}>('GET','/ai/status')
 signal.throwIfAborted()
 const base=serviceUrl(status.url),deadline=Date.now()+90_000
 let awake=false
 while(Date.now()<deadline){
  signal.throwIfAborted()
  try{const res=await fetch(`${base}/health`,{credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});awake=res.ok&&(await res.json()).ok===true;if(awake)break}catch{signal.throwIfAborted()}
  await pause(2500,signal)
 }
 if(!awake)throw new Error('The AI service is taking longer to wake up. Please try again in a moment.')
 const {url,ticket}=await api<{url:string;ticket:string}>('POST','/ai/ticket',{mode:'ask'})
 signal.throwIfAborted()
 if(serviceUrl(url)!==base)throw new Error('The AI service changed. Please try again.')
 phase('answering')
 const res=await fetch(`${base}/ask`,{method:'POST',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(40_000)]),headers:{'content-type':'application/json',accept:'text/event-stream',authorization:`Bearer ${ticket}`},body:JSON.stringify({question,today:localDate(),history:history.slice(-6).map(t=>({...t,text:t.text.slice(0,2000)}))})})
 if(!res.ok)throw await problem(res)
 // Compatible with the existing service during a rolling deployment.
 if(res.headers.get('content-type')?.includes('application/json')){const data=await res.json();if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('No answer arrived. Please try again.');events.delta(data.answer);events.sources(data.sources??[]);return}
 if(!res.body||!res.headers.get('content-type')?.includes('text/event-stream'))throw new Error('The answer could not be read. Please try again.')
 const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',done=false,hasText=false
 try{
  while(true){
   const chunk=await reader.read();buffer+=decoder.decode(chunk.value,{stream:!chunk.done}).replace(/\r\n/g,'\n')
   let end:number
   while((end=buffer.indexOf('\n\n'))!==-1){
    const block=buffer.slice(0,end);buffer=buffer.slice(end+2)
    const event=block.split('\n').find(l=>l.startsWith('event:'))?.slice(6).trim()
    const raw=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')
    if(!raw)continue
    const data=JSON.parse(raw)
    if(event==='error')throw new Error(data.message??'The answer was interrupted. Please try again.')
    if(event==='delta'&&typeof data.text==='string'){hasText ||=Boolean(data.text.trim());events.delta(data.text)}
    if(event==='done'){events.sources(Array.isArray(data.sources)?data.sources:[]);done=true}
   }
   if(done)break
   if(chunk.done)throw new Error('The connection ended before the answer finished. Please try again.')
  }
  if(!hasText)throw new Error('No answer arrived. Please try again.')
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
