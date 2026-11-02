import {useCallback,useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {CheckCircle,Info,WarningCircle} from '@phosphor-icons/react'

export type NoticeTone='success'|'info'|'error'
export type Notify=(message:string,tone?:NoticeTone)=>void
type Message={id:number;text:string;tone:NoticeTone}

export function useNotice(){
 const [notice,setNotice]=useState<Message|null>(null),sequence=useRef(0)
 const notify=useCallback<Notify>((text,tone='info')=>setNotice(text?{id:++sequence.current,text,tone}:null),[])
 const dismiss=useCallback(()=>setNotice(null),[])
 return {notice,notify,dismiss}
}

/** A top-layer message, inside the active dialog so its dismiss control is never inert. */
export default function Notice({notice,onDismiss,container}:{notice:Message|null;onDismiss:()=>void;container?:HTMLElement|null}){
 const node=useRef<HTMLDivElement>(null),[paused,setPaused]=useState(false)
 useEffect(()=>setPaused(false),[notice?.id])
 useEffect(()=>{
  if(!notice)return
  const el=node.current
  // Wait for the parent's showModal effect before raising the message above it.
  const frame=requestAnimationFrame(()=>{if(el?.isConnected)el.showPopover()})
  return()=>{cancelAnimationFrame(frame);if(el?.matches(':popover-open'))el.hidePopover()}
 },[notice?.id,container])
 useEffect(()=>{
  if(!notice||notice.tone==='error'||paused)return
  const timer=setTimeout(onDismiss,8000)
  return()=>clearTimeout(timer)
 },[notice?.id,notice?.tone,paused,onDismiss])
 if(!notice)return null
 const Icon=notice.tone==='success'?CheckCircle:notice.tone==='error'?WarningCircle:Info
 const content=<div ref={node} className={`notification notice-${notice.tone}`} popover="manual"
  onPointerEnter={()=>setPaused(true)} onPointerLeave={()=>setPaused(false)}
  onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false)}}>
  <Icon className="notice-icon" size={24} aria-hidden="true"/>
  <span className="notice-copy" role={notice.tone==='error'?'alert':'status'} aria-atomic="true">{notice.text}</span>
  <button type="button" className="button-quiet" aria-label="Dismiss notification" onClick={onDismiss}>Dismiss</button>
 </div>
 return container?createPortal(content,container):content
}
