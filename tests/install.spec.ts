import {test,expect} from './fixtures'

test('the install manifest has valid app metadata and downloadable icons',async({page})=>{
 await page.goto('/')
 const session=await page.context().newCDPSession(page)
 const {errors,data}=await session.send('Page.getAppManifest')
 expect(errors.filter((e:{critical:number})=>e.critical)).toEqual([])
 const manifest=JSON.parse(data)
 expect(manifest.display).toBe('standalone')
 expect(manifest.start_url).toBe('/')
 for(const icon of manifest.icons){
  const response=await page.request.get(icon.src)
  expect(response.ok()).toBe(true)
  const bytes=await response.body(),size=Number(icon.sizes.split('x')[0])
  expect(bytes.subarray(1,4).toString()).toBe('PNG')
  expect(bytes.readUInt32BE(16)).toBe(size)
  expect(bytes.readUInt32BE(20)).toBe(size)
 }
})

test('Install app uses the browser prompt and hides after installation',async({page})=>{
 await page.goto('/')
 await page.evaluate(()=>{
  const state=window as Window&{promptCalls?:number}
  state.promptCalls=0
  const event=new Event('beforeinstallprompt',{cancelable:true})
  Object.assign(event,{prompt:async()=>{state.promptCalls!++},userChoice:Promise.resolve({outcome:'accepted'})})
  window.dispatchEvent(event)
 })
 await page.getByRole('button',{name:'Install app',exact:true}).click()
 expect(await page.evaluate(()=>(window as Window&{promptCalls?:number}).promptCalls)).toBe(1)
 await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')))
 await expect(page.getByRole('button',{name:'Install app',exact:true})).toHaveCount(0)
})

test('installation instructions fit phones, support Escape and follow the theme',async({page})=>{
 await page.goto('/')
 await page.getByRole('button',{name:'Switch to dark theme'}).click()
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900})
  const button=page.getByRole('button',{name:'Install app',exact:true})
  await button.click()
  const dialog=page.getByRole('dialog',{name:'A place on your home screen.'})
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Internet is needed')
  expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`.impeccable/review/install-dark-${width}.png`})
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(button).toBeFocused()
 }
})

test('iPhone installation explains Safari Add to Home Screen',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}))
 await page.goto('/')
 await page.getByRole('button',{name:'Install app',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog).toContainText('Safari')
 await expect(dialog).toContainText('Add to Home Screen')
 await expect(dialog).toContainText('Open as Web App')
 await dialog.getByRole('button',{name:'Got it'}).click()
 await expect(dialog).not.toBeVisible()
})
