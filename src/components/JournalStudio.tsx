import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type FormEvent,type KeyboardEvent as ReactKeyboardEvent,type PointerEvent as ReactPointerEvent,type ReactNode} from 'react'
import {ArrowCounterClockwise,ArrowLeft,ArrowRight,ArrowsOutCardinal,BookOpen,Check,Crop,TextAlignCenter,TextAlignLeft,TextAlignRight,FloppyDisk,Highlighter,LinkSimple,Microphone,Stop,TextB,TextItalic,TextUnderline,Image as ImageIcon,Plus,Trash,X,PencilSimple,SquaresFour,Sticker,PaintBrush} from '@phosphor-icons/react'
import PhoneTools,{panelOf,type Tool} from './PhoneTools'
import {ScribbleArt} from './Scribble'
import {StickerLayer,StickerTray,changeSticker,dropPoint} from './Stickers'
import {STICKERS_ON_COVER,STICKERS_PER_PAGE,fitSticker,newSticker,safeSticker,type PlacedSticker,type StickerItem} from '../data/stickers'
import {Cover,inkFor} from './Sketchbook'
import {formats,papers,presets,type Format,type Placement,type TurnStyle} from '../data/presets'
import {api,message} from '../lib/api'
import type {Book} from '../Profile'
import type {Owner} from './Journal'
import ArtworkCropper from './ArtworkCropper'
import {JournalSheet,dragFocus,focusKey,journalCover,layoutFits,pageNumbers,slotBox,slotFits,slotName,useFontReady,writingPages} from './Journal'
import {IMAGE_LIMITS,ingestJournalImage} from '../lib/images'
import {escapeText,safeLink,sanitize,wordCount} from '../lib/richtext'
import {canDictate,dictate} from '../lib/voice'
import {SCRIBBLES_PER_PAGE,coverFields,coverLayouts,type JournalCover,entrySlots,gridOf,isSpread,scribbleKinds,journalFonts,journalInks,journalLayouts,layoutSlots,moveEdge,newEntry,paperRules,type FontId,type PaperRule,type TextSize,sectionOf,sheetSize,slotArea,slotEdges,slotRect,slotWordLimits,textSizes,today,typeScale,wordLimits,type Edge,type JournalData,type Scribble,type ScribbleKind,type JournalEntry,type LayoutId,type Slot,type TextAlign} from '../data/journal'

export function JournalSettings({journal,onChange}:{journal:JournalData;onChange:(patch:Partial<JournalData>)=>void}){
 return <div className="journal-settings">
  <label className="journal-about">About this journal<textarea rows={2} maxLength={140} placeholder="What will you write here?" value={journal.about} onChange={e=>onChange({about:e.target.value})}/></label>
 </div>
}

/** What every written page looks like: paper, lines, type and the watermark. Shown beside the page being written. */
export function JournalPageSettings({journal,owner,paper,onPaper,onChange}:{journal:JournalData;owner:Owner;paper:string;onPaper:(id:string)=>void;onChange:(patch:Partial<JournalData>)=>void}){
 return <div className="journal-settings journal-page-settings">
  <div className="journal-group"><label>Paper</label><div className="visual-papers">{papers.map(p=><button key={p.id} data-hint={p.name} aria-label={`${p.name} paper`} aria-pressed={paper===p.id} onClick={()=>onPaper(p.id)}><i className={p.id==='dots'?'dotted-paper':''} style={{backgroundImage:`url(${p.src})`}}/></button>)}</div></div>
  <div className="journal-group"><label>Paper lines</label><div className="journal-row">{paperRules.map(rule=><button key={rule.id} aria-label={`${rule.name} paper`} data-hint={rule.name} aria-pressed={journal.rule===rule.id} onClick={()=>onChange({rule:rule.id})}>{rule.name}</button>)}</div></div>
  <div className="journal-group"><label>Font</label><div className="journal-fonts">{journalFonts.map(font=><button key={font.id} data-hint={font.name} aria-label={`${font.name} font`} aria-pressed={journal.font===font.id} onClick={()=>onChange({font:font.id})}><b style={{fontFamily:font.family,fontSize:`${font.scale*22}px`}}>Aa</b><span>{font.name}</span></button>)}</div></div>
  <div className="journal-group"><label>Size</label><div className="journal-row">{textSizes.map(size=><button key={size.id} aria-label={`${size.name} text`} data-hint={size.name} aria-pressed={journal.size===size.id} onClick={()=>onChange({size:size.id})}>{size.name}</button>)}</div></div>
  <div className="journal-group"><label>Ink</label><div className="journal-inks">{journalInks.map(ink=><button key={ink.value} aria-label={`${ink.name} ink`} data-hint={ink.name} aria-pressed={journal.ink===ink.value} style={{backgroundColor:ink.value}} onClick={()=>onChange({ink:ink.value})}/>)}</div></div>
  <div className="journal-group"><label>Watermark</label><div className="journal-row"><button aria-label="No watermark" data-hint="None" aria-pressed={!journal.watermark} onClick={()=>onChange({watermark:false})}>None</button><button className="journal-watermark-choice" aria-label="Watermark with your name and picture" data-hint="Signature" aria-pressed={Boolean(journal.watermark)} onClick={()=>onChange({watermark:true})}><img src={owner.avatar} alt=""/>@{owner.handle}</button></div></div>
 </div>
}

const NO_COVER:JournalCover={front:'artwork',back:'plain'}

