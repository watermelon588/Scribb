import {useEffect,useState} from 'react'
import {Heart,BookmarkSimple,MagnifyingGlass,BookOpen,Plus} from '@phosphor-icons/react'
import {BookObject} from './Bookshelf'
import {api,avatarSrc,bookPage,message,type User} from '../lib/api'
import type {Book} from '../Profile'
import './feed.css'

type Tab='explore'|'following'|'saved'
const CATEGORIES=['All','Watercolor','Illustration','Sketches']
/** Explore and Following come from the API; guests can read, and liking or saving asks them to sign in. */
export default function Feed({user,onOpen,onPerson,onSignIn}:{user:User|null|undefined;onOpen:(b:Book)=>void;onPerson:(handle:string)=>void;onSignIn:()=>void}){
 const [tab,setTab]=useState<Tab>('explore'),[category,setCategory]=useState('All'),[query,setQuery]=useState('')
 const [books,setBooks]=useState<Book[]>([]),[next,setNext]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const path=tab==='saved'?'/me/saved':`/feed?tab=${tab}${category==='All'?'':`&category=${encodeURIComponent(category)}`}`
 async function load(cursor?:string|null){
  setLoading(true);setError('')
  try{const page=await bookPage(path,cursor);setBooks(b=>cursor?[...b,...page.items]:page.items);setNext(page.next)}catch(e){setError(message(e,'The feed could not be loaded.'))}finally{setLoading(false)}
 }
 useEffect(()=>{if(tab!=='explore'&&!user)return;setBooks([]);void load()},[path,user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
 function choose(next:Tab){if(next!=='explore'&&!user){onSignIn();return}setTab(next)}
 // Optimistic: the button changes at once and the server's counts replace the guess.
 async function react(book:Book,kind:'like'|'save'){
  if(!user){onSignIn();return}
  const on=kind==='like'?!book.liked:!book.saved
  const patch=(b:Book):Book=>kind==='like'?{...b,liked:on,likeCount:(b.likeCount??0)+(on?1:-1)}:{...b,saved:on,saveCount:(b.saveCount??0)+(on?1:-1)}
  setBooks(list=>list.map(b=>b.id===book.id?patch(b):b))
  try{const r=await api<{likeCount:number;saveCount:number}>(on?'PUT':'DELETE',`/books/${book.id}/${kind}`);setBooks(list=>list.map(b=>b.id===book.id?{...b,likeCount:r.likeCount,saveCount:r.saveCount}:b))}
  catch(e){setBooks(list=>list.map(b=>b.id===book.id?book:b));setNotice(message(e))}
 }
 const shown=books.filter(b=>`${b.title} ${b.owner?.displayName} ${b.owner?.username}`.toLowerCase().includes(query.toLowerCase()))
 function card(book:Book,index:number){const author=book.owner!,noun=book.kind==='journal'?'journal':'sketchbook';return <article className="feed-card" key={book.id}>
 <div className="feed-card-heading"><button className="feed-author" onClick={()=>onPerson(author.username)} aria-label={`View ${author.displayName||author.username}'s portfolio`}><img src={avatarSrc(author.avatar)} alt="" loading="lazy"/><span>{author.displayName||author.username}<small>@{author.username}</small></span></button>{book.category&&<span className="feed-category">{book.category}</span>}</div>
 <button className="feed-book-scene" aria-label={`Open ${book.title}`} onClick={()=>onOpen(book)}><span className="feed-edition">{String(index+1).padStart(2,'0')}</span><BookObject book={book}/><span className="feed-open"><BookOpen size={17}/><span>Open {noun}</span></span></button>
 <div className="feed-card-caption"><div><h2>{book.title}</h2><span>{noun} <i/> {book.format}</span></div><div className="feed-reactions"><button title={`Like ${noun}`} aria-label={`Like ${book.title}`} aria-pressed={Boolean(book.liked)} onClick={()=>void react(book,'like')}><Heart size={21} weight={book.liked?'fill':'light'}/><span>{book.likeCount??0}</span></button><button title={`Save ${noun}`} aria-label={`Save ${book.title}`} aria-pressed={Boolean(book.saved)} onClick={()=>void react(book,'save')}><BookmarkSimple size={21} weight={book.saved?'fill':'light'}/></button></div></div>
 </article>}
 return <main className="feed-page">
 <div className="feed-toolbar"><div className="feed-categories" role="group" aria-label="Art category">{CATEGORIES.map(c=><button key={c} aria-pressed={tab!=='saved'&&category===c} onClick={()=>{setCategory(c);if(tab==='saved')setTab('explore')}}>{c==='All'?'For you':c}</button>)}</div><div className="feed-toolbar-right"><button className="feed-saved-toggle" title="Saved books" aria-label="Show saved books" aria-pressed={tab==='saved'} onClick={()=>choose(tab==='saved'?'explore':'saved')}><BookmarkSimple size={19} weight={tab==='saved'?'fill':'light'}/></button><div className="feed-sort" role="group" aria-label="Feed"><button aria-pressed={tab==='explore'} onClick={()=>choose('explore')}>Everyone</button><button aria-pressed={tab==='following'} onClick={()=>choose('following')}>Following</button></div></div></div>
 <label className="feed-search"><MagnifyingGlass size={18}/><input aria-label="Search the feed" placeholder="Find a book or an artist" value={query} onChange={e=>setQuery(e.target.value)} type="search" enterKeyHint="search"/></label>
 <div className="feed-layout"><aside className="feed-side-note"><span className="eyebrow">THE READING ROOM</span><h2>Good art<br/>takes time.</h2><p>A few pages from someone else’s world.</p></aside><div className="feed-grid" aria-busy={loading}>{shown.map(card)}</div></div>
 {error&&<div className="feed-empty" role="alert"><h2>The feed could not be loaded.</h2><p>{error}</p><button className="outline-button" onClick={()=>void load()}>Try again</button></div>}
 {!error&&!loading&&!shown.length&&<div className="feed-empty"><BookOpen size={35} weight="thin"/><h2>{tab==='saved'?'Your saved shelf is waiting.':tab==='following'?'Nothing from people you follow yet.':query?'No books found.':'Nothing published here yet.'}</h2><p>{tab==='saved'?'Tap the bookmark on a book to keep it here.':tab==='following'?'Follow artists from their portfolios to see their new books here.':query?'Try another name.':'Published sketchbooks and journals appear here.'}</p>{(tab!=='explore'||query||category!=='All')&&<button className="outline-button" onClick={()=>{setQuery('');setCategory('All');setTab('explore')}}>Explore everyone</button>}</div>}
 {next&&!error&&<button className="feed-load" disabled={loading} onClick={()=>void load(next)}><Plus/> {loading?'Loading…':'More to discover'}</button>}
 <footer className="feed-footer"><span>Made by hand. Shared with care.</span></footer>{notice&&<p role="status" className="feed-notice">{notice}</p>}
 </main>
}
