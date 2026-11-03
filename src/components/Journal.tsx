import {useEffect,useMemo,useState,type CSSProperties,type KeyboardEvent,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react'
import {ArrowsOutCardinal,DotsSixVertical,X} from '@phosphor-icons/react'
import {ScribbleArt} from './Scribble'
import {StickerLayer,type StickerEdit} from './Stickers'
import Sketchbook from './Sketchbook'
import {placementStyle} from './PlacementEditor'
import {sanitize} from '../lib/richtext'
import {entrySlots,formatDate,isSpread,journalFonts,journalLayouts,layoutSlots,scribbleKinds,sectionOf,sheetSize,slotArea,slotRect,typeScale,writingLines,type JournalData,type JournalEntry,type LayoutId,type Section,type Slot,type SlotKind} from '../data/journal'
import {formats,papers,presets,type Artwork} from '../data/presets'
import type {Book} from '../Profile'

export type Owner = {name:string;handle:string;avatar:string}
const PANEL=36,PANEL_META=44
const NO_ARTWORKS:Artwork[]=[]

export function sheetStyle(journal:JournalData,ratio:number,section:Section='writing'){
 const sheet=sheetSize(ratio),type=typeScale(journal,section)
 return {'--sheet-w':`${sheet.width*(section==='spread'?2:1)}px`,'--sheet-h':`${sheet.height}px`,'--sheet-mx':`${sheet.margin}px`,'--sheet-top':`${sheet.top}px`,'--sheet-bottom':`${sheet.bottom}px`,'--sheet-gap':`${sheet.gap}px`,'--j-font':type.font.family,'--j-size':`${type.size}px`,'--j-line':`${type.line}px`,'--j-ink':journal.ink} as CSSProperties
}

// Text is measured on one hidden sheet, so every surface agrees on what fits.
let probe:HTMLDivElement|null=null
function textHeight(html:string,width:number,kind:SlotKind,style:CSSProperties){
 if(!probe){probe=document.createElement('div');document.body.appendChild(probe)}
 probe.removeAttribute('style')
 for(const [key,value] of Object.entries(style))probe.style.setProperty(key,String(value))
 probe.className=`journal-probe j-text j-${kind}`;probe.style.width=`${width}px`;probe.innerHTML=html
 return probe.scrollHeight
}
export function slotBox(slot:Slot,ratio:number){
 const {width,height}=slotRect(slot,ratio)
 if(slot.overlap&&slot.kind!=='I')return {width:width-2*PANEL,height:height-2*PANEL-(slot.meta?PANEL_META:0)}
 if(slot.kind==='B')return {width:width-PANEL,height:height-2*PANEL}
 return {width,height}
}
// A longer title steps down in size until it fits its box. Every surface measures the same, so all pick the same step.
const TITLE_STEPS=[1,.84,.7,.58]
export function titleFit(journal:JournalData,layout:LayoutId,slot:Slot,html:string,ratio:number){
 if(slot.kind!=='T'||!html)return 1
 const box=slotBox(slot,ratio),style=sheetStyle(journal,ratio,sectionOf(layout)),text=sanitize(html)
 return TITLE_STEPS.find(fit=>textHeight(text,box.width,'T',{...style,'--fit':fit} as CSSProperties)<=box.height+1)??0
}
export function slotFits(journal:JournalData,layout:LayoutId,slot:Slot,html:string,ratio:number){
 if(!html||layout==='writing')return true
 if(slot.kind==='T')return titleFit(journal,layout,slot,html,ratio)>0
 const box=slotBox(slot,ratio)
 return textHeight(sanitize(html),box.width,slot.kind,sheetStyle(journal,ratio,sectionOf(layout)))<=box.height+1
}
export function layoutFits(journal:JournalData,entry:JournalEntry,layout:LayoutId,ratio:number){return layoutSlots(layout,ratio).every(slot=>slot.kind==='I'||slotFits(journal,layout,slot,entry.texts[slot.id]??'',ratio))}
/** The first page number of every entry. A spread takes two pages and starts on a left (odd) page, after a blank when needed. */
export function pageNumbers(journal:JournalData,ratio:number){
 const numbers=new Map<string,{first:number;pages:number;blank:boolean}>()
 let next=1
 for(const entry of journal.entries){
  const spread=isSpread(entry.layout),blank=spread&&next%2===0,pages=spread?2:writingPages(journal,entry,ratio)
  if(blank)next++
  numbers.set(entry.id,{first:next,pages,blank});next+=pages
 }
 return numbers
}
export function writingPages(journal:JournalData,entry:JournalEntry,ratio:number){
 const html=entry.texts.p0
 if(entry.layout!=='writing'||!html)return 1
 const sheet=sheetSize(ratio),height=textHeight(sanitize(html),sheet.width-2*sheet.margin,'P',sheetStyle(journal,ratio))
 return Math.max(1,Math.ceil(Math.round(height/typeScale(journal,'writing').line)/writingLines(journal,ratio)))
}
export function useFontReady(family:string){
 const [version,setVersion]=useState(0)
 useEffect(()=>{let live=true;document.fonts.load(`30px ${family}`).then(()=>{if(live)setVersion(v=>v+1)}).catch(()=>{});return()=>{live=false}},[family])
 return version
}

// Where text really sits in a line box, from the font's own metrics, so rules meet every font's baseline.
let metrics:CanvasRenderingContext2D|null=null
function baseline(family:string,size:number,line:number){
 metrics??=document.createElement('canvas').getContext('2d')
 if(!metrics)return line*.72
 metrics.font=`${size}px ${family}`
 const {fontBoundingBoxAscent:ascent,fontBoundingBoxDescent:descent}=metrics.measureText('x')
 return (line-ascent-descent)/2+ascent
}
// Vector lines stay even when a sheet is scaled down. Gradients drop lines at small sizes.
function PaperLines({journal,ratio,lines}:{journal:JournalData;ratio:number;lines:number}){
 const {width}=sheetSize(ratio),{font,size,line}=typeScale(journal,'writing'),first=Math.round(baseline(font.family,size,line))+6,height=lines*line
 let path=''
 for(let i=0;i<lines;i++)path+=`M0 ${first+i*line}H${width}`
 if(journal.rule==='grid'){path+=`M0 ${first-line}H${width}`;for(let x=(width%line)/2;x<width;x+=line)path+=`M${x} ${first-line}V${first+(lines-1)*line}`}
 return <svg className="j-rule" width={width} height={height} aria-hidden="true"><path d={path}/></svg>
}

const SLOT_NAMES:Record<SlotKind,string>={T:'Title',H:'Subtitle',P:'Paragraph',I:'Picture',C:'Caption',Q:'Quote',S:'Strip',B:'Band text'}
export const slotName=(slot:Slot)=>SLOT_NAMES[slot.kind]

/** Drag a picture inside its box to choose what stays in view. The page and the side panel share this. */
export function dragFocus(event:ReactPointerEvent<HTMLElement>,image:HTMLImageElement,focus:[number,number],onMove:(focus:[number,number])=>void){
 if(event.button)return
 const percent=(value:number)=>Math.min(100,Math.max(0,Math.round(value)))
 const box=image.getBoundingClientRect(),fit=Math.max(box.width/image.naturalWidth,box.height/image.naturalHeight)
 const spareX=image.naturalWidth*fit-box.width,spareY=image.naturalHeight*fit-box.height,{clientX:x,clientY:y}=event,[fromX,fromY]=focus,target=event.currentTarget
 target.setPointerCapture(event.pointerId)
 target.onpointermove=e=>onMove([spareX>1?percent(fromX-(e.clientX-x)/spareX*100):fromX,spareY>1?percent(fromY-(e.clientY-y)/spareY*100):fromY])
 target.onpointerup=target.onpointercancel=()=>{target.onpointermove=null}
}
export function focusKey(event:KeyboardEvent<HTMLElement>,focus:[number,number],onMove:(focus:[number,number])=>void){
 const step=({ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]} as Record<string,[number,number]>)[event.key]
 if(!step)return
 event.preventDefault();onMove([Math.min(100,Math.max(0,focus[0]+step[0])),Math.min(100,Math.max(0,focus[1]+step[1]))])
}
const alignOf=(entry:JournalEntry,id:string)=>{const align=entry.align?.[id];return align==='center'||align==='right'?{textAlign:align}:undefined}

