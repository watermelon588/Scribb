import {useEffect,useRef,useState} from 'react'
import {canDictate,dictate} from './voice'

/** Turn-based voice uses the same authenticated journal request, never an unauthenticated call endpoint. */
export function useJournalVoice(onQuestion:(text:string)=>Promise<string|undefined>,onTranscript:(text:string)=>void,onCancel:()=>void){
 const [state,setState]=useState<'off'|'listening'|'thinking'|'speaking'>('off'),[error,setError]=useState('')
 const callbacks=useRef({onQuestion,onTranscript,onCancel});callbacks.current={onQuestion,onTranscript,onCancel}
 const session=useRef(0),listening=useRef<(()=>void)|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),silence=useRef<ReturnType<typeof setTimeout>|null>(null)
 const supported=canDictate()&&'speechSynthesis' in window
 function cleanup(){session.current++;if(timer.current)clearTimeout(timer.current);if(silence.current)clearTimeout(silence.current);listening.current?.();listening.current=null;if('speechSynthesis' in window)speechSynthesis.cancel()}
 function stop(){cleanup();setState('off');callbacks.current.onCancel()}
 useEffect(()=>()=>cleanup(),[])
 function start(){
  if(!supported){setError('Voice conversation needs a browser with speech recognition and spoken replies. You can still type here.');return}
  cleanup();setError('');const id=session.current
  const valid=()=>id===session.current
  function fail(message:string){if(!valid())return;cleanup();setState('off');setError(message)}
  function speak(answer:string){
   if(!valid())return
   setState('speaking')
   const chunks=answer.match(/.{1,220}(?:\s|$)|\S{1,220}/gs)??[answer]
   function next(){
    if(!valid())return
    const text=chunks.shift();if(!text){listen();return}
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang=navigator.language
    const local=speechSynthesis.getVoices().find(v=>v.localService&&v.lang.split('-')[0]===navigator.language.split('-')[0]);if(local)utterance.voice=local
    utterance.onend=next;utterance.onerror=()=>fail('Spoken replies stopped. Your answer is still available as text.')
    speechSynthesis.speak(utterance)
   }
   next()
  }
  function listen(){
   if(!valid())return
   setState('listening');let text='',pending=false
   const send=async()=>{
    if(!valid()||pending||!text.trim())return
    pending=true;if(silence.current)clearTimeout(silence.current);if(timer.current)clearTimeout(timer.current)
    listening.current?.();listening.current=null;setState('thinking')
    try{const answer=await callbacks.current.onQuestion(text.trim());if(!valid())return;if(answer)speak(answer);else fail('The answer did not finish. Retry in the conversation, or start voice again.')}catch{fail('Voice conversation stopped. You can retry your question below.')}
   }
   // No silent background microphone sessions: one idle turn lasts at most 20 seconds.
   silence.current=setTimeout(()=>fail('No speech was heard. Tap the microphone to try again.'),20000)
   listening.current=dictate(navigator.language,(final,interim)=>{
    if(!valid()||pending)return
    if(final)text=[text,final].filter(Boolean).join(' ')
    if(text.length>500){fail('That question is longer than 500 characters. Please ask a shorter question.');return}
    callbacks.current.onTranscript([text,interim].filter(Boolean).join(' ').slice(0,500))
    if(timer.current)clearTimeout(timer.current)
    if(text&&!interim)timer.current=setTimeout(()=>void send(),1000)
   },message=>{if(valid()&&!pending&&message)fail(message)})
  }
  listen()
 }
 return {state,error,supported,start,stop,active:state!=='off'}
}
