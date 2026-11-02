// The browser's own speech recognition. Not in TypeScript's DOM types, so only the part used is typed.
type Result = {isFinal:boolean;0:{transcript:string}}
type Recognition = {lang:string;continuous:boolean;interimResults:boolean;start():void;stop():void;onresult:((e:{resultIndex:number;results:ArrayLike<Result>})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null}
type Engine = new()=>Recognition

const engine=()=>{const w=window as unknown as {SpeechRecognition?:Engine;webkitSpeechRecognition?:Engine};return w.SpeechRecognition??w.webkitSpeechRecognition}
export const canDictate=()=>isSecureContext&&Boolean(engine())

const MESSAGES:Record<string,string>={
 'not-allowed':'Microphone access is blocked for this site.',
 'service-not-allowed':'Voice typing is not available in this browser.',
 'audio-capture':'No microphone was found.',
 network:'Voice typing needs an internet connection in this browser.',
 'language-not-supported':'Voice typing does not support this language here.',
}

/** Listens until stopped. Browsers end a session after silence, so a new one starts; finished phrases are reported once, so nothing repeats. */
export function dictate(lang:string,onText:(final:string,interim:string)=>void,onStop:(error?:string)=>void){
 const Speech=engine()!
 // Android repeats earlier phrases in continuous mode, so it listens one phrase at a time and restarts.
 const continuous=!/Android/i.test(navigator.userAgent)
 let live=true,failed:string|undefined,current:Recognition|null=null,quick=0,started=0
 function start(){
  const recognition=new Speech()
  recognition.lang=lang;recognition.continuous=continuous;recognition.interimResults=true
  recognition.onresult=e=>{
   let final='',interim=''
   for(let i=e.resultIndex;i<e.results.length;i++){const text=e.results[i][0].transcript;if(e.results[i].isFinal)final+=text;else interim+=text}
   onText(final.trim(),interim.trim())
  }
  recognition.onerror=e=>{if(e.error==='no-speech'||e.error==='aborted')return;live=false;failed=MESSAGES[e.error]??'Voice typing stopped.'}
  recognition.onend=()=>{
   // A session that keeps ending at once would restart forever.
   quick=Date.now()-started<1000?quick+1:0
   if(live&&quick<3)start();else onStop(failed??(live?'Voice typing stopped.':undefined))
  }
  started=Date.now();current=recognition
  try{recognition.start()}catch{live=false;onStop('Voice typing could not start.')}
 }
 start()
 return ()=>{live=false;current?.stop()}
}
