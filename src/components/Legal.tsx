import {ArrowLeft,CaretRight,ChatCircleText,DownloadSimple,Info,Scroll,ShieldCheck,SignIn,type Icon} from '@phosphor-icons/react'
import Avatar from './Avatar'
import InstallApp from './InstallApp'
import Feedback from './Feedback'
const geminiTerms='https://ai.google.dev/gemini-api/terms'
export function SiteFooter(){
 const links = <nav aria-label="Information"><a href="#ask">Ask my journal</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="/about/">About</a><Feedback/><InstallApp/></nav>

 return <footer className="site-footer"><span className="footer-brand"><img className="brand-mark" src="/brand/scribb-mark.png" alt="" width="22" height="22"/><b>Scribb</b> A space of your own.</span>{links}</footer>
}

const settingsLinks=[
 {label:'About',href:'/about/',icon:Info},
 {label:'Terms',href:'#terms',icon:Scroll},
 {label:'Privacy',href:'#privacy',icon:ShieldCheck},
]

function SettingsLabel({icon:Glyph,label}:{icon:Icon;label:string}){
 return <><Glyph size={20} className="settings-row-icon" aria-hidden="true"/><span>{label}</span><CaretRight size={16} aria-hidden="true"/></>
}

export function PhoneSettings({username,avatar,onAccount,onBack}:{username?:string;avatar?:string;onAccount:()=>void;onBack:()=>void}){
 return <main className="phone-settings">
  <header className="phone-settings-header"><button className="button-icon" data-hint="Back" aria-label="Back to portfolio" onClick={onBack}><ArrowLeft size={20}/></button><h1>Settings</h1></header>
  <section>
   <h2>Account</h2>
   <button className="button-quiet settings-account" onClick={onAccount}>{username?<><Avatar avatar={avatar} sizes="48px"/><span>Profile settings<small>@{username}</small></span><CaretRight size={16} aria-hidden="true"/></>:<SettingsLabel icon={SignIn} label="Sign in"/>}</button>
  </section>
  <section>
   <h2>Scribb</h2>
   <nav className="settings-rows" aria-label="Information">
    {settingsLinks.map(({label,href,icon})=><a key={label} className="button-quiet" href={href}><SettingsLabel icon={icon} label={label}/></a>)}
    <Feedback trigger={<SettingsLabel icon={ChatCircleText} label="Feedback"/>}/>
    <InstallApp trigger={<SettingsLabel icon={DownloadSimple} label="Install app"/>}/>
   </nav>
  </section>
 </main>
}

