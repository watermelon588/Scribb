import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react'
import {Heart,BookmarkSimple,MagnifyingGlass,BookOpen,Book as BookIcon,Plus,CaretDown,ShareNetwork,Star,Clock} from '@phosphor-icons/react'
import {BookObject} from './Bookshelf'
import {ArtworkPage,artworkPages} from './Sketchbook'
import {journalLeaves,useFontReady,type Owner} from './Journal'
import {api,avatarSrc,bookPage,message,type User} from '../lib/api'
import Avatar from './Avatar'
import {formats,papers} from '../data/presets'
import {sectionOf,sheetSize,typeScale} from '../data/journal'
import type {Book} from '../Profile'
import './feed.css'

type Tab='explore'|'following'|'saved'
type Sort='weekly'|'recent'
const hasPost=(book:Book)=>book.kind==='journal'?Boolean(book.latest):book.artworks.length>0
/** A card's book lying open at its newest post, drawn from the same leaves as the book: a sketchbook's last page,
 * or the last page of a journal's newest written entry. The journal is laid out from that entry alone, so its page
 * numbers would not match the book and are hidden here. */
function OpenSpread({book}:{book:Book}){
 const ratio=formats.find(f=>f.id===book.format)?.ratio??.75,journal=book.kind==='journal'?book.journal:undefined
 const ready=useFontReady(journal?typeScale(journal,'writing').font.family:'serif')
 const {leaves,recent}=useMemo(()=>{
  if(journal&&book.latest){const owner:Owner={name:book.owner?.displayName||book.owner?.username||'',handle:book.owner?.username??'',avatar:avatarSrc(book.owner?.avatar)};return journalLeaves(book,{...journal,entries:[book.latest]},owner,ratio)}
  const pages=artworkPages(book.artworks);return {leaves:pages.map((art,i)=><ArtworkPage key={art.id} artwork={art} index={i}/>),recent:pages.length}
 },[book,journal,ratio,ready])
 const latestIsSpread = journal && book.latest ? sectionOf(book.latest.layout) === 'spread' : book.artworks.at(-1)?.layout === 'spread'
 const leaf=useRef<HTMLDivElement>(null),[pageWidth,setPageWidth]=useState(0)
 useEffect(()=>{const node=leaf.current;if(!node)return;const observer=new ResizeObserver(([e])=>setPageWidth(e.contentRect.width));observer.observe(node);return()=>observer.disconnect()},[recent])
 // Leaf i is page i + 1, and pages pair up 1-2, 3-4, … so the spread starts on the even leaf.
 const left=2*Math.floor((Math.max(recent,1)-1)/2)
 return <div data-unpaired={!leaves[left+1]||undefined} className={`feed-spread ${latestIsSpread?'continuous':'single-post'} textured preset-${journal?'linen':book.presetId} ${journal?'is-journal':''}`} style={{'--r':ratio,'--paper-image':`url("${papers.find(p=>p.id===book.paper)?.src??'/paper.svg'}")`,'--sheet-scale':journal&&pageWidth?pageWidth/sheetSize(ratio).width:undefined} as CSSProperties}>
  <div ref={recent===left+2?undefined:leaf} className={`feed-leaf ${recent===left+2?'':'recent'}`}>{leaves[left]}</div><div ref={recent===left+2?leaf:undefined} className={`feed-leaf ${recent===left+2?'recent':''}`}>{leaves[left+1]??<div className="book-page endpaper"/>}</div>
 </div>
}

