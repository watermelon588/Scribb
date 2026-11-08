import {PhonePanel,Part} from './components/PhonePanel'
import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {ArrowCounterClockwise, DotsThree, Moon, Sun, BookOpen, Plus, ArrowLeft, X, MagnifyingGlass, Palette, Crop, Check, ArrowRight,  PencilSimple, UploadSimple, Trash, Sticker, Bell, LockSimple, GlobeSimple, Images, Image as ImageIcon, BookBookmark, Scroll, Notebook, SquaresFour, Bookmarks} from '@phosphor-icons/react'
import PhoneTools, {panelOf, type Tool} from './components/PhoneTools'
import Sketchbook, {artworkPages} from './components/Sketchbook'
import CreatorBadge from './components/CreatorBadge'
import Welcome from './components/Welcome'
import Legal, {SiteFooter, PhoneSettings} from './components/Legal'
import AskJournal, {JournalCompanion} from './components/AskJournal'
import Hints from './components/Hints'
import Notice, {useNotice} from './components/Notice'
import Bookshelf, {BookObject} from './components/Bookshelf'
import {ingestImage,validateBatch} from './lib/images'
import {presets, formats, papers, coverColors, type Artwork, type PresetId, type Format} from './data/presets'
import {coversFor} from './data/covers'
import PlacementEditor, {defaultPlacement} from './components/PlacementEditor'
import type {Placement, TurnStyle} from './data/presets'
import './profile.css'
import Feed from './components/Feed'
import {JournalBook, layoutFits, type Owner} from './components/Journal'
import {CoverStickers, JournalDesk, JournalPages, JournalCoverSettings, JournalPageSettings, JournalPresets, JournalSettings} from './components/JournalStudio'
import {newJournal, type JournalData, type JournalEntry} from './data/journal'
import {useAppMotion} from './lib/motion'
import {LinkIcon, Notifications, ResetPassword, Settings, SignIn, linkName} from './components/Account'
import {ApiError, LINK_KINDS, PartialSave, allBooks, api, avatarSrc, loadBook, message, saveBook, type BookOwner, type Person, type User} from './lib/api'

export type BookKind = 'sketchbook'|'journal'
export type Book = {kind?:BookKind;journal?:JournalData;caption?:string;id:string; title:string; presetId:PresetId; color:string; format:Format; paper:string; coverImage?:string; coverPlacement?:Placement; bandColor?:string; turnStyle?:TurnStyle; artworks:Artwork[]
 // From the API: visibility and version are saved; owner, counts and flags come with cards; complete means pages (and entries) are loaded.
 // latest is a feed card's newest journal entry, the page the card opens at.
 visibility?:'private'|'public'; category?:string; version?:number; owner?:BookOwner; likeCount?:number; saveCount?:number; liked?:boolean; saved?:boolean; complete?:boolean; latest?:JournalEntry}
const emptyPages:Artwork[]=[{id:'blank-left',src:'',title:'',artist:'',medium:'',blank:true},{id:'blank-right',src:'',title:'',artist:'',medium:'',blank:true}]
// Journals are always Linen: no elastic and no spiral wire. Sketchbooks keep every binding.
const asJournal=(b:Book):Book=>b.kind==='journal'&&b.presetId!=='linen'?{...b,presetId:'linen'}:b
const fresh=(kind:BookKind='sketchbook'):Book=>({id:crypto.randomUUID(),kind,journal:kind==='journal'?newJournal():undefined,title:`Untitled ${kind}`,presetId:kind==='journal'?'linen':'watercolor',color:'#232429',format:'3:4',paper:'plain',coverImage:coversFor(kind)[0].src,bandColor:'#2464ed',turnStyle:'curl',artworks:[],visibility:'private',complete:true})
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('untitled-portfolio',1);r.onupgradeneeded=()=>r.result.createObjectStore('library');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function loadRecord<T>(key:string){const db=await database();return new Promise<T|undefined>((resolve,reject)=>{const tx=db.transaction('library');const r=tx.objectStore('library').get(key);r.onsuccess=()=>{resolve(r.result);db.close()};r.onerror=()=>{reject(r.error);db.close()}})}
// Quota failures can surface only at commit, as an abort with no error event.
async function saveRecord(key:string,value:unknown){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('library','readwrite');tx.objectStore('library').put(value,key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error)}})}

