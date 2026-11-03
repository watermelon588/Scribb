/** Only web links are kept, so a stored link can never run script. */
export function safeLink(value?:string|null){
 try{const url=new URL(value??'');return url.protocol==='https:'||url.protocol==='http:'?url.href:''}catch{return ''}
}

/** Journal text is stored as a small allow-listed HTML subset. Everything else is dropped,
 * so stored or pasted markup can never reach the page as live elements. */
const inline:Record<string,string>={B:'b',STRONG:'b',I:'i',EM:'i',U:'u',MARK:'mark'}
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/ /g,' ')
function walk(node:Node):string{
 let out=''
 node.childNodes.forEach(child=>{
  if(child.nodeType===Node.TEXT_NODE){out+=escape((child.textContent??'').replace(/​/g,''));return}
  if(child.nodeType!==Node.ELEMENT_NODE)return
  const element=child as HTMLElement,inner=walk(element),tag=inline[element.tagName]
  if(element.tagName==='BR')out+='<br>'
  else if(tag)out+=inner&&`<${tag}>${inner}</${tag}>`
  else if(element.tagName==='A'){const href=safeLink(element.getAttribute('href'));out+=href&&inner?`<a href="${escapeText(href)}" target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`:inner}
  else if(element.tagName==='DIV'||element.tagName==='P')out+=(out&&!out.endsWith('<br>')?'<br>':'')+inner
  else out+=inner
 })
 return out
}
export function sanitize(html:string){return walk(new DOMParser().parseFromString(html,'text/html').body).replace(/(<br>)+$/,'')}
export function wordCount(html=''){return html.replace(/<br>/g,' ').replace(/<[^>]+>/g,'').trim().split(/\s+/).filter(Boolean).length}

/** Plain text, such as speech, made safe to place in journal HTML. */
export const escapeText=(text:string)=>text.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`)
