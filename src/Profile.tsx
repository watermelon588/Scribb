import {useEffect, useMemo, useRef, useState} from 'react'
import {Moon, Sun, BookOpen, Plus, ArrowLeft, ArrowUpRight, X, MagnifyingGlass, Palette, Crop, Check, ArrowRight,  PencilSimple, UploadSimple, Trash, Sticker, Bell, LockSimple, GlobeSimple} from '@phosphor-icons/react'
import Sketchbook from './components/Sketchbook'
import Welcome from './components/Welcome'
import Legal, {SiteFooter} from './components/Legal'
import AskJournal from './components/AskJournal'
import Bookshelf, {BookObject} from './components/Bookshelf'
import {ingestImage,validateBatch} from './lib/images'
import {presets, formats, papers, coverColors, type Artwork, type PresetId, type Format} from './data/presets'
import {coversFor} from './data/covers'
import PlacementEditor, {defaultPlacement} from './components/PlacementEditor'
import type {Placement, TurnStyle} from './data/presets'
import './profile.css'
import Feed from './components/Feed'
import {JournalBook, layoutFits, type Owner} from './components/Journal'
import {CoverStickers, JournalDesk, JournalPages, JournalCoverSettings,JournalSettings} from './components/JournalStudio'
import {newJournal, type JournalData, type JournalEntry} from './data/journal'
import {useAppMotion} from './lib/motion'
import {Notifications, ResetPassword, Settings, SignIn} from './components/Account'
import {ApiError, PartialSave, allBooks, api, avatarSrc, loadBook, message, saveBook, type BookOwner, type Person, type User} from './lib/api'

export type BookKind = 'sketchbook'|'journal'
export type Book = {kind?:BookKind;journal?:JournalData;caption?:string;id:string; title:string; presetId:PresetId; color:string; format:Format; paper:string; coverImage?:string; coverPlacement?:Placement; bandColor?:string; turnStyle?:TurnStyle; artworks:Artwork[]
 // From the API: visibility and version are saved; owner, counts and flags come with cards; complete means pages (and entries) are loaded.
 visibility?:'private'|'public'; category?:string; version?:number; owner?:BookOwner; likeCount?:number; saveCount?:number; liked?:boolean; saved?:boolean; complete?:boolean}
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
 return <div className="cover-picker"><div ref={rail} className="cover-fan" aria-label="Cover artwork presets">{coversFor(kind).map(c=><button type="button" key={c.id} className={`cover-choice ${value===c.src?'chosen':''}`} title={c.name} aria-label={`Choose ${c.name}`} aria-pressed={value===c.src} onClick={()=>onChange(c.src)}><img src={c.src} alt=""/></button>)}</div><div className="cover-rail-controls"><button aria-label="Previous covers" onClick={()=>rail.current?.scrollBy({left:-180,behavior:'smooth'})}><ArrowLeft size={16}/></button><button aria-label="More covers" onClick={()=>rail.current?.scrollBy({left:180,behavior:'smooth'})}><ArrowRight size={16}/></button></div></div>
}
function LayoutIcon({spread=false}:{spread?:boolean}){return <svg width="32" height="24" viewBox="0 0 32 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="28" height="20" rx="1" stroke="currentColor" opacity=".4"/><path d="M16 2v20" stroke="currentColor"/>{spread?<rect x="6" y="6" width="20" height="12" fill="currentColor" opacity=".35"/>:<><rect x="6" y="6" width="7" height="12" fill="currentColor" opacity=".35"/><rect x="19" y="6" width="7" height="12" fill="currentColor" opacity=".35"/></>}</svg>}

export default function Profile(){
 const route=()=>location.hash==='#new'||location.hash==='#studio'?'new':location.hash==='#feed'?'feed':['#privacy','#terms','#ask'].includes(location.hash)?location.hash.slice(1):location.hash.startsWith('#@')?'person':'portfolio'
 const personHandle=()=>location.hash.startsWith('#@')?decodeURIComponent(location.hash.slice(2)).toLowerCase():''
 const [screen,setScreen]=useState(route),[handle,setHandle]=useState(personHandle)
 function navigate(next:string){setScreen(next.startsWith('@')?'person':next);history.pushState(null,'',`#${next}`);window.scrollTo({top:0,behavior:'instant'})}
 function openPerson(name:string){setHandle(name);navigate(`@${name}`)}
 useEffect(()=>{const sync=()=>{setScreen(route());setHandle(personHandle());window.scrollTo({top:0,behavior:'instant'});if(route()==='new')setDraft(d=>{if(d)return d;const book=fresh();pristine.current=book;return book});setViewing(null)};window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync)}},[])
 const appRoot=useRef<HTMLDivElement>(null)
 const [theme,setTheme]=useState<'light'|'dark'>(()=>document.documentElement.dataset.theme==='dark'?'dark':'light')
 useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#181c1a':'#faf9f6');try{localStorage.setItem('untitled-theme',theme)}catch{/* Keep the chosen appearance for this session. */}},[theme])
 const [style,setStyle]=useState<'gallery'|'editorial'>(()=>{try{return localStorage.getItem('portfolio-style')==='editorial'?'editorial':'gallery'}catch{return 'gallery'}})
 const [shelf,setShelf]=useState(false)
 const [kind,setKind]=useState<BookKind>(()=>{try{return localStorage.getItem('collection-kind')==='journal'?'journal':'sketchbook'}catch{return 'sketchbook'}})
 function chooseKind(v:BookKind){setKind(v);try{localStorage.setItem('collection-kind',v)}catch{/* The choice still applies for this session. */}}
 function chooseStyle(v:'gallery'|'editorial'){setStyle(v);try{localStorage.setItem('portfolio-style',v)}catch{/* Style can still be explored without storage. */}}
 const [showCover,setShowCover]=useState<{side:'front'|'back';at:number}>()
 // The sketchbook binding chosen in a new draft, restored when switching back from Journal (journals are always Linen).
 const sketchPreset=useRef<PresetId>('watercolor')