export function CoverPicker({value,onChange,kind='sketchbook'}:{value?:string;onChange:(value?:string)=>void;kind?:BookKind}) {
 const rail=useRef<HTMLDivElement>(null)
 return <div className="cover-picker"><div ref={rail} className="cover-fan" aria-label="Cover artwork presets">{coversFor(kind).map(c=><button type="button" key={c.id} className={`cover-choice ${value===c.src?'chosen':''}`} data-hint={c.name} aria-label={`Choose ${c.name}`} aria-pressed={value===c.src} onClick={()=>onChange(c.src)}><img src={c.src} alt=""/></button>)}</div><div className="cover-rail-controls"><button className="button-icon" aria-label="Previous covers" data-hint="Back" onClick={()=>rail.current?.scrollBy({left:-180,behavior:'smooth'})}><ArrowLeft size={16}/></button><button className="button-icon" aria-label="More covers" data-hint="More" onClick={()=>rail.current?.scrollBy({left:180,behavior:'smooth'})}><ArrowRight size={16}/></button></div></div>
}
function LayoutIcon({spread=false}:{spread?:boolean}){return <svg width="32" height="24" viewBox="0 0 32 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="28" height="20" rx="1" stroke="currentColor" opacity=".4"/><path d="M16 2v20" stroke="currentColor"/>{spread?<rect x="6" y="6" width="20" height="12" fill="currentColor" opacity=".35"/>:<><rect x="6" y="6" width="7" height="12" fill="currentColor" opacity=".35"/><rect x="19" y="6" width="7" height="12" fill="currentColor" opacity=".35"/></>}</svg>}

// Phones get their own compact layout (src/phone.css); this breakpoint matches the bottom navigation.
const PHONE='(max-width:600px)'
function usePhone(){return useSyncExternalStore(change=>{const m=matchMedia(PHONE);m.addEventListener('change',change);return()=>m.removeEventListener('change',change)},()=>matchMedia(PHONE).matches)}
const SKETCH_TOOLS:Tool[]=[{id:'pages',name:'Pages',Icon:Images},{id:'cover',name:'Cover',Icon:ImageIcon},{id:'binding',name:'Binding',Icon:BookBookmark},{id:'paper',name:'Paper',Icon:Scroll}]
const JOURNAL_TOOLS:Tool[]=[{id:'pages',name:'Pages',Icon:Notebook},{id:'cover',name:'Cover',Icon:ImageIcon},{id:'layout',name:'Layout',Icon:SquaresFour},{id:'paper',name:'Paper',Icon:Scroll},{id:'presets',name:'Presets',Icon:Bookmarks}]

export default function Profile(){
 // Profiles, books and Explore have crawlable paths (/@name, /@name/<book id>, /explore; server/seo.ts renders them for crawlers). Legacy hash links still work.
 const pathPerson=()=>location.hash?null:/^\/@([\w.]+)(?:\/([\da-f-]{36}))?\/?$/i.exec(location.pathname)
 const route=()=>location.hash==='#new'||location.hash==='#studio'?'new':location.hash==='#feed'||!location.hash&&location.pathname==='/explore'?'feed':['#privacy','#terms','#ask','#settings'].includes(location.hash)?location.hash.slice(1):location.hash.startsWith('#@')||pathPerson()?'person':'portfolio'
 const personHandle=()=>location.hash.startsWith('#@')?decodeURIComponent(location.hash.slice(2)).toLowerCase():pathPerson()?.[1].toLowerCase()??''
 const [screen,setScreen]=useState(route),[handle,setHandle]=useState(personHandle)
 const urlFor=(next:string)=>next.startsWith('@')?`/${next}`:next==='feed'?'/explore':next==='portfolio'?'/':`/#${next}`
 function navigate(next:string){setScreen(next.startsWith('@')?'person':next);history.pushState(null,'',urlFor(next));window.scrollTo({top:0,behavior:'instant'})}
 function openPerson(name:string){setHandle(name);navigate(`@${name}`)}
 useEffect(()=>{const sync=()=>{setScreen(route());setHandle(personHandle());window.scrollTo({top:0,behavior:'instant'});if(route()==='new')setDraft(d=>{if(d)return d;const book=fresh();pristine.current=book;return book});setViewing(null)};window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync)}},[])
 const appRoot=useRef<HTMLDivElement>(null)
 const [theme,setTheme]=useState<'light'|'dark'>(()=>document.documentElement.dataset.theme==='dark'?'dark':'light')
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#181c1a':'#faf9f6');try{localStorage.setItem('untitled-theme',theme)}catch{/* Keep the chosen appearance for this session. */}},[theme])
 const [style,setStyle]=useState<'gallery'|'editorial'>(()=>{try{return localStorage.getItem('portfolio-style')==='editorial'?'editorial':'gallery'}catch{return 'gallery'}})
 const [shelf,setShelf]=useState(false)
 // Phones always use the Gallery style and view; the stored choices still apply on wider screens.
 const phone=usePhone(),look=phone?'gallery':style
 // The phone editor's open tool panel; 'publish' is the sheet Save opens for name, caption and visibility.
 const [tool,setTool]=useState<string|null>('pages')
 const [kind,setKind]=useState<BookKind>(()=>{try{return localStorage.getItem('collection-kind')==='journal'?'journal':'sketchbook'}catch{return 'sketchbook'}})
 function chooseKind(v:BookKind){setKind(v);try{localStorage.setItem('collection-kind',v)}catch{/* The choice still applies for this session. */}}
 function chooseStyle(v:'gallery'|'editorial'){setStyle(v);try{localStorage.setItem('portfolio-style',v)}catch{/* Style can still be explored without storage. */}}
 const [showCover,setShowCover]=useState<{side:'front'|'back';at:number}>()
 // The sketchbook binding chosen in a new draft, restored when switching back from Journal (journals are always Linen).
 const sketchPreset=useRef<PresetId>('watercolor')
