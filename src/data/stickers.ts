/** A sticker pressed onto a cover or a page. Position and size are percentages of that surface,
 * so the same record draws identically in the editor, the book, the shelf and every format. */
export interface PlacedSticker { id:string; src:string; name:string; x:number; y:number; size:number; rotate:number; page?:number }
export interface StickerItem { id:string; name:string; category:StickerVibe; src:string }

export type StickerVibe = 'quotes'|'philosophy'|'gratitude'|'expressions'|'cutesy'|'anime'|'japanese'|'nature'|'travel'|'music'|'retro-tech'|'vintage'|'calendars'
export const stickerVibes:{id:StickerVibe;name:string}[]=[
 {id:'quotes',name:'Quotes'},{id:'philosophy',name:'Philosophy'},{id:'gratitude',name:'Gratitude'},{id:'expressions',name:'Faces'},
 {id:'cutesy',name:'Cute'},{id:'anime',name:'Anime'},{id:'japanese',name:'Japanese'},{id:'nature',name:'Nature'},{id:'travel',name:'Travel'},
 {id:'music',name:'Music'},{id:'retro-tech',name:'Retro tech'},{id:'vintage',name:'Vintage'},{id:'calendars',name:'Calendars'},
]

export const STICKERS_PER_PAGE=8
export const STICKERS_ON_COVER=5
export const STICKER_SIZE={min:6,max:60}

// Only the prepared cutouts in public/stickers are drawn; stored records are data, never markup or remote URLs.
export const safeSticker=(src:string)=>/^\/stickers\/[a-z0-9-]+\/[a-z0-9-]+\.png$/.test(src)

let library:Promise<StickerItem[]>|undefined
/** The manifest is fetched once, the first time a tray opens. A failed fetch can be retried. */
export function loadStickers(){
 library??=fetch('/stickers/manifest.json')
  .then(response=>{if(!response.ok)throw new Error('Stickers could not load.');return response.json() as Promise<{stickers:StickerItem[]}>})
  .then(({stickers})=>stickers.filter(item=>safeSticker(item.src)&&stickerVibes.some(v=>v.id===item.category)))
  .catch(error=>{library=undefined;throw error})
 return library
}

const clamp=(value:number,low:number,high:number)=>Math.min(high,Math.max(low,value))
export function fitSticker(sticker:PlacedSticker):PlacedSticker{
 return {...sticker,x:clamp(sticker.x,0,100),y:clamp(sticker.y,0,100),size:clamp(sticker.size,STICKER_SIZE.min,STICKER_SIZE.max),rotate:Math.round(((sticker.rotate%360)+540)%360-180)}
}
/** A new sticker lands where it was dropped, or near the middle with a small natural tilt. */
export function newSticker(item:StickerItem,size:number,at?:{x:number;y:number}):PlacedSticker{
 const jitter=()=>Math.random()*16-8
 return fitSticker({id:crypto.randomUUID(),src:item.src,name:item.name,x:at?.x??50+jitter(),y:at?.y??46+jitter(),size,rotate:Math.round(jitter())})
}
