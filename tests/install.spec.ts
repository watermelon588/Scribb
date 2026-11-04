import {test,expect} from './fixtures'

test('the manifest makes Scribb installable, with square and maskable icons',async({page})=>{
 await page.goto('/')
 const session=await page.context().newCDPSession(page)
 const {errors,data}=await session.send('Page.getAppManifest')
 expect(errors.filter((e:{critical:number})=>e.critical)).toEqual([])
 const manifest=JSON.parse(data)
 expect(manifest).toMatchObject({id:'/',start_url:'/',scope:'/',display:'standalone'})
 expect(manifest.icons.some((icon:{purpose?:string})=>icon.purpose==='maskable')).toBe(true)
 for(const icon of manifest.icons){
  const bytes=await (await page.request.get(icon.src)).body(),size=Number(icon.sizes.split('x')[0])
  expect(bytes.subarray(1,4).toString()).toBe('PNG')
  expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([size,size])
 }
})

test('Install app uses the browser prompt and hides once installed',async({page})=>{
 await page.goto('/')
 await page.evaluate(()=>{
  const state=window as Window&{prompts?:number};state.prompts=0
  const event=new Event('beforeinstallprompt',{cancelable:true})
  Object.assign(event,{prompt:async()=>{state.prompts!++},userChoice:Promise.resolve({outcome:'accepted'})})
  dispatchEvent(event)
 })
 await page.getByRole('button',{name:'Install app',exact:true}).click()
 expect(await page.evaluate(()=>(window as Window&{prompts?:number}).prompts)).toBe(1)
 await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.evaluate(()=>dispatchEvent(new Event('appinstalled')))
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0)
})

test('without a browser prompt, instructions fit phones, close with Escape and follow the theme',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:'Switch to dark theme'}).click()
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900})
  if(width<=600 && !(await page.locator('#phone-information').evaluate(el=>el.matches(':popover-open'))))await page.getByRole('button',{name:'More options'}).click()
  const button=page.getByRole('button',{name:'Install app',exact:true})
  await button.click()
  const dialog=page.getByRole('dialog',{name:'Scribb on your home screen'})
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('Chrome or Edge')
  expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(button).toBeFocused()
 }
})

test('on an iPhone, Install app explains Add to Home Screen in Safari',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}))
 await page.goto('/')
 await page.getByRole('button',{name:'Install app',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog).toContainText('Add to Home Screen');await expect(dialog).toContainText('Open as Web App')
 await dialog.getByRole('button',{name:'Got it'}).click();await expect(dialog).not.toBeVisible()
})
