import {useEffect,useRef} from 'react'

/** The one tooltip for every [data-hint]: a word or two above the control, on mouse hover or keyboard focus.
 *  A manual popover sits in the top layer, so hints also show inside modal dialogs. Large areas (the book) place it at the pointer. */
export default function Hints(){
 const tip=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const node=tip.current
  if(!node)return
  let current:Element|null=null,timer=0,cool=0,warm=false,pointer:{x:number;y:number}|null=null
  const large=(r:DOMRect)=>r.width>200||r.height>140
  function place(el:Element){
   if(!node)return
   const r=el.getBoundingClientRect(),w=node.offsetWidth,h=node.offsetHeight
   const at=pointer&&large(r)?{x:pointer.x,top:pointer.y-24,bottom:pointer.y+24}:{x:r.left+r.width/2,top:r.top,bottom:r.bottom}
   node.style.left=`${Math.min(innerWidth-w-8,Math.max(8,at.x-w/2))}px`
   node.style.top=`${at.top-h-8>8?at.top-h-8:at.bottom+8}px`
  }
  function hide(){
   clearTimeout(timer);current=null
   if(!node?.matches(':popover-open'))return
   node.hidePopover()
   clearTimeout(cool);cool=window.setTimeout(()=>{warm=false},300)
  }
  function show(el:Element|null){
   if(el===current)return
   const text=el?.getAttribute('data-hint')
   if(!el||!text){hide();return}
   current=el;clearTimeout(timer);clearTimeout(cool)
   timer=window.setTimeout(()=>{
    if(current!==el||!el.isConnected||!node)return
    node.textContent=text
    // Reopening raises the hint above a dialog opened since the last one.
    if(node.matches(':popover-open'))node.hidePopover()
    node.showPopover();place(el);warm=true
   },warm?0:450)
  }
  const target=(e:Event)=>(e.target instanceof Element?e.target.closest('[data-hint]'):null)
  const over=(e:PointerEvent)=>{if(e.pointerType==='touch')return;pointer={x:e.clientX,y:e.clientY};show(target(e))}
  const move=(e:PointerEvent)=>{pointer={x:e.clientX,y:e.clientY};if(current&&node?.matches(':popover-open')&&large(current.getBoundingClientRect()))place(current)}
  const focus=(e:FocusEvent)=>{if(e.target instanceof Element&&e.target.matches(':focus-visible')){pointer=null;show(target(e))}}
  const leave=(e:PointerEvent)=>{if(!e.relatedTarget)hide()}
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')hide()}
  // A press or drag hides the hint until the pointer reaches another control.
  const press=()=>{const el=current;hide();current=el}
  const opts={capture:true,passive:true}
  document.addEventListener('pointerover',over,opts);document.addEventListener('pointermove',move,opts);document.addEventListener('pointerout',leave,opts)
  document.addEventListener('pointerdown',press,opts);document.addEventListener('focusin',focus,opts);document.addEventListener('focusout',hide,opts)
  document.addEventListener('keydown',key,opts);addEventListener('scroll',hide,opts)
  return()=>{
   clearTimeout(timer);clearTimeout(cool)
   document.removeEventListener('pointerover',over,opts);document.removeEventListener('pointermove',move,opts);document.removeEventListener('pointerout',leave,opts)
   document.removeEventListener('pointerdown',press,opts);document.removeEventListener('focusin',focus,opts);document.removeEventListener('focusout',hide,opts)
   document.removeEventListener('keydown',key,opts);removeEventListener('scroll',hide,opts)
  }
 },[])
 return <div ref={tip} className="hint-tip" popover="manual" aria-hidden="true"/>
}
