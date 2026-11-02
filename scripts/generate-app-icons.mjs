// Reproducible raster exports of our existing notebook mark, with a mask-safe inset.
import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const directory=new URL('../public/icons/',import.meta.url)
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'})
try{
 for(const [file,size] of [['app-192.png',192],['app-512.png',512],['app-maskable-512.png',512],['apple-touch-icon.png',180]]){
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1})
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#43533b"/><rect x="29" y="23" width="44" height="54" rx="3" fill="#faf9f6"/><path d="M38 23v54M47 39h17M47 46h12" fill="none" stroke="#43533b" stroke-width="2"/></svg>`)
  await page.screenshot({path:fileURLToPath(new URL(file,directory))})
  await page.close()
 }
}finally{await browser.close()}