const CATEGORIES=['All','Watercolor','Illustration','Sketches']
/** Explore and Following come from the API; guests can read, and liking or saving asks them to sign in. */
export default function Feed({user,onOpen,onShare,onPerson,onSignIn,onNotice}:{user:User|null|undefined;onOpen:(b:Book)=>void;onShare:(b:Book)=>void;onPerson:(handle:string)=>void;onSignIn:()=>void;onNotice:import('./Notice').Notify}){
 const [tab,setTab]=useState<Tab>('explore'),[category,setCategory]=useState('All'),[query,setQuery]=useState('')
 const [sorts,setSorts]=useState<Record<'explore'|'following',Sort>>({explore:'weekly',following:'recent'})
 // Cards lie open at the newest post; the icon closes one to its cover and opens it again.
 const [closed,setClosed]=useState<Set<string>>(()=>new Set())
 const [books,setBooks]=useState<Book[]>([]),[next,setNext]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const sort=tab==='saved'?null:sorts[tab]
 const path=tab==='saved'?'/me/saved':`/feed?tab=${tab}&sort=${sort}${category==='All'?'':`&category=${encodeURIComponent(category)}`}`
 const request=useRef(0),pages=useRef(0),pending=useRef(new Set<string>()),refreshRank=useRef(false)
 async function load(cursor?:string|null){
  const id=++request.current
  setLoading(true);setError('')
  try{
   const page=await bookPage(path,cursor)
   if(id!==request.current)return
   setBooks(previous=>{
    const previousById=new Map(previous.map(book=>[book.id,book]))
    const incoming=page.items.map(book=>{
     const current=previousById.get(book.id)
     if(!current)return book
     if(pending.current.has(`${book.id}:like`))book={...book,liked:current.liked,likeCount:current.likeCount}
     if(pending.current.has(`${book.id}:save`))book={...book,saved:current.saved,saveCount:current.saveCount}
     return book
    })
    return cursor?[...previous,...incoming.filter(book=>!previousById.has(book.id))]:incoming
   })
   pages.current=cursor?pages.current+1:1
   setNext(page.next)
  }catch(e){if(id===request.current)setError(message(e,'The feed could not be loaded.'))}
  finally{if(id===request.current)setLoading(false)}
 }
 useEffect(()=>{
  refreshRank.current=false;pages.current=0;setBooks([]);setNext(null)
  if(tab==='explore'||user)void load()
  else setLoading(false)
  return()=>{request.current++}
 },[path,user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 function choose(next:Tab){if(next!=='explore'&&!user){onSignIn();return}setTab(next)}
 // Phones replace the toolbar and search with one switch that opens a bottom sheet of views.
 const views=useRef<HTMLDivElement>(null),view=tab==='saved'?'Saved':tab==='following'?'Following':category==='All'?'For you':category
 function pick(next:Tab,c='All'){views.current?.hidePopover();setCategory(c);choose(next)}
 function pickSort(next:Sort){
  if(tab==='saved')return
  setSorts(current=>({...current,[tab]:next}))
  views.current?.hidePopover()
 }
 function sortControls(inSheet=false){return sort&&<div className="feed-order" role="group" aria-label="Sort posts">
  {inSheet&&<span className="feed-sort-label">Sort posts</span>}
  <button className="button-quiet" aria-pressed={sort==='weekly'} onClick={()=>pickSort('weekly')}><Star size={16}/> Top this week</button>
  <button className="button-quiet" aria-pressed={sort==='recent'} onClick={()=>pickSort('recent')}><Clock size={16}/> Recent</button>
 </div>}
 // Optimistic: the button changes at once and the server's counts replace the guess.
 async function react(book:Book,kind:'like'|'save'){
  if(!user){onSignIn();return}
  const key=`${book.id}:${kind}`,started=request.current
  if(pending.current.has(key))return
  pending.current.add(key)
  const on=kind==='like'?!book.liked:!book.saved
  const patch=(b:Book):Book=>kind==='like'?{...b,liked:on,likeCount:(b.likeCount??0)+(on?1:-1)}:{...b,saved:on,saveCount:(b.saveCount??0)+(on?1:-1)}
  setBooks(list=>list.map(b=>b.id===book.id?patch(b):b))
  try{
   const r=await api<{likeCount:number;saveCount:number}>(on?'PUT':'DELETE',`/books/${book.id}/${kind}`)
   setBooks(list=>list.map(b=>b.id!==book.id?b:kind==='like'?{...b,liked:on,likeCount:r.likeCount}:{...b,saved:on,saveCount:r.saveCount}))
   if(kind==='save')onNotice(on?'Book saved to your saved shelf.':'Book removed from your saved shelf.','success')
   else if(tab!=='saved'&&pages.current===1&&started===request.current)refreshRank.current=true
  }catch(e){
   setBooks(list=>list.map(b=>b.id!==book.id?b:kind==='like'?{...b,liked:book.liked,likeCount:book.likeCount}:{...b,saved:book.saved,saveCount:book.saveCount}))
   onNotice(message(e),'error')
  }finally{
   pending.current.delete(key)
   if(!pending.current.size&&refreshRank.current&&started===request.current){refreshRank.current=false;void load()}
  }
 }
 const shown=books.filter(b=>`${b.title} ${b.owner?.displayName} ${b.owner?.username}`.toLowerCase().includes(query.toLowerCase()))
 function toggle(id:string){setClosed(set=>{const next=new Set(set);if(!next.delete(id))next.add(id);return next})}
 function card(book:Book,index:number){const author=book.owner!,noun=book.kind==='journal'?'journal':'sketchbook',post=hasPost(book),open=post&&!closed.has(book.id);return <article className="feed-card" key={book.id}>
 <div className="feed-card-heading"><button className="feed-author" onClick={()=>onPerson(author.username)} aria-label={`View ${author.displayName||author.username}'s portfolio`}><Avatar avatar={author.avatar} sizes="35px" loading="lazy"/><span>{author.displayName||author.username}<small>@{author.username}</small></span></button><div className="feed-card-labels">{book.weeklyTop&&<span className="feed-weekly-badge"><Star size={15} weight="fill"/> Top this week</span>}{book.category&&<span className="feed-category">{book.category}</span>}</div></div>
 <div className="feed-book-scene"><button className="feed-scene-open" aria-label={`Open ${book.title}`} onClick={()=>onOpen(book)}><span className="feed-edition">{String(index+1).padStart(2,'0')}</span>{open?<OpenSpread book={book}/>:<BookObject book={book}/>}</button>
  {post&&<button className="button-icon feed-cover-toggle" aria-label={open?`Close ${book.title}`:`Open ${book.title} at the newest page`} data-hint={open?'Close book':'Newest page'} onClick={()=>toggle(book.id)}>{open?<BookIcon size={19} weight="light"/>:<BookOpen size={19} weight="light"/>}</button>}</div>
 <div className="feed-card-caption"><div><h2>{book.title}</h2><span>{noun} <i/> {book.format}</span></div><div className="feed-reactions">
  <button className="button-quiet" data-hint="Like" aria-label={`Like ${book.title}`} aria-pressed={Boolean(book.liked)} onClick={()=>void react(book,'like')}><Heart size={21} weight={book.liked?'fill':'light'}/><span>{book.likeCount??0}</span></button>
  {book.visibility==='public'&&<button className="button-icon" data-hint="Share" aria-label={`Share ${book.title}`} onClick={()=>onShare(book)}><ShareNetwork size={21} weight="light"/></button>}
  <button className="button-icon" data-hint="Save" aria-label={`Save ${book.title}`} aria-pressed={Boolean(book.saved)} onClick={()=>void react(book,'save')}><BookmarkSimple size={21} weight={book.saved?'fill':'light'}/></button>
 </div></div>
 </article>}
 return <main className="feed-page">
 <div className="feed-toolbar"><div className="feed-categories" role="group" aria-label="Art category">{CATEGORIES.map(c=><button key={c} className="button-quiet" aria-pressed={tab!=='saved'&&category===c} onClick={()=>{setCategory(c);if(tab==='saved')setTab('explore')}}>{c==='All'?'For you':c}</button>)}</div><div className="feed-toolbar-right">{sortControls()}<button className="button-icon feed-saved-toggle" data-hint="Saved books" aria-label="Show saved books" aria-pressed={tab==='saved'} onClick={()=>choose(tab==='saved'?'explore':'saved')}><BookmarkSimple size={19} weight={tab==='saved'?'fill':'light'}/></button><div className="feed-sort" role="group" aria-label="Feed"><button className="button-quiet" aria-pressed={tab==='explore'} onClick={()=>choose('explore')}>Everyone</button><button className="button-quiet" aria-pressed={tab==='following'} onClick={()=>choose('following')}>Following</button></div></div></div>
 <div className="feed-phone-menu"><button className="button-quiet" popoverTarget="feed-views" aria-label={`Showing ${view}. Change view`}>{view}<CaretDown size={14}/></button>
  <div ref={views} id="feed-views" popover="auto" className="feed-views" aria-label="Feed views">{sortControls(true)}{([['explore','All','For you'],['following','All','Following'],['saved','All','Saved'],...CATEGORIES.slice(1).map(c=>['explore',c,c])] as [Tab,string,string][]).map(([t,c,name],i)=><button key={name} className={`button-quiet${i===3?' feed-view-category':''}`} aria-pressed={view===name} onClick={()=>pick(t,c)}>{name}</button>)}</div></div>
 <label className="feed-search"><MagnifyingGlass size={18}/><input aria-label="Search the feed" placeholder="Find a book or an artist" value={query} onChange={e=>setQuery(e.target.value)} type="search" enterKeyHint="search"/></label>
 <div className="feed-layout"><aside className="feed-side-note"><span className="eyebrow">THE READING ROOM</span><h2>Good art<br/>takes time.</h2><p>A few pages from someone else’s world.</p></aside><div className="feed-grid" aria-busy={loading}>{shown.map(card)}</div></div>
 {error&&<div className="feed-empty" role="alert"><h2>The feed could not be loaded.</h2><p>{error}</p><button className="button-secondary" onClick={()=>void load()}>Try again</button></div>}
 {!error&&!loading&&!shown.length&&<div className="feed-empty"><img className="brand-mark" src="/brand/scribb-mark.png" alt="" width="64" height="64"/><h2>{tab==='saved'?'Your saved shelf is waiting.':tab==='following'?'Nothing from people you follow yet.':query?'No books found.':'Nothing published here yet.'}</h2><p>{tab==='saved'?'Tap the bookmark on a book to keep it here.':tab==='following'?'Follow artists from their portfolios to see their new books here.':query?'Try another name.':'Published sketchbooks and journals appear here.'}</p>{(tab!=='explore'||query||category!=='All')&&<button className="button-secondary" onClick={()=>{setQuery('');setCategory('All');setTab('explore')}}>Explore everyone</button>}</div>}
 {next&&!error&&<button className="button-secondary feed-load" disabled={loading} onClick={()=>void load(next)}><Plus/> {loading?'Loading…':'More to discover'}</button>}
 <footer className="feed-footer"><span>Made by hand. Shared with care.</span></footer>
 </main>
}
