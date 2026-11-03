import type {PlacedSticker} from './stickers'
export type FontId = 'book'|'classic'|'clean'|'modern'|'typewriter'|'slab'|'everyday'|'neat'|'elegant'|'rough'
export type TextSize = 's'|'m'|'l'
export type PaperRule = 'lined'|'grid'|'plain'
export type LayoutId = 'writing'|'statement'|'window'|'margin'|'frames'|'zigzag'|'stepped'|'inset'|'ledger'|'collage'|'band'|'overlap'|'stack'|'card'|'offset'|'ribbon'|'panorama'|'fold'|'scrapbook'
export type Section = 'writing'|'minimal'|'long'|'layered'|'spread'
export type SlotKind = 'T'|'H'|'P'|'I'|'C'|'Q'|'S'|'B'

export type ScribbleKind = 'underline'|'box'|'circle'|'heart'|'star'|'smile'|'arrow'|'check'
/** A rough.js mark placed on the sheet in reference pixels. `page` is the page of a long Writing entry. */
export interface Scribble {id:string;kind:ScribbleKind;x:number;y:number;w:number;h:number;seed:number;page?:number}
// Free kinds stretch to fit words; the others keep their shape.
export const scribbleKinds:{id:ScribbleKind;name:string;w:number;h:number;free?:boolean}[]=[
 {id:'underline',name:'Underline',w:320,h:44,free:true},
 {id:'box',name:'Box',w:340,h:140,free:true},
 {id:'circle',name:'Circle',w:300,h:140,free:true},
 {id:'arrow',name:'Arrow',w:220,h:90,free:true},
 {id:'heart',name:'Heart',w:120,h:110},
 {id:'star',name:'Star',w:124,h:120},
 {id:'smile',name:'Smile',w:120,h:120},
 {id:'check',name:'Check',w:110,h:100},
]
export const SCRIBBLES_PER_PAGE=6
export interface SlotRect {col:number;row:number;w:number;h:number}
export interface JournalGrid {layout:LayoutId;wide:boolean;rects:Record<string,SlotRect>}
export type TextAlign='left'|'center'|'right'
export interface JournalEntry { id:string; layout:LayoutId; date:string; texts:Record<string,string>; images:Record<string,string>; grid?:JournalGrid; focus?:Record<string,[number,number]>; scribbles?:Scribble[]; stickers?:PlacedSticker[]; align?:Record<string,TextAlign> }
export type FrontCover='artwork'|'label'|'titled'|'window'
export type BackCover='plain'|'quote'|'note'|'picture'
/** Fixed cover layouts. The title and the cover phrase come from the book; the rest is stored here. */
export interface JournalCover {front:FrontCover;back:BackCover;quote?:string;by?:string;backQuote?:string;backBy?:string;note?:string;image?:string;stickers?:PlacedSticker[]}
export type CoverField='quote'|'by'|'backQuote'|'backBy'|'note'
export const coverLayouts:{front:{id:FrontCover;name:string;fields:CoverField[]}[];back:{id:BackCover;name:string;fields:CoverField[]}[]}={
 front:[{id:'artwork',name:'Artwork',fields:[]},{id:'label',name:'Label',fields:[]},{id:'titled',name:'Title',fields:['quote','by']},{id:'window',name:'Window',fields:[]}],
 back:[{id:'plain',name:'Plain',fields:[]},{id:'quote',name:'Quote',fields:['backQuote','backBy']},{id:'note',name:'Note',fields:['note']},{id:'picture',name:'Picture',fields:['note']}],
}
export const coverFields:Record<CoverField,{name:string;max:number;lines?:boolean}>={quote:{name:'Quote',max:120,lines:true},by:{name:'Quote by',max:40},backQuote:{name:'Back quote',max:120,lines:true},backBy:{name:'Back quote by',max:40},note:{name:'Note',max:140,lines:true}}
export interface JournalData { font:FontId; size:TextSize; ink:string; rule:PaperRule; about:string; created:string; entries:JournalEntry[]; watermark?:boolean; cover?:JournalCover }

