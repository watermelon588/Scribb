import sketchbookCovers from './sketchbook-covers.json'
import journalCovers from './journal-covers.json'

type CoverImage = {id:string;src:string;name:string;band?:string;color?:string}

// Keep the existing material and elastic color suggestions while replacing the artwork.
const accents = [
  {band:'#2464ed',color:'#232429'},
  {band:'#f47722',color:'#2149a6'},
  {band:'#092773',color:'#093cb4'},
]
const prepare = (items:{id:string;src:string;name:string}[]):CoverImage[] =>
  items.map(({id,src,name},index)=>({...accents[index],id,src,name}))

export const coverImages = prepare(sketchbookCovers.items)
export const journalCoverImages = prepare(journalCovers.items)
export const coversFor = (kind:'sketchbook'|'journal') =>
  kind==='journal'?journalCoverImages:coverImages