/** A saved look for new journals: the book, the page style, the cover layouts and stickers, and the page layouts. */
export interface JournalPreset {name:string;format:Format;color:string;coverImage?:string;coverPlacement?:Placement;paper:string;turnStyle:TurnStyle;font:FontId;size:TextSize;ink:string;rule:PaperRule;watermark:boolean;cover?:JournalCover;layouts:LayoutId[]}
export const PRESET_LIMIT=2
// Built-in pictures and saved uploads are kept; a picture still only in the draft (a data: URL) is too large to keep.
const keep=(src?:unknown)=>typeof src==='string'&&(/^\/[\w\-/.]+$/.test(src)||/^https:\/\/[^\s"'<>]+$/.test(src))?src:undefined
const one=<T,>(list:readonly T[],value:unknown,fallback:T)=>list.includes(value as T)?value as T:fallback
function presetOf(book:Book):JournalPreset{
 const j=book.journal!
 return {name:book.title.trim().slice(0,36)||'Preset',format:book.format,color:book.color,coverImage:keep(book.coverImage),coverPlacement:book.coverPlacement,paper:book.paper,turnStyle:book.turnStyle??'curl',font:j.font,size:j.size,ink:j.ink,rule:j.rule,watermark:Boolean(j.watermark),cover:j.cover&&{...j.cover,image:keep(j.cover.image)},layouts:j.entries.map(e=>e.layout)}
}
/** Presets come back from the server, so every field is checked again before it reaches the draft. */
function readCover(raw:unknown):JournalCover|undefined{
 if(!raw||typeof raw!=='object')return undefined
 const c=raw as Record<string,unknown>,text=(id:keyof typeof coverFields)=>typeof c[id]==='string'?(c[id] as string).slice(0,coverFields[id].max):undefined
 const stickers=(Array.isArray(c.stickers)?c.stickers:[]).filter((s):s is PlacedSticker=>Boolean(s)&&safeSticker(s.src)&&['x','y','size','rotate'].every(k=>Number.isFinite(s[k]))).slice(0,STICKERS_ON_COVER).map(s=>fitSticker({id:crypto.randomUUID(),src:s.src,name:String(s.name??'').slice(0,40),x:s.x,y:s.y,size:s.size,rotate:s.rotate}))
 return {front:one(coverLayouts.front.map(l=>l.id),c.front,'artwork'),back:one(coverLayouts.back.map(l=>l.id),c.back,'plain'),quote:text('quote'),by:text('by'),backQuote:text('backQuote'),backBy:text('backBy'),note:text('note'),image:keep(c.image),stickers}
}
export function withPreset(book:Book,p:JournalPreset):Book{
 const j=book.journal!,written=j.entries.some(e=>Object.values(e.texts).some(Boolean)||Object.keys(e.images).length>0)
 const layouts=(Array.isArray(p.layouts)?p.layouts:[]).filter(id=>journalLayouts.some(l=>l.id===id)).slice(0,60)
 const placement=p.coverPlacement&&['x','y','scale'].every(k=>Number.isFinite(p.coverPlacement![k as keyof Placement]))?{x:p.coverPlacement.x,y:p.coverPlacement.y,scale:p.coverPlacement.scale}:undefined
 return {...book,format:one(formats.map(f=>f.id),p.format,book.format),color:/^#[\da-f]{6}$/i.test(p.color)?p.color:book.color,coverImage:keep(p.coverImage),coverPlacement:placement,paper:one(papers.map(x=>x.id),p.paper,book.paper),turnStyle:one(['curl','hinge'] as TurnStyle[],p.turnStyle,'curl'),
  // Pages already written are never replaced; an empty journal takes the preset's page layouts.
  journal:{...j,font:one(journalFonts.map(f=>f.id),p.font,j.font),size:one(textSizes.map(x=>x.id),p.size,j.size),ink:one(journalInks.map(x=>x.value),p.ink,j.ink),rule:one(paperRules.map(x=>x.id),p.rule,j.rule),watermark:p.watermark===true,cover:readCover(p.cover),entries:written||!layouts.length?j.entries:layouts.map(layout=>newEntry(layout))}}
}

/** Up to two saved looks, kept with the account. Saving copies this journal's look; applying copies it onto this journal. */
export function JournalPresets({book,onApply,onNotice}:{book:Book;onApply:(book:Book)=>boolean;onNotice:(text:string,tone?:'success'|'error')=>void}){
 const [saved,setSaved]=useState<JournalPreset[]|null>(null),[busy,setBusy]=useState(false)
 useEffect(()=>{let live=true;api<{presets:JournalPreset[]}>('GET','/me/presets').then(r=>{if(live)setSaved(r.presets)}).catch(()=>{if(live)setSaved([])});return()=>{live=false}},[])
 async function store(next:JournalPreset[],done:string){
  setBusy(true)
  try{setSaved((await api<{presets:JournalPreset[]}>('PUT','/me/presets',{presets:next})).presets);onNotice(done,'success')}
  catch(error){onNotice(message(error,'Could not save your presets. Please try again.'),'error')}
  finally{setBusy(false)}
 }
 if(!saved)return null
 return <div className="journal-group journal-presets"><label>Presets<span className="sticker-count">{saved.length} / {PRESET_LIMIT}</span></label>
  <div className="journal-preset-list">
   {saved.map((p,i)=><div key={i} className="journal-preset">
    <button className="button-secondary" data-hint="Apply" aria-label={`Apply preset ${p.name}`} onClick={()=>{if(onApply(withPreset(book,p)))onNotice(`${p.name} applied.`,'success')}}>{p.name}</button>
    <button className="button-icon" data-hint="Replace" aria-label={`Replace preset ${p.name} with this journal`} disabled={busy} onClick={()=>{if(confirm(`Replace ${p.name} with this journal's look?`))void store(saved.map((q,j)=>j===i?presetOf(book):q),'Preset updated.')}}><FloppyDisk size={18}/></button>
    <button className="button-icon" data-hint="Delete" aria-label={`Delete preset ${p.name}`} disabled={busy} onClick={()=>{if(confirm(`Delete ${p.name}?`))void store(saved.filter((_,j)=>j!==i),'Preset deleted.')}}><Trash size={18}/></button>
   </div>)}
   {saved.length<PRESET_LIMIT&&<button className="button-quiet" disabled={busy} onClick={()=>void store([...saved,presetOf(book)],'Preset saved.')}><Plus size={18}/>Save as preset</button>}
  </div>
 </div>
}

/** Fixed front and back layouts, shown as real covers so each choice looks like the book. */
export function JournalCoverSettings({book,onChange,onNotice,onArrange}:{book:Book;onChange:(cover:JournalCover,side:'front'|'back')=>void;onNotice:(message:string)=>void;onArrange:()=>void}){
 const journal=book.journal!,cover=journal.cover??NO_COVER
 const [busy,setBusy]=useState(false),upload=useRef<HTMLInputElement>(null)
 const ratio=formats.find(f=>f.id===book.format)!.ratio,preset=presets.find(p=>p.id===book.presetId)!
 // The side tells the preview which cover to show while it changes.
 const set=(patch:Partial<JournalCover>)=>onChange({...cover,...patch},'front' in patch||'quote' in patch||'by' in patch?'front':'back')
 // Previews fill empty fields with a sample, so every layout shows its shape before anything is written.
 const sample={...cover,quote:cover.quote||'Write it down.',backQuote:cover.backQuote||'Keep the small days.',note:cover.note||'If found, please return.',image:cover.image||'/artworks/roses.jpg'}
 const preview=(patch:Partial<JournalCover>,back=false)=>{
  const shown=journalCover({...book,journal:{...journal,cover:{...sample,...patch}}})
  return <span className="cover-layout-book" style={{'--cover':book.color,'--cover-ink':inkFor(book.color),'--title-scale':1,aspectRatio:ratio} as CSSProperties}><Cover preset={preset} title={book.title} caption={book.caption} count={0} coverPlacement={book.coverPlacement} kicker="JOURNAL" back={back} coverImage={shown.coverImage} face={back?shown.back:shown.front}/></span>
 }
 const fields=[...coverLayouts.front.find(l=>l.id===cover.front)!.fields,...coverLayouts.back.find(l=>l.id===cover.back)!.fields]
 async function addPicture(file?:File){
  if(!file)return
  setBusy(true)
  try{set({image:await ingestJournalImage(file)})}
  catch(error){onNotice(error instanceof Error?error.message:'Could not open this picture.')}
  finally{setBusy(false)}
 }
 const stickers=(cover.stickers??[]).filter(s=>safeSticker(s.src))
 // Stickers are arranged on the flat front cover in the canvas, so adding one opens it there.
 function addSticker(item:StickerItem,point?:{x:number;y:number}){
  const at=point&&dropPoint(document.querySelector('.cover-stickers-editor [data-sticker-surface]'),point)
  if(point&&!at)return
  if(stickers.length>=STICKERS_ON_COVER){onNotice(`Up to ${STICKERS_ON_COVER} stickers on the cover.`);return}
  onChange({...cover,stickers:[...stickers,newSticker(item,24,at??undefined)]},'front');onArrange()
 }
 return <div className="journal-cover-settings">
  <div className="journal-group"><label>Front cover</label><div className="cover-layouts">{coverLayouts.front.map(l=><button key={l.id} aria-label={`${l.name} front cover`} data-hint={l.name} aria-pressed={cover.front===l.id} onClick={()=>set({front:l.id})}>{preview({front:l.id})}<span>{l.name}</span></button>)}</div></div>
  <div className="journal-group"><label>Back cover</label><div className="cover-layouts">{coverLayouts.back.map(l=><button key={l.id} aria-label={`${l.name} back cover`} data-hint={l.name} aria-pressed={cover.back===l.id} onClick={()=>set({back:l.id})}>{preview({back:l.id},true)}<span>{l.name}</span></button>)}</div></div>
  {fields.map(id=>{
   const field=coverFields[id],props={'aria-label':field.name,maxLength:field.max,value:cover[id]??'',onChange:(e:{target:{value:string}})=>set({[id]:e.target.value})}
   return <label key={id} className="journal-about">{field.name}{field.lines?<textarea rows={2} {...props}/>:<input {...props}/>}</label>
  })}
  {cover.back==='picture'&&<div className="cover-picture-row"><button className="button-quiet" disabled={busy} onClick={()=>upload.current?.click()}><ImageIcon size={18} weight="light"/>{cover.image?'Replace back picture':'Add back picture'}</button>{cover.image&&<button className="button-icon" aria-label="Remove back picture" data-hint="Remove" onClick={()=>set({image:undefined})}><Trash size={18} weight="light"/></button>}<input ref={upload} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e=>{void addPicture(e.target.files?.[0]);e.target.value=''}}/></div>}
  <div className="journal-group"><label>Cover stickers<span className="sticker-count">{stickers.length} / {STICKERS_ON_COVER}</span></label><StickerTray used={stickers.length} max={STICKERS_ON_COVER} onStart={onArrange} onAdd={addSticker}/></div>
 </div>
}

/** The front cover, flat and large in the canvas, where its stickers are moved, turned and removed. */
export function CoverStickers({book,onChange}:{book:Book;onChange:(stickers:PlacedSticker[])=>void}){
 const [selected,setSelected]=useState<string|null>(null)
 const stickers=book.journal?.cover?.stickers??[],ratio=formats.find(f=>f.id===book.format)!.ratio,preset=presets.find(p=>p.id===book.presetId)!,shown=journalCover(book)
 const edit={selected,onSelect:setSelected,onChange:(id:string,patch:Partial<PlacedSticker>)=>onChange(changeSticker(stickers,id,patch)),onRemove:(id:string)=>{onChange(stickers.filter(s=>s.id!==id));setSelected(null)}}
 return <div className="cover-stickers-editor" onPointerDown={e=>{if(!(e.target as HTMLElement).closest('.sticker'))setSelected(null)}}>
  <span className="cover-layout-book" style={{'--cover':book.color,'--cover-ink':inkFor(book.color),'--title-scale':1,aspectRatio:ratio} as CSSProperties}><Cover preset={preset} title={book.title} caption={book.caption} count={0} coverPlacement={book.coverPlacement} kicker="JOURNAL" coverImage={shown.coverImage} face={shown.front} overlay={<StickerLayer stickers={stickers} edit={edit}/>}/></span>
 </div>
}

function PageThumb({journal,entry,ratio,number,owner}:{journal:JournalData;entry:JournalEntry;ratio:number;number:number;owner:Owner}){
 const sheet=sheetSize(ratio),width=Math.round(Math.sqrt(21000*ratio))
 return <span className="journal-thumb" style={{width:width*(isSpread(entry.layout)?2:1),height:Math.round(width/ratio),'--sheet-scale':width/sheet.width} as CSSProperties}><JournalSheet journal={journal} entry={entry} ratio={ratio} number={number} side="left" owner={owner}/></span>
}

export function JournalPages({journal,ratio,owner,onEdit,onChange}:{journal:JournalData;ratio:number;owner:Owner;onEdit:(id:string)=>void;onChange:(entries:JournalEntry[])=>void}){
 const {entries}=journal
 function move(from:number,to:number){const next=[...entries];[next[from],next[to]]=[next[to],next[from]];onChange(next)}
 function add(){const entry=newEntry();onChange([...entries,entry]);onEdit(entry.id)}
 function remove(entry:JournalEntry){
  const written=Object.keys(entry.texts).some(key=>entry.texts[key])||Object.keys(entry.images).length>0
  if(written&&!confirm('Delete this page? This cannot be undone.'))return
  const next=entries.filter(e=>e.id!==entry.id);onChange(next.length?next:[newEntry()])
 }
 const numbers=pageNumbers(journal,ratio)
 return <section className="artwork-editor journal-pages"><div className="collection-heading"><h2>Your pages</h2><button className="button-secondary" onClick={add}><Plus/>Add page</button></div>
  <div className="journal-page-strip">{entries.map((entry,i)=>{const first=numbers.get(entry.id)!.first;return <div className="journal-page-card" key={entry.id}><button className="journal-page-open" aria-label={`Write on page ${first}`} data-hint="Write" onClick={()=>onEdit(entry.id)}><PageThumb journal={journal} entry={entry} ratio={ratio} number={first} owner={owner}/></button><div className="journal-page-tools"><button className="button-icon" data-hint="Earlier" aria-label={`Move page ${first} earlier`} disabled={i===0} onClick={()=>move(i,i-1)}><ArrowLeft size={15}/></button><button className="button-icon" data-hint="Later" aria-label={`Move page ${first} later`} disabled={i===entries.length-1} onClick={()=>move(i,i+1)}><ArrowRight size={15}/></button><button className="button-icon" data-hint="Delete" aria-label={`Delete page ${first}`} onClick={()=>remove(entry)}><Trash size={15}/></button></div></div>})}</div>
 </section>
}

function caretToEnd(node:HTMLElement){const range=document.createRange();range.selectNodeContents(node);range.collapse(false);const selection=getSelection();selection?.removeAllRanges();selection?.addRange(range)}

/** The dedicated writing field. The browser owns its text, so the caret survives every render. */
const selectionIn=(node:HTMLElement)=>{const selection=getSelection();return selection?.rangeCount&&node.contains(selection.anchorNode)?selection:null}
function within(node:HTMLElement,tag:string){
 const selection=selectionIn(node),at=selection?.anchorNode
 const found=(at instanceof Element?at:at?.parentElement)?.closest(tag)
 return found&&node.contains(found)?found as HTMLElement:null
}
const ALIGNS:{id:TextAlign;name:string;Icon:typeof TextAlignLeft}[]=[{id:'left',name:'Align left',Icon:TextAlignLeft},{id:'center',name:'Align centre',Icon:TextAlignCenter},{id:'right',name:'Align right',Icon:TextAlignRight}]
const FORMATS=[{tag:'b',name:'Bold',Icon:TextB,command:'bold'},{tag:'i',name:'Italic',Icon:TextItalic,command:'italic'},{tag:'u',name:'Underline',Icon:TextUnderline,command:'underline'},{tag:'mark',name:'Highlight',Icon:Highlighter,command:''}]

function TextField({id,html,label,singleLine,font,readOnly,align,onWrite,children}:{id:string;html:string;label:string;singleLine:boolean;font:{family:string;scale:number};readOnly:boolean;align:TextAlign;onWrite:(value:string)=>boolean;children?:ReactNode}){
 const field=useRef<HTMLDivElement>(null),accepted=useRef(html),composing=useRef(false),saved=useRef<Range|null>(null)
 const [active,setActive]=useState<string[]>([]),[link,setLink]=useState<string|null>(null),[linkError,setLinkError]=useState(false)
 // Bold, italic and underline report the browser's own state, so a style chosen at the caret shows before typing.
 function update(){const node=field.current;if(node&&selectionIn(node))setActive([...FORMATS.filter(f=>f.command?document.queryCommandState(f.command):within(node,f.tag)).map(f=>f.tag),...(within(node,'a')?['a']:[])])}
 useEffect(()=>{document.addEventListener('selectionchange',update);return()=>document.removeEventListener('selectionchange',update)},[])
 function ready(){const node=field.current!;if(!selectionIn(node)){node.focus();caretToEnd(node)};return node}
 function format(tag:string,command:string){
  const node=ready()
  if(command){document.execCommand(command);update();return}
  const mark=within(node,'mark'),selection=getSelection()!
  if(mark)mark.replaceWith(...mark.childNodes)
  // At a caret, an empty marker holds the place so the next words are highlighted. sanitize drops the placeholder.
  else if(selection.isCollapsed){
   // Moving the caret forgets a bold or italic chosen at it, so those are chosen again inside the marker.
   const pending=FORMATS.filter(f=>f.command&&document.queryCommandState(f.command)),element=document.createElement(tag)
   element.textContent='​';selection.getRangeAt(0).insertNode(element)
   const caret=document.createRange();caret.setStart(element.firstChild!,1);selection.removeAllRanges();selection.addRange(caret)
   pending.forEach(f=>document.execCommand(f.command))
  }
  else wrap(selection.getRangeAt(0),document.createElement(tag))
  node.dispatchEvent(new Event('input',{bubbles:true}));update()
 }
 // Range edits keep the bold or italic around a selection, which insertHTML drops.
 function wrap(range:Range,element:HTMLElement,after=''){
  if(!range.collapsed)element.append(range.extractContents())
  range.insertNode(element)
  const caret=document.createRange()
  if(after){const space=document.createTextNode(after);element.after(space);caret.setStartAfter(space)}else caret.selectNodeContents(element)
  const selection=getSelection()!;selection.removeAllRanges();selection.addRange(caret)
 }
 function openLink(){
  const node=field.current!,anchor=within(node,'a')
  if(anchor){const range=document.createRange();range.selectNodeContents(anchor);const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.execCommand('unlink');return}
  saved.current=selectionIn(node)?.getRangeAt(0).cloneRange()??null;setLinkError(false);setLink('')
 }
 function addLink(event:FormEvent){
  event.preventDefault()
  const typed=(link??'').trim(),href=safeLink(/^https?:\/\//i.test(typed)?typed:`https://${typed}`)
  if(!typed||!href||!new URL(href).hostname.includes('.')){setLinkError(true);return}
  const node=field.current!,selection=getSelection()!
  node.focus();selection.removeAllRanges()
  if(saved.current)selection.addRange(saved.current);else caretToEnd(node)
  const range=selection.getRangeAt(0),anchor=document.createElement('a')
  anchor.href=href
  if(range.collapsed)anchor.textContent=new URL(href).hostname.replace(/^www\./,'')
  wrap(range,anchor,range.collapsed?' ':'')
  node.dispatchEvent(new Event('input',{bubbles:true}))
  setLink(null)
 }
 useLayoutEffect(()=>{const node=field.current!;node.innerHTML=sanitize(html);accepted.current=node.innerHTML;node.dataset.empty=String(!node.textContent);if(matchMedia('(pointer: fine)').matches){node.focus();caretToEnd(node)}},[id]) // eslint-disable-line react-hooks/exhaustive-deps
 function input(){
  const node=field.current!
  if(composing.current)return
  if(onWrite(sanitize(node.innerHTML)))accepted.current=node.innerHTML
  else{node.innerHTML=accepted.current;caretToEnd(node)}
  node.dataset.empty=String(!node.textContent)
 }
 const field_=<div ref={field} className="journal-field" style={{fontFamily:font.family,fontSize:`${Math.max(17,18*font.scale)}px`,textAlign:align}} role="textbox" aria-multiline={!singleLine} aria-label={label} aria-readonly={readOnly} data-placeholder="Write here" contentEditable={!readOnly} suppressContentEditableWarning onInput={input} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false;input()}} onKeyDown={e=>{if(singleLine&&e.key==='Enter')e.preventDefault()}} onDrop={e=>e.preventDefault()} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))}}/>
 return <>
  {field_}
  <div className="journal-tools">
   {FORMATS.map(({tag,name,Icon,command})=><button key={tag} type="button" className="button-icon" data-hint={name} aria-label={name} aria-pressed={active.includes(tag)} disabled={readOnly} onMouseDown={e=>e.preventDefault()} onClick={()=>format(tag,command)}><Icon size={18} weight={active.includes(tag)?'bold':'regular'}/></button>)}
   <button type="button" className="button-icon" data-hint={active.includes('a')?'Remove link':'Add link'} aria-label={active.includes('a')?'Remove link':'Add link'} aria-pressed={active.includes('a')||link!==null} disabled={readOnly} onMouseDown={e=>e.preventDefault()} onClick={openLink}><LinkSimple size={18}/></button>
   {children}
  </div>
  {link!==null&&<form className="journal-link" onSubmit={addLink} onKeyDown={e=>{if(e.key==='Escape')setLink(null)}}>
   <input autoFocus inputMode="url" autoComplete="url" spellCheck={false} aria-label="Link address" aria-invalid={linkError} placeholder="Paste a link" value={link} onChange={e=>{setLink(e.target.value);setLinkError(false)}}/>
   <button type="submit" className="button-icon" data-hint="Add link" aria-label="Save link"><Check size={18}/></button>
   <button type="button" className="button-icon" data-hint="Cancel" aria-label="Cancel link" onClick={()=>setLink(null)}><X size={18}/></button>
   {linkError&&<small role="alert">Enter a web address, like example.com</small>}
  </form>}
 </>
}