// `scale` evens out optical size, so every font fills the same line grid.
export const journalFonts:{id:FontId;name:string;family:string;scale:number;hand?:boolean}[] = [
 {id:'book',name:'Book',family:"'Newsreader Variable',serif",scale:1},
 {id:'classic',name:'Classic',family:"'Cormorant Garamond Variable',serif",scale:1.1},
 {id:'clean',name:'Clean',family:"'Manrope Variable',sans-serif",scale:.9},
 {id:'modern',name:'Modern',family:"'DM Sans Variable',sans-serif",scale:.93},
 {id:'typewriter',name:'Typewriter',family:"'Courier Prime',monospace",scale:.88},
 {id:'slab',name:'Slab',family:"'Zilla Slab',serif",scale:.98},
 {id:'everyday',name:'Everyday',family:"'Caveat Variable',cursive",scale:1.2,hand:true},
 {id:'neat',name:'Neat',family:"'Shadows Into Light',cursive",scale:1,hand:true},
 {id:'elegant',name:'Elegant',family:"'La Belle Aurore',cursive",scale:1.05,hand:true},
 {id:'rough',name:'Rough',family:"'Reenie Beanie',cursive",scale:1.4,hand:true},
]
export const journalInks=[{name:'Ink black',value:'#262826'},{name:'Graphite',value:'#55585a'},{name:'Navy',value:'#233a63'},{name:'Sepia',value:'#6a4a33'},{name:'Crimson',value:'#8e2b33'}]
export const textSizes:{id:TextSize;name:string;body:number}[]=[{id:'s',name:'Small',body:26},{id:'m',name:'Medium',body:30},{id:'l',name:'Large',body:34}]
export const paperRules:{id:PaperRule;name:string}[]=[{id:'lined',name:'Lined'},{id:'grid',name:'Grid'},{id:'plain',name:'Plain'}]

// One definition per layout: the same slots, arranged for upright (3:4, 1:1) and wide (4:3, 16:9) pages.
// KIND column row width height on a 12 x 12 grid. ^ overlaps, ~n tilts, ! bleeds to the page edge.
// Spreads are one surface over two pages: columns 12 to 23 are the right page. Only pictures cross the fold.
export const journalLayouts:{id:LayoutId;name:string;section:Section;upright:string;wide:string;mirror?:boolean}[] = [
 {id:'writing',name:'Writing',section:'writing',upright:'P 0 0 12 12',wide:'P 0 0 12 12'},
 {id:'statement',name:'Statement',section:'minimal',upright:'T 0 0 10 2|I 0 2 12 5|P 0 7 12 5',wide:'I 0 0 6 12|T 6 0 6 3|P 6 3 6 9'},
 {id:'window',name:'Window',section:'minimal',upright:'I! 0 0 12 12|P^ 2 3 8 6',wide:'I! 0 0 12 12|P^ 5 1 6 10'},
 {id:'margin',name:'Margin Note',section:'minimal',upright:'P 0 0 6 12|I 7 0 5 9|C 7 9 5 3',wide:'P 0 0 7 12|I 7 0 5 9|C 7 9 5 3'},
 {id:'frames',name:'Two Frames',section:'minimal',upright:'I 0 0 8 6|I 0 6 8 6|P 8 0 4 6|P 8 6 4 6',wide:'I 0 0 6 7|I 6 0 6 7|P 0 7 6 5|P 6 7 6 5'},
 {id:'zigzag',name:'Zigzag',section:'long',upright:'I 0 0 5 4|P 5 0 7 7|P 0 4 5 8|I 7 7 5 5|I 5 7 2 3',wide:'I 0 0 4 6|P 4 0 4 12|P 0 6 4 6|I 8 0 4 8|I 8 8 4 4'},
 {id:'stepped',name:'Stepped Essay',section:'long',upright:'I 0 0 4 5|I 4 2 3 3|P 7 0 5 7|Q 0 5 7 2|I 0 7 7 5|P 7 7 5 5',wide:'I 0 0 3 6|I 3 2 2 4|P 5 0 7 6|Q 0 6 5 2|I 0 8 5 4|P 5 6 7 6'},
 {id:'inset',name:'Inset Columns',section:'long',upright:'T 0 0 4 2|P 0 2 4 10|P 4 0 8 3|I 4 3 8 6|P 4 9 8 3',wide:'T 0 0 4 2|P 0 2 4 10|P 8 0 4 12|I 4 0 4 7|P 4 7 4 5'},
 {id:'ledger',name:'Ledger',section:'long',upright:'I 0 0 4 5|P 4 0 8 5|S 0 5 12 1|P 0 6 8 6|I 8 6 4 3|P 8 9 4 3',wide:'I 0 0 4 5|P 4 0 8 5|S 0 5 12 2|P 0 7 6 5|I 6 7 2 5|P 8 7 4 5'},
 {id:'collage',name:'Collage Story',section:'long',upright:'I~-3 0 0 6 4|I^~3 5 1 6 4|I^~-1 2 3 5 3|T 0 6 12 2|P 0 8 12 4',wide:'I~-2 0 0 4 6|I^~3 3 1 4 5|I^~-1 1 5 5 6|T 7 0 5 3|P 7 3 5 9'},
 {id:'band',name:'Fold Band',section:'long',upright:'P 0 0 12 4|I 0 4 5 4|B 5 4 7 4|P 0 8 12 4',wide:'P 0 0 12 3|I 0 3 4 6|B 4 3 8 6|P 0 9 12 3',mirror:true},
 {id:'overlap',name:'Overlap Title',section:'layered',upright:'I 0 0 12 6|T^ 0 5 8 3|H 8 6 4 2|P 0 8 12 4',wide:'I 0 0 7 12|T^ 5 1 7 3|H 7 4 5 2|P 7 6 5 6'},
 {id:'stack',name:'Photo Stack',section:'layered',upright:'I~-4 0 0 6 4|I^~3 5 1 7 4|T 0 6 12 2|H 0 8 12 1|P 0 9 12 3',wide:'I~-4 0 0 4 7|I^~3 3 4 4 8|T 7 0 5 3|H 7 3 5 2|P 7 5 5 7'},
 {id:'card',name:'Title Card',section:'layered',upright:'I! 0 0 12 12|T^ 0 1 9 3|H^ 0 4 7 2|P^ 3 7 9 5',wide:'I! 0 0 12 12|T^ 0 1 6 3|H^ 0 4 5 2|P^ 7 3 5 8'},
 {id:'offset',name:'Offset Frames',section:'layered',upright:'T 0 0 8 2|H 0 2 8 1|I 0 3 8 6|I^~3 8 1 4 3|P^ 5 7 7 5',wide:'T 0 0 6 3|H 0 3 6 2|I 0 5 6 7|I^~3 6 0 3 4|P^ 5 4 7 8'},
 {id:'ribbon',name:'Ribbon Title',section:'layered',upright:'I 0 0 12 4|T^ 2 3 8 2|H 2 5 8 1|P 0 6 6 6|P 6 6 6 6',wide:'I 0 0 12 5|T^ 3 4 6 3|H 3 7 6 1|P 0 8 6 4|P 6 8 6 4'},
 {id:'panorama',name:'Panorama',section:'spread',upright:'I! 0 0 24 12|T^ 1 1 9 3|P^ 14 6 9 5',wide:'I! 0 0 24 12|T^ 1 1 8 3|P^ 15 4 8 7'},
 {id:'fold',name:'Across the Fold',section:'spread',upright:'T 0 0 10 2|H 0 2 8 1|I 3 3 18 5|Q 14 0 10 3|P 0 8 12 4|P 12 8 12 4',wide:'T 0 0 8 3|H 0 3 8 2|P 0 6 8 6|I 9 0 15 7|Q 12 8 5 4|P 17 8 7 4'},
 {id:'scrapbook',name:'Scrapbook',section:'spread',upright:'I~-3 1 0 9 6|I^~4 8 4 8 5|I~-2 16 0 7 5|T 0 8 7 2|H 0 10 7 2|P 16 6 8 6',wide:'I~-3 0 0 7 7|I^~4 8 2 8 7|I~-2 17 0 6 5|T 0 8 7 2|H 0 10 7 2|P 17 6 7 6'},
]
export const isSpread=(layout:LayoutId)=>sectionOf(layout)==='spread'

