import type {Book} from '../Profile'
import {coverImages} from './covers'
import {sampleArtworks, type Format, type PresetId} from './presets'
export type Creator={id:string;name:string;handle:string;city:string;bio:string;avatar:string;color:string}
export const creators:Creator[]=[
 {id:'mira',name:'Mira Sen',handle:'mira.in.colour',city:'Kolkata, India',bio:'Water, pigment, and the quiet things between.',avatar:coverImages[4].src,color:'#b6c2a0'},
 {id:'leo',name:'Leo Martin',handle:'leomakesmarks',city:'Lyon, France',bio:'A record of places, people, and passing light.',avatar:coverImages[9].src,color:'#c7af98'},
 {id:'aya',name:'Aya Mori',handle:'aya.on.paper',city:'Kyoto, Japan',bio:'Small stories, drawn slowly.',avatar:coverImages[13].src,color:'#a6b5c6'},
 {id:'ines',name:'Inès Costa',handle:'ines.studies',city:'Lisbon, Portugal',bio:'Looking for colour in everyday life.',avatar:coverImages[7].src,color:'#c5a8a4'},
]
export type FeedBook=Book & {creatorId:string;category:'Watercolor'|'Illustration'|'Sketches';likes:number;day:number}
const titles=['A small kind of wonder','Somewhere by the sea','Flowers for no reason','The long way home','Little lives','Notes from the garden','Blue hour studies','Places I return to','Soft edges','A season in colour','In passing','Almost a landscape']
const covers=[6,3,5,20,7,14,10,16,8,18,12,19]
const ratios:Format[]=['3:4','16:9','1:1','4:3','3:4','1:1','4:3','16:9','3:4','1:1','4:3','16:9']
export const feedBooks:FeedBook[]=titles.map((title,i)=>({
 id:`feed-${i+1}`,title,creatorId:creators[i%creators.length].id,category:(['Watercolor','Illustration','Sketches'] as const)[i%3],likes:[328,214,187,163,142,126,112,97,86,74,63,51][i],day:(i*7)%13,
 presetId:(['watercolor','linen','spiral'] as PresetId[])[i%3],format:ratios[i],color:['#647b68','#bca987','#d98061','#406b8a','#bfaa80','#767b64'][i%6],paper:i%3===0?'cotton':'plain',coverImage:coverImages[covers[i]].src,bandColor:['#ed843f','#2464ed','#344438'][i%3],caption:['Collected along the way.','A place to begin again.','Look a little closer.'][i%3],turnStyle:'curl',
 artworks:Array.from({length:6},(_,n)=>{const c=coverImages[3+(i+n)%17];return{id:`feed-art-${i}-${n}`,src:c.src,title:`Study ${n+1}`,artist:creators[i%4].name,medium:'From the artist’s sketchbook',layout:n===2&&i%2===1?'spread':'page'}}),
}))
// A small mixed-media study adds variety without a separate book renderer.
feedBooks[10].artworks=sampleArtworks.map(a=>({...a,id:`feed-11-${a.id}`}))
