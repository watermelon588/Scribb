import {useRef,useState,type FormEvent,type MouseEvent} from 'react'
import {Star,X} from '@phosphor-icons/react'
import {api,message} from '../lib/api'

const LABELS=['Poor','Fair','Good','Great','Love it']

/** Footer link plus a small dialog: a 1–5 rating and a note, mailed to the founder (server/feedback.ts). */
export default function Feedback(){
 const dialog=useRef<HTMLDialogElement>(null),press=useRef(false)
 const [rating,setRating]=useState(0),[note,setNote]=useState(''),[status,setStatus]=useState<'idle'|'sending'|'sent'|{error:string}>('idle')
 function open(){if(status!=='sending')setStatus('idle');dialog.current?.showModal()}
 function close(){dialog.current?.close();if(status==='sent'){setRating(0);setNote('');setStatus('idle')}}
 async function submit(e:FormEvent){
  e.preventDefault()
  if(!rating)return setStatus({error:'Choose a rating first.'})
  setStatus('sending')
  try{await api('POST','/feedback',{rating,message:note,page:location.pathname+location.hash});setStatus('sent')}
  catch(err){setStatus({error:message(err,'Your feedback could not be sent. Please try again.')})}
 }
 const outside=(e:MouseEvent)=>{const r=dialog.current!.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom}
 return <>
  <button type="button" className="button-link footer-feedback" onClick={open}>Feedback</button>
  <dialog ref={dialog} className="feedback-dialog" aria-labelledby="feedback-title" onPointerDown={e=>{press.current=outside(e)}} onClick={e=>{if(press.current&&outside(e))close();press.current=false}}>
   <button type="button" className="button-icon dialog-close" aria-label="Close feedback" data-hint="Close" onClick={close}><X size={18}/></button>
   {status==='sent'?<div className="feedback-done" role="status">
    <h2 id="feedback-title">Thank you.</h2>
    <p>Your note went straight to the founder.</p>
    <button type="button" className="button-secondary" onClick={close}>Close</button>
   </div>:<form onSubmit={submit}>
    <h2 id="feedback-title">How is Scribb for you?</h2>
    <div className="feedback-stars" role="radiogroup" aria-label="Rating">
     {LABELS.map((label,i)=><button type="button" key={label} role="radio" aria-checked={rating===i+1} aria-label={`${i+1} of 5, ${label}`} data-hint={label} className="button-icon" onClick={()=>setRating(i+1)}><Star size={26} weight={i<rating?'fill':'light'}/></button>)}
    </div>
    <label htmlFor="feedback-note">What could be better?</label>
    <textarea id="feedback-note" rows={4} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="An idea, a bug, anything at all."/>
    {typeof status==='object'&&<p className="feedback-error" role="alert">{status.error}</p>}
    <button type="submit" className="button-primary" disabled={status==='sending'}>{status==='sending'?'Sending…':'Send feedback'}</button>
   </form>}
  </dialog>
 </>
}
