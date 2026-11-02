import {useEffect,useRef,type RefObject} from 'react'
import {useGSAP} from '@gsap/react'
import gsap from 'gsap'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
gsap.registerPlugin(useGSAP)
export function useAppMotion(root:RefObject<HTMLDivElement|null>,screen:string,style:string,modal:boolean){
 const scroll=useRef<Lenis|null>(null)
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(pointer: fine)')
  let removeTick:(()=>void)|undefined
  function setup(){removeTick?.();scroll.current?.destroy();scroll.current=null
   if(media.matches||!desktop.matches)return
   const lenis=new Lenis({lerp:.16,smoothWheel:true,syncTouch:false,prevent:node=>Boolean(node.closest('dialog,.book-stage,.cover-fan,.reference-shelf-rail,.artwork-strip,.placement-surface,.crop-surface,input,textarea'))})
   scroll.current=lenis
   const tick=(time:number)=>lenis.raf(time*1000)
   gsap.ticker.add(tick);removeTick=()=>gsap.ticker.remove(tick)
   const dialog=root.current?.querySelector('dialog[open]');if(dialog)lenis.stop()
  }
  setup();media.addEventListener('change',setup);desktop.addEventListener('change',setup)
  return()=>{removeTick?.();scroll.current?.destroy();scroll.current=null;media.removeEventListener('change',setup);desktop.removeEventListener('change',setup)}
 },[root])
 useEffect(()=>{if(modal)scroll.current?.stop();else scroll.current?.start()},[modal])
 useEffect(()=>{scroll.current?.scrollTo(0,{immediate:true,force:true})},[screen])
 useGSAP(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const nodes=root.current?.querySelectorAll('.feed-intro,.artist-profile,.creation-heading,.feed-toolbar,.collection-heading')
  if(nodes?.length)gsap.from(nodes,{y:9,opacity:.65,duration:.36,stagger:.035,ease:'power2.out',clearProps:'transform,opacity'})
 },{scope:root,dependencies:[screen,style],revertOnUpdate:true})
}