/** `meta` is the panel that carries the date and number when a picture covers the page. */
export interface Slot {id:string;kind:SlotKind;col:number;row:number;w:number;h:number;overlap:boolean;bleed:boolean;tilt:number;meta:boolean}
export function layoutSlots(layout:LayoutId,ratio:number):Slot[]{
 const def=journalLayouts.find(l=>l.id===layout)!
 const seen:Record<string,number>={}
 const slots=(ratio>1?def.wide:def.upright).split('|').map(part=>{
  const [head,...rest]=part.split(' ');const kind=head[0] as SlotKind;const [col,row,w,h]=rest.map(Number)
  const n=seen[kind]??0;seen[kind]=n+1
  return {id:`${kind.toLowerCase()}${n}`,kind,col,row,w,h,overlap:head.includes('^'),bleed:head.includes('!'),tilt:Number(head.split('~')[1]??0),meta:false}
 })
 const panels=slots.filter(slot=>slot.overlap&&slot.kind!=='I'),panel=panels.find(slot=>slot.kind==='P')??panels[0]
 if(panel&&slots.some(slot=>slot.bleed))panel.meta=true
 return slots
}
/** A box in sheet pixels. On a spread, the right page starts one sheet width across. */
export function slotRect(slot:Slot,ratio:number){
 const sheet=sheetSize(ratio),cw=(sheet.width-2*sheet.margin-11*sheet.gap)/12,ch=(sheet.height-sheet.top-sheet.bottom-11*sheet.gap)/12,fold=2*sheet.margin-sheet.gap
 return {x:sheet.margin+slot.col*(cw+sheet.gap)+(slot.col>=12?fold:0),y:sheet.top+slot.row*(ch+sheet.gap),width:cw*slot.w+sheet.gap*(slot.w-1)+(slot.col<12&&slot.col+slot.w>12?fold:0),height:ch*slot.h+sheet.gap*(slot.h-1)}
}
/** CSS grid lines for a box. A spread grid has a gutter track at the fold, between columns 11 and 12. */
export const slotArea=(slot:Slot)=>`${slot.row+1}/${slot.col<12?slot.col+1:slot.col+2}/span ${slot.h}/span ${slot.w+(slot.col<12&&slot.col+slot.w>12?1:0)}`

