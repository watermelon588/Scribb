import {useEffect,useRef,useState,type FormEvent} from 'react'
import {BehanceLogo,CaretDown,DribbbleLogo,GlobeSimple,InstagramLogo,LinkedinLogo,PaintBrush,PinterestLogo,Plus,TiktokLogo,X,XLogo,YoutubeLogo,type Icon} from '@phosphor-icons/react'
import {AVATARS,LINK_KINDS,api,avatarSrc,message,type LinkKind,type Person,type User} from '../lib/api'
import type {Notify} from './Notice'

/** Sign-in, password reset, settings and notifications. Each renders inside the portfolio dialog. */
const GOOGLE_CLIENT_ID=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined
type Google={accounts:{id:{initialize(o:{client_id:string;callback:(r:{credential:string})=>void}):void;renderButton(el:HTMLElement,o:Record<string,unknown>):void}}}

function useBusy(onNotice?:Notify){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 async function run(task:()=>Promise<void>){setBusy(true);setError('');try{await task()}catch(e){const text=message(e);setError(text);onNotice?.(text,'error')}finally{setBusy(false)}}
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

export function SignIn({initial='signin',onUser,onLegal,onNotice}:{initial?:'signin'|'signup';onUser:(u:User)=>void;onLegal?:()=>void;onNotice?:Notify}){
 const [mode,setMode]=useState<'signin'|'signup'|'forgot'>(initial),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[sent,setSent]=useState(false)
 const {busy,error,run,setError}=useBusy(onNotice)
 function submit(e:FormEvent){e.preventDefault();void run(async()=>{
  if(mode==='forgot'){await api('POST','/auth/forgot',{email});setSent(true);return}
  onUser((await api<{user:User}>('POST',mode==='signup'?'/auth/register':'/auth/login',{username,password})).user)
  if(mode==='signup')onNotice?.('Account created successfully. Welcome to Scribb!','success')
 })}
 function switchTo(next:typeof mode){if(next==='forgot'&&username.includes('@'))setEmail(username.trim());setMode(next);setError('');setSent(false)}
 if(mode==='forgot')return <form className="account-form" onSubmit={submit}><img className="brand-mark account-mark" src="/brand/scribb-mark.png" alt="" width="56" height="56"/><h2>Reset your password</h2>
  <p className="form-note">Enter the verified email on the account you want to recover.</p>
  <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSent(false)}}/></label>
  {sent&&<p className="form-note" role="status">If this address is verified on Scribb, check its inbox and Spam for a reset link. The link expires in one hour.</p>}
  <Problem text={error}/><button className="button-primary" disabled={busy}>{busy?'Sending…':sent?'Resend reset link':'Send reset link'}</button>
  <button type="button" className="button-link" onClick={()=>switchTo('signin')}>Back to sign in</button></form>
 return <form className="account-form" onSubmit={submit}><img className="brand-mark account-mark" src="/brand/scribb-mark.png" alt="" width="56" height="56"/><h2>{mode==='signup'?'Create your account':'Sign in to Scribb'}</h2>
  <GoogleButton onUser={onUser}/>
  <label>{mode==='signup'?'Username':'Username or verified email'}<input autoComplete="username" required minLength={3} maxLength={mode==='signup'?30:254} autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(mode==='signup'?e.target.value.toLowerCase():e.target.value)} pattern={mode==='signup'?'[a-z0-9._]{3,30}':undefined}/></label>
  <label>Password<input type="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?8:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {mode==='signup'&&<p className="form-note">No email needed. You can add one later in Settings to reset your password.</p>}
  {mode==='signup'&&<p className="account-legal">By creating an account, you agree to the <a href="#terms" onClick={onLegal}>Terms</a> and acknowledge the <a href="#privacy" onClick={onLegal}>Privacy notice</a>.</p>}
  <Problem text={error}/><button className="button-primary" disabled={busy}>{busy?'One moment…':mode==='signup'?'Create account':'Sign in'}</button>
  <div className="form-switch">{mode==='signin'?<><button type="button" className="button-link" onClick={()=>switchTo('signup')}>Create an account</button><button type="button" className="button-link" onClick={()=>switchTo('forgot')}>Forgot password?</button></>:<button type="button" className="button-link" onClick={()=>switchTo('signin')}>I already have an account</button>}</div>
 </form>
}

export function ResetPassword({token,onUser,onNotice}:{token:string;onUser:(u:User)=>void;onNotice?:Notify}){
 const [password,setPassword]=useState(''),{busy,error,run}=useBusy(onNotice)
 return <form className="account-form" onSubmit={e=>{e.preventDefault();void run(async()=>onUser((await api<{user:User}>('POST','/auth/reset',{token,password})).user))}}><h2>Choose a new password</h2>
  <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <p className="form-note">Every device signed in to your account will be signed out.</p><Problem text={error}/><button className="button-primary" disabled={busy}>{busy?'Saving…':'Save password'}</button></form>
}

