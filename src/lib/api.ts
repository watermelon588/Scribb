/** The Scribb API (server/). Same origin, so the session cookie travels with every request. */
import type {Book, BookKind} from '../Profile'
import type {JournalEntry} from '../data/journal'

export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message)}}

export async function api<T=Record<string,never>>(method:string,path:string,body?:unknown):Promise<T>{
 let res:Response
 try{res=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})}
 catch{throw new ApiError(0,'offline','Scribb could not be reached. Check your connection and try again.')}
 if(res.status===204)return {} as T
 const data=await res.json().catch(()=>({}))
 if(!res.ok)throw new ApiError(res.status,data?.error?.code??'error',data?.error?.message??'Something went wrong. Please try again.')
 return data as T
}
export const message=(error:unknown,fallback='Something went wrong. Please try again.')=>error instanceof Error?error.message:fallback

export interface User {id:string;username:string;displayName:string;avatar:string;email:string|null;emailVerified:boolean;hasPassword:boolean;aiConsent:boolean}
export type Links={instagram?:string;behance?:string;cara?:string;website?:string}
export interface Person {username:string;displayName:string;bio:string;city:string;avatar:string;links:Links;followers:number;following:number;books:number;followed:boolean;own:boolean}
export interface BookOwner {username:string;displayName:string;avatar:string}
export const AVATARS=Array.from({length:12},(_,i)=>`a${String(i+1).padStart(2,'0')}`)
export const avatarSrc=(id?:string)=>`/avatars/${AVATARS.includes(id??'')?id:'a01'}.svg`

// ---- Books: the editor's Book is one record; the API keeps the design, the pages and the entries apart.
interface BookRow {id:string;kind:BookKind;title:string;visibility:'private'|'public';category:string|null;design:Record<string,unknown>;pages?:Book['artworks'];likeCount:number;saveCount:number;version:number;owner:BookOwner;liked:boolean;saved:boolean}
type EntryRow=JournalEntry&{version:number}
export function toBook(row:BookRow):Book{
 const {journal,...design}=row.design as Partial<Book>
 return {...design,id:row.id,kind:row.kind,title:row.title,visibility:row.visibility,category:row.category??undefined,version:row.version,owner:row.owner,likeCount:row.likeCount,saveCount:row.saveCount,liked:row.liked,saved:row.saved,
  presetId:design.presetId??'linen',color:design.color??'#232429',format:design.format??'3:4',paper:design.paper??'plain',
  artworks:row.pages??[],journal:journal?{...journal,entries:[]}:undefined,complete:Boolean(row.pages)&&row.kind!=='journal'} as Book
}
function designOf(book:Book){
 const {id:_id,kind:_kind,title:_title,visibility:_visibility,category:_category,version:_version,owner:_owner,likeCount:_likes,saveCount:_saves,liked:_liked,saved:_saved,complete:_complete,artworks:_artworks,journal,...design}=book
 return {...design,journal:journal?{...journal,entries:undefined}:undefined}
}
export interface Page<T> {items:T[];next:string|null}
export async function bookPage(path:string,cursor?:string|null):Promise<Page<Book>>{
 const data=await api<{books:BookRow[];next:string|null}>('GET',`${path}${cursor?`${path.includes('?')?'&':'?'}cursor=${encodeURIComponent(cursor)}`:''}`)
 return {items:data.books.map(toBook),next:data.next}
}
/** Every book on a profile. ponytail: loads all pages at once; page it in the UI past a few hundred books. */
export async function allBooks(handle:string){
 const books:Book[]=[];let next:string|null=null
 do{const page:Page<Book>=await bookPage(`/users/${encodeURIComponent(handle)}/books`,next);books.push(...page.items);next=page.next}while(next&&books.length<1000)
 return books
}
/** A whole book: its pages, and every entry when it is a journal. */
export async function loadBook(id:string):Promise<Book>{
 const book=toBook((await api<{book:BookRow}>('GET',`/books/${id}`)).book)
 if(book.kind!=='journal'||!book.journal)return {...book,complete:true}
 const entries:JournalEntry[]=[];let next:string|null=null
 do{const page:{entries:EntryRow[];next:string|null}=await api('GET',`/books/${id}/entries${next?`?cursor=${encodeURIComponent(next)}`:''}`);entries.push(...page.entries.map(entryOf));next=page.next}while(next)
 return {...book,journal:{...book.journal,entries},complete:true}
}
function entryOf(row:EntryRow&{bookId?:string}):JournalEntry{const {bookId:_bookId,...entry}=row;return entry}

