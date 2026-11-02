import {useEffect,useRef,useState} from 'react'
import {Pause,Play} from '@phosphor-icons/react'

export default function Welcome({theme,onCreate}:{theme:'light'|'dark';onCreate:()=>void}){
 const video=useRef<HTMLVideoElement>(null)
 const [playing,setPlaying]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches)
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)')
  const changed=()=>setPlaying(!media.matches)
  media.addEventListener('change',changed)
  return()=>media.removeEventListener('change',changed)
 },[])
 useEffect(()=>{const node=video.current;if(!node)return;if(playing)void node.play().catch(()=>setPlaying(false));else node.pause()},[playing,theme])
 return <main className="welcome-page"><section className="welcome-content" aria-labelledby="welcome-heading">
  <div className="welcome-film">
   <video key={theme} ref={video} src={`/media/welcome-${theme}.mp4`} poster={`/media/welcome-${theme}.webp`} width="720" height="406" autoPlay={playing} muted loop playsInline preload="auto" aria-label="A playful animated illustration of a head full of thoughts"/>
   <button className="film-toggle" aria-label={playing?'Pause animation':'Play animation'} title={playing?'Pause animation':'Play animation'} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
  </div>
  <h1 id="welcome-heading">A little space for what’s on your mind.</h1>
  <p>Make it yours.</p>
  <button className="solid-button" onClick={onCreate}>Create an account</button>
 </section></main>
}
