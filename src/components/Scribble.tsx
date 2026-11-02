import rough from 'roughjs'
import type {ScribbleKind} from '../data/journal'

type Path = {d:string;stroke:string;strokeWidth:number;fill?:string}
const generator=rough.generator()
const cache=new Map<string,Path[]>()

// Every scribble is drawn from its stored seed, so it looks the same in the editor, the book and thumbnails.
function shapes(kind:ScribbleKind,w:number,h:number,seed:number){
 const line={seed,roughness:1.3,bowing:1.4,stroke:'currentColor',strokeWidth:3.2}
 const fill={...line,fill:'currentColor',fillStyle:'hachure',hachureGap:9,fillWeight:1.6}
 const pad=6,X=(n:number)=>pad+n*(w-2*pad)/100,Y=(n:number)=>pad+n*(h-2*pad)/100
 switch(kind){
  case 'underline':return [generator.curve([[X(0),Y(70)],[X(30),Y(42)],[X(66),Y(60)],[X(100),Y(34)]],line)]
  case 'box':return [generator.rectangle(X(0),Y(0),w-2*pad,h-2*pad,line)]
  case 'circle':return [generator.ellipse(w/2,h/2,w-2*pad,h-2*pad,line)]
  case 'heart':return [generator.path(`M${X(50)} ${Y(96)}C${X(14)} ${Y(70)} ${X(-2)} ${Y(44)} ${X(8)} ${Y(22)}C${X(18)} ${Y(2)} ${X(42)} ${Y(4)} ${X(50)} ${Y(26)}C${X(58)} ${Y(4)} ${X(82)} ${Y(2)} ${X(92)} ${Y(22)}C${X(102)} ${Y(44)} ${X(86)} ${Y(70)} ${X(50)} ${Y(96)}Z`,fill)]
  case 'star':return [generator.polygon(Array.from({length:10},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/5,r=i%2?.42:1;return [X(50+50*r*Math.cos(angle)),Y(54+50*r*Math.sin(angle))] as [number,number]}),line)]
  case 'smile':return [generator.ellipse(w/2,h/2,w-2*pad,h-2*pad,line),generator.ellipse(X(35),Y(38),w*.07,h*.09,{...line,fill:'currentColor',fillStyle:'solid'}),generator.ellipse(X(65),Y(38),w*.07,h*.09,{...line,fill:'currentColor',fillStyle:'solid'}),generator.arc(w/2,Y(56),w*.46,h*.36,Math.PI*.15,Math.PI*.85,false,line)]
  case 'arrow':return [generator.curve([[X(0),Y(78)],[X(34),Y(38)],[X(70),Y(48)],[X(97),Y(30)]],line),generator.linearPath([[X(78),Y(8)],[X(98),Y(30)],[X(76),Y(52)]],line)]
  case 'check':return [generator.linearPath([[X(0),Y(55)],[X(34),Y(96)],[X(100),Y(0)]],line)]
 }
}
function paths(kind:ScribbleKind,w:number,h:number,seed:number){
 const key=`${kind}-${w}-${h}-${seed}`
 let found=cache.get(key)
 if(!found){if(cache.size>400)cache.clear();found=shapes(kind,w,h,seed).flatMap(shape=>generator.toPaths(shape));cache.set(key,found)}
 return found
}

export function ScribbleArt({kind,w,h,seed}:{kind:ScribbleKind;w:number;h:number;seed:number}){
 return <svg className="j-scribble-art" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">{paths(kind,w,h,seed).map((path,i)=><path key={i} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill??'none'} strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
}
