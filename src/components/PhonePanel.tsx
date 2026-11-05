import {createContext,useContext,useState,useSyncExternalStore,type ReactNode} from 'react'

const featureContext=createContext<string|null>(null)
const query='(max-width:600px)'
function subscribe(change:()=>void){const m=matchMedia(query);m.addEventListener('change',change);return ()=>m.removeEventListener('change',change)}
/** Keep desktop elements in their existing parents. On phones mount just the selected family of controls. */
export function PhonePanel({features,children}:{features:string[];children:ReactNode}){
 const phone=useSyncExternalStore(subscribe,()=>matchMedia(query).matches)
 const [choice,choose]=useState({family:'',name:''})
 if(!phone||!features.length)return <>{children}</>
 const family=features.join('|'),active=choice.family===family?choice.name:features[0]
 return <featureContext.Provider value={active}><div className="feature-deck">
  <div className="feature-tabs" role="group" aria-label="Tool features">{features.map(name=><button type="button" className="button-quiet" aria-pressed={active===name} key={name} onClick={()=>choose({family,name})}>{name}</button>)}</div>
  <div className="feature-options" role="group" aria-label={active+' options'} key={active}>{children}</div>
 </div></featureContext.Provider>
}
export function Part({name,children}:{name:string;children:ReactNode}){
 const active=useContext(featureContext)
 return active===null||active===name?<>{children}</>:null
}