const LINK_ICONS:Record<LinkKind,Icon>={website:GlobeSimple,instagram:InstagramLogo,behance:BehanceLogo,cara:PaintBrush,x:XLogo,youtube:YoutubeLogo,pinterest:PinterestLogo,dribbble:DribbbleLogo,tiktok:TiktokLogo,linkedin:LinkedinLogo}
export const linkName=(kind:LinkKind)=>LINK_KINDS.find(([k])=>k===kind)![1]
export function LinkIcon({kind,size=18}:{kind:LinkKind;size?:number}){const Glyph=LINK_ICONS[kind];return <Glyph size={size} aria-hidden="true"/>}

type LinkRow={id:string;kind:LinkKind;url:string}
/** One row per link: a platform icon that opens the icon menu, the address and a remove button. Each platform is used once. */
function LinkEditor({rows,onChange}:{rows:LinkRow[];onChange:(rows:LinkRow[])=>void}){
 const [picking,setPicking]=useState<string|null>(null)
 const used=new Set(rows.map(r=>r.kind)),free=LINK_KINDS.find(([k])=>!used.has(k))?.[0]
 const set=(id:string,patch:Partial<LinkRow>)=>onChange(rows.map(r=>r.id===id?{...r,...patch}:r))
 return <fieldset className="link-editor" onKeyDown={e=>{if(e.key==='Escape'&&picking){e.preventDefault();e.stopPropagation();setPicking(null)}}}><legend>Links</legend>
  {rows.map(row=><div className="link-row" key={row.id} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPicking(p=>p===row.id?null:p)}}>
   <button type="button" className="link-kind" aria-label={`${linkName(row.kind)}, choose platform`} aria-expanded={picking===row.id} data-hint="Platform" onClick={()=>setPicking(picking===row.id?null:row.id)}><LinkIcon kind={row.kind}/><CaretDown size={11} weight="bold" aria-hidden="true"/></button>
   <input type="url" aria-label={`${linkName(row.kind)} address`} placeholder={`${linkName(row.kind)} · https://`} maxLength={200} value={row.url} onChange={e=>set(row.id,{url:e.target.value})}/>
   <button type="button" className="link-remove" aria-label={`Remove ${linkName(row.kind)} link`} data-hint="Remove" onClick={()=>onChange(rows.filter(r=>r.id!==row.id))}><X size={15}/></button>
   {picking===row.id&&<div className="link-menu" role="group" aria-label="Platform">{LINK_KINDS.map(([kind,name])=><button type="button" key={kind} aria-label={name} data-hint={name} aria-pressed={row.kind===kind} disabled={kind!==row.kind&&used.has(kind)} onClick={()=>{set(row.id,{kind});setPicking(null)}}><LinkIcon kind={kind}/></button>)}</div>}
  </div>)}
  {free&&<button type="button" className="link-add" onClick={()=>{const id=crypto.randomUUID();onChange([...rows,{id,kind:free,url:''}]);setPicking(id)}}><Plus size={15}/> Add link</button>}
 </fieldset>
}