const [books,setBooks]=useState<Book[]>([]),[ready,setReady]=useState(false),[query,setQuery]=useState(''),[limit,setLimit]=useState(12)
 const [draft,setDraft]=useState<Book|null>(()=>location.hash==='#studio'||location.hash==='#new'?fresh():null),[viewing,setViewing]=useState<Book|null>(null),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false)
 // Signed in: undefined while asking the server, null for guests.
 const [user,setUser]=useState<User|null>(),[me,setMe]=useState<Person|null>(null),[unread,setUnread]=useState(0)
 const [person,setPerson]=useState<{profile:Person;books:Book[]}|'missing'|null>(null)
 const [panel,setPanel]=useState<null|'signin'|'signup'|'settings'|'notifications'|{reset:string}>(null)
 // The saved copy of the book being edited, so a save sends only changed journal entries and removes deleted ones.
 const serverCopy=useRef<Book|null>(null)
 const [editing,setEditing]=useState('book')
 // The draft as it was opened. Any edit creates a new object, so identity tells us it changed.
 const pristine=useRef(draft)
 const unsaved=Boolean(draft)&&draft!==pristine.current
 const coverUpload=useRef<HTMLInputElement>(null)
 const file=useRef<HTMLInputElement>(null),dialog=useRef<HTMLDialogElement>(null)
 function refreshUser(){return api<{user:User|null}>('GET','/auth/me').then(r=>setUser(r.user)).catch(()=>setUser(null))}
 // Links from emails: #reset/<token> and #verify-email/<token>.
 useEffect(()=>{
  const token=/^#(reset|verify-email)\/([\w-]+)$/.exec(location.hash)
  if(token){history.replaceState(null,'','#');if(token[1]==='reset')setPanel({reset:token[2]});else api('POST','/auth/verify-email',{token:token[2]}).then(()=>{setNotice('Your email is verified.');void refreshUser()}).catch(e=>setNotice(message(e)))}
  void refreshUser()
 },[])
 // Your profile, books and on-device draft load once you are signed in. Drafts are kept per account.
 useEffect(()=>{
  if(user===undefined)return
  if(!user){setMe(null);setBooks([]);setReady(true);return}
  setReady(false)
  Promise.all([api<{profile:Person}>('GET',`/users/${encodeURIComponent(user.username)}`),allBooks(user.username),loadRecord<Book|null>(`draft:${user.id}`).catch(()=>null)])
   .then(([p,list,stored])=>{setMe(p.profile);setBooks(list.map(asJournal));if(stored)setDraft(asJournal(stored))})
   .catch(e=>setNotice(message(e,'Your books could not be loaded.'))).finally(()=>setReady(true))
  api<{unread:number}>('GET','/notifications').then(r=>setUnread(r.unread)).catch(()=>{})
 },[user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(screen!=='person'||!handle||handle===user?.username)return
  let live=true;setPerson(null)
  Promise.all([api<{profile:Person}>('GET',`/users/${encodeURIComponent(handle)}`),allBooks(handle)]).then(([p,list])=>{if(live)setPerson({profile:p.profile,books:list.map(asJournal)})})
   .catch(e=>{if(!live)return;setPerson('missing');if(!(e instanceof ApiError&&e.status===404))setNotice(message(e))})
  return()=>{live=false}
 },[screen,handle,user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(user===null&&screen==='new')setPanel('signin')},[user,screen])
 useEffect(()=>{if(!ready||!user||!draft||draft===pristine.current)return;const timer=setTimeout(()=>{saveRecord(`draft:${user.id}`,draft).catch(()=>setNotice('Autosave failed. Your draft stays open here until you save it.'))},600);return()=>clearTimeout(timer)},[draft,ready,user])
 useEffect(()=>{if(viewing||panel)dialog.current?.showModal();else dialog.current?.close()},[viewing,panel])
 function signedIn(next:User){setUser(next);setPanel(null);setNotice(`Signed in as @${next.username}.`)}
 function signedOut(){setUser(null);setPanel(null);setDraft(null);pristine.current=null;serverCopy.current=null;if(screen==='new')navigate('portfolio')}
 async function follow(who:Person){
  if(!user){setPanel('signin');return}
  const on=!who.followed,update=(p:Person)=>({...p,followed:on,followers:p.followers+(on?1:-1)})
  setPerson(v=>v&&v!=='missing'?{...v,profile:update(v.profile)}:v)
  try{await api(on?'PUT':'DELETE',`/users/${encodeURIComponent(who.username)}/follow`)}catch(e){setPerson(v=>v&&v!=='missing'?{...v,profile:who}:v);setNotice(message(e))}
 }
 function change<K extends keyof Book>(key:K,value:Book[K]){setDraft(current=>current?{...current,[key]:value}:current)}
 async function upload(files:FileList|null){
  if(!files||!draft||uploading)return
  const id=draft.id, chosen=Array.from(files);setUploading(true)
  try{validateBatch(chosen,draft.artworks.length);const arts:Artwork[]=[]
   for(const f of chosen){const src=await ingestImage(f);arts.push({id:crypto.randomUUID(),src,title:f.name.replace(/\.[^.]+$/,''),artist:me?.displayName??'',medium:'From your collection',layout:'page'})}
   setDraft(d=>d?.id===id?{...d,artworks:[...d.artworks,...arts]}:d)
  }catch(error){setNotice(error instanceof Error?error.message:'Could not open those images.')}finally{setUploading(false)}
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
   setNotice(saved.visibility==='public'?`${Noun} saved and published.`:`${Noun} saved. Only you can see it.`)
  }catch(error){
   if(error instanceof PartialSave){serverCopy.current=null;setDraft(asJournal(error.book))}
   setNotice(error instanceof ApiError&&error.code==='stale_version'?`This ${noun} changed on another device. Your draft is still here.`:`Could not save: ${message(error)} Your draft is still here.`)
  }finally{setSaving(false)}
 }
 /** Cards from lists carry no pages; opening or editing loads the whole book first. */
 async function full(b:Book){if(b.complete)return b;try{return asJournal(await loadBook(b.id))}catch(e){setNotice(message(e,'This book could not be opened.'));return null}}
 async function view(b:Book){const book=await full(b);if(book)setViewing(book)}
 function renderBook(b:Book,show?:{side:'front'|'back';at:number}){if(b.kind==='journal')return <JournalBook key={`${b.id}-${b.presetId}`} book={b} owner={b.owner?{name:b.owner.displayName,handle:b.owner.username,avatar:avatarSrc(b.owner.avatar)}:owner} show={show}/>;return <Sketchbook key={`${b.id}-${b.presetId}`} preset={presets.find(p=>p.id===b.presetId)!} coverColor={b.color} coverImage={b.coverImage} aspectRatio={formats.find(f=>f.id===b.format)!.ratio} coverPlacement={b.coverPlacement} bandColor={b.bandColor??'#2464ed'} turnStyle={b.turnStyle??'curl'} caption={b.caption} title={b.title} artworks={b.artworks.length?b.artworks:emptyPages} paper={papers.find(p=>p.id===b.paper)?.src} initiallyClosed/>}
 const owner=useMemo<Owner>(()=>({name:me?.displayName??'',handle:me?.username??'',avatar:avatarSrc(me?.avatar)}),[me])
 const ratio=draft?formats.find(f=>f.id===draft.format)!.ratio:.75
 const selectedArt=draft?.artworks.find(a=>a.id===editing)
 const draftKind=draft?.kind??'sketchbook',isJournal=draftKind==='journal',noun=isJournal?'journal':'sketchbook',Noun=isJournal?'Journal':'Sketchbook'
 const canSave=Boolean(draft?.title.trim())&&(isJournal||Boolean(draft?.artworks.length))
 const selectedEntry=draft?.journal?.entries.find(e=>e.id===editing)
 const isNewDraft=Boolean(draft)&&!books.some(b=>b.id===draft?.id)
 useEffect(()=>{if(draft&&draft.kind!=='journal')sketchPreset.current=draft.presetId},[draft])
  function switchKind(next:BookKind){setEditing('book');setDraft(d=>{
   if(!d)return d
   const index=coversFor(d.kind??'sketchbook').findIndex(c=>c.src===d.coverImage)
   return {...d,kind:next,coverImage:index<0?d.coverImage:coversFor(next)[index].src,presetId:next==='journal'?'linen':sketchPreset.current,journal:d.journal??(next==='journal'?newJournal():undefined),title:d.title===`Untitled ${d.kind??'sketchbook'}`?`Untitled ${next}`:d.title}
  })}
 function changeJournal(patch:Partial<JournalData>){setDraft(d=>d?.journal?{...d,journal:{...d.journal,...patch}}:d)}
 function chooseFormat(format:Book['format']){
  const nextRatio=formats.find(f=>f.id===format)!.ratio
  if(draft?.journal&&draft.journal.entries.some(e=>!layoutFits(draft.journal!,e,e.layout,nextRatio))){setNotice('Some pages hold too much text for this format.');return}
  change('format',format)
 }
 function changeType(patch:Partial<JournalData>){
  if(!draft?.journal)return
  const next={...draft.journal,...patch}
  if(next.entries.some(e=>!layoutFits(next,e,e.layout,ratio))){setNotice('Some pages hold too much text for this choice.');return}
  changeJournal(patch)
 }
 function updateEntry(entry:JournalEntry){setDraft(d=>d?.journal?{...d,journal:{...d.journal,entries:d.journal.entries.map(e=>e.id===entry.id?entry:e)}}:d)}
 async function openDraft(book:Book){if(unsaved){navigate('new');setNotice('Continuing your unsaved draft. Save or discard it first.');return}const loaded=await full(book);if(!loaded)return;serverCopy.current=books.some(b=>b.id===loaded.id)?loaded:null;pristine.current=loaded;setEditing('book');setDraft(loaded);navigate('new')}
 function startBook(){if(!user){setPanel('signin');return}void openDraft(fresh(kind))}
 function discardDraft(){if(!confirm('Discard this draft? This cannot be undone.'))return;if(user)saveRecord(`draft:${user.id}`,null).catch(()=>{});pristine.current=null;serverCopy.current=null;setDraft(null);setEditing('book');navigate('portfolio')}
 function chooseCover(src?:string){const preset=coversFor(draftKind).find(c=>c.src===src);setDraft(d=>d?{...d,coverImage:src,coverPlacement:defaultPlacement,bandColor:preset?.band??d.bandColor,color:preset?.color??d.color}:d)}
 function updateArt(id:string,patch:Partial<Artwork>){setDraft(d=>d?{...d,artworks:d.artworks.map(a=>a.id===id?{...a,...patch}:a)}:d)}
 async function uploadCover(f?:File){if(!f||uploading||!draft)return;const id=draft.id;setUploading(true);try{const src=await ingestImage(f);setDraft(d=>d?.id===id?{...d,coverImage:src,coverPlacement:defaultPlacement}:d);setEditing('cover')}catch(error){setNotice(error instanceof Error?error.message:'Could not open this image.')}finally{setUploading(false)}}
 useAppMotion(appRoot,screen,style,Boolean(viewing||panel))
 function portfolio(){
  const self=screen!=='person'||handle===user?.username
  if(self&&user===null)return <Welcome theme={theme} onCreate={()=>setPanel('signup')}/>
  if(!self&&person==='missing')return <main className="profile-main"><p className="empty-search">No one has that username.</p></main>
  const who=self?me:person&&person!=='missing'?person.profile:null
  if(!who)return <main className="profile-main" aria-busy="true"/>
  const list=self?books:(person as {books:Book[]}).books,noun=kind
  const filtered=list.filter(b=>(b.kind??'sketchbook')===kind&&b.title.toLowerCase().includes(query.toLowerCase()))
  const links=([['website','Website'],['instagram','Instagram'],['behance','Behance'],['cara','Cara']] as const).filter(([key])=>who.links[key])
  return <main className="profile-main"><section className="artist-profile"><div className="artist-portrait"><img src={avatarSrc(who.avatar)} alt={`${who.displayName||who.username}'s profile picture`}/></div><div className="artist-details"><h1>{who.displayName||who.username}<span>.</span></h1>{who.bio&&<p>{who.bio}</p>}<div className="artist-links"><span>@{who.username}</span>{who.city&&<span>{who.city}</span>}{links.map(([key,name])=><a key={key} href={who.links[key]} target="_blank" rel="noopener noreferrer nofollow">{name} <ArrowUpRight/></a>)}<span className="artist-counts">{who.followers} {who.followers===1?'follower':'followers'}</span>{self?<button aria-label="Edit artist profile" title="Edit profile" onClick={()=>setPanel('settings')}><PencilSimple/></button>:<button className={who.followed?'outline-button follow-button':'solid-button follow-button'} aria-pressed={who.followed} onClick={()=>void follow(who)}>{who.followed?'Following':'Follow'}</button>}</div></div></section><section className="profile-collection"><div className="collection-heading"><h2 className="sr-only">{self?'Your books':`Books by ${who.displayName||who.username}`}</h2><div className="kind-switch kind-switch-large" role="group" aria-label="Collection">{(['sketchbook','journal'] as const).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{chooseKind(k);setQuery('');setLimit(12)}}>{k==='journal'?'Journals':'Sketchbooks'}</button>)}</div>{self&&<div className="collection-actions">{kind==='journal'&&<button className="quiet-button" onClick={()=>navigate('ask')}>Ask my journal <ArrowUpRight size={15}/></button>}<button className="solid-button" disabled={!ready} onClick={startBook}><Plus size={18}/> New {kind}</button></div>}</div><div className="collection-toolbar"><label className="collection-search"><MagnifyingGlass size={17}/><input aria-label={`Find a ${noun}`} placeholder={`Find a ${noun}`} value={query} onChange={e=>{setQuery(e.target.value);setLimit(12)}}/></label></div><div className="collection-view-switch"><button aria-pressed={!shelf} onClick={()=>setShelf(false)}>Gallery</button><button aria-pressed={shelf} onClick={()=>setShelf(true)}>Bookshelf</button></div>{shelf?<Bookshelf noun={kind} books={filtered.slice(0,limit)} onOpen={b=>void view(b)} onEdit={self?b=>void openDraft({...b}):undefined}/>:<div className="book-collection layout-gallery">{filtered.slice(0,limit).map(b=><article className="collection-book" key={b.id}><button className="collection-book-open" onClick={()=>void view(b)} aria-label={`Open ${b.title}`}><BookObject book={b}/></button><div className="collection-book-caption"><h3>{b.title}</h3>{self&&b.visibility!=='public'&&<LockSimple size={14} aria-label="Private" className="private-mark"/>}{self&&<button title={`Edit ${kind}`} aria-label={`Edit ${b.title}`} onClick={()=>void openDraft({...b})}><PencilSimple size={16}/></button>}</div></article>)}</div>}{ready&&!filtered.length&&<p className="empty-search">{query?`No ${kind}s found.`:self?`No ${kind}s yet.`:`No public ${kind}s yet.`}</p>}{filtered.length>limit&&<button className="load-more" onClick={()=>setLimit(limit+12)}>Show more</button>}</section></main>
 }
 return <div ref={appRoot} className={`portfolio-app style-${style} ${screen==='new'?'is-editing':''}`}><header className="portfolio-header"><a className="wordmark" href="/"><BookOpen size={28} weight="thin"/>untitled.</a><nav><button aria-current={screen==='feed'?'page':undefined} onClick={()=>navigate('feed')}>Explore</button><button aria-current={screen==='portfolio'?'page':undefined} onClick={()=>navigate('portfolio')}>Your portfolio</button></nav><div className="header-actions"><button className="theme-toggle" aria-label={theme==='dark'?'Switch to light theme':'Switch to dark theme'} title={theme==='dark'?'Light theme':'Dark theme'} onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={21} weight="light"/>:<Moon size={21} weight="light"/>}</button>{user?<><button className="notification-bell" aria-label={unread?`Notifications, ${unread} unread`:'Notifications'} title="Notifications" onClick={()=>setPanel('notifications')}><Bell size={21} weight="light"/>{unread>0&&<i aria-hidden="true"/>}</button><button className="profile-avatar" onClick={()=>setPanel('settings')} aria-label="Settings" title="Settings"><img src={avatarSrc(me?.avatar??user.avatar)} alt=""/></button></>:user===null&&<button className="outline-button header-sign-in" onClick={()=>setPanel('signin')}>Sign in</button>}</div></header><div className="style-picker" role="group" aria-label="Portfolio style">{(['gallery','editorial'] as const).map(v=><button key={v} title={v==='gallery'?'Gallery':'Editorial'} aria-label={`${v} style`} aria-pressed={style===v} onClick={()=>chooseStyle(v)}><i className={`style-glyph glyph-${v}`} aria-hidden="true"/></button>)}</div>
 {screen==='privacy'||screen==='terms'?<Legal page={screen}/>:screen==='ask'?<AskJournal key={user?.id??'guest'} user={user} onUser={setUser} onSignIn={()=>setPanel('signin')} onSettings={()=>setPanel('settings')}/>:screen==='feed'?<Feed user={user} onOpen={b=>void view(b)} onPerson={openPerson} onSignIn={()=>setPanel('signin')}/>:screen==='new'&&draft&&user?<main className="creation-page">
 <div className="creation-heading"><button className="quiet-button" title="Back to portfolio" aria-label="Back to portfolio" onClick={()=>navigate('portfolio')}><ArrowLeft size={22}/></button>{isNewDraft&&<div className="kind-switch" role="group" aria-label="Book type">{(['sketchbook','journal'] as const).map(k=><button key={k} aria-pressed={draftKind===k} onClick={()=>switchKind(k)}>{k==='journal'?'Journal':'Sketchbook'}</button>)}</div>}<div className="creation-save">{unsaved&&<button className="quiet-button" title="Discard draft" aria-label="Discard draft" onClick={discardDraft}><Trash size={20}/></button>}<button className="solid-button" disabled={saving||uploading||!canSave} onClick={save}>{saving?'Saving…':`Save ${noun}`} <Check/></button></div></div>
 {selectedEntry&&draft.journal?<JournalDesk key={selectedEntry.id} owner={owner} journal={draft.journal} entry={selectedEntry} ratio={ratio} paper={papers.find(p=>p.id===draft.paper)?.src} onEntry={updateEntry} onClose={()=>setEditing('book')} onNotice={setNotice}/>:<div className="creation-layout"><div className="creation-preview">
 {editing==='cover'&&draft.coverImage?<div className="canvas-editor"><PlacementEditor key={draft.coverImage} src={draft.coverImage} value={draft.coverPlacement} onChange={p=>change('coverPlacement',p)} ratio={ratio} cover/><button className="editor-done" title="Preview book" aria-label="Preview book" onClick={()=>setEditing('book')}><Check size={20}/></button></div>:editing==='stickers'&&draft.journal?<div className="canvas-editor"><CoverStickers book={draft} onChange={stickers=>changeType({cover:{...(draft.journal!.cover??{front:'artwork',back:'plain'}),stickers}})}/><button className="editor-done" title="Preview book" aria-label="Preview book" onClick={()=>setEditing('book')}><Check size={20}/></button></div>:selectedArt?<div className="canvas-editor"><PlacementEditor key={selectedArt.id} src={selectedArt.src} value={selectedArt.placement} onChange={p=>updateArt(selectedArt.id,{placement:p})} onCrop={src=>updateArt(selectedArt.id,{src,placement:defaultPlacement})} ratio={ratio*(selectedArt.layout==='spread'?2:1)} spread={selectedArt.layout==='spread'}/><div className="canvas-layout-toggle"><button aria-label="Single page" title="Single page" aria-pressed={selectedArt.layout!=='spread'} onClick={()=>updateArt(selectedArt.id,{layout:'page'})}><LayoutIcon/></button><button aria-label="Across both pages" title="Across both pages" aria-pressed={selectedArt.layout==='spread'} onClick={()=>updateArt(selectedArt.id,{layout:'spread'})}><LayoutIcon spread/></button></div><button className="editor-done" title="Preview book" aria-label="Preview book" onClick={()=>setEditing('book')}><Check size={20}/></button></div>:renderBook(draft,showCover)}
 <div className="canvas-actions"><button title="Preview book" aria-label="Preview book" aria-pressed={editing==='book'} onClick={()=>setEditing('book')}><BookOpen size={21} weight="light"/></button>{draft.coverImage&&<button title="Position cover" aria-label="Position cover" aria-pressed={editing==='cover'} onClick={()=>setEditing('cover')}><Crop size={21} weight="light"/></button>}{isJournal&&<button title="Cover stickers" aria-label="Cover stickers" aria-pressed={editing==='stickers'} onClick={()=>setEditing('stickers')}><Sticker size={21} weight="light"/></button>}</div>
 </div><section className="creation-controls"><div className="creator-identity"><input className="book-name-input" aria-label={`${Noun} name`} maxLength={36} value={draft.title} onChange={e=>change('title',e.target.value)}/>
 <label className="caption-field">On the cover<input aria-label="Cover caption" placeholder="A phrase to keep" maxLength={48} value={draft.caption??''} onChange={e=>change('caption',e.target.value.replace(/[\r\n]/g,' '))}/></label></div>
 <div className="creator-visibility"><label>Visibility</label><div className="choice-row visibility-choices">{(['private','public'] as const).map(v=><button key={v} title={v==='private'?'Only you can see it':'Anyone can see it in Explore and on your profile'} aria-pressed={(draft.visibility??'private')===v} onClick={()=>change('visibility',v)}>{v==='private'?<LockSimple size={18}/>:<GlobeSimple size={18}/>}<span>{v==='private'?'Private':'Public'}</span></button>)}</div>
 {!isJournal&&<><label>Category</label><div className="choice-row visibility-choices">{['Watercolor','Illustration','Sketches'].map(c=><button key={c} aria-label={`${c} category`} aria-pressed={draft.category===c} onClick={()=>change('category',draft.category===c?undefined:c)}><span>{c}</span></button>)}</div></>}</div>
 {isJournal&&draft.journal&&<JournalSettings journal={draft.journal} owner={owner} onChange={changeType}/>}{!isJournal&&<div className="creator-binding"><label>Binding</label><div className="choice-row binding-choices">{presets.map(p=><button key={p.id} aria-pressed={draft.presetId===p.id} onClick={()=>change('presetId',p.id)}><i className={`binding-icon binding-${p.id}`}><b/></i><span>{p.name.replace('The ','')}</span></button>)}</div></div>}
 <div className="creator-cover"><div className="control-label"><label>Cover</label><div><button title="Solid color cover" aria-label="Solid color cover" aria-pressed={!draft.coverImage} onClick={()=>{chooseCover();setEditing('book')}}><Palette size={18}/></button><button title="Upload cover" aria-label="Upload cover" onClick={()=>coverUpload.current?.click()}><UploadSimple size={18}/></button><input ref={coverUpload} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e=>{void uploadCover(e.target.files?.[0]);e.target.value=''}}/></div></div>
 <CoverPicker value={draft.coverImage} onChange={chooseCover} kind={draftKind}/>
 <div className="creator-colors">{coverColors.map(c=><button key={c.value} title={c.name} aria-label={`${c.name} cover color`} aria-pressed={draft.color===c.value} style={{background:c.value}} onClick={()=>change('color',c.value)}/>)}</div>
 {draft.presetId==='watercolor'&&<div className="band-color-row"><span>Elastic</span>{['#2464ed','#f47722','#092773','#344438','#25282e'].map(c=><button key={c} title={`Elastic ${c}`} aria-label={`Elastic ${c}`} aria-pressed={(draft.bandColor??'#2464ed')===c} style={{backgroundColor:c}} onClick={()=>change('bandColor',c)}/>)}</div>}</div>
 {isJournal&&draft.journal&&<JournalCoverSettings book={draft} onChange={(cover,side)=>{changeType({cover});setShowCover({side,at:Date.now()})}} onNotice={setNotice} onArrange={()=>setEditing('stickers')}/>}
 <div className="creator-paper"><label>Format</label><div className="visual-formats">{formats.map(f=><button key={f.id} title={f.id} aria-label={`${f.id} format`} aria-pressed={draft.format===f.id} onClick={()=>chooseFormat(f.id)}><i style={{aspectRatio:f.ratio}}/><span>{f.id}</span></button>)}</div>
 <label>Paper</label><div className="visual-papers">{papers.map(p=><button key={p.id} title={p.name} aria-label={`${p.name} paper`} aria-pressed={draft.paper===p.id} onClick={()=>change('paper',p.id)}><i className={p.id==='dots'?'dotted-paper':''} style={{backgroundImage:`url(${p.src})`}}/></button>)}</div>
 <label>Page turn</label><div className="motion-choices">{(['curl','hinge'] as const).map(m=><button key={m} title={m==='curl'?'Flexible paper':'Rigid page'} aria-label={`${m} page turn`} aria-pressed={(draft.turnStyle??'curl')===m} onClick={()=>change('turnStyle',m)}><svg width="38" height="28" viewBox="0 0 38 28" fill="none"><path d="M4 24H34V4H20" stroke="currentColor" opacity=".35"/><path d={m==='curl'?'M20 4C5 3 24 16 7 24H20V4Z':'M20 4L7 8V24L20 20V4Z'} fill="currentColor" fillOpacity=".1" stroke="currentColor"/></svg><span>{m==='curl'?'Flexible':'Rigid'}</span></button>)}</div></div>
 </section></div>}
 {isJournal&&draft.journal?<JournalPages owner={owner} journal={draft.journal} ratio={ratio} onEdit={setEditing} onChange={entries=>changeJournal({entries})}/>:<section className="artwork-editor"><div className="collection-heading"><div><h2>Your artwork</h2><small className="upload-limits">JPG, PNG, WebP · 10 MB / image · 20 MP</small></div><button className="outline-button" onClick={()=>file.current?.click()} disabled={uploading}><Plus/>{uploading?'Opening…':'Add artwork'}</button><input hidden ref={file} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files);e.target.value=''}}/></div>
 {!draft.artworks.length&&<button className="art-upload-empty" onClick={()=>file.current?.click()}><UploadSimple size={32} weight="thin"/><span>Add your first artwork</span></button>}
 <div className="artwork-strip">{draft.artworks.map((a,i)=><div className={`artwork-edit-card ${editing===a.id?'selected':''}`} key={a.id}><button className="artwork-edit-preview" title="Position and resize artwork" aria-label={`Position ${a.title}`} onClick={()=>{setEditing(a.id);window.scrollTo({top:90,behavior:'smooth'})}}><img src={a.src} alt={a.title}/><Crop size={19}/></button><div className="artwork-tools"><button title="Single page" aria-label={`Single page for ${a.title}`} aria-pressed={a.layout!=='spread'} onClick={()=>{updateArt(a.id,{layout:'page'});setEditing(a.id)}}><LayoutIcon/></button><button title="Across both pages" aria-label={`Across both pages for ${a.title}`} aria-pressed={a.layout==='spread'} onClick={()=>{updateArt(a.id,{layout:'spread'});setEditing(a.id)}}><LayoutIcon spread/></button><button title="Remove artwork" aria-label={`Remove ${a.title}`} onClick={()=>{change('artworks',draft.artworks.filter(x=>x.id!==a.id));if(editing===a.id)setEditing('book')}}><X size={15}/></button></div><div className="art-order"><button title="Move earlier" aria-label={`Move ${a.title} earlier`} disabled={i===0} onClick={()=>{const list=[...draft.artworks];[list[i-1],list[i]]=[list[i],list[i-1]];change('artworks',list)}}><ArrowLeft/></button><button title="Move later" aria-label={`Move ${a.title} later`} disabled={i===draft.artworks.length-1} onClick={()=>{const list=[...draft.artworks];[list[i+1],list[i]]=[list[i],list[i+1]];change('artworks',list)}}><ArrowRight/></button></div></div>)}</div></section>}</main>:
 portfolio()}
 <SiteFooter/>
 <nav className="mobile-navigation" aria-label="Main navigation"><button aria-current={screen==='feed'?'page':undefined} onClick={()=>navigate('feed')}><MagnifyingGlass size={22}/><span>Explore</span></button><button aria-current={screen==='new'?'page':undefined} onClick={()=>{if(!user)setPanel('signin');else if(!draft)startBook();else navigate('new')}}><Plus size={24}/><span>Create</span></button><button aria-current={screen==='portfolio'?'page':undefined} onClick={()=>navigate('portfolio')}><BookOpen size={22}/><span>Portfolio</span></button></nav><dialog ref={dialog} className="portfolio-dialog" onCancel={()=>{setViewing(null);setPanel(null)}}><button className="dialog-close" aria-label="Close dialog" onClick={()=>{setViewing(null);setPanel(null)}}><X/></button>{viewing&&books.some(b=>b.id===viewing.id)&&<button className="dialog-edit outline-button" aria-label={`Edit ${viewing.title}`} onClick={()=>{const b=viewing;setViewing(null);void openDraft({...b})}}><PencilSimple size={16}/> Edit</button>}{viewing&&<><h2>{viewing.title}</h2>{renderBook(viewing)}</>}{panel==='signin'||panel==='signup'?<SignIn key={panel} initial={panel} onUser={signedIn} onLegal={()=>setPanel(null)}/>:panel==='settings'&&user&&me?<Settings user={user} person={me} onUser={setUser} onPerson={setMe} onSignedOut={signedOut} onNotice={setNotice}/>:panel==='notifications'?<Notifications onPerson={name=>{setPanel(null);openPerson(name)}} onBook={id=>{setPanel(null);void view({id} as Book)}} onRead={()=>setUnread(0)}/>:panel&&typeof panel==='object'?<ResetPassword token={panel.reset} onUser={signedIn}/>:null}</dialog>{notice&&<div className="notification" role="status">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X/></button></div>}</div>
}

import './variants.css'

import './responsive.css'
import './account.css'

import './pages.css'