export type ScribbleHandlers = {selected:string|null;onGrab:(event:ReactPointerEvent<HTMLElement>,id:string,mode:'move'|'size')=>void;onKey:(event:KeyboardEvent<HTMLElement>,id:string)=>void;onSelect:(id:string)=>void;onRemove:(id:string)=>void}

export function JournalSheet({journal,entry,ratio,number,side,offset=0,half,owner,selected,moving,overlay,scribbles,stickers,positioning,onPosition,onSelect,onGrab,onGrip}:{journal:JournalData;entry:JournalEntry;ratio:number;number:number;side:'left'|'right';offset?:number;half?:0|1;owner?:Owner;selected?:string;moving?:string|null;overlay?:ReactNode;scribbles?:ScribbleHandlers;stickers?:StickerEdit;positioning?:string|null;onPosition?:(id:string,focus:[number,number])=>void;onSelect?:(slot:Slot)=>void;onGrab?:(event:ReactPointerEvent<HTMLElement>,id:string)=>void;onGrip?:(id:string)=>void}){
 const section=sectionOf(entry.layout),editing=Boolean(onSelect)
 const mirror=side==='right'&&journalLayouts.find(l=>l.id===entry.layout)?.mirror
 const slots=entrySlots(entry,ratio).map(slot=>mirror?{...slot,col:12-slot.col-slot.w}:slot)
 const marks=(entry.scribbles??[]).filter(mark=>(mark.page??0)===offset).map(mark=>{
  const name=scribbleKinds.find(k=>k.id===mark.kind)?.name??'Scribble',chosen=scribbles?.selected===mark.id
  return <div key={mark.id} className={`j-scribble ${chosen?'is-chosen':''}`} style={{left:mark.x,top:mark.y,width:mark.w,height:mark.h}}><ScribbleArt kind={mark.kind} w={mark.w} h={mark.h} seed={mark.seed}/>
   {scribbles&&<button type="button" className="j-scribble-hit" data-hint="Move" aria-label={`${name} scribble`} aria-pressed={chosen} onPointerDown={e=>scribbles.onGrab(e,mark.id,'move')} onFocus={()=>scribbles.onSelect(mark.id)} onKeyDown={e=>scribbles.onKey(e,mark.id)}/>}
   {scribbles&&chosen&&<><button type="button" className="j-scribble-size" data-hint="Resize" aria-label="Resize scribble" onPointerDown={e=>scribbles.onGrab(e,mark.id,'size')}/><button type="button" className="j-scribble-remove" data-hint="Remove" aria-label="Remove scribble" onClick={()=>scribbles.onRemove(mark.id)}><X size={14}/></button></>}
  </div>
 })
 const pressed=(entry.stickers??[]).filter(s=>(s.page??0)===offset),stuck=(pressed.length>0||stickers)&&<StickerLayer stickers={pressed} edit={stickers}/>
 // The owner's mark on every written page, so a shared screenshot still says whose journal it is.
 const mark=journal.watermark&&owner&&<div className="j-watermark"><img src={owner.avatar} alt=""/><span>@{owner.handle}</span></div>
 // A spread is one sheet two pages wide; in the book each page shows its half.
 const spread=section==='spread',number2=spread&&<span className="j-number is-right">{number+1}</span>
 const meta=<><span className="j-date">{formatDate(entry.date)}</span><span className="j-number">{number}</span>{number2}</>
 const hit=(slot:Slot,filled:boolean)=>editing&&<>
  <button type="button" className={`j-hit ${filled?'':'is-empty'}`} aria-label={`Edit ${slotName(slot).toLowerCase()}`} aria-pressed={selected===slot.id} onPointerDown={e=>{if(filled&&e.pointerType!=='touch')onGrab?.(e,slot.id)}} onClick={()=>onSelect?.(slot)}>{!filled&&<span>{slotName(slot)}</span>}</button>
  {filled&&selected===slot.id&&<button type="button" className="j-grip" data-hint="Swap" aria-label={`Move ${slotName(slot).toLowerCase()}`} aria-pressed={moving===slot.id} onPointerDown={e=>onGrab?.(e,slot.id)} onClick={()=>onGrip?.(slot.id)}><DotsSixVertical size={18}/></button>}
 </>
 function render(slot:Slot):ReactNode{
  const area={gridArea:slotArea(slot),rotate:slot.tilt?`${slot.tilt}deg`:undefined}
  const target=moving&&moving!==slot.id&&(moving[0]==='i')===(slot.kind==='I')
  const classes=`j-slot ${slot.overlap?'is-over':''} ${slot.bleed?'is-bleed':''} ${slot.tilt?'is-tilted':''} ${target?'is-target':''} ${moving===slot.id?'is-source':''}`
  const data=editing?{'data-slot':slot.id}:undefined
  if(slot.kind==='I'){const src=entry.images[slot.id],focus=entry.focus?.[slot.id];return <div key={slot.id} {...data} className={`${classes} j-image`} style={slot.bleed?undefined:area}>{src&&<img src={src} alt="" draggable={false} style={focus&&{objectPosition:`${focus[0]}% ${focus[1]}%`}}/>}{src&&positioning===slot.id&&onPosition?<div className="j-position" role="slider" tabIndex={0} data-hint="Drag to frame" aria-label="Picture position" aria-valuenow={(focus??[50,50])[0]} aria-valuetext={`${(focus??[50,50])[0]}% across, ${(focus??[50,50])[1]}% down`} onPointerDown={e=>dragFocus(e,e.currentTarget.parentElement!.querySelector('img')!,focus??[50,50],f=>onPosition(slot.id,f))} onKeyDown={e=>focusKey(e,focus??[50,50],f=>onPosition(slot.id,f))}><ArrowsOutCardinal weight="light"/></div>:hit(slot,Boolean(src))}</div>}
  const html=entry.texts[slot.id]
  return <div key={slot.id} {...data} className={`${classes} j-box j-box-${slot.kind}`} style={area}>{slot.meta&&<div className="j-panel-meta"><span>{formatDate(entry.date)}</span><span>{spread&&slot.col>=12?number+1:number}</span></div>}{html&&<div className={`j-text j-${slot.kind}`} style={{...alignOf(entry,slot.id),...(slot.kind==='T'&&{'--fit':titleFit(journal,entry.layout,slot,html,ratio)||TITLE_STEPS.at(-1)})} as CSSProperties} dangerouslySetInnerHTML={{__html:sanitize(html)}}/>}{hit(slot,Boolean(html))}</div>
 }
 if(entry.layout==='writing'){
  const lines=writingLines(journal,ratio),line=typeScale(journal,'writing').line,html=entry.texts.p0
  return <div className={`journal-sheet j-writing-page rule-${journal.rule} side-${side}`} style={sheetStyle(journal,ratio)}>{meta}
   <div className="j-writing" style={{height:lines*line}}>{journal.rule!=='plain'&&<PaperLines journal={journal} ratio={ratio} lines={lines}/>}{html&&<div className="j-text j-P" style={{transform:`translateY(${-offset*lines*line}px)`,...alignOf(entry,'p0')}} dangerouslySetInnerHTML={{__html:sanitize(html)}}/>}</div>{mark}{stuck}{marks}</div>
 }
 const bleed=slots.some(slot=>slot.bleed)
 return <div className={`journal-sheet j-layout-${entry.layout} j-section-${section} side-${side} ${mirror?'is-mirrored':''} ${bleed?'has-bleed':''} ${spread?'is-spread':''} ${half?'is-right-half':''}`} style={sheetStyle(journal,ratio,section)}>
  {!bleed&&meta}{slots.filter(slot=>slot.bleed).map(render)}<div className="j-grid">{slots.filter(slot=>!slot.bleed).map(render)}{overlay}</div>{mark}{stuck}{marks}</div>
}