export default function Legal({page}:{page:'privacy'|'terms'}){
 const privacy=page==='privacy'
 return <main className="reading-page"><header className="reading-heading"><h1>{privacy?'Your privacy.':'Terms of use.'}</h1><p>{privacy?'What you share, what stays private, and how your words are handled.':'A few things to know about making this space your own.'}</p><span>Last updated <time dateTime="2026-11-02">2 November 2026</time></span></header>
 <article className="legal-copy">{privacy?<>
  <section><h2>Your books start private</h2><p>New sketchbooks and journals are private. Your account can access them; other visitors cannot read them unless you publish them. Your username, profile picture, public profile details, published books and public social activity can be seen by others. Publishing makes a book accessible to anyone, who may copy or share it.</p></section>
  <section><h2>What is stored</h2><p>The service stores your account details, profile, books, journal entries, uploaded images, likes, saves and follows. Passwords are stored as hashes. If you use Google sign-in, the service receives the account details needed to identify you. An optional email is used for verification and password recovery.</p><p>A session cookie keeps you signed in. Unsaved drafts are stored in this browser, separately for each account. Appearance and view preferences also stay on your device. A private book is access-controlled; it is not end-to-end encrypted. Avoid using a shared device for private writing.</p></section>
  <section id="privacy-ai"><h2>Before you ask your journal</h2><p>AI is optional and starts only after you turn it on and ask a question. Your question, recent conversation and relevant text from your saved journal entries are processed by the AI service on Render and Google’s Gemini API to prepare an answer. Images and unsaved drafts are not used for journal questions.</p><p>The current integration uses Gemini’s free tier. Google may use submitted content and responses to improve its products, and human reviewers may process them. Google says not to submit sensitive, confidential or personal information to unpaid services. Do not enable this feature for journals containing that information.</p><p>You can turn AI off in Ask my journal at any time. This stops future requests; it cannot recall information already sent to a provider. Conversations are held in page memory and are cleared when you leave the panel or reload. The AI service does not save a conversation history. Provider processing and retention follow <a href={geminiTerms} target="_blank" rel="noopener noreferrer">Google’s Gemini API terms</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s Privacy Policy</a>. AI requires a verified email, is for adults aged 18 or over, and may be unavailable in your region.</p></section>
  <section><h2>Services that help this space work</h2><p>When configured, Vercel hosts the app, Neon stores account and book records, Cloudinary stores uploaded images, and Resend delivers verification and recovery emails. Google handles Google sign-in. These providers process information needed for their role and may process it outside your country. Hosting services may also process technical request information for security and operation.</p><p>If you choose voice typing, your browser may send audio to its speech-recognition provider. A notice appears while listening. Voice in Ask my journal works the same way: your browser turns speech into a typed question and reads the answer aloud, and Scribb never receives or stores audio.</p></section>
  <section><h2>Removing your work</h2><p>You can update your profile and delete your account in Settings. Account deletion removes account and book records, journal entries and social activity from the active database. Uploaded image files are not yet automatically removed from the image host. Copies others have made, provider logs and backups may remain under their retention rules. AI data already sent to a provider is subject to that provider’s terms.</p><p>Device drafts can remain in browser storage after signing out or deleting an account. Clear this site’s browser data on a shared device. Keep your own copy of anything you cannot afford to lose.</p></section>
 </>:<>
  <section><h2>Using your account</h2><p>These terms cover your use of this sketchbook and journaling service. By creating an account or using the service, you agree to them and acknowledge the <a href="#privacy">Privacy page</a>. Keep your password secure and use an account you are authorized to access. You are responsible for activity through your account.</p></section>
  <section><h2>Your work remains yours</h2><p>You keep ownership of the writing and artwork you upload. You give the service permission to store, process and display that work as needed to provide the features you choose. Publishing permits it to be displayed publicly; it does not transfer your ownership. Only upload material you own or have permission to use, including pictures of other people.</p></section>
  <section><h2>Respect other people’s space</h2><p>Do not upload unlawful material, infringe someone else’s rights, impersonate others, harass people, or attempt to access private books or accounts. Do not bypass security, usage limits or provider restrictions. Access or content may be restricted when needed to protect the service and its users.</p></section>
  <section><h2>Optional AI</h2><p>Ask my journal is available only to adults aged 18 or over with a verified email who explicitly enable it. It uses saved journal text and external AI services, including Gemini’s free tier. Read the <a href="#privacy">AI privacy notice</a> before enabling it. Do not submit sensitive, confidential or personal information. Availability depends on your region, provider capacity and usage limits.</p><p>AI can misunderstand, omit details or invent information. Check answers against your original writing. It is a reflection aid and is not professional advice or an emergency service. Provider rules also apply, including the <a href={geminiTerms} target="_blank" rel="noopener noreferrer">Gemini API terms</a>. Turning AI off stops future requests but does not undo previous processing.</p></section>
  <section><h2>Availability and your copies</h2><p>The service is still being developed. Features may change or be interrupted, and saving can fail. A draft stored in your browser is not a backup. Keep separate copies of important work. The service is offered as available, without a promise that it will always be uninterrupted or error-free. Nothing here excludes rights or responsibilities that cannot be excluded under applicable law.</p></section>
  <section><h2>Leaving or changes to these terms</h2><p>You can stop using the service at any time and delete your account in Settings. The <a href="#privacy">Privacy page</a> explains current deletion limits. This page will show a new update date when the terms change; material changes should be reviewed before you continue using the affected feature.</p></section>
 </>}</article>
 <a className="reading-back" href="#portfolio">Back to your portfolio</a></main>
}