function LayoutGlyph({layout,ratio}:{layout:LayoutId;ratio:number}){
 const spread=isSpread(layout)
 return <span className={`layout-glyph ${spread?'is-spread':''}`} style={{aspectRatio:(ratio>1?1.4:.76)*(spread?2:1)}}>{layoutSlots(layout,ratio).map(slot=><i key={slot.id} className={`glyph-${slot.kind}`} style={slot.bleed?{gridArea:'1/1/-1/-1'}:{gridArea:slotArea(slot),rotate:slot.tilt?`${slot.tilt}deg`:undefined}}/>)}</span>
}

function swap<T>(items:Record<string,T>,a:string,b:string){
 const next={...items};delete next[a];delete next[b]
 if(items[a]!==undefined)next[b]=items[a]
 if(items[b]!==undefined)next[a]=items[b]
 return next
}

/** Drag the picture inside its box to choose what stays in view. Arrow keys do the same. */
function PictureFrame({src,shape,focus,onMove}:{src:string;shape:number;focus:[number,number];onMove:(focus:[number,number])=>void}){
 return <div className="journal-picture-preview is-framed" style={{'--shape':shape} as CSSProperties}><img src={src} alt="" draggable={false} role="slider" tabIndex={0} data-hint="Drag to frame" aria-label="Picture position" aria-valuenow={focus[0]} aria-valuetext={`${focus[0]}% across, ${focus[1]}% down`} style={{objectPosition:`${focus[0]}% ${focus[1]}%`}} onPointerDown={e=>dragFocus(e,e.currentTarget,focus,onMove)} onKeyDown={e=>focusKey(e,focus,onMove)}/></div>
}