function FrontPage({book,journal,owner,ratio}:{book:Book;journal:JournalData;owner:Owner;ratio:number}){
 return <div className="journal-sheet j-front" style={sheetStyle(journal,ratio)}>
  <div className="j-owner"><img src={owner.avatar} alt=""/><span>{owner.name}</span></div>
  <div className="j-front-body"><div className="j-front-title">{book.title}</div>{journal.about&&<p>{journal.about}</p>}</div>
  <div className="j-front-date">Started {formatDate(journal.created)}</div></div>
}

export function journalLeaves(book:Book,journal:JournalData,owner:Owner,ratio:number){
 const leaves:ReactNode[]=[<div key="inside" className="book-page endpaper"/>,<div key="front" className="book-page journal-page page-right"><FrontPage book={book} journal={journal} owner={owner} ratio={ratio}/></div>]
 const numbers=pageNumbers(journal,ratio)
 let recent=0,latest=''
 for(const entry of journal.entries){
  const {first,pages,blank}=numbers.get(entry.id)!,spread=isSpread(entry.layout)
  if(blank)leaves.push(<div key={`${entry.id}-align`} className="book-page journal-page"/>)
  for(let i=0;i<pages;i++){
   const side=leaves.length%2?'right':'left'
   leaves.push(<div key={`${entry.id}-${i}`} className={`book-page journal-page page-${side}`}><JournalSheet journal={journal} entry={entry} ratio={ratio} number={spread?first:first+i} side={spread?'left':side} offset={spread?0:i} half={spread?i as 0|1:undefined} owner={owner}/></div>)
  }
  // The book opens on the last page of the newest entry that has something on it. Leaf i is page i + 1.
  const written=Object.values(entry.texts).some(html=>html.replace(/<[^>]*>/g,'').trim())||Object.keys(entry.images).length||entry.scribbles?.length||entry.stickers?.length
  if(written&&entry.date>=latest){latest=entry.date;recent=leaves.length}
 }
 const blanks=leaves.length%2?3:2
 for(let i=0;i<blanks;i++)leaves.push(<div key={`blank-${i}`} className="book-page journal-page"/>)
 return {leaves,recent}
}

