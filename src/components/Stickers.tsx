import {useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type PointerEvent as ReactPointerEvent} from 'react'
import gsap from 'gsap'
import {useGSAP} from '@gsap/react'
import {AirplaneTilt,ArrowClockwise,Brain,CalendarBlank,Flower,HandHeart,Heart,Hourglass,Leaf,MusicNotes,Quotes,Smiley,Sparkle,SquaresFour,Television,X,type Icon} from '@phosphor-icons/react'
import {fitSticker,loadStickers,safeSticker,stickerVibes,type PlacedSticker,type StickerItem,type StickerVibe} from '../data/stickers'

gsap.registerPlugin(useGSAP)

const vibeIcons:Record<StickerVibe,Icon>={quotes:Quotes,philosophy:Brain,gratitude:HandHeart,expressions:Smiley,cutesy:Heart,anime:Sparkle,japanese:Flower,nature:Leaf,travel:AirplaneTilt,music:MusicNotes,'retro-tech':Television,vintage:Hourglass,calendars:CalendarBlank}
const still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches

export type StickerEdit={selected:string|null;onSelect:(id:string|null)=>void;onChange:(id:string,patch:Partial<PlacedSticker>)=>void;onRemove:(id:string)=>void}

/** Where a drop lands on a sticker surface, in percent, or nothing when it missed. */
export function dropPoint(surface:Element|null|undefined,point:{x:number;y:number}){
 const box=surface?.getBoundingClientRect()
 if(!box||point.x<box.left||point.x>box.right||point.y<box.top||point.y>box.bottom)return null
 return {x:(point.x-box.left)/box.width*100,y:(point.y-box.top)/box.height*100}
}
/** Applies one change to a sticker list, keeping every sticker inside its limits. */
export const changeSticker=(list:PlacedSticker[],id:string,patch:Partial<PlacedSticker>)=>list.map(s=>s.id===id?fitSticker({...s,...patch}):s)

/** One surface of stickers, shared by covers and pages. Read-only unless `edit` is given. */
export function StickerLayer({stickers,edit}:{stickers:PlacedSticker[];edit?:StickerEdit}){
 const layer=useRef<HTMLDivElement>(null),seen=useRef<Set<string>|null>(null)
 // A new sticker is pressed down onto the paper: it settles from slightly large, never from nothing.
 useGSAP(()=>{
  const known=seen.current;seen.current=new Set(stickers.map(s=>s.id))
  if(!known||!edit||still())return
  for(const s of stickers)if(!known.has(s.id))gsap.from(`[data-sticker="${s.id}"] .sticker-art`,{scale:1.18,opacity:0,rotate:-6,duration:.34,ease:'power3.out'})
 },{scope:layer,dependencies:[stickers]})

 function drag(event:ReactPointerEvent<HTMLElement>,sticker:PlacedSticker,mode:'move'|'turn'){
  if(!edit||event.button)return
  event.stopPropagation();event.preventDefault();edit.onSelect(sticker.id)
  const box=layer.current!.getBoundingClientRect(),target=event.currentTarget,node=target.closest<HTMLElement>('.sticker')!,art=node.querySelector('.sticker-art')!
  const rect=node.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,{clientX:x,clientY:y}=event
  const reach=Math.hypot(x-cx,y-cy)||1,angle=Math.atan2(y-cy,x-cx)
  // Lifted while held, then laid back down on release.
  node.classList.add('is-lifted');gsap.to(art,{scale:1.06,duration:still()?0:.16,ease:'power2.out',overwrite:'auto'})
  target.setPointerCapture(event.pointerId)
  target.onpointermove=e=>edit.onChange(sticker.id,mode==='move'
   ?{x:sticker.x+(e.clientX-x)/box.width*100,y:sticker.y+(e.clientY-y)/box.height*100}
   :{size:sticker.size*Math.hypot(e.clientX-cx,e.clientY-cy)/reach,rotate:sticker.rotate+(Math.atan2(e.clientY-cy,e.clientX-cx)-angle)*180/Math.PI})
  target.onpointerup=target.onpointercancel=()=>{target.onpointermove=target.onpointerup=target.onpointercancel=null;node.classList.remove('is-lifted');gsap.to(art,{scale:1,duration:still()?0:.22,ease:'power3.out',overwrite:'auto'})}
 }
 function remove(id:string){
  const art=layer.current?.querySelector(`[data-sticker="${id}"] .sticker-art`)
  if(!art||still()){edit!.onRemove(id);return}
  gsap.to(art,{scale:.8,opacity:0,duration:.16,ease:'power2.in',overwrite:'auto',onComplete:()=>edit!.onRemove(id)})
 }
 function key(event:ReactKeyboardEvent<HTMLElement>,sticker:PlacedSticker){
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove(sticker.id);return}
  if(event.key==='Escape'){edit!.onSelect(null);event.currentTarget.blur();return}
  const step:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},move=step[event.key]
  if(!move)return
  event.preventDefault()
  // Shift turns with left and right, and grows or shrinks with up and down.
  edit!.onChange(sticker.id,event.shiftKey?{rotate:sticker.rotate+move[0]*5,size:sticker.size-move[1]}:{x:sticker.x+move[0],y:sticker.y+move[1]})
 }

 return <div ref={layer} className={`stickers ${edit?'is-editing':''}`} data-sticker-surface="">
  {stickers.filter(s=>safeSticker(s.src)).map(s=>{
   const chosen=edit?.selected===s.id
   return <div key={s.id} data-sticker={s.id} className={`sticker ${chosen?'is-chosen':''}`} style={{left:`${s.x}%`,top:`${s.y}%`,width:`${s.size}%`,transform:`translate(-50%,-50%) rotate(${s.rotate}deg)`}}>
    <img className="sticker-art" src={s.src} alt="" draggable={false}/>
    {edit&&<button type="button" className="sticker-hit" data-hint="Move" aria-label={`${s.name} sticker`} aria-pressed={chosen} onPointerDown={e=>drag(e,s,'move')} onFocus={()=>edit.onSelect(s.id)} onKeyDown={e=>key(e,s)}/>}
    {edit&&chosen&&<><button type="button" className="sticker-turn" data-hint="Resize" aria-label="Resize and turn sticker" onPointerDown={e=>drag(e,s,'turn')}><ArrowClockwise size={14} weight="bold"/></button><button type="button" className="sticker-remove" data-hint="Remove" aria-label="Remove sticker" onClick={()=>remove(s.id)}><X size={14} weight="bold"/></button></>}
   </div>
  })}
 </div>
}

