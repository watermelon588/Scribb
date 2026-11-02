import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {ArrowLeft,ArrowRight,BookOpen,PencilSimple} from '@phosphor-icons/react'
import {Cover,inkFor} from './Sketchbook'
import {journalCover} from './Journal'
import {presets,formats} from '../data/presets'
import type {Book} from '../Profile'
export function BookObject({book}:{book:Book}){
 return <div className="collection-book-object" style={{'--cover':book.color,'--band-color':book.bandColor??'#2464ed','--cover-ink':inkFor(book.color),'--title-scale':1,'--book-ratio':formats.find(f=>f.id===book.format)?.ratio??.75} as CSSProperties}><div className="portfolio-cover"><Cover preset={presets.find(p=>p.id===book.presetId)!} title={book.title} caption={book.caption} count={book.artworks.length} coverPlacement={book.coverPlacement} {...(book.kind==='journal'?(({front,coverImage,stickers})=>({kicker:'JOURNAL',coverImage,face:front,overlay:stickers}))(journalCover(book)):{coverImage:book.coverImage})}/>{book.presetId==='watercolor'&&<i className="thumbnail-elastic"/>}{book.presetId==='spiral'&&<i className="thumbnail-wire"/>}</div></div>
}
export default function Bookshelf({books,onOpen,onEdit,noun='sketchbook'}:{books:Book[];onOpen:(b:Book)=>void;onEdit:(b:Book)=>void;noun?:string}){
 const [selected,setSelected]=useState(books[0]?.id);const rail=useRef<HTMLDivElement>(null)
 // Focus selects a volume, so the click opens it only if it was already selected when pressed (or came from the keyboard).
 const pressed=useRef<string|undefined>(undefined)
 const active=books.find(b=>b.id===selected)??books[0]
 useEffect(()=>{const node=rail.current?.querySelector<HTMLElement>('[aria-pressed="true"]');if(node&&rail.current){const r=rail.current;const left=node.offsetLeft-r.offsetLeft;r.scrollTo({left:Math.max(0,left-r.clientWidth/2+node.offsetWidth/2),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}},[active?.id])
 if(!active)return null
 const index=books.indexOf(active)
 function move(direction:number){setSelected(books[Math.max(0,Math.min(books.length-1,index+direction))].id)}
 return <div className="reference-shelf"><div ref={rail} className="reference-shelf-rail" role="group" aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} bookshelf`} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}}}>{books.map((book,i)=><button key={book.id} className={`shelf-volume ${active.id===book.id?'selected':''}`} style={{'--spine-color':book.color,'--volume-height':`${255+(i%4)*12}px`,'--volume-ratio':formats.find(f=>f.id===book.format)?.ratio??.75} as CSSProperties} aria-label={`Select ${book.title}`} aria-pressed={active.id===book.id} onPointerDown={()=>{pressed.current=active.id}} onClick={e=>{if(e.detail===0||pressed.current===book.id)onOpen(book);else setSelected(book.id)}} onFocus={()=>setSelected(book.id)}><span className="reference-spine"><span>{book.title}</span><small>{String(i+1).padStart(2,'0')}</small></span><div className="shelf-front"><BookObject book={book}/></div></button>)}</div><div className="shelf-selection"><div><span className="eyebrow">{String(index+1).padStart(2,'0')} / {String(books.length).padStart(2,'0')}</span><h3>{active.title}</h3></div><div className="shelf-actions"><button aria-label={`Previous ${noun}`} disabled={index===0} onClick={()=>move(-1)}><ArrowLeft/></button><button aria-label={`Next ${noun}`} disabled={index===books.length-1} onClick={()=>move(1)}><ArrowRight/></button><button title={`Edit ${noun}`} aria-label={`Edit ${active.title}`} onClick={()=>onEdit(active)}><PencilSimple/></button><button className="outline-button" onClick={()=>onOpen(active)}><BookOpen/> Open {noun}</button></div></div></div>
}
