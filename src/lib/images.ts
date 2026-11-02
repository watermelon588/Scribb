/** Local image ingestion: validate signatures and dimensions before decoding,
 * then store newly encoded pixels, never the original file or its metadata. */
export const IMAGE_LIMITS = {fileBytes:10*1024*1024,batchBytes:40*1024*1024,pixels:20_000_000,edge:8192,outputEdge:2560,count:40}
const allowed = ['image/jpeg','image/png','image/webp']
export function validateBatch(files:File[], existing=0){
 if(files.length+existing>IMAGE_LIMITS.count)throw new Error('Up to 40 artworks per sketchbook.')
 if(files.reduce((sum,f)=>sum+f.size,0)>IMAGE_LIMITS.batchBytes)throw new Error('Choose up to 40 MB of images at a time.')
 for(const f of files)if(!allowed.includes(f.type)||!f.size||f.size>IMAGE_LIMITS.fileBytes)throw new Error('Use JPG, PNG or WebP, up to 10 MB per image.')
}
function dimensions(bytes:Uint8Array,mime:string):[number,number]{
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 const text=(a:number,b:number)=>String.fromCharCode(...bytes.subarray(a,b))
 if(mime==='image/png'&&bytes.length>=33&&bytes[0]===137&&text(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10&&text(12,16)==='IHDR')return[v.getUint32(16),v.getUint32(20)]
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){
  let p=2
  while(p+4<bytes.length){if(bytes[p++]!==255)break;while(p<bytes.length&&bytes[p]===255)p++;if(p+3>bytes.length)break;const m=bytes[p++];if(m===217||m===218)break;if(m===1||(m>=208&&m<=215))continue;const n=v.getUint16(p);if(n<2||p+n>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)&&n>=8)return[v.getUint16(p+5),v.getUint16(p+3)];p+=n}
 }
 if(mime==='image/webp'&&bytes.length>=30&&text(0,4)==='RIFF'&&text(8,12)==='WEBP'){
  const kind=text(12,16)
  if(kind==='VP8X')return[1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)]
  if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return[v.getUint16(26,true)&16383,v.getUint16(28,true)&16383]
  if(kind==='VP8L'&&bytes[20]===47){const bits=v.getUint32(21,true);return[(bits&16383)+1,((bits>>>14)&16383)+1]}
 }
 throw new Error('This file is not a supported image, or its contents do not match its type.')
}
async function decode(file:File){
 validateBatch([file]);const [width,height]=dimensions(new Uint8Array(await file.arrayBuffer()),file.type)
 if(!width||!height||width>IMAGE_LIMITS.edge||height>IMAGE_LIMITS.edge||width*height>IMAGE_LIMITS.pixels)throw new Error('Images must be under 20 megapixels and 8192 pixels on either side.')
 let bitmap:ImageBitmap
 try{bitmap=await createImageBitmap(file)}catch{throw new Error('This image is damaged or could not be decoded.')}
 if(bitmap.width*bitmap.height>IMAGE_LIMITS.pixels){bitmap.close();throw new Error('This image exceeds the pixel limit.')}
 return bitmap
}
// Safari cannot encode WebP and silently returns PNG, so fall back to JPEG there.
function encode(bitmap:ImageBitmap,edge:number,quality:number){
 const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable.');ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
 const webp=canvas.toDataURL('image/webp',quality);const result=webp.startsWith('data:image/webp')?webp:canvas.toDataURL('image/jpeg',quality);canvas.width=canvas.height=1;return result
}
export async function ingestImage(file:File):Promise<string>{
 const bitmap=await decode(file)
 try{return encode(bitmap,IMAGE_LIMITS.outputEdge,.9)}finally{bitmap.close()}
}
export const JOURNAL_IMAGE_BYTES=200*1024
/** Journal pictures: step resolution down at good quality first, and only then lower quality. */
export async function ingestJournalImage(file:File):Promise<string>{
 const bitmap=await decode(file)
 try{
  for(const quality of[.82,.68])for(const edge of[1600,1280,1024,800,640]){
   const url=encode(bitmap,edge,quality);if((url.length-url.indexOf(',')-1)*.75<JOURNAL_IMAGE_BYTES)return url
  }
  throw new Error('This picture cannot be reduced under 200 KB. Try a simpler one.')
 }finally{bitmap.close()}
}