const [books,setBooks]=useState<Book[]>([]),[ready,setReady]=useState(false),[query,setQuery]=useState(''),[limit,setLimit]=useState(12)
 const [draft,setDraft]=useState<Book|null>(()=>location.hash==='#studio'||location.hash==='#new'?fresh():null),[viewing,setViewing]=useState<Book|null>(null),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false)
 const undoStack=useRef<Book[]>([]),previousDraft=useRef(draft)
 const [undoCount,setUndoCount]=useState(0),[undoRevision,setUndoRevision]=useState(0)
 useEffect(()=>{
  const before=previousDraft.current
  if(before===draft)return
  if(!phone||!before||!draft||before.id!==draft.id||before.version!==draft.version)undoStack.current=[]
  else undoStack.current=[...undoStack.current.slice(-39),before]
  previousDraft.current=draft;setUndoCount(undoStack.current.length)
 },[draft,phone])
 function undoEdit(){
  const previous=undoStack.current.pop();if(!previous)return
  previousDraft.current=previous;setDraft(previous);setUndoCount(undoStack.current.length);setUndoRevision(n=>n+1)
 }
 const {notice,notify:setNotice,dismiss:dismissNotice}=useNotice()
 const showError=(text:string)=>setNotice(text,'error')
 // Signed in: undefined while asking the server, null for guests.
 const [user,setUser]=useState<User|null>(),[me,setMe]=useState<Person|null>(null),[unread,setUnread]=useState(0)
 const [person,setPerson]=useState<{profile:Person;books:Book[]}|'missing'|null>(null)
 // An open public book shows its own address (/@name/<id>), so it can be shared; closing restores the page's address.
 const beforeBook=useRef('')
 useEffect(()=>{const id=pathPerson()?.[2];if(id)loadBook(id).then(b=>setViewing(asJournal(b))).catch(e=>showError(message(e,'This book could not be opened.')))},[]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  const at=viewing?.visibility==='public'&&viewing.owner?`/@${viewing.owner.username}/${viewing.id}`:''
  if(at&&location.pathname!==at){beforeBook.current=location.pathname+location.hash;history.replaceState(null,'',at)}
  else if(at)beforeBook.current||=`/@${viewing!.owner!.username}`
  else if(beforeBook.current){if(pathPerson()?.[2])history.replaceState(null,'',beforeBook.current);beforeBook.current=''}
 },[viewing]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  const who=screen==='person'&&person&&person!=='missing'?person.profile:null
  document.title=viewing?`${viewing.title||'Untitled'} · Scribb`:screen==='feed'?'Explore sketchbooks and journals · Scribb':who?`${who.displayName||who.username} (@${who.username}) · Scribb`:'Scribb — Free digital sketchbooks and journals'
 },[screen,person,viewing])
 const [panel,setPanel]=useState<null|'signin'|'signup'|'settings'|'notifications'|'verified'|{reset:string}>(null)
 // The saved copy of the book being edited, so a save sends only changed journal entries and removes deleted ones.
 const serverCopy=useRef<Book|null>(null)
 const [editing,setEditing]=useState('book')
 // The draft as it was opened. Any edit creates a new object, so identity tells us it changed.
 const pristine=useRef(draft)
 const unsaved=Boolean(draft)&&draft!==pristine.current
 const coverUpload=useRef<HTMLInputElement>(null)
 const file=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null)
 // A press and release both on the backdrop close the dialog; a drag that ends outside does not.
 const backdropPress=useRef(false)
 const outsideDialog=(e:{target:EventTarget;currentTarget:HTMLElement;clientX:number;clientY:number})=>{if(e.target!==e.currentTarget)return false;const r=e.currentTarget.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom}
 function refreshUser(){return api<{user:User|null}>('GET','/auth/me').then(r=>setUser(r.user)).catch(()=>setUser(null))}
 // Links from emails: #reset/<token> and #verify-email/<token>.
 useEffect(()=>{
  const token=/^#(reset|verify-email)\/([\w-]+)$/.exec(location.hash)
  if(token){history.replaceState(null,'','#');if(token[1]==='reset')setPanel({reset:token[2]});else api('POST','/auth/verify-email',{token:token[2]}).then(()=>{setPanel('verified');setNotice('Your email is verified. Welcome to Scribb!','success');void refreshUser()}).catch(e=>showError(message(e)))}
  void refreshUser()
 },[])
 // Your profile, books and on-device draft load once you are signed in. Drafts are kept per account.
 useEffect(()=>{
  if(user===undefined)return
  if(!user){setMe(null);setBooks([]);setReady(true);return}
  setReady(false)
  Promise.all([api<{profile:Person}>('GET',`/users/${encodeURIComponent(user.username)}`),allBooks(user.username),loadRecord<Book|null>(`draft:${user.id}`).catch(()=>null)])
   .then(([p,list,stored])=>{setMe(p.profile);setBooks(list.map(asJournal));if(stored)setDraft(asJournal(stored))})
   .catch(e=>showError(message(e,'Your books could not be loaded.'))).finally(()=>setReady(true))
  api<{unread:number}>('GET','/notifications').then(r=>setUnread(r.unread)).catch(()=>{})
 },[user?.id,user?.isCreator]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(screen!=='person'||!handle||handle===user?.username)return
  let live=true;setPerson(null)
  Promise.all([api<{profile:Person}>('GET',`/users/${encodeURIComponent(handle)}`),allBooks(handle)]).then(([p,list])=>{if(live)setPerson({profile:p.profile,books:list.map(asJournal)})})
   .catch(e=>{if(!live)return;setPerson('missing');if(!(e instanceof ApiError&&e.status===404))showError(message(e))})
  return()=>{live=false}
 },[screen,handle,user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(user===null&&screen==='new')setPanel('signin')},[user,screen])
 useEffect(()=>{if(!ready||!user||!draft||draft===pristine.current)return;const timer=setTimeout(()=>{saveRecord(`draft:${user.id}`,draft).catch(()=>showError('Autosave failed. Your draft stays open here until you save it.'))},600);return()=>clearTimeout(timer)},[draft,ready,user])
 useEffect(()=>{if(viewing||panel)dialog.current?.showModal();else dialog.current?.close()},[viewing,panel])
 function signedIn(next:User){setUser(next);setPanel(null);setNotice(`Signed in as @${next.username}.`,'success')}
 function signedOut(){setUser(null);setPanel(null);setDraft(null);pristine.current=null;serverCopy.current=null;if(screen==='new')navigate('portfolio')}
 async function follow(who:Person){
  if(!user){setPanel('signin');return}
  const on=!who.followed,update=(p:Person)=>({...p,followed:on,followers:p.followers+(on?1:-1)})
  setPerson(v=>v&&v!=='missing'?{...v,profile:update(v.profile)}:v)
  try{await api(on?'PUT':'DELETE',`/users/${encodeURIComponent(who.username)}/follow`);setNotice(on?`You’re now following @${who.username}.`:`Unfollowed @${who.username}.`,'success')}catch(e){setPerson(v=>v&&v!=='missing'?{...v,profile:who}:v);showError(message(e))}
 }
 function change<K extends keyof Book>(key:K,value:Book[K]){setDraft(current=>current?{...current,[key]:value}:current)}
 async function upload(files:FileList|null){
  if(!files||!draft||uploading)return
  const id=draft.id, chosen=Array.from(files);setUploading(true)
  try{validateBatch(chosen,draft.artworks.length);const arts:Artwork[]=[]
   for(const f of chosen){const src=await ingestImage(f);arts.push({id:crypto.randomUUID(),src,title:f.name.replace(/\.[^.]+$/,''),artist:me?.displayName??'',medium:'From your collection',layout:'page'})}
   setDraft(d=>d?.id===id?{...d,artworks:[...d.artworks,...arts]}:d)
   setNotice(`${arts.length===1?'Artwork':`${arts.length} artworks`} added to your draft. Save your ${draft.kind==='journal'?'journal':'sketchbook'} to keep it.`,'success')
  }catch(error){showError(error instanceof Error?error.message:'Could not open those images.')}finally{setUploading(false)}
 }
 // Pictures upload first, then the book, then changed journal entries. A failure keeps the draft open and unsaved.
 async function save(){
  if(!draft||!canSave||!user)return;setSaving(true)
  const next={...draft,title:draft.title.trim(),artworks:isJournal?[]:draft.artworks,journal:isJournal?draft.journal:undefined},existing=books.some(b=>b.id===draft.id)
  try{
   if(existing&&isJournal&&!serverCopy.current)serverCopy.current=await loadBook(draft.id)
   const saved=asJournal(await saveBook(next,existing?serverCopy.current??undefined:undefined))
   setBooks([saved,...books.filter(b=>b.id!==draft.id)])
   await saveRecord(`draft:${user.id}`,null).catch(()=>{})
   serverCopy.current=null;pristine.current=null;setDraft(null);chooseKind(draftKind);navigate('portfolio')
   setNotice(saved.visibility==='public'?`${Noun} saved successfully and published.`:`${Noun} saved successfully. Only you can see it.`,'success')
  }catch(error){
   if(error instanceof PartialSave){serverCopy.current=null;setDraft(asJournal(error.book))}
   showError(error instanceof ApiError&&error.code==='stale_version'?`This ${noun} changed on another device. Your draft is still here.`:`Could not save: ${message(error)} Your draft is still here.`)
  }finally{setSaving(false)}
 }
 /** Cards from lists carry no pages; opening or editing loads the whole book first. */
 async function full(b:Book){if(b.complete)return b;try{return asJournal(await loadBook(b.id))}catch(e){showError(message(e,'This book could not be opened.'));return null}}
 async function view(b:Book){const book=await full(b);if(book)setViewing(book)}
 function renderBook(b:Book,show?:{side:'front'|'back';at:number},latest?:boolean){if(b.kind==='journal')return <JournalBook key={`${b.id}-${b.presetId}`} book={b} owner={b.owner?{name:b.owner.displayName,handle:b.owner.username,avatar:avatarSrc(b.owner.avatar)}:owner} show={show}/>;return <Sketchbook key={`${b.id}-${b.presetId}`} preset={presets.find(p=>p.id===b.presetId)!} coverColor={b.color} coverImage={b.coverImage} aspectRatio={formats.find(f=>f.id===b.format)!.ratio} coverPlacement={b.coverPlacement} bandColor={b.bandColor??'#2464ed'} turnStyle={b.turnStyle??'curl'} caption={b.caption} title={b.title} artworks={b.artworks.length?b.artworks:emptyPages} paper={papers.find(p=>p.id===b.paper)?.src} initiallyClosed startPage={latest&&b.artworks.length?artworkPages(b.artworks).length:undefined}/>}
 const owner=useMemo<Owner>(()=>({name:me?.displayName??'',handle:me?.username??'',avatar:avatarSrc(me?.avatar)}),[me])
 const ratio=draft?formats.find(f=>f.id===draft.format)!.ratio:.75
 const selectedArt=draft?.artworks.find(a=>a.id===editing)
 const draftKind=draft?.kind??'sketchbook',isJournal=draftKind==='journal',noun=isJournal?'journal':'sketchbook',Noun=isJournal?'Journal':'Sketchbook'
 const canSave=Boolean(draft?.title.trim())&&(isJournal||Boolean(draft?.artworks.length))
 const selectedEntry=draft?.journal?.entries.find(e=>e.id===editing)
 const isNewDraft=Boolean(draft)&&!books.some(b=>b.id===draft?.id)
 const writing=Boolean(selectedEntry&&draft?.journal),toolPanel=panelOf(writing?null:tool)
 useEffect(()=>{if(draft&&draft.kind!=='journal')sketchPreset.current=draft.presetId},[draft])
  function switchKind(next:BookKind){setEditing('book');setTool('pages');setDraft(d=>{
   if(!d)return d
   const index=coversFor(d.kind??'sketchbook').findIndex(c=>c.src===d.coverImage)
   return {...d,kind:next,coverImage:index<0?d.coverImage:coversFor(next)[index].src,presetId:next==='journal'?'linen':sketchPreset.current,journal:d.journal??(next==='journal'?newJournal():undefined),title:d.title===`Untitled ${d.kind??'sketchbook'}`?`Untitled ${next}`:d.title}
  })}
 function changeJournal(patch:Partial<JournalData>){setDraft(d=>d?.journal?{...d,journal:{...d.journal,...patch}}:d)}
 function chooseFormat(format:Book['format']){
  const nextRatio=formats.find(f=>f.id===format)!.ratio
  if(draft?.journal&&draft.journal.entries.some(e=>!layoutFits(draft.journal!,e,e.layout,nextRatio))){showError('Some pages hold too much text for this format.');return}
  change('format',format)
 }
 function changeType(patch:Partial<JournalData>){
  if(!draft?.journal)return
  const next={...draft.journal,...patch}
  if(next.entries.some(e=>!layoutFits(next,e,e.layout,ratio))){showError('Some pages hold too much text for this choice.');return}
  changeJournal(patch)
 }
 function applyPreset(next:Book){
  const r=formats.find(f=>f.id===next.format)!.ratio
  if(next.journal!.entries.some(e=>!layoutFits(next.journal!,e,e.layout,r))){showError('Some pages hold too much text for this preset.');return false}
  setDraft(next);setEditing('book');setShowCover({side:'front',at:Date.now()});return true
 }
 function updateEntry(entry:JournalEntry){setDraft(d=>d?.journal?{...d,journal:{...d.journal,entries:d.journal.entries.map(e=>e.id===entry.id?entry:e)}}:d)}
 async function openDraft(book:Book){if(unsaved){navigate('new');setNotice('Continuing your unsaved draft. Save or discard it first.');return}const loaded=await full(book);if(!loaded)return;serverCopy.current=books.some(b=>b.id===loaded.id)?loaded:null;setTool('pages');pristine.current=loaded;setEditing('book');setDraft(loaded);navigate('new')}
 function startBook(){if(!user){setPanel('signin');return}void openDraft(fresh(kind))}
 async function discardDraft(){
  if(!confirm('Discard this draft? This cannot be undone.'))return
  try{if(user)await saveRecord(`draft:${user.id}`,null);pristine.current=null;serverCopy.current=null;setDraft(null);setEditing('book');navigate('portfolio');setNotice('Draft discarded.','success')}
  catch{showError('Could not discard this draft. Your draft is still here. Please try again.')}
 }
 function chooseCover(src?:string){const preset=coversFor(draftKind).find(c=>c.src===src);setDraft(d=>d?{...d,coverImage:src,coverPlacement:defaultPlacement,bandColor:preset?.band??d.bandColor,color:preset?.color??d.color}:d)}
 function updateArt(id:string,patch:Partial<Artwork>){setDraft(d=>d?{...d,artworks:d.artworks.map(a=>a.id===id?{...a,...patch}:a)}:d)}
 async function uploadCover(f?:File){if(!f||uploading||!draft)return;const id=draft.id;setUploading(true);try{const src=await ingestImage(f);setDraft(d=>d?.id===id?{...d,coverImage:src,coverPlacement:defaultPlacement}:d);setEditing('cover');setNotice('Cover added to your draft. Save your book to keep it.','success')}catch(error){showError(error instanceof Error?error.message:'Could not open this image.')}finally{setUploading(false)}}
 useAppMotion(appRoot,screen,look,Boolean(viewing||panel))
 function portfolio(){
  const self=screen!=='person'||handle===user?.username
  if(self&&user===null)return <Welcome theme={theme} onCreate={()=>setPanel('signup')}/>
  if(!self&&person==='missing')return <main className="profile-main"><p className="empty-search">No one has that username.</p></main>
  const who=self?me:person&&person!=='missing'?person.profile:null
  if(!who)return <main className="profile-main" aria-busy="true"/>
  const list=self?books:(person as {books:Book[]}).books,noun=kind
  const filtered=list.filter(b=>(b.kind??'sketchbook')===kind&&b.title.toLowerCase().includes(query.toLowerCase()))
  const links=LINK_KINDS.filter(([key])=>who.links[key])
  return <main className="profile-main"><section className="artist-profile"><div className="artist-portrait"><img src={avatarSrc(who.avatar)} alt={`${who.displayName||who.username}'s profile picture`}/></div><div className="artist-details"><h1>{who.username}<span>.</span>{who.isCreator&&<CreatorBadge/>}</h1>{self&&phone&&<button className="button-icon profile-more" aria-label="Portfolio settings" data-hint="Settings" onClick={()=>navigate('settings')}><DotsThree size={22}/></button>}{who.bio&&<p>{who.bio}</p>}<div className="artist-links">{links.length>0&&<span className="artist-link-icons">{links.map(([key])=><a key={key} href={who.links[key]} target="_blank" rel="noopener noreferrer nofollow" aria-label={linkName(key)} data-hint={linkName(key)}><LinkIcon kind={key} size={17}/></a>)}</span>}<span className="artist-counts">{who.followers} {who.followers===1?'follower':'followers'}</span>{self?<button className="button-icon" aria-label="Edit artist profile" data-hint="Edit" onClick={()=>setPanel('settings')}><PencilSimple/></button>:<button className={who.followed?'button-secondary follow-button':'button-primary follow-button'} aria-pressed={who.followed} onClick={()=>void follow(who)}>{who.followed?'Following':'Follow'}</button>}</div></div></section><section className="profile-collection"><div className="collection-heading"><h2 className="sr-only">{self?'Your books':`Books by ${who.displayName||who.username}`}</h2><div className="kind-switch kind-switch-large" role="group" aria-label="Collection">{(['sketchbook','journal'] as const).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{chooseKind(k);setQuery('');setLimit(12)}}>{k==='journal'?'Journals':'Sketchbooks'}</button>)}</div>{self&&<div className="collection-actions"><button className="button-primary" disabled={!ready} onClick={startBook}><Plus size={18}/> New {kind}</button></div>}</div><div className="collection-toolbar"><label className="collection-search"><MagnifyingGlass size={17}/><input aria-label={`Find a ${noun}`} placeholder={`Find a ${noun}`} value={query} onChange={e=>{setQuery(e.target.value);setLimit(12)}}/></label></div><div className="collection-view-switch"><button className="button-quiet" aria-pressed={!shelf} onClick={()=>setShelf(false)}>Gallery</button><button className="button-quiet" aria-pressed={shelf} onClick={()=>setShelf(true)}>Bookshelf</button></div>{shelf&&!phone?<Bookshelf noun={kind} books={filtered.slice(0,limit)} onOpen={b=>void view(b)} onEdit={self?b=>void openDraft({...b}):undefined}/>:<div className="book-collection layout-gallery">{filtered.slice(0,limit).map(b=><article className="collection-book" key={b.id}><button className="collection-book-open" onClick={()=>void view(b)} aria-label={`Open ${b.title}`}><BookObject book={b}/></button><div className="collection-book-caption"><h3>{b.title}</h3>{self&&b.visibility!=='public'&&<LockSimple size={14} aria-label="Private" className="private-mark"/>}{self&&<button className="button-icon" data-hint="Edit" aria-label={`Edit ${b.title}`} onClick={()=>void openDraft({...b})}><PencilSimple size={16}/></button>}</div></article>)}</div>}{ready&&!filtered.length&&(query?<p className="empty-search">No {noun}s found.</p>:self?<button className="empty-create" onClick={startBook} aria-label={`Create ${noun}`} disabled={!ready}><Plus size={24}/><span>Create your first {noun}</span></button>:<p className="empty-search">No public {noun}s yet.</p>)}{filtered.length>limit&&<button className="button-secondary load-more" onClick={()=>setLimit(limit+12)}>Show more</button>}</section></main>
 }
 return <div ref={appRoot} className={`portfolio-app style-${look} ${screen==='new'?'is-editing':''}`}><header className="portfolio-header"><a className="wordmark" href="/" aria-label="Scribb home"><img className="brand-mark" src="/brand/scribb-mark.png" alt="" width="34" height="34"/><span>Scribb</span></a><nav><button aria-current={screen==='feed'?'page':undefined} onClick={()=>navigate('feed')}>Explore</button><button aria-current={screen==='portfolio'?'page':undefined} onClick={()=>navigate('portfolio')}>Your portfolio</button></nav><div className="header-actions"><button className="button-icon theme-toggle" aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'} data-hint={theme==='dark'?'Light':'Dark'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={21} weight="light"/>:<Moon size={21} weight="light"/>}</button>{user?<><button className="button-icon notification-bell" aria-label={unread?`Notifications, ${unread} unread`:'Notifications'} data-hint="Notifications" onClick={()=>setPanel('notifications')}><Bell size={21} weight="light"/>{unread>0&&<i aria-hidden="true"/>}</button><button className="profile-avatar" onClick={()=>phone?navigate('settings'):setPanel('settings')} aria-label="Settings" data-hint="Account"><img src={avatarSrc(me?.avatar??user.avatar)} alt=""/></button></>:user===null&&<button className="button-secondary header-sign-in" onClick={()=>setPanel('signin')}>Sign in</button>}</div></header>{!['ask','privacy','terms'].includes(screen)&&<div className="style-picker" role="group" aria-label="Portfolio style">{(['gallery','editorial'] as const).map(v=><button key={v} data-hint={v==='gallery'?'Gallery':'Editorial'} aria-label={`${v} style`} aria-pressed={style===v} onClick={()=>chooseStyle(v)}><i className={`style-glyph glyph-${v}`} aria-hidden="true"/></button>)}</div>}
 {screen==='settings'&&phone?<PhoneSettings username={user?.username} onAccount={()=>setPanel(user?'settings':'signin')} onBack={()=>navigate('portfolio')}/>:screen==='privacy'||screen==='terms'?<Legal page={screen}/>:screen==='ask'?<AskJournal key={user?.id??'guest'} user={user} onUser={setUser} onSignIn={()=>setPanel('signin')} onSettings={()=>setPanel('settings')}/>:screen==='feed'?<Feed onNotice={setNotice} user={user} onOpen={b=>void view(b)} onPerson={openPerson} onSignIn={()=>setPanel('signin')}/>:screen==='new'&&draft&&user?<main className="creation-page">
 <div className="creation-heading"><button className="button-icon" data-hint="Back" aria-label="Back to portfolio" onClick={()=>navigate('portfolio')}><ArrowLeft size={22}/></button>{isNewDraft&&<div className="kind-switch" role="group" aria-label="Book type">{(['sketchbook','journal'] as const).map(k=><button key={k} aria-pressed={draftKind===k} onClick={()=>switchKind(k)}>{k==='journal'?'Journal':'Sketchbook'}</button>)}</div>}<div className="creation-save">{phone&&<button className="button-icon" aria-label="Undo edit" data-hint="Undo" disabled={!undoCount||saving||uploading} onClick={undoEdit}><ArrowCounterClockwise size={20}/></button>}{unsaved&&<button className="button-icon" data-hint="Discard" aria-label="Discard draft" onClick={discardDraft}><Trash size={20}/></button>}<button className={phone?"button-icon":"button-primary"} aria-label={phone?"Save":undefined} data-hint={phone?"Save":undefined} disabled={saving||uploading||(!canSave&&(!phone||tool==='publish'))} onClick={phone&&tool!=='publish'?()=>{setEditing('book');setTool('publish')}:save}>{phone?<Check/>:saving?'Saving…':<>Save<span className="phone-hidden"> {noun}</span></>} {!phone&&<Check/>}</button></div></div>
 {selectedEntry&&draft.journal?<JournalDesk key={selectedEntry.id} phone={phone} undoRevision={undoRevision} owner={owner} journal={draft.journal} entry={selectedEntry} ratio={ratio} paper={papers.find(p=>p.id===draft.paper)?.src} onEntry={updateEntry} onClose={()=>setEditing('book')} onNotice={showError}><JournalPageSettings journal={draft.journal} owner={owner} paper={draft.paper} onPaper={id=>change('paper',id)} onChange={changeType}/></JournalDesk>:<div className="creation-layout"><div className="creation-preview">
 {editing==='cover'&&draft.coverImage?<div className="canvas-editor"><PlacementEditor key={draft.coverImage} src={draft.coverImage} value={draft.coverPlacement} onChange={p=>change('coverPlacement',p)} ratio={ratio} cover/><button className="button-secondary button-icon editor-done" data-hint="Preview" aria-label="Preview book" onClick={()=>setEditing('book')}><Check size={20}/></button></div>:editing==='stickers'&&draft.journal?<div className="canvas-editor"><CoverStickers book={draft} onChange={stickers=>changeType({cover:{...(draft.journal!.cover??{front:'artwork',back:'plain'}),stickers}})}/><button className="button-secondary button-icon editor-done" data-hint="Preview" aria-label="Preview book" onClick={()=>setEditing('book')}><Check size={20}/></button></div>:selectedArt?<div className="canvas-editor"><PlacementEditor key={selectedArt.id} src={selectedArt.src} value={selectedArt.placement} onChange={p=>updateArt(selectedArt.id,{placement:p})} onCrop={src=>updateArt(selectedArt.id,{src,placement:defaultPlacement})} ratio={ratio*(selectedArt.layout==='spread'?2:1)} spread={selectedArt.layout==='spread'}/><div className="canvas-layout-toggle"><button className="button-icon" aria-label="Single page" data-hint="One page" aria-pressed={selectedArt.layout!=='spread'} onClick={()=>updateArt(selectedArt.id,{layout:'page'})}><LayoutIcon/></button><button className="button-icon" aria-label="Across both pages" data-hint="Spread" aria-pressed={selectedArt.layout==='spread'} onClick={()=>updateArt(selectedArt.id,{layout:'spread'})}><LayoutIcon spread/></button></div><button className="button-secondary button-icon editor-done" data-hint="Preview" aria-label="Preview book" onClick={()=>setEditing('book')}><Check size={20}/></button></div>:renderBook(draft,showCover)}
 <div className="canvas-actions"><button className="button-icon" data-hint="Preview" aria-label="Preview book" aria-pressed={editing==='book'} onClick={()=>setEditing('book')}><BookOpen size={21} weight="light"/></button>{draft.coverImage&&<button className="button-icon" data-hint="Position" aria-label="Position cover" aria-pressed={editing==='cover'} onClick={()=>setEditing('cover')}><Crop size={21} weight="light"/></button>}{isJournal&&<button className="button-icon" data-hint="Stickers" aria-label="Cover stickers" aria-pressed={editing==='stickers'} onClick={()=>setEditing('stickers')}><Sticker size={21} weight="light"/></button>}</div>
 </div><section className="creation-controls"><PhonePanel features={tool==='publish'?['Details','Visibility',...(!isJournal?['Category']:[])]:[]}><Part name="Details"><div className="creator-identity" {...toolPanel('publish')}><input className="book-name-input" data-hint="Rename" aria-label={`${Noun} name`} maxLength={36} value={draft.title} onChange={e=>change('title',e.target.value)}/>
 <label className="caption-field">On the cover<input aria-label="Cover caption" data-hint="Caption" placeholder="A phrase to keep" maxLength={48} value={draft.caption??''} onChange={e=>change('caption',e.target.value.replace(/[\r\n]/g,' '))}/></label></div>
 </Part><div className="creator-visibility" {...toolPanel('publish')}><Part name="Visibility"><label>Visibility</label><div className="choice-row visibility-choices">{(['private','public'] as const).map(v=><button key={v} data-hint={v==='private'?'Only you':'Everyone'} aria-pressed={(draft.visibility??'private')===v} onClick={()=>change('visibility',v)}>{v==='private'?<LockSimple size={18}/>:<GlobeSimple size={18}/>}<span>{v==='private'?'Private':'Public'}</span></button>)}</div></Part>
 <Part name="Category">{!isJournal&&<><label>Category</label><div className="choice-row visibility-choices">{['Watercolor','Illustration','Sketches'].map(c=><button key={c} aria-label={`${c} category`} aria-pressed={draft.category===c} onClick={()=>change('category',draft.category===c?undefined:c)}><span>{c}</span></button>)}</div></>}</Part></div>
 {isJournal&&draft.journal&&<><div className="tool-group" {...toolPanel('presets')}><JournalPresets book={draft} onApply={applyPreset} onNotice={setNotice}/></div><div className="tool-group" {...toolPanel('publish')}><Part name="Details"><JournalSettings journal={draft.journal} onChange={changeType}/></Part></div></>}{!isJournal&&<div className="creator-binding" {...toolPanel('binding')}><label>Binding</label><div className="choice-row binding-choices">{presets.map(p=><button key={p.id} aria-pressed={draft.presetId===p.id} onClick={()=>change('presetId',p.id)}><i className={`binding-icon binding-${p.id}`}><b/></i><span>{p.name.replace('The ','')}</span></button>)}</div></div>}
 <div className="creator-cover" {...toolPanel('cover')}><PhonePanel features={draft.presetId==='watercolor'?['Artwork','Color','Elastic']:['Artwork','Color']}><Part name="Artwork"><div className="control-label"><label>Cover</label><div><button className="button-icon" data-hint="Solid color" aria-label="Solid color cover" aria-pressed={!draft.coverImage} onClick={()=>{chooseCover();setEditing('book')}}><Palette size={18}/></button><button className="button-icon" data-hint="Upload" aria-label="Upload cover" onClick={()=>coverUpload.current?.click()}><UploadSimple size={18}/></button><input ref={coverUpload} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e=>{void uploadCover(e.target.files?.[0]);e.target.value=''}}/></div></div>
 <CoverPicker value={draft.coverImage} onChange={chooseCover} kind={draftKind}/></Part>
 <Part name="Color"><div className="creator-colors">{coverColors.map(c=><button key={c.value} data-hint={c.name} aria-label={`${c.name} cover color`} aria-pressed={draft.color===c.value} style={{background:c.value}} onClick={()=>change('color',c.value)}/>)}</div></Part>
 <Part name="Elastic">{draft.presetId==='watercolor'&&<div className="band-color-row"><span>Elastic</span>{['#2464ed','#f47722','#092773','#344438','#25282e'].map(c=><button key={c} data-hint="Elastic" aria-label={`Elastic ${c}`} aria-pressed={(draft.bandColor??'#2464ed')===c} style={{backgroundColor:c}} onClick={()=>change('bandColor',c)}/>)}</div>}</Part></PhonePanel></div>
 {isJournal&&draft.journal&&<div className="tool-group" {...toolPanel('layout')}><JournalCoverSettings book={draft} onChange={(cover,side)=>{changeType({cover});setShowCover({side,at:Date.now()})}} onNotice={showError} onArrange={()=>setEditing('stickers')}/></div>}
 <div className="creator-paper" {...toolPanel('paper')}><PhonePanel features={isJournal?['Format','Page turn']:['Format','Texture','Page turn']}><Part name="Format"><label>Format</label><div className="visual-formats">{formats.map(f=><button key={f.id} data-hint="Format" aria-label={`${f.id} format`} aria-pressed={draft.format===f.id} onClick={()=>chooseFormat(f.id)}><i style={{aspectRatio:f.ratio}}/><span>{f.id}</span></button>)}</div></Part>
 <Part name="Texture">{!isJournal&&<><label>Paper</label><div className="visual-papers">{papers.map(p=><button key={p.id} data-hint={p.name} aria-label={`${p.name} paper`} aria-pressed={draft.paper===p.id} onClick={()=>change('paper',p.id)}><i className={p.id==='dots'?'dotted-paper':''} style={{backgroundImage:`url(${p.src})`}}/></button>)}</div></>}</Part>
 <Part name="Page turn"><label>Page turn</label><div className="motion-choices">{(['curl','hinge'] as const).map(m=><button key={m} data-hint={m==='curl'?'Soft curl':'Stiff hinge'} aria-label={`${m} page turn`} aria-pressed={(draft.turnStyle??'curl')===m} onClick={()=>change('turnStyle',m)}><svg width="38" height="28" viewBox="0 0 38 28" fill="none"><path d="M4 24H34V4H20" stroke="currentColor" opacity=".35"/><path d={m==='curl'?'M20 4C5 3 24 16 7 24H20V4Z':'M20 4L7 8V24L20 20V4Z'} fill="currentColor" fillOpacity=".1" stroke="currentColor"/></svg><span>{m==='curl'?'Flexible':'Rigid'}</span></button>)}</div></Part></PhonePanel></div>
 <button className="button-primary phone-save" {...toolPanel('publish')} disabled={saving||uploading||!canSave} onClick={save}>{saving?'Saving…':canSave?`Save ${noun}`:isJournal?'Name your journal':'Add artwork first'} <Check/></button>
 </PhonePanel></section></div>}
 {isJournal&&draft.journal?<div className="tool-group" {...toolPanel('pages')}><JournalPages phone={phone} owner={owner} journal={draft.journal} ratio={ratio} onEdit={setEditing} onChange={entries=>changeJournal({entries})}/></div>:<section className="artwork-editor" {...toolPanel('pages')}><PhonePanel features={draft.artworks.length?['Artwork','Placement','Order']:[]}><Part name="Artwork"><div className="collection-heading"><div><h2>Your artwork</h2><small className="upload-limits">JPG, PNG, WebP · 10 MB / image · 20 MP</small></div><button className={phone?"button-icon":"button-secondary"} aria-label="Add artwork" data-hint="Add artwork" onClick={()=>file.current?.click()} disabled={uploading}><Plus/>{!phone&&(uploading?'Opening…':'Add artwork')}</button><input hidden ref={file} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files);e.target.value=''}}/></div>
 {!draft.artworks.length&&<button className="art-upload-empty" onClick={()=>file.current?.click()}><UploadSimple size={32} weight="thin"/><span>Add your first artwork</span></button>}
 </Part><div className="artwork-strip">{draft.artworks.map((a,i)=><div className={`artwork-edit-card ${editing===a.id?'selected':''}`} key={a.id}><button className="artwork-edit-preview" data-hint="Position" aria-label={`Position ${a.title}`} onClick={()=>{setEditing(a.id);if(!phone)window.scrollTo({top:90,behavior:'smooth'})}}><img src={a.src} alt={a.title}/><Crop size={19}/></button><Part name="Placement"><div className="artwork-tools"><button className="button-icon" data-hint="One page" aria-label={`Single page for ${a.title}`} aria-pressed={a.layout!=='spread'} onClick={()=>{updateArt(a.id,{layout:'page'});setEditing(a.id)}}><LayoutIcon/></button><button className="button-icon" data-hint="Spread" aria-label={`Across both pages for ${a.title}`} aria-pressed={a.layout==='spread'} onClick={()=>{updateArt(a.id,{layout:'spread'});setEditing(a.id)}}><LayoutIcon spread/></button><button className="button-icon" data-hint="Remove" aria-label={`Remove ${a.title}`} onClick={()=>{change('artworks',draft.artworks.filter(x=>x.id!==a.id));if(editing===a.id)setEditing('book')}}><X size={15}/></button></div></Part><Part name="Order"><div className="art-order"><button className="button-icon" data-hint="Earlier" aria-label={`Move ${a.title} earlier`} disabled={i===0} onClick={()=>{const list=[...draft.artworks];[list[i-1],list[i]]=[list[i],list[i-1]];change('artworks',list)}}><ArrowLeft/></button><button className="button-icon" data-hint="Later" aria-label={`Move ${a.title} later`} disabled={i===draft.artworks.length-1} onClick={()=>{const list=[...draft.artworks];[list[i+1],list[i]]=[list[i],list[i+1]];change('artworks',list)}}><ArrowRight/></button></div></Part></div>)}</div></PhonePanel></section>}{!writing&&<PhoneTools tools={isJournal?JOURNAL_TOOLS:SKETCH_TOOLS} value={tool==='publish'?null:tool} onChange={setTool}/>}</main>:
 portfolio()}
 {!phone&&<SiteFooter/>}
 <nav className="mobile-navigation" aria-label="Main navigation"><button aria-current={screen==='feed'?'page':undefined} onClick={()=>navigate('feed')}><MagnifyingGlass size={22}/><span>Explore</span></button><button aria-current={screen==='new'?'page':undefined} onClick={()=>{if(!user)setPanel('signin');else if(!draft)startBook();else navigate('new')}}><Plus size={24}/><span>Create</span></button><button aria-current={screen==='portfolio'?'page':undefined} onClick={()=>navigate('portfolio')}><BookOpen size={22}/><span>Portfolio</span></button></nav><dialog ref={dialog} className={`portfolio-dialog ${panel?'is-panel':''}`} onCancel={()=>{setViewing(null);setPanel(null)}} onPointerDown={e=>{backdropPress.current=outsideDialog(e)}} onClick={e=>{if(backdropPress.current&&outsideDialog(e)){setViewing(null);setPanel(null)}backdropPress.current=false}}><button className="button-icon dialog-close" aria-label="Close dialog" onClick={()=>{setViewing(null);setPanel(null)}}><X/></button>{viewing&&books.some(b=>b.id===viewing.id)&&<button className="dialog-edit button-secondary" aria-label={`Edit ${viewing.title}`} onClick={()=>{const b=viewing;setViewing(null);void openDraft({...b})}}><PencilSimple size={16}/> Edit</button>}{viewing&&<><h2>{viewing.title}</h2>{renderBook(viewing,undefined,true)}</>}{panel==='signin'||panel==='signup'?<SignIn key={panel} initial={panel} onUser={signedIn} onNotice={setNotice} onLegal={()=>setPanel(null)}/>:panel==='settings'&&user&&me?<Settings user={user} person={me} onUser={setUser} onPerson={setMe} onSignedOut={signedOut} onNotice={setNotice}/>:panel==='notifications'?<Notifications onPerson={name=>{setPanel(null);openPerson(name)}} onBook={id=>{setPanel(null);void view({id} as Book)}} onRead={()=>setUnread(0)}/>:panel&&typeof panel==='object'?<ResetPassword token={panel.reset} onUser={next=>{signedIn(next);setNotice('Password reset successfully. Other devices are signed out.','success')}} onNotice={setNotice}/>:panel==='verified'?<div className="email-verified account-form"><img className="brand-mark account-mark" src="/brand/scribb-mark.png" alt="" width="56" height="56"/><h2>Email verified.</h2><p>Congratulations! Your email is now connected to your Scribb account.</p><p className="form-note">Your space is ready when you are. You may need to sign in on this device.</p><button className="button-primary" onClick={()=>{setPanel(null);navigate('portfolio')}}>Go to homepage</button></div>:null}</dialog>{user&&<JournalCompanion hidden={phone?screen!=='portfolio':screen==='ask'||screen==='new'} onOpen={()=>navigate('ask')}/>}<Hints/><Notice notice={notice} onDismiss={dismissNotice} container={panel||viewing?dialog.current:null}/></div>
}

import './variants.css'

import './responsive.css'
import './account.css'

import './pages.css'
import './ask.css'
