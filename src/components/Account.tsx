import {useEffect,useRef,useState,type FormEvent} from 'react'
import {AVATARS,api,avatarSrc,message,type Links,type Person,type User} from '../lib/api'

/** Sign-in, password reset, settings and notifications. Each renders inside the portfolio dialog. */
const GOOGLE_CLIENT_ID=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined
type Google={accounts:{id:{initialize(o:{client_id:string;callback:(r:{credential:string})=>void}):void;renderButton(el:HTMLElement,o:Record<string,unknown>):void}}}

function useBusy(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function run(task:()=>Promise<void>){setBusy(true);setError('');try{await task()}catch(e){setError(message(e))}finally{setBusy(false)}}
 return {busy,error,run,setError}
}
const Problem=({text}:{text:string})=>text?<p className="form-error" role="alert">{text}</p>:null

function GoogleButton({onUser}:{onUser:(u:User)=>void}){
 const slot=useRef<HTMLDivElement>(null),[error,setError]=useState('')
 useEffect(()=>{
  if(!GOOGLE_CLIENT_ID||!slot.current)return
  const node=slot.current
  const ready=()=>{const g=(window as unknown as {google?:Google}).google;if(!g)return
   g.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:r=>{api<{user:User}>('POST','/auth/google',{credential:r.credential}).then(d=>onUser(d.user)).catch(e=>setError(message(e)))}})
   g.accounts.id.renderButton(node,{theme:'outline',size:'large',shape:'rectangular',text:'continue_with',width:Math.min(400,node.clientWidth||320)})}
  let script=document.querySelector<HTMLScriptElement>('script[data-google]')
  if(!script){script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.dataset.google='';document.head.append(script)}
  if((window as unknown as {google?:Google}).google)ready();else script.addEventListener('load',ready,{once:true})
 },[onUser])
 if(!GOOGLE_CLIENT_ID)return null
 return <><div className="google-slot" ref={slot}/><Problem text={error}/><p className="form-divider"><span>or</span></p></>
}

export function SignIn({initial='signin',onUser,onLegal}:{initial?:'signin'|'signup';onUser:(u:User)=>void;onLegal?:()=>void}){
 const [mode,setMode]=useState<'signin'|'signup'|'forgot'>(initial),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[sent,setSent]=useState(false)
 const {busy,error,run,setError}=useBusy()
 function submit(e:FormEvent){e.preventDefault();void run(async()=>{
  if(mode==='forgot'){await api('POST','/auth/forgot',{email});setSent(true);return}
  onUser((await api<{user:User}>('POST',mode==='signup'?'/auth/register':'/auth/login',{username,password})).user)
 })}
 function switchTo(next:typeof mode){setMode(next);setError('');setSent(false)}
 if(mode==='forgot')return <form className="account-form" onSubmit={submit}><h2>Reset your password</h2>
  {sent?<p className="form-note" role="status">If that email is verified on a Scribb account, a reset link is on its way. It works once, for one hour.</p>:<><p className="form-note">Password resets go to the email you verified in Settings.</p>
  <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><Problem text={error}/><button className="solid-button" disabled={busy}>{busy?'Sending…':'Send reset link'}</button></>}
  <button type="button" className="text-button" onClick={()=>switchTo('signin')}>Back to sign in</button></form>
 return <form className="account-form" onSubmit={submit}><h2>{mode==='signup'?'Create your account':'Sign in to Scribb'}</h2>
  <GoogleButton onUser={onUser}/>
  <label>Username<input autoComplete="username" required minLength={3} maxLength={mode==='signup'?30:254} autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(mode==='signup'?e.target.value.toLowerCase():e.target.value)} pattern={mode==='signup'?'[a-z0-9._]{3,30}':undefined} title={mode==='signup'?'3 to 30 lowercase letters, numbers, dots or underscores':undefined}/></label>
  <label>Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?8:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {mode==='signup'&&<p className="form-note">No email needed. You can add one later in Settings to reset your password.</p>}
  {mode==='signup'&&<p className="account-legal">By creating an account, you agree to the <a href="#terms" onClick={onLegal}>Terms</a> and acknowledge the <a href="#privacy" onClick={onLegal}>Privacy notice</a>.</p>}
  <Problem text={error}/><button className="solid-button" disabled={busy}>{busy?'One moment…':mode==='signup'?'Create account':'Sign in'}</button>
  <div className="form-switch">{mode==='signin'?<><button type="button" className="text-button" onClick={()=>switchTo('signup')}>Create an account</button><button type="button" className="text-button" onClick={()=>switchTo('forgot')}>Forgot password?</button></>:<button type="button" className="text-button" onClick={()=>switchTo('signin')}>I already have an account</button>}</div>
 </form>
}