function coverFace(book:Book,side:'front'|'back'):ReactNode{
 const journal=book.journal,cover=journal?.cover
 if(!journal||!cover)return
 const font=journalFonts.find(f=>f.id===journal.font)!,style={'--jc-font':font.family,'--jc-scale':font.scale} as CSSProperties
 const quote=(text?:string,by?:string)=>text&&<blockquote><q>{text}</q>{by&&<cite>{by}</cite>}</blockquote>
 const phrase=book.caption&&<small>{book.caption}</small>
 if(side==='front'){
  if(cover.front==='label')return <div className="jc jc-label" style={style}><div className="jc-plate"><b>{book.title}</b>{phrase}</div></div>
  if(cover.front==='titled')return <div className="jc jc-titled" style={style}><b>{book.title}</b>{phrase}{quote(cover.quote,cover.by)}</div>
  if(cover.front==='window')return <div className="jc jc-window" style={style}><b>{book.title}</b>{book.coverImage&&<figure><img src={book.coverImage} alt="" style={placementStyle(book.coverPlacement)}/></figure>}{phrase}</div>
  return
 }
 if(cover.back==='quote'&&cover.backQuote)return <div className="jc jc-quote" style={style}>{quote(cover.backQuote,cover.backBy)}</div>
 if(cover.back==='note'&&cover.note)return <div className="jc jc-note" style={style}><p>{cover.note}</p></div>
 if(cover.back==='picture'&&(cover.image||cover.note))return <div className="jc jc-picture" style={style}>{cover.image&&<figure><img src={cover.image} alt=""/></figure>}{cover.note&&<p>{cover.note}</p>}</div>
}

