import type {Icon} from '@phosphor-icons/react'

export type Tool={id:string;name:string;Icon:Icon}
/** Phones only: the editor's tools as one row of icons under the thumb. One panel opens at a time; tapping the open tool closes it. */
export default function PhoneTools({tools,value,onChange}:{tools:Tool[];value:string|null;onChange:(id:string|null)=>void}){
 return <nav className="phone-tools" aria-label="Tools">{tools.map(({id,name,Icon})=><button key={id} type="button" aria-pressed={value===id} onClick={()=>onChange(value===id?null:id)}><Icon size={22} weight={value===id?'regular':'light'}/><span>{name}</span></button>)}</nav>
}
/** Marks an element as one tool's panel. Phones show only the open tool's panels; wider screens ignore both attributes. */
export const panelOf=(open:string|null)=>(id:string)=>({'data-panel':id,'data-on':open===id||undefined})