export function ResetPassword({token,onUser}:{token:string;onUser:(u:User)=>void}){
 const [password,setPassword]=useState(''),{busy,error,run}=useBusy()
 return <form className="account-form" onSubmit={e=>{e.preventDefault();void run(async()=>onUser((await api<{user:User}>('POST','/auth/reset',{token,password})).user))}}><h2>Choose a new password</h2>
  <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <p className="form-note">Every device signed in to your account will be signed out.</p><Problem text={error}/><button className="solid-button" disabled={busy}>{busy?'Saving…':'Save password'}</button></form>
}

const LINK_FIELDS:[keyof Links,string][]=[['website','Website'],['instagram','Instagram'],['behance','Behance'],['cara','Cara']]
export function Settings({user,person,onUser,onPerson,onSignedOut,onNotice}:{user:User;person:Person;onUser:(u:User)=>void;onPerson:(p:Person)=>void;onSignedOut:()=>void;onNotice:(text:string)=>void}){
 const [form,setForm]=useState({displayName:person.displayName,username:person.username,bio:person.bio,city:person.city,avatar:person.avatar,links:{...person.links}})
 const [email,setEmail]=useState(user.email??''),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
 const profile=useBusy(),mail=useBusy(),secret=useBusy(),danger=useBusy()
 return <div className="account-settings"><h2>Settings</h2>
  <form className="account-form" onSubmit={e=>{e.preventDefault();void profile.run(async()=>{const {profile:p}=await api<{profile:Person}>('PATCH','/me/profile',form);onPerson(p);onUser({...user,username:p.username,displayName:p.displayName,avatar:p.avatar});onNotice('Profile saved.')})}}>
   <h3>Profile</h3>
   <fieldset className="avatar-choices"><legend>Profile picture</legend>{AVATARS.map(id=><button type="button" key={id} aria-label={`Profile picture ${Number(id.slice(1))}`} aria-pressed={form.avatar===id} onClick={()=>setForm({...form,avatar:id})}><img src={avatarSrc(id)} alt=""/></button>)}</fieldset>
   <label>Name<input required maxLength={60} value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label>
   <label>Username<input required minLength={3} maxLength={30} pattern="[a-z0-9._]{3,30}" autoCapitalize="none" spellCheck={false} value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})}/></label>
   <label>Bio<input maxLength={300} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
   <label>City<input maxLength={60} value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label>
   {LINK_FIELDS.map(([key,name])=><label key={key}>{name}<input type="url" maxLength={200} placeholder="https://" value={form.links[key]??''} onChange={e=>setForm({...form,links:{...form.links,[key]:e.target.value}})}/></label>)}
   <Problem text={profile.error}/><button className="solid-button" disabled={profile.busy}>{profile.busy?'Saving…':'Save profile'}</button>
  </form>
  <form className="account-form" onSubmit={e=>{e.preventDefault();void mail.run(async()=>{await api('PUT','/me/email',{email});onNotice(`Check ${email} for a link to verify it.`)})}}>
   <h3>Email</h3><p className="form-note">{user.email&&user.emailVerified?`${user.email} is verified.`:user.email?`${user.email} is not verified yet.`:'Optional. A verified email lets you reset your password and use Scribb AI.'}</p>
   <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <Problem text={mail.error}/><button className="outline-button" disabled={mail.busy}>{mail.busy?'Sending…':user.emailVerified&&email===user.email?'Send again':'Verify email'}</button>
  </form>
  <form className="account-form" onSubmit={e=>{e.preventDefault();void secret.run(async()=>{const {user:u}=await api<{user:User}>('PUT','/me/password',{current,password});onUser(u);setCurrent('');setPassword('');onNotice('Password saved. Other devices are signed out.')})}}>
   <h3>{user.hasPassword?'Change password':'Add a password'}</h3>
   {user.hasPassword&&<label>Current password<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>}
   <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <Problem text={secret.error}/><button className="outline-button" disabled={secret.busy}>{secret.busy?'Saving…':'Save password'}</button>
  </form>
  <div className="account-form"><h3>Session</h3><button type="button" className="outline-button" onClick={()=>void api('POST','/auth/logout').finally(onSignedOut)}>Sign out</button></div>
  <form className="account-form danger-zone" onSubmit={e=>{e.preventDefault();if(!window.confirm('Delete your account, every book and every journal? This cannot be undone.'))return;void danger.run(async()=>{await api('DELETE','/me',user.hasPassword?{password:confirm}:{confirm});onSignedOut();onNotice('Your account was deleted.')})}}>
   <h3>Delete account</h3><p className="form-note">Removes your profile, books, journals, likes and follows.</p>
   <label>{user.hasPassword?'Password':'Type your username to confirm'}<input type={user.hasPassword?'password':'text'} autoComplete={user.hasPassword?'current-password':'off'} required maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   <Problem text={danger.error}/><button className="outline-button" disabled={danger.busy}>{danger.busy?'Deleting…':'Delete account'}</button>
  </form>
 </div>
}