/** Cover props for a journal. Title and Window layouts are plain material, so the artwork is not drawn edge to edge. */
export function journalCover(book:Book){
 const front=book.journal?.cover?.front??'artwork',stickers=book.journal?.cover?.stickers
 return {front:coverFace(book,'front'),back:coverFace(book,'back'),coverImage:front==='artwork'||front==='label'?book.coverImage:undefined,stickers:stickers?.length?<StickerLayer stickers={stickers}/>:undefined}
}

/** The same book renderer as sketchbooks, with pages drawn from journal entries. */
export function JournalBook({book,owner,show}:{book:Book;owner:Owner;show?:{side:'front'|'back';at:number}}){
 const journal=book.journal!,ratio=formats.find(f=>f.id===book.format)!.ratio,family=typeScale(journal,'writing').font.family
 const ready=useFontReady(family)
 // ready is a dependency so pages are measured again once the font has loaded.
 const {leaves:pages,recent}=useMemo(()=>journalLeaves(book,journal,owner,ratio),[book.title,journal,owner,ratio,ready])
 const cover=useMemo(()=>journalCover(book),[book.title,book.caption,book.coverImage,book.coverPlacement,journal.cover,journal.font])
 return <Sketchbook kicker="JOURNAL" pages={pages} sheetWidth={sheetSize(ratio).width} maxPage={760} preset={presets.find(p=>p.id==='linen')!} coverColor={book.color} coverImage={cover.coverImage} front={cover.front} back={cover.back} overlay={cover.stickers} show={show} aspectRatio={ratio} coverPlacement={book.coverPlacement} bandColor={book.bandColor??'#2464ed'} turnStyle={book.turnStyle??'curl'} caption={book.caption} title={book.title} artworks={NO_ARTWORKS} paper={papers.find(p=>p.id===book.paper)?.src} startPage={recent}/>
}
