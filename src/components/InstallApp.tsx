import {useEffect,useRef,useState,type MouseEvent,type ReactNode} from 'react'
import {X} from '@phosphor-icons/react'

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)

/** Footer link that installs Scribb as an app: the browser's own prompt where there is one, otherwise short instructions. Hidden once installed. */
export default function InstallApp({trigger}:{trigger?:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),press=useRef(false)
 const [installed,setInstalled]=useState(standalone),[prompt,setPrompt]=useState<InstallPrompt|null>(null),[busy,setBusy]=useState(false)
 useEffect(()=>{
  const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)}
  const done=()=>{setInstalled(true);setPrompt(null);dialog.current?.close()}
  const mode=matchMedia('(display-mode: standalone)'),changed=()=>setInstalled(standalone())
  addEventListener('beforeinstallprompt',ready);addEventListener('appinstalled',done);mode.addEventListener('change',changed)
  return()=>{removeEventListener('beforeinstallprompt',ready);removeEventListener('appinstalled',done);mode.removeEventListener('change',changed)}
 },[])
 async function install(){
  if(!prompt){dialog.current?.showModal();return}
  setBusy(true)
  try{await prompt.prompt();await prompt.userChoice}catch{dialog.current?.showModal()}
  finally{setPrompt(null);setBusy(false)}
 }
 if(installed)return null
 const iphone=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),mac=/Mac/.test(navigator.platform)
 const outside=(e:MouseEvent)=>{const r=dialog.current!.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom}
 return <>
  <button type="button" className={trigger?'button-quiet':'button-link footer-feedback'} disabled={busy} onClick={()=>void install()}>{trigger??'Install app'}</button>
  <dialog ref={dialog} className="feedback-dialog install-dialog" aria-labelledby="install-title" onPointerDown={e=>{press.current=outside(e)}} onClick={e=>{if(press.current&&outside(e))dialog.current?.close();press.current=false}}>
   <button type="button" className="button-icon dialog-close" aria-label="Close install instructions" data-hint="Close" onClick={()=>dialog.current?.close()}><X size={18}/></button>
   <h2 id="install-title">Scribb on your home screen</h2>
   {iphone?<ol><li>Open this page in Safari.</li><li>Tap <b>Share</b>, then <b>Add to Home Screen</b>.</li><li>Keep <b>Open as Web App</b> on, then tap <b>Add</b>.</li></ol>
   :<><p>In Chrome or Edge, open the browser menu and choose <b>Install Scribb</b>, or use the install icon in the address bar.</p>{mac&&<p>In Safari on a Mac, choose <b>File</b>, then <b>Add to Dock</b>.</p>}</>}
   <p className="install-note">Scribb opens in its own window. Your account, books and Ask my journal still need the internet.</p>
   <button type="button" className="button-primary" onClick={()=>dialog.current?.close()}>Got it</button>
  </dialog>
 </>
}
