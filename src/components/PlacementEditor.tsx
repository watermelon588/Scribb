import ArtworkCropper from './ArtworkCropper'
import {useRef, useState, type CSSProperties, type PointerEvent} from 'react'
import {ArrowsOutSimple, ArrowCounterClockwise, Minus, Plus, Crop} from '@phosphor-icons/react'
import type {Placement} from '../data/presets'

export const defaultPlacement:Placement = {x:0,y:0,scale:1}
export function placementStyle(value:Placement = defaultPlacement):CSSProperties {
 return {transform:`translate(${value.x}%, ${value.y}%) scale(${value.scale})`}
}
export default function PlacementEditor({src,value=defaultPlacement,onChange,ratio=0.75,cover=false,spread=false,onCrop}:{src:string;value?:Placement;onChange:(v:Placement)=>void;ratio?:number;cover?:boolean;spread?:boolean;onCrop?:(src:string)=>void}){
 const [cropping,setCropping]=useState(false)
 const surface=useRef<HTMLDivElement>(null), image=useRef<HTMLImageElement>(null), outline=useRef<HTMLDivElement>(null)
 const active=useRef<{x:number;y:number;value:Placement;resize:boolean}|null>(null)
 const pending=useRef(value)
 const clamp=(v:Placement)=>{const scale=Math.max(cover?1:.3,Math.min(cover?3:1.8,v.scale));const max=cover?(scale-1)*50:35;return{scale,x:Math.max(-max,Math.min(max,v.x)),y:Math.max(-max,Math.min(max,v.y))}}
 function paint(v:Placement){pending.current=clamp(v);const t=placementStyle(pending.current).transform!;if(image.current)image.current.style.transform=t;if(outline.current)outline.current.style.transform=t}
 function start(e:PointerEvent,resize=false){e.preventDefault();e.stopPropagation();active.current={x:e.clientX,y:e.clientY,value,resize};pending.current=value;surface.current?.setPointerCapture(e.pointerId)}
 function finish(){if(!active.current)return;active.current=null;onChange(pending.current)}
 function update(v:Placement){onChange(clamp(v))}
 if(cropping && onCrop)return <ArtworkCropper src={src} onApply={src=>{onCrop(src);setCropping(false)}} onClose={()=>setCropping(false)}/>
 return <div className="placement-editor"><div className={`placement-surface ${cover?'placement-cover':'placement-paper'} ${spread?'placement-spread':''}`} style={{aspectRatio:ratio}} ref={surface} tabIndex={0} role="group" aria-label={cover?'Position cover image':'Position artwork'} onPointerDown={e=>start(e)} onPointerMove={e=>{const a=active.current;if(!a||!surface.current)return;const box=surface.current.getBoundingClientRect();const dx=(e.clientX-a.x)/box.width,dy=(e.clientY-a.y)/box.height;paint(a.resize?{...a.value,scale:a.value.scale+dx*2}:{...a.value,x:a.value.x+dx*100,y:a.value.y+dy*100})}} onPointerUp={finish} onPointerCancel={()=>{active.current=null;paint(value)}} onLostPointerCapture={finish} onKeyDown={e=>{const moves:Record<string,[number,number]>={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]};if(moves[e.key]){e.preventDefault();update({...value,x:value.x+moves[e.key][0],y:value.y+moves[e.key][1]})}}}>
 <img ref={image} src={src} alt="Drag to position" draggable={false} style={placementStyle(value)}/><div ref={outline} className="placement-outline" style={placementStyle(value)}/><button className="placement-resize" title="Drag to resize" aria-label="Drag to resize image" onPointerDown={e=>start(e,true)}><ArrowsOutSimple size={15}/></button>{spread&&<i className="placement-gutter"/>}</div>
 <div className="placement-tools">{onCrop&&<button title="Crop artwork" aria-label="Crop artwork" onClick={()=>setCropping(true)}><Crop size={19}/></button>}<Minus size={14}/><input type="range" aria-label={cover?'Cover image size':'Artwork size'} min={cover?1:.3} max={cover?3:1.8} step=".01" value={value.scale} onChange={e=>update({...value,scale:Number(e.target.value)})}/><Plus size={14}/><button title="Reset placement" aria-label="Reset placement" onClick={()=>onChange(defaultPlacement)}><ArrowCounterClockwise size={17}/></button></div></div>
}