interface Note {id:string;type:'like'|'follow';read:boolean;createdAt:string;actor:{username:string;displayName:string;avatar:string};book:{id:string;title:string}|null}
export function Notifications({onPerson,onBook,onRead}:{onPerson:(handle:string)=>void;onBook:(id:string)=>void;onRead:()=>void}){
 const [notes,setNotes]=useState<Note[]|null>(null),[next,setNext]=useState<string|null>(null),{error,run}=useBusy()
 useEffect(()=>{void run(async()=>{const d=await api<{notifications:Note[];next:string|null}>('GET','/notifications');setNotes(d.notifications);setNext(d.next);if(d.notifications.some(n=>!n.read)){await api('POST','/notifications/read');onRead()}})},[]) // eslint-disable-line react-hooks/exhaustive-deps
 return <div className="notifications"><h2>Notifications</h2><Problem text={error}/>
  {notes&&!notes.length&&<p className="form-note">Likes and new followers show up here.</p>}
  <ul>{notes?.map(n=><li key={n.id} className={n.read?'':'unread'}><button className="note-actor" onClick={()=>onPerson(n.actor.username)}><img src={avatarSrc(n.actor.avatar)} alt=""/></button>
   <p><button className="text-button" onClick={()=>onPerson(n.actor.username)}>{n.actor.displayName||n.actor.username}</button> {n.type==='follow'?'started following you':<>liked {n.book?<button className="text-button" onClick={()=>onBook(n.book!.id)}>{n.book.title||'your book'}</button>:'your book'}</>}<time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</time></p></li>)}</ul>
  {next&&<button className="outline-button" onClick={()=>void run(async()=>{const d=await api<{notifications:Note[];next:string|null}>('GET',`/notifications?cursor=${encodeURIComponent(next)}`);setNotes(n=>[...(n??[]),...d.notifications]);setNext(d.next)})}>Older</button>}
 </div>
}
