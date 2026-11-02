import {useEffect,useRef,useState} from 'react'
import {DownloadSimple,X} from '@phosphor-icons/react'
import './install-app.css'

type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone)

/** Installation stays a deliberate choice; never interrupt writing with a prompt. */
export default function InstallApp(){
 const [installed,setInstalled]=useState(standalone),[prompt,setPrompt]=useState<InstallPrompt|null>(null),[busy,setBusy]=useState(false),[help,setHelp]=useState(false)
 const dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{if(help)dialog.current?.showModal()},[help])
 useEffect(()=>{
  const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)}
  const done=()=>{setInstalled(true);setPrompt(null);dialog.current?.close()}
  const mode=matchMedia('(display-mode: standalone)'),changed=()=>setInstalled(standalone())
  window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);mode.addEventListener('change',changed)
  return()=>{window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);mode.removeEventListener('change',changed)}
 },[])
 async function install(){
  if(!prompt){setHelp(true);return}
  setBusy(true)
  try{await prompt.prompt();await prompt.userChoice}catch{setHelp(true)}
  finally{setPrompt(null);setBusy(false)}
 }
 if(installed)return null
 const applePhone=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
 const mac=/Mac/.test(navigator.platform)
 return <>
  <button className="install-app-button" type="button" disabled={busy} onClick={()=>void install()}><DownloadSimple size={16} aria-hidden="true"/>{busy?'Opening…':'Install app'}</button>
  {help&&<dialog className="install-app-dialog" ref={dialog} aria-labelledby="install-heading" onClose={()=>setHelp(false)}>
   <button className="install-close" type="button" aria-label="Close install instructions" onClick={()=>dialog.current?.close()}><X size={20}/></button>
   <span className="eyebrow">TAKE YOUR SPACE WITH YOU</span>
   <h2 id="install-heading">A place on your home screen.</h2>
   <p>Open your sketchbooks and journals in their own window, straight from your device.</p>
   {applePhone?<ol><li>Open this website in Safari.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol>:<><p>In Chrome or Edge, open the browser menu and choose <strong>Install app</strong> or <strong>Install this site as an app</strong>. You may also see an install icon beside the address bar.</p>{mac&&<p>In Safari on a Mac, choose <strong>File → Add to Dock</strong>.</p>}<p>If your browser has no install option, open this website in Chrome or Edge.</p></>}
   <p className="install-note">Internet is needed for your account, cloud books and AI. Use the same account to find your saved work. Local drafts stay in the browser or installed app where you created them.</p>
   <button className="solid-button" type="button" onClick={()=>dialog.current?.close()}>Got it</button>
  </dialog>}
 </>
}