// A resize belongs to one layout and one arrangement, so changing either falls back to the design.
export const gridOf=(entry:JournalEntry,ratio:number)=>entry.grid?.layout===entry.layout&&entry.grid.wide===(ratio>1)?entry.grid:undefined
export function entrySlots(entry:JournalEntry,ratio:number):Slot[]{
 const slots=layoutSlots(entry.layout,ratio),grid=gridOf(entry,ratio)
 return grid?slots.map(slot=>({...slot,...grid.rects[slot.id]})):slots
}

export interface Edge {axis:'x'|'y';at:number;from:number;to:number}
const solid=(slot:Slot)=>!slot.overlap&&!slot.bleed
/** The lines neighbouring boxes share. Moving one grows the boxes on one side and shrinks the other side. */
export function slotEdges(slots:Slot[]):Edge[]{
 const edges=new Map<string,Edge>(),boxes=slots.filter(solid)
 function add(axis:Edge['axis'],at:number,from:number,to:number){
  if(from>=to)return
  const known=edges.get(axis+at)
  edges.set(axis+at,{axis,at,from:Math.min(from,known?.from??from),to:Math.max(to,known?.to??to)})
 }
 for(const a of boxes)for(const b of boxes){
  if(a.col+a.w===b.col)add('x',b.col,Math.max(a.row,b.row),Math.min(a.row+a.h,b.row+b.h))
  if(a.row+a.h===b.row)add('y',b.row,Math.max(a.col,b.col),Math.min(a.col+a.w,b.col+b.w))
 }
 return [...edges.values()]
}
export function moveEdge(slots:Slot[],{axis,at}:Edge,step:number){
 const next=slots.map(slot=>{
  if(!solid(slot))return slot
  if(axis==='x'&&slot.col+slot.w===at)return {...slot,w:slot.w+step}
  if(axis==='x'&&slot.col===at)return {...slot,col:slot.col+step,w:slot.w-step}
  if(axis==='y'&&slot.row+slot.h===at)return {...slot,h:slot.h+step}
  if(axis==='y'&&slot.row===at)return {...slot,row:slot.row+step,h:slot.h-step}
  return slot
 })
 const tooSmall=next.some((slot,i)=>slot.w<Math.min(2,slots[i].w)||slot.h<Math.min(2,slots[i].h))
 const boxes=next.filter(solid)
 const clash=boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.col<b.col+b.w&&b.col<a.col+a.w&&a.row<b.row+b.h&&b.row<a.row+a.h))
 return tooSmall||clash?null:next
}

export const wordLimits:Record<Section,number>={writing:1000,minimal:100,long:250,layered:160,spread:300}
export const slotWordLimits:Partial<Record<SlotKind,number>>={T:16,H:14,C:12,S:14,Q:20}
export const sectionOf=(layout:LayoutId)=>journalLayouts.find(l=>l.id===layout)!.section

const pad=(n:number)=>String(n).padStart(2,'0')
export function today(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
export function formatDate(iso:string){const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'})}
export const newEntry=(layout:LayoutId='writing'):JournalEntry=>({id:crypto.randomUUID(),layout,date:today(),texts:{},images:{}})
export const newJournal=():JournalData=>({font:'book',size:'m',ink:journalInks[0].value,rule:'lined',about:'',created:today(),entries:[newEntry()]})

/** Every format shares one sheet area, so type holds the same words at every ratio. */
export function sheetSize(ratio:number){
 const width=Math.round(1000*Math.sqrt(ratio/.75));const height=Math.round(width/ratio)
 return {width,height,margin:Math.round(width*.084),top:112,bottom:104,gap:20}
}
export function typeScale(journal:JournalData,section:Section){
 const font=journalFonts.find(f=>f.id===journal.font)!
 const base=textSizes.find(s=>s.id===journal.size)!.body-(section==='writing'||section==='minimal'?0:4)
 return {font,size:Math.round(base*font.scale*10)/10,line:Math.round(base*1.55)}
}
export function writingLines(journal:JournalData,ratio:number){
 const {height,top,bottom}=sheetSize(ratio)
 return Math.floor((height-top-bottom)/typeScale(journal,'writing').line)
}
