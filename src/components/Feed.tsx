import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react'
import {Heart,BookmarkSimple,MagnifyingGlass,BookOpen,Book as BookIcon,Plus,CaretDown} from '@phosphor-icons/react'
import {BookObject} from './Bookshelf'
import {ArtworkPage,artworkPages} from './Sketchbook'
import {journalLeaves,useFontReady,type Owner} from './Journal'
import {api,avatarSrc,bookPage,message,type User} from '../lib/api'
import {formats,papers} from '../data/presets'
import {sectionOf,sheetSize,typeScale} from '../data/journal'
import type {Book} from '../Profile'
import './feed.css'

type Tab='explore'|'following'|'saved'
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
export default function Feed({user,onOpen,onPerson,onSignIn,onNotice}:{user:User|null|undefined;onOpen:(b:Book)=>void;onPerson:(handle:string)=>void;onSignIn:()=>void;onNotice:import('./Notice').Notify}){
 const [tab,setTab]=useState<Tab>('explore'),[category,setCategory]=useState('All'),[query,setQuery]=useState('')
 // Cards lie open at the newest post; the icon closes one to its cover and opens it again.
 const [closed,setClosed]=useState<Set<string>>(()=>new Set())
 const [books,setBooks]=useState<Book[]>([]),[next,setNext]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const path=tab==='saved'?'/me/saved':`/feed?tab=${tab}${category==='All'?'':`&category=${encodeURIComponent(category)}`}`
 async function load(cursor?:string|null){
  setLoading(true);setError('')
  try{const page=await bookPage(path,cursor);setBooks(b=>cursor?[...b,...page.items]:page.items);setNext(page.next)}catch(e){setError(message(e,'The feed could not be loaded.'))}finally{setLoading(false)}
 }
 useEffect(()=>{if(tab!=='explore'&&!user)return;setBooks([]);void load()},[path,user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 function choose(next:Tab){if(next!=='explore'&&!user){onSignIn();return}setTab(next)}
 // Phones replace the toolbar and search with one switch that opens a bottom sheet of views.
 const views=useRef<HTMLDivElement>(null),view=tab==='saved'?'Saved':tab==='following'?'Following':category==='All'?'For you':category
 function pick(next:Tab,c='All'){views.current?.hidePopover();setCategory(c);choose(next)}
 // Optimistic: the button changes at once and the server's counts replace the guess.
 async function react(book:Book,kind:'like'|'save'){
  if(!user){onSignIn();return}
  const on=kind==='like'?!book.liked:!book.saved
  const patch=(b:Book):Book=>kind==='like'?{...b,liked:on,likeCount:(b.likeCount??0)+(on?1:-1)}:{...b,saved:on,saveCount:(b.saveCount??0)+(on?1:-1)}
  setBooks(list=>list.map(b=>b.id===book.id?patch(b):b))
  try{const r=await api<{likeCount:number;saveCount:number}>(on?'PUT':'DELETE',`/books/${book.id}/${kind}`);setBooks(list=>list.map(b=>b.id===book.id?{...b,likeCount:r.likeCount,saveCount:r.saveCount}:b));if(kind==='save')onNotice(on?'Book saved to your saved shelf.':'Book removed from your saved shelf.','success')}
  catch(e){setBooks(list=>list.map(b=>b.id===book.id?book:b));onNotice(message(e),'error')}
 }
 const shown=books.filter(b=>`${b.title} ${b.owner?.displayName} ${b.owner?.username}`.toLowerCase().includes(query.toLowerCase()))
 function toggle(id:string){setClosed(set=>{const next=new Set(set);if(!next.delete(id))next.add(id);return next})}
 function card(book:Book,index:number){const author=book.owner!,noun=book.kind==='journal'?'journal':'sketchbook',post=hasPost(book),open=post&&!closed.has(book.id);return <article className="feed-card" key={book.id}>
 <div className="feed-card-heading"><button className="feed-author" onClick={()=>onPerson(author.username)} aria-label={`View ${author.displayName||author.username}'s portfolio`}><img src={avatarSrc(author.avatar)} alt="" loading="lazy"/><span>{author.displayName||author.username}<small>@{author.username}</small></span></button>{book.category&&<span className="feed-category">{book.category}</span>}</div>
 <div className="feed-book-scene"><button className="feed-scene-open" aria-label={`Open ${book.title}`} onClick={()=>onOpen(book)}><span className="feed-edition">{String(index+1).padStart(2,'0')}</span>{open?<OpenSpread book={book}/>:<BookObject book={book}/>}</button>
  {post&&<button className="button-icon feed-cover-toggle" aria-label={open?`Close ${book.title}`:`Open ${book.title} at the newest page`} title={open?'Close the book':'Open at the newest page'} onClick={()=>toggle(book.id)}>{open?<BookIcon size={19} weight="light"/>:<BookOpen size={19} weight="light"/>}</button>}</div>
 <div className="feed-card-caption"><div><h2>{book.title}</h2><span>{noun} <i/> {book.format}</span></div><div className="feed-reactions"><button title={`Like ${noun}`} aria-label={`Like ${book.title}`} aria-pressed={Boolean(book.liked)} onClick={()=>void react(book,'like')}><Heart size={21} weight={book.liked?'fill':'light'}/><span>{book.likeCount??0}</span></button><button title={`Save ${noun}`} aria-label={`Save ${book.title}`} aria-pressed={Boolean(book.saved)} onClick={()=>void react(book,'save')}><BookmarkSimple size={21} weight={book.saved?'fill':'light'}/></button></div></div>
 </article>}
 return <main className="feed-page">
 <div className="feed-toolbar"><div className="feed-categories" role="group" aria-label="Art category">{CATEGORIES.map(c=><button key={c} className="button-quiet" aria-pressed={tab!=='saved'&&category===c} onClick={()=>{setCategory(c);if(tab==='saved')setTab('explore')}}>{c==='All'?'For you':c}</button>)}</div><div className="feed-toolbar-right"><button className="button-icon feed-saved-toggle" title="Saved books" aria-label="Show saved books" aria-pressed={tab==='saved'} onClick={()=>choose(tab==='saved'?'explore':'saved')}><BookmarkSimple size={19} weight={tab==='saved'?'fill':'light'}/></button><div className="feed-sort" role="group" aria-label="Feed"><button className="button-quiet" aria-pressed={tab==='explore'} onClick={()=>choose('explore')}>Everyone</button><button className="button-quiet" aria-pressed={tab==='following'} onClick={()=>choose('following')}>Following</button></div></div></div>
 <div className="feed-phone-menu"><button className="button-quiet" popoverTarget="feed-views" aria-label={`Showing ${view}. Change view`}>{view}<CaretDown size={14}/></button>
  <div ref={views} id="feed-views" popover="auto" className="feed-views" aria-label="Feed views">{([['explore','All','For you'],['following','All','Following'],['saved','All','Saved'],...CATEGORIES.slice(1).map(c=>['explore',c,c])] as [Tab,string,string][]).map(([t,c,name])=><button key={name} className="button-quiet" aria-pressed={view===name} onClick={()=>pick(t,c)}>{name}</button>)}</div></div>
 <label className="feed-search"><MagnifyingGlass size={18}/><input aria-label="Search the feed" placeholder="Find a book or an artist" value={query} onChange={e=>setQuery(e.target.value)} type="search" enterKeyHint="search"/></label>
 <div className="feed-layout"><aside className="feed-side-note"><span className="eyebrow">THE READING ROOM</span><h2>Good art<br/>takes time.</h2><p>A few pages from someone else’s world.</p></aside><div className="feed-grid" aria-busy={loading}>{shown.map(card)}</div></div>
 {error&&<div className="feed-empty" role="alert"><h2>The feed could not be loaded.</h2><p>{error}</p><button className="button-secondary" onClick={()=>void load()}>Try again</button></div>}
 {!error&&!loading&&!shown.length&&<div className="feed-empty"><img className="brand-mark" src="/brand/scribb-mark.png" alt="" width="64" height="64"/><h2>{tab==='saved'?'Your saved shelf is waiting.':tab==='following'?'Nothing from people you follow yet.':query?'No books found.':'Nothing published here yet.'}</h2><p>{tab==='saved'?'Tap the bookmark on a book to keep it here.':tab==='following'?'Follow artists from their portfolios to see their new books here.':query?'Try another name.':'Published sketchbooks and journals appear here.'}</p>{(tab!=='explore'||query||category!=='All')&&<button className="button-secondary" onClick={()=>{setQuery('');setCategory('All');setTab('explore')}}>Explore everyone</button>}</div>}
 {next&&!error&&<button className="button-secondary feed-load" disabled={loading} onClick={()=>void load(next)}><Plus/> {loading?'Loading…':'More to discover'}</button>}
 <footer className="feed-footer"><span>Made by hand. Shared with care.</span></footer>
 </main>
}