export function Settings({user,person,onUser,onPerson,onSignedOut,onNotice}:{user:User;person:Person;onUser:(u:User)=>void;onPerson:(p:Person)=>void;onSignedOut:()=>void;onNotice:Notify}){
 const [form,setForm]=useState({username:person.username,bio:person.bio,avatar:person.avatar})
 const [rows,setRows]=useState<LinkRow[]>(()=>LINK_KINDS.filter(([k])=>person.links[k]).map(([kind])=>({id:kind,kind,url:person.links[kind]!})))
 const pendingEmail=user.pendingEmail??null
 const [email,setEmail]=useState(pendingEmail??user.email??''),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
 const profile=useBusy(onNotice),mail=useBusy(onNotice),secret=useBusy(onNotice),danger=useBusy(onNotice),session=useBusy(onNotice)
 const address=email.trim().toLowerCase(),alreadyVerified=user.emailVerified&&address===user.email
 // Profiles show the username only, so the display name follows it.
 const links=Object.fromEntries(rows.filter(r=>r.url.trim()).map(r=>[r.kind,r.url.trim()]))
 return <div className="account-settings"><h2>Settings</h2>
  <form className="account-form profile-form" onSubmit={e=>{e.preventDefault();void profile.run(async()=>{const {profile:p}=await api<{profile:Person}>('PATCH','/me/profile',{...form,displayName:form.username,links});onPerson(p);onUser({...user,username:p.username,displayName:p.displayName,avatar:p.avatar});onNotice('Profile saved successfully.','success')})}}>
   <h3>Profile</h3>
   <div className="profile-card"><img src={avatarSrc(form.avatar)} alt=""/><div><strong>@{form.username||'username'}</strong><span>{form.bio||'A line about you'}</span></div></div>
   <fieldset className="avatar-choices"><legend>Profile picture</legend>{[...AVATARS,...(user.isCreator?['mine']:[])].map(id=><button type="button" key={id} aria-label={id==='mine'?'Mine, creator profile picture':`Profile picture ${Number(id.slice(1))}`} aria-pressed={form.avatar===id} onClick={()=>setForm({...form,avatar:id})}><img src={avatarSrc(id)} alt=""/></button>)}</fieldset>
   <label>Username<span className="handle-field"><span aria-hidden="true">@</span><input required minLength={3} maxLength={30} pattern="[a-z0-9._]{3,30}" autoCapitalize="none" spellCheck={false} value={form.username} onChange={e=>setForm({...form,username:e.target.value.toLowerCase()})}/></span></label>
   <label>Bio<input maxLength={300} placeholder="A line about you" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
   <LinkEditor rows={rows} onChange={setRows}/>
   <Problem text={profile.error}/><button className="button-primary" disabled={profile.busy}>{profile.busy?'Saving…':'Save profile'}</button>
  </form>
  <form className="account-form" onSubmit={e=>{e.preventDefault();void mail.run(async()=>{const result=await api<{alreadyVerified?:boolean}>('PUT','/me/email',{email:address});if(!result.alreadyVerified)onUser({...user,pendingEmail:address});onNotice(result.alreadyVerified?'This email is already verified.':`Verification link sent to ${address}. Check your inbox and spam folder.`,result.alreadyVerified?'info':'success')})}}>
   <h3>Email</h3><p className="form-note">{user.emailVerified?`Password recovery uses ${user.email}.`:'Verify an email to recover your account and use Scribb AI.'}</p>
   {pendingEmail&&<p className="form-note" role="status">Verification pending for {pendingEmail}.</p>}
   <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <Problem text={mail.error}/><button className="button-secondary" disabled={mail.busy||alreadyVerified}>{mail.busy?'Sending…':alreadyVerified?'Email verified':address===pendingEmail?'Resend verification link':'Verify email'}</button>
  </form>
  <form className="account-form" onSubmit={e=>{e.preventDefault();void secret.run(async()=>{const {user:u}=await api<{user:User}>('PUT','/me/password',{current,password});onUser(u);setCurrent('');setPassword('');onNotice('Password saved successfully. Other devices are signed out.','success')})}}>
   <h3>{user.hasPassword?'Change password':'Add a password'}</h3>
   {!user.hasPassword&&<p className="form-note">Add a password to sign in to this account with your username{user.emailVerified?' or verified email':''}. You can keep using Google.</p>}
   {user.hasPassword&&<label>Current password<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>}
   <label>New password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <Problem text={secret.error}/><button className="button-secondary" disabled={secret.busy}>{secret.busy?'Saving…':'Save password'}</button>
  </form>
  <div className="account-form"><h3>Session</h3><Problem text={session.error}/><button type="button" className="button-secondary" disabled={session.busy} onClick={()=>void session.run(async()=>{await api('POST','/auth/logout');onSignedOut();onNotice('Signed out successfully.','success')})}>{session.busy?'Signing out…':'Sign out'}</button></div>
  <form className="account-form danger-zone" onSubmit={e=>{e.preventDefault();if(!window.confirm('Delete your account, every book and every journal? This cannot be undone.'))return;void danger.run(async()=>{await api('DELETE','/me',user.hasPassword?{password:confirm}:{confirm});onSignedOut();onNotice('Your account was deleted successfully.','success')})}}>
   <h3>Delete account</h3><p className="form-note">Removes your profile, books, journals, likes and follows.</p>
   <label>{user.hasPassword?'Password':'Type your username to confirm'}<input type={user.hasPassword?'password':'text'} autoComplete={user.hasPassword?'current-password':'off'} required maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   <Problem text={danger.error}/><button className="button-secondary" disabled={danger.busy}>{danger.busy?'Deleting…':'Delete account'}</button>
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
   <p><button className="button-link" onClick={()=>onPerson(n.actor.username)}>{n.actor.displayName||n.actor.username}</button> {n.type==='follow'?'started following you':<>liked {n.book?<button className="button-link" onClick={()=>onBook(n.book!.id)}>{n.book.title||'your book'}</button>:'your book'}</>}<time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</time></p></li>)}</ul>
  {next&&<button className="button-secondary" onClick={()=>void run(async()=>{const d=await api<{notifications:Note[];next:string|null}>('GET',`/notifications?cursor=${encodeURIComponent(next)}`);setNotes(n=>[...(n??[]),...d.notifications]);setNext(d.next)})}>Older</button>}
 </div>
}