/** The prepared cutouts, filtered by vibe. Tap to add, or drag one onto the surface (mouse and pen). */
export function StickerTray({used,max,onAdd,onStart}:{used:number;max:number;onAdd:(item:StickerItem,point?:{x:number;y:number})=>void;onStart?:()=>void}){
 const [items,setItems]=useState<StickerItem[]|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[vibe,setVibe]=useState<StickerVibe|'all'>('all')
 const dropped=useRef(false)
 useEffect(()=>{let live=true;setFailed(false);loadStickers().then(list=>{if(live)setItems(list)},()=>{if(live)setFailed(true)});return()=>{live=false}},[attempt])
 const full=used>=max,shown=items?.filter(item=>vibe==='all'||item.category===vibe)
 function drag(event:ReactPointerEvent<HTMLButtonElement>,item:StickerItem){
  if(event.button||event.pointerType==='touch'||full)return
  const button=event.currentTarget,{clientX:x,clientY:y}=event
  let ghost:HTMLImageElement|null=null
  button.setPointerCapture(event.pointerId)
  button.onpointermove=e=>{
   if(!ghost){
    if(Math.hypot(e.clientX-x,e.clientY-y)<6)return
    onStart?.()
    ghost=Object.assign(new Image(),{src:item.src,alt:'',className:'sticker-ghost'});document.body.append(ghost)
    gsap.set(ghost,{xPercent:-50,yPercent:-50,rotate:-6});if(!still())gsap.from(ghost,{scale:.7,duration:.18,ease:'power3.out'})
   }
   gsap.set(ghost,{x:e.clientX,y:e.clientY})
  }
  button.onpointerup=button.onpointercancel=e=>{
   button.onpointermove=button.onpointerup=button.onpointercancel=null
   if(!ghost)return
   ghost.remove();dropped.current=true;setTimeout(()=>{dropped.current=false})
   if(e.type==='pointerup')onAdd(item,{x:e.clientX,y:e.clientY})
  }
 }
 return <div className="sticker-tray">
  <div className="sticker-vibes" role="group" aria-label="Sticker vibes">{[{id:'all' as const,name:'All stickers'},...stickerVibes].map(v=>{
   const Glyph=v.id==='all'?SquaresFour:vibeIcons[v.id]
   return <button key={v.id} type="button" data-hint={v.name} aria-label={v.name} aria-pressed={vibe===v.id} onClick={()=>setVibe(v.id)}><Glyph size={18} weight="light"/></button>
  })}</div>
  {failed?<div className="sticker-failed" role="alert"><span>Stickers could not load.</span><button type="button" className="button-icon" data-hint="Try again" aria-label="Load stickers again" onClick={()=>setAttempt(a=>a+1)}><ArrowClockwise size={16}/></button></div>
  :<div className="sticker-grid" data-lenis-prevent="" aria-busy={!shown}>{shown?shown.map(item=><button key={item.id} type="button" className="sticker-pick" data-hint={full?`Up to ${max} stickers here`:item.name} aria-label={`Add ${item.name} sticker`} disabled={full} onPointerDown={e=>drag(e,item)} onClick={()=>{if(!dropped.current)onAdd(item)}}><img src={item.src} alt="" loading="lazy" draggable={false}/></button>)
   :Array.from({length:12},(_,i)=><i key={i} className="sticker-pick is-loading"/>)}</div>}
 </div>
}