// ---- Images: pictures picked in the editor are data: URLs until the book is saved, then they are uploaded once each.
async function upload(src:string,kind:'artwork'|'cover'|'journal',done:Map<string,Promise<string>>){
 if(!src.startsWith('data:'))return src
 if(!done.has(src))done.set(src,(async()=>{
  const blob=await (await fetch(src)).blob()
  const res=await fetch(`/api/media?kind=${kind}`,{method:'POST',credentials:'same-origin',headers:{'content-type':blob.type},body:blob}).catch(()=>{throw new ApiError(0,'offline','Scribb could not be reached. Check your connection and try again.')})
  const data=await res.json().catch(()=>({}))
  if(!res.ok)throw new ApiError(res.status,data?.error?.code??'error',data?.error?.message??'An image could not be uploaded.')
  return data.url as string
 })())
 return done.get(src)!
}
async function withUploads(book:Book):Promise<Book>{
 const done=new Map<string,Promise<string>>()
 const artworks=await Promise.all(book.artworks.map(async a=>({...a,src:await upload(a.src,'artwork',done)})))
 const coverImage=book.coverImage&&await upload(book.coverImage,'cover',done)
 let journal=book.journal
 if(journal){
  const entries=await Promise.all(journal.entries.map(async e=>({...e,images:Object.fromEntries(await Promise.all(Object.entries(e.images).map(async([slot,src])=>[slot,await upload(src,'journal',done)])))})))
  const cover=journal.cover?.image?{...journal.cover,image:await upload(journal.cover.image,'cover',done)}:journal.cover
  journal={...journal,entries,cover}
 }
 return {...book,artworks,coverImage,journal}
}

/** Thrown when part of a save reached the server: `book` carries the new versions, so the next try continues from there. */
export class PartialSave extends ApiError {constructor(error:ApiError,public book:Book){super(error.status,error.code,error.message)}}
const sameEntry=(a:JournalEntry,b:JournalEntry)=>{const {version:_a,...x}=a as EntryRow,{version:_b,...y}=b as EntryRow;return JSON.stringify(x)===JSON.stringify(y)}
/** Saves the book, then each new or changed journal entry, then removes entries deleted since `saved`. */
export async function saveBook(draft:Book,saved?:Book):Promise<Book>{
 let book=await withUploads(draft)
 const result=await api<{version:number}>('PUT',`/books/${book.id}`,{kind:book.kind??'sketchbook',title:book.title,visibility:book.visibility??'private',category:book.category??null,design:designOf(book),pages:book.kind==='journal'?[]:book.artworks,version:book.version??0})
 book={...book,version:result.version}
 if(!book.journal)return {...book,complete:true}
 const before=new Map((saved?.journal?.entries??[]).map(e=>[e.id,e]))
 const entries=[...book.journal.entries]
 try{
  for(const [i,e] of entries.entries()){
   const old=before.get(e.id);before.delete(e.id)
   if(old&&sameEntry(old,e))continue
   const {id,layout,date,texts,images,grid,focus,scribbles,stickers,align}=e
   const r=await api<{version:number;texts:Record<string,string>}>('PUT',`/entries/${id}`,{bookId:book.id,date,layout,texts,images,extras:{grid,focus,scribbles,stickers,align},version:(e as EntryRow).version??0})
   entries[i]={...e,texts:r.texts,version:r.version} as JournalEntry
  }
  for(const id of before.keys())await api('DELETE',`/entries/${id}`)
 }catch(error){
  throw error instanceof ApiError?new PartialSave(error,{...book,journal:{...book.journal,entries}}):error
 }
 return {...book,journal:{...book.journal,entries},complete:true}
}
