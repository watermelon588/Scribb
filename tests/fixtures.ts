import {test as base,expect,type APIRequestContext,type BrowserContext} from '@playwright/test'
import {randomUUID} from 'node:crypto'

/** Creating needs an account, so every test signs up its own through the API before it starts.
 * The request shares the browser context's cookies, so the page opens signed in. */
export type Account={username:string;password:string}
let count=0
export async function signUp(context:BrowserContext,prefix='t'):Promise<Account>{
 const account={username:`${prefix}${Date.now().toString(36)}${(count++).toString(36)}`.slice(0,30),password:'test password 1'}
 const res=await context.request.post('/api/auth/register',{data:account})
 expect(res.status(),await res.text()).toBe(201)
 return account
}
type Seed={title:string;kind?:'sketchbook'|'journal';visibility?:'private'|'public';category?:string;design?:Record<string,unknown>;pages?:Record<string,unknown>[]}
/** Saves a book straight through the API, as the editor would. */
export async function seedBook(request:APIRequestContext,{title,kind='sketchbook',visibility='public',category,design={},pages}:Seed){
 const id=randomUUID()
 const res=await request.put(`/api/books/${id}`,{data:{kind,title,visibility,category,design:{presetId:kind==='journal'?'linen':'watercolor',color:'#5d6b4a',format:'3:4',paper:'plain',coverImage:'/covers/stripes-flat.png',...design},pages:pages??(kind==='journal'?[]:[{id:'a1',src:'/artworks/roses.jpg',title:'Roses',artist:'',medium:'',layout:'page'}]),version:0}})
 expect(res.status(),await res.text()).toBe(201)
 return id
}

export const test=base.extend<{account:Account}>({
 account:[async({context},use)=>{await use(await signUp(context))},{auto:true}],
})
export {expect}

const journalDesign={font:'book',size:'m',ink:'#262826',rule:'lined',about:'',created:'2026-11-02'}
/** A journal and its entries, saved through the API. Editor-only fields go in `extras`, as the app sends them. */
export async function seedJournal(request:APIRequestContext,title:string,entries:Record<string,unknown>[],design:Record<string,unknown>={},visibility:'private'|'public'='private'){
 const book=await seedBook(request,{title,kind:'journal',visibility,design:{journal:journalDesign,...design}})
 for(const {id=randomUUID(),date='2026-11-02',layout='writing',texts={},images={},...extras} of entries){
  const res=await request.put(`/api/entries/${id}`,{data:{bookId:book,date,layout,texts,images,extras,version:0}})
  expect(res.status(),await res.text()).toBe(201)
 }
 return book
}
/** The six sample sketchbooks the portfolio tests expect, created oldest first so the newest-first list keeps this order. */
export async function seedShelf(request:APIRequestContext){
 for(const title of ['Quiet observations','A study in blue','Things that bloom','The everyday','Small worlds','A little summer'].reverse())await seedBook(request,{title,visibility:'private'})
}