const DESK_TOOLS:Tool[]=[{id:'write',name:'Write',Icon:PencilSimple},{id:'layout',name:'Layout',Icon:SquaresFour},{id:'decorate',name:'Decorate',Icon:Sticker},{id:'style',name:'Style',Icon:PaintBrush}]
export function JournalDesk({journal,entry,ratio,paper,owner,onEntry,onClose,onNotice,children}:{journal:JournalData;entry:JournalEntry;ratio:number;paper?:string;owner:Owner;onEntry:(entry:JournalEntry)=>void;onClose:()=>void;onNotice:(message:string)=>void;children?:ReactNode}){
 // A spread is edited as one surface two pages wide. Its boxes are fixed, so it has no edges to resize.
 const section=sectionOf(entry.layout),spread=section==='spread',across=spread?2:1,slots=entrySlots(entry,ratio),edges=spread?[]:slotEdges(slots)
 const texts=slots.filter(slot=>slot.kind!=='I')
 const [slotId,setSlotId]=useState(texts[0]?.id??slots[0].id)
 const slot=slots.find(s=>s.id===slotId)??texts[0]??slots[0]
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[moving,setMoving]=useState<string|null>(null),[revision,setRevision]=useState(0)
 const dropped=useRef(false),stopDrag=useRef<(()=>void)|null>(null)
 const [listening,setListening]=useState(false),stopVoice=useRef<(()=>void)|null>(null),speech=canDictate()
 // Speech arrives between renders, so writes read the newest page from here.
 const live=useRef(entry);live.current=entry
 const [markId,setMarkId]=useState<string|null>(null),[stickerId,setStickerId]=useState<string|null>(null)
 const [cropping,setCropping]=useState(false),[positioning,setPositioning]=useState(false)
 // Phones show one tool panel under the page at a time.
 const [tool,setTool]=useState<string|null>('write'),panel=panelOf(tool)
 const surface=useRef<HTMLDivElement>(null),picker=useRef<HTMLInputElement>(null),[scale,setScale]=useState(0)
 const sheet=sheetSize(ratio),surfaceWidth=sheet.width*across,frame=slot.bleed?{width:surfaceWidth,height:sheet.height}:slotBox(slot,ratio)
 const maxMarks=SCRIBBLES_PER_PAGE*across,maxStickers=STICKERS_PER_PAGE*across,where=spread?'on a spread':'on a page'
 useFontReady(typeScale(journal,'writing').font.family)
 useLayoutEffect(()=>{const node=surface.current!,measure=()=>setScale(node.clientWidth/surfaceWidth);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect()},[surfaceWidth])
 useEffect(()=>{if(!status)return;const timer=setTimeout(()=>setStatus(''),1800);return()=>clearTimeout(timer)},[status])
 useEffect(()=>()=>{stopDrag.current?.();stopVoice.current?.()},[])
 useEffect(()=>{if(!moving)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMoving(null)};addEventListener('keydown',key);return()=>removeEventListener('keydown',key)},[moving])

 const limited=slotWordLimits[slot.kind],bodySlots=slots.filter(s=>s.kind==='P'||s.kind==='B')
 const bodyWords=(page:JournalEntry)=>bodySlots.reduce((sum,s)=>sum+wordCount(page.texts[s.id]),0)
 const used=limited?wordCount(entry.texts[slot.id]):bodyWords(entry)
 const limit=limited??wordLimits[section]
 const spare=[...Object.keys(entry.texts).filter(key=>entry.texts[key]),...Object.keys(entry.images)].filter(key=>!slots.some(s=>s.id===key))
 const pages=writingPages(journal,entry,ratio)
 const number=pageNumbers(journal,ratio).get(entry.id)?.first??1
 const side=(number+pages-1)%2?'left':'right',mirror=side==='right'&&journalLayouts.find(l=>l.id===entry.layout)?.mirror
 const blank=(page:JournalEntry)=>!Object.values(page.texts).some(Boolean)&&!Object.keys(page.images).length,isEmpty=blank(entry)

 function writeTo(id:string,html:string,quiet=false){
  const page=live.current,box=slots.find(s=>s.id===id)!,most=slotWordLimits[box.kind]
  const next:JournalEntry={...page,date:blank(page)?today():page.date,texts:{...page.texts,[id]:html}}
  const shorter=html.length<(page.texts[id]??'').length,words=most?wordCount(html):bodyWords(next)
  const problem=shorter?'':words>(most??wordLimits[section])?'Word limit reached':slotFits(journal,page.layout,box,html,ratio)?'':'This box is full'
  if(problem){if(!quiet)setStatus(problem);return false}
  live.current=next;onEntry(next);return true
 }
 const write=(html:string)=>writeTo(slot.id,html)
 /** Words appear on the page while they are spoken. Finished phrases are kept; a full box hands over to the next one. */
 function speak(){
  if(stopVoice.current){stopVoice.current();return}
  const order=texts.map(s=>s.id)
  let target=slot.id,base=entry.texts[slot.id]??''
  const join=(text:string)=>!text?base:!base?escapeText(text):`${base}${/(\s|<br>)$/.test(base)?'':' '}${escapeText(text)}`
  stopVoice.current=dictate(navigator.language,(final,interim)=>{
   if(final){
    while(!writeTo(target,join(final),true)){
     const next=order[order.indexOf(target)+1]
     if(!next){stopVoice.current?.();setStatus(section==='writing'?'Word limit reached':'This page is full');return}
     target=next;base=live.current.texts[next]??'';setSlotId(next)
    }
    base=join(final)
   }
   if(!interim||!writeTo(target,join(interim),true))writeTo(target,base,true)
   setRevision(r=>r+1)
  },error=>{stopVoice.current=null;setListening(false);if(error)onNotice(error)})
  setListening(true)
 }
 const marks=(entry.scribbles??[]).filter(mark=>(mark.page??0)===pages-1)
 function setMarks(update:(list:Scribble[])=>Scribble[]){const next={...live.current,scribbles:update(live.current.scribbles??[])};live.current=next;onEntry(next)}
 function fitMark(mark:Scribble):Scribble{
  const w=Math.round(Math.min(surfaceWidth,Math.max(40,mark.w))),h=Math.round(Math.min(sheet.height,Math.max(24,mark.h)))
  return {...mark,w,h,x:Math.round(Math.min(surfaceWidth-w,Math.max(0,mark.x))),y:Math.round(Math.min(sheet.height-h,Math.max(0,mark.y)))}
 }
 function changeMark(id:string,change:(mark:Scribble)=>Partial<Scribble>){setMarks(list=>list.map(mark=>mark.id===id?fitMark({...mark,...change(mark)}):mark))}
 function resized(mark:Scribble,w:number,h:number){const kind=scribbleKinds.find(k=>k.id===mark.kind)!;return kind.free?{w,h}:{w,h:w*kind.h/kind.w}}
 function addMark(kind:ScribbleKind){
  if(marks.length>=maxMarks){setStatus(`Up to ${maxMarks} scribbles ${where}`);return}
  // New scribbles land on the chosen box, where they are most likely wanted.
  const size=scribbleKinds.find(k=>k.id===kind)!,box=slotRect(mirror?{...slot,col:12-slot.col-slot.w}:slot,ratio),x=box.x+box.width/2,y=box.y+box.height/2
  const mark=fitMark({id:crypto.randomUUID(),kind,x:x-size.w/2,y:y-size.h/2,w:size.w,h:size.h,seed:1+Math.floor(Math.random()*2**30),page:pages-1})
  setMarks(list=>[...list,mark]);setMarkId(mark.id)
 }
 const stuck=(entry.stickers??[]).filter(s=>(s.page??0)===pages-1&&safeSticker(s.src))
 function setStickers(update:(list:PlacedSticker[])=>PlacedSticker[]){const next={...live.current,stickers:update(live.current.stickers??[])};live.current=next;onEntry(next)}
 function addSticker(item:StickerItem,point?:{x:number;y:number}){
  const at=point&&dropPoint(surface.current,point)
  if(point&&!at)return
  if(stuck.length>=maxStickers){setStatus(`Up to ${maxStickers} stickers ${where}`);return}
  const sticker={...newSticker(item,22/across,at??undefined),page:pages-1}
  setStickers(list=>[...list,sticker]);setMarkId(null);setStickerId(sticker.id)
 }
 const stickerEdit={selected:stickerId,onSelect:(id:string|null)=>{setStickerId(id);if(id)setMarkId(null)},onChange:(id:string,patch:Partial<PlacedSticker>)=>setStickers(list=>changeSticker(list,id,patch)),onRemove:(id:string)=>{setStickers(list=>list.filter(s=>s.id!==id));setStickerId(null)}}
 function removeMark(id:string){setMarks(list=>list.filter(mark=>mark.id!==id));setMarkId(null)}
 function grabMark(event:ReactPointerEvent<HTMLElement>,id:string,mode:'move'|'size'){
  if(event.button)return
  event.stopPropagation();setMarkId(id);setStickerId(null)
  const start=marks.find(mark=>mark.id===id)!,{clientX:x,clientY:y}=event
  follow(event.pointerId,e=>{const dx=(e.clientX-x)/scale,dy=(e.clientY-y)/scale;changeMark(id,()=>mode==='move'?{x:start.x+dx,y:start.y+dy}:resized(start,start.w+dx,start.h+dy))},()=>{})
 }
 function markKey(event:ReactKeyboardEvent<HTMLElement>,id:string){
  const step:Record<string,[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]},move=step[event.key]
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeMark(id);return}
  if(event.key==='Escape'){setMarkId(null);(event.target as HTMLElement).blur();return}
  if(!move)return
  event.preventDefault()
  changeMark(id,mark=>event.shiftKey?resized(mark,mark.w+move[0],mark.h+move[1]):{x:mark.x+move[0],y:mark.y+move[1]})
 }
 function setLayout(layout:LayoutId){
  if(layout===entry.layout)return
  stopVoice.current?.()
  if(!layoutFits(journal,entry,layout,ratio)){setStatus('Too much text for this layout');return}
  onEntry({...entry,layout,grid:undefined});const first=layoutSlots(layout,ratio).find(s=>s.kind!=='I');if(first)setSlotId(first.id)
 }
 function refusal(next:JournalEntry){
  for(const box of entrySlots(next,ratio)){
   const html=next.texts[box.id],most=slotWordLimits[box.kind]
   if(!html||box.kind==='I')continue
   if(most&&wordCount(html)>most)return 'Too long for that box'
   if(!slotFits(journal,next.layout,box,html,ratio))return 'This box is full'
  }
  return bodyWords(next)>Math.max(wordLimits[section],bodyWords(entry))?'Word limit reached':''
 }
 function place(from:string,to:string){
  setMoving(null);stopVoice.current?.()
  const target=slots.find(s=>s.id===to)
  if(from===to||!target)return
  if((from[0]==='i')!==(target.kind==='I')){setStatus('Pictures and words keep their own boxes');return}
  const next=from[0]==='i'?{...entry,images:swap(entry.images,from,to),focus:swap(entry.focus??{},from,to)}:{...entry,texts:swap(entry.texts,from,to)}
  const problem=refusal(next)
  if(problem){setStatus(problem);return}
  onEntry(next);setSlotId(to);setRevision(r=>r+1)
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(()=>surface.current?.querySelectorAll(`[data-slot=${from}],[data-slot=${to}]`).forEach(node=>node.animate([{opacity:.3,transform:'scale(.985)'},{opacity:1,transform:'none'}],{duration:220,easing:'cubic-bezier(.23,1,.32,1)'})))
 }
 function select(next:Slot){
  if(dropped.current)return
  setMarkId(null);setStickerId(null);setTool('write');if(next.id!==slot.id)setPositioning(false)
  stopVoice.current?.()
  if(moving){place(moving,next.id);return}
  setSlotId(next.id);if(next.kind==='I'&&!entry.images[next.id])picker.current?.click()
 }
 function grip(id:string){if(!dropped.current)setMoving(moving===id?null:id)}
 function ghostOf(id:string){
  const ghost=document.createElement('div');ghost.className='journal-ghost';ghost.style.fontFamily=typeScale(journal,'writing').font.family
  if(entry.images[id]){const image=new Image();image.src=entry.images[id];ghost.append(image)}else ghost.innerHTML=sanitize(entry.texts[id])
  document.body.append(ghost);return ghost
 }
 function follow(id:number,onMove:(e:PointerEvent)=>void,onEnd:(e:PointerEvent|null)=>void){
  const move=(e:PointerEvent)=>{if(e.pointerId===id)onMove(e)}
  const stop=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',cancel);stopDrag.current=null}
  const up=(e:PointerEvent)=>{if(e.pointerId!==id)return;stop();onEnd(e)}
  const cancel=(e:PointerEvent)=>{if(e.pointerId!==id)return;stop();onEnd(null)}
  addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',cancel);stopDrag.current=()=>{stop();onEnd(null)}
 }
 function grab(event:ReactPointerEvent<HTMLElement>,id:string){
  if(event.button)return
  const {clientX:x,clientY:y}=event;let ghost:HTMLElement|null=null
  follow(event.pointerId,e=>{
   if(!ghost){if(Math.hypot(e.clientX-x,e.clientY-y)<6)return;ghost=ghostOf(id);setMoving(id)}
   ghost.style.transform=`translate(${e.clientX}px,${e.clientY}px)`
  },e=>{
   if(!ghost)return
   ghost.remove();dropped.current=true;setTimeout(()=>{dropped.current=false})
   const to=e&&document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-slot]')?.dataset.slot
   if(to)place(id,to);else setMoving(null)
  })
 }
 function shiftEdge(edge:Edge,step:number){
  const moved=moveEdge(slots,edge,step)
  if(!moved)return false
  const next={...entry,grid:{layout:entry.layout,wide:ratio>1,rects:Object.fromEntries(moved.map(({id,col,row,w,h})=>[id,{col,row,w,h}]))}}
  const problem=refusal(next)
  if(problem){setStatus(problem);return false}
  onEntry(next);return true
 }
 function dragEdge(event:ReactPointerEvent<HTMLElement>,edge:Edge){
  const grid=event.currentTarget.parentElement!.getBoundingClientRect(),across=edge.axis==='x'
  const cell=(across?grid.width:grid.height)/12,start=across?event.clientX:event.clientY,sign=across&&mirror?-1:1
  let last=0
  follow(event.pointerId,e=>{const step=Math.round(sign*((across?e.clientX:e.clientY)-start)/cell);if(step!==last&&shiftEdge(edge,step))last=step},()=>{})
 }
 function resetGrid(){
  const next={...entry,grid:undefined}
  if(refusal(next)){setStatus('Too much text for this layout');return}
  onEntry(next)
 }
 const overlay=edges.map((edge,i)=>{
  const flip=edge.axis==='y'&&mirror,at=edge.axis==='x'&&mirror?12-edge.at:edge.at,from=flip?12-edge.to:edge.from,to=flip?12-edge.from:edge.to
  const area=edge.axis==='x'?{gridColumn:at+1,gridRow:`${from+1}/${to+1}`}:{gridRow:at+1,gridColumn:`${from+1}/${to+1}`}
  const back=edge.axis==='x'?(mirror?'ArrowRight':'ArrowLeft'):'ArrowUp',forward=edge.axis==='x'?(mirror?'ArrowLeft':'ArrowRight'):'ArrowDown'
  return <div key={i} className={`j-edge is-${edge.axis}`} style={area} role="separator" tabIndex={0} data-hint="Resize" aria-label="Resize boxes" aria-orientation={edge.axis==='x'?'vertical':'horizontal'} aria-valuemin={1} aria-valuemax={11} aria-valuenow={edge.at} onPointerDown={e=>dragEdge(e,edge)} onKeyDown={e=>{if(e.key===back||e.key===forward){e.preventDefault();shiftEdge(edge,e.key===forward?1:-1)}}}/>
 })
 async function addPicture(file?:File){
  if(!file||busy)return
  const total=journal.entries.reduce((sum,e)=>sum+Object.keys(e.images).length,0)
  if(total>=IMAGE_LIMITS.count&&!entry.images[slot.id]){onNotice('Up to 40 pictures per journal.');return}
  setBusy(true)
  try{const src=await ingestJournalImage(file),focus={...entry.focus};delete focus[slot.id];onEntry({...entry,date:isEmpty?today():entry.date,images:{...entry.images,[slot.id]:src},focus})}
  catch(error){onNotice(error instanceof Error?error.message:'Could not open this picture.')}
  finally{setBusy(false)}
 }
 // A crop is compressed again like any journal picture, so it stays under 200 KB.
 async function applyCrop(src:string){
  setBusy(true)
  try{const blob=await (await fetch(src)).blob(),image=await ingestJournalImage(new File([blob],'crop.webp',{type:blob.type})),focus={...live.current.focus};delete focus[slot.id];onEntry({...live.current,images:{...live.current.images,[slot.id]:image},focus});setCropping(false)}
  catch(error){onNotice(error instanceof Error?error.message:'Could not crop this picture.')}
  finally{setBusy(false)}
 }
 const align=entry.align?.[slot.id]??'left'
 function setAlign(next:TextAlign){onEntry({...live.current,align:{...live.current.align,[slot.id]:next}})}
 function removePicture(){const images={...entry.images},focus={...entry.focus};delete images[slot.id];delete focus[slot.id];setPositioning(false);onEntry({...entry,images,focus})}

 return <div className="creation-layout journal-desk">
  <div className="creation-preview">
   {cropping&&entry.images[slot.id]&&<div className="canvas-editor"><ArtworkCropper src={entry.images[slot.id]} onApply={src=>void applyCrop(src)} onClose={()=>setCropping(false)}/></div>}
   {/* Hidden, not unmounted, while cropping: the page keeps its measured scale. */}
   <div className="journal-canvas textured" style={cropping&&entry.images[slot.id]?{display:'none'}:undefined}><div ref={surface} className={`book-page journal-canvas-page ${spread?'is-spread':''}`} style={{'--ratio':ratio*across,'--sheet-scale':scale,'--paper-image':paper?`url("${paper}")`:undefined} as CSSProperties}>{scale>0&&<JournalSheet journal={journal} entry={entry} ratio={ratio} number={number+pages-1} side={side} offset={pages-1} owner={owner} selected={markId||stickerId?undefined:slot.id} moving={moving} overlay={overlay} scribbles={{selected:markId,onGrab:grabMark,onKey:markKey,onSelect:id=>{setMarkId(id);setStickerId(null)},onRemove:removeMark}} stickers={stickerEdit} positioning={positioning&&slot.kind==='I'?slot.id:null} onPosition={(id,focus)=>onEntry({...live.current,focus:{...live.current.focus,[id]:focus}})} onSelect={select} onGrab={grab} onGrip={grip}/>}</div></div>
   <div className="canvas-actions"><button className="button-icon" data-hint="Book" aria-label="Back to book" onClick={onClose}><BookOpen size={21} weight="light"/></button>{gridOf(entry,ratio)&&<button className="button-icon" data-hint="Reset" aria-label="Reset boxes" onClick={resetGrid}><ArrowCounterClockwise size={21} weight="light"/></button>}</div>
  </div>
  <section className="creation-controls journal-composer">
   <div className="tool-group" {...panel('write')}>{slot.kind==='I'?<div className="journal-picture">
    {entry.images[slot.id]?<PictureFrame src={entry.images[slot.id]} shape={frame.width/frame.height} focus={entry.focus?.[slot.id]??[50,50]} onMove={focus=>onEntry({...entry,focus:{...entry.focus,[slot.id]:focus}})}/>:<div className="journal-picture-preview"><ImageIcon size={30} weight="thin"/></div>}
    <div className="journal-picture-actions"><button className="button-secondary" disabled={busy} onClick={()=>picker.current?.click()}>{busy?'Opening…':entry.images[slot.id]?'Replace picture':'Add picture'}</button>{entry.images[slot.id]&&<><button className="button-icon" data-hint={positioning?'Done':'Position'} aria-label="Position picture" aria-pressed={positioning} onClick={()=>{setCropping(false);setPositioning(p=>!p)}}><ArrowsOutCardinal size={18}/></button><button className="button-icon" data-hint="Crop" aria-label="Crop picture" aria-pressed={cropping} disabled={busy} onClick={()=>{setPositioning(false);setCropping(c=>!c)}}><Crop size={18}/></button><button className="button-icon" data-hint="Remove" aria-label="Remove picture" onClick={removePicture}><X size={18}/></button></>}</div>
    <small className="upload-limits">Reduced to under 200 KB. You are responsible for the pictures you add.</small>
   </div>:<>
    <TextField id={`${entry.id}-${slot.id}-${revision}`} html={entry.texts[slot.id]??''} label={slotName(slot)} singleLine={Boolean(limited)} font={typeScale(journal,'writing').font} readOnly={listening} align={align} onWrite={write}>
    <span className="journal-align" role="group" aria-label="Text alignment">{ALIGNS.map(({id,name,Icon})=><button key={id} type="button" className="button-icon" data-hint={name} aria-label={name} aria-pressed={align===id} disabled={listening} onMouseDown={e=>e.preventDefault()} onClick={()=>setAlign(id)}><Icon size={18}/></button>)}</span>
    {speech&&<><button className={`button-icon journal-mic ${listening?'is-on':''}`} data-hint={listening?'Stop':'Dictate'} aria-label="Voice typing" aria-pressed={listening} onClick={speak}>{listening?<Stop size={16} weight="fill"/>:<Microphone size={19} weight="light"/>}</button>{listening&&<small>Your browser may send what you say to its speech service to write it out.</small>}</>}
    </TextField>
   </>}
   <div className="journal-status" aria-live="polite"><span>{moving?'Choose a box':status||(positioning&&slot.kind==='I'?'Drag the picture on the page':'')||(listening?'Listening':'')||(slot.kind==='I'?'':`${used} / ${limit} words`)}</span>{pages>1&&<span>{pages} pages</span>}</div>
   {spare.length>0&&<div className="journal-group"><label>Not on this page</label><div className="journal-tray">{spare.map(id=><button key={id} data-hint="Place" aria-label={`Move ${entry.images[id]?'picture':'text'} onto the page`} aria-pressed={moving===id} onPointerDown={e=>{if(e.pointerType!=='touch')grab(e,id)}} onClick={()=>grip(id)}>{entry.images[id]?<img src={entry.images[id]} alt="" draggable={false}/>:<span style={{fontFamily:typeScale(journal,'writing').font.family}} dangerouslySetInnerHTML={{__html:sanitize(entry.texts[id])}}/>}</button>)}</div></div>}</div>
   <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void addPicture(e.target.files?.[0]);e.target.value=''}}/>
   <div className="tool-group" {...panel('layout')}>{(['writing','minimal','long','layered','spread'] as const).map(group=><div className="journal-group" key={group}><label>{group[0].toUpperCase()+group.slice(1)}</label><div className="journal-layouts">{journalLayouts.filter(l=>l.section===group).map(l=><button key={l.id} className={l.section==='spread'?'is-spread-layout':undefined} data-hint={l.name} aria-label={`${l.name} layout`} aria-pressed={entry.layout===l.id} onClick={()=>setLayout(l.id)}><LayoutGlyph layout={l.id} ratio={ratio}/></button>)}</div></div>)}</div>
   <div className="tool-group" {...panel('decorate')}><div className="journal-group"><label>Scribbles</label><div className="journal-scribbles">{scribbleKinds.map(kind=><button key={kind.id} type="button" data-hint={kind.name} aria-label={`Add ${kind.name.toLowerCase()} scribble`} disabled={marks.length>=maxMarks} onClick={()=>addMark(kind.id)}><ScribbleArt kind={kind.id} w={kind.w} h={kind.h} seed={7}/></button>)}</div></div>
   <div className="journal-group"><label>Stickers<span className="sticker-count">{stuck.length} / {maxStickers}</span></label><StickerTray used={stuck.length} max={maxStickers} onAdd={addSticker}/></div></div>
   <div className="tool-group" {...panel('style')}>{children}</div>
  </section>
  <PhoneTools tools={DESK_TOOLS} value={tool} onChange={setTool}/>
 </div>
}
