import {test,expect} from './fixtures'

const avatarAsset=(id:string)=>new RegExp(`/avatar-${id}-(128|256|512)(-[\\w-]+)?\\.webp`)

test('public PFP cutouts replace placeholders and save without offering Mine',async({page})=>{
 await page.goto('/')
 await expect(page.locator('.creator-badge')).toHaveCount(0)
 await page.getByRole('button',{name:'Edit artist profile'}).click()
 const choices=page.locator('.avatar-choices button')
 await expect(choices).toHaveCount(12)
 await expect(page.getByRole('button',{name:'Mine, creator profile picture'})).toHaveCount(0)
 await expect.poll(()=>choices.locator('img').evaluateAll(images=>images.every(image=>image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0&&new URL(image.currentSrc).pathname.endsWith('.webp')))).toBe(true)
 await page.getByRole('button',{name:'Profile picture 10',exact:true}).click()
 await page.getByRole('button',{name:'Save profile',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Profile saved')
 await page.getByRole('button',{name:'Close dialog'}).click()
 await page.reload()
 await expect.poll(()=>page.locator('.artist-portrait img').evaluate(img=>(img as HTMLImageElement).currentSrc)).toMatch(avatarAsset('a10'))
})

test('creator identity shows its star and reserved PFP in round layouts',async({page,account})=>{
 // UI fixture only: server/social.test.ts independently checks verified ownership and rejects forged roles.
 await page.route('**/api/auth/me',async route=>{
  const response=await route.fetch(),body=await response.json()
  await route.fulfill({response,json:{...body,user:{...body.user,isCreator:true,avatar:'mine'}}})
 })
 await page.route(`**/api/users/${account.username}`,async route=>{
  const response=await route.fetch(),body=await response.json()
  await route.fulfill({response,json:{...body,profile:{...body.profile,displayName:'Rohit Maity',isCreator:true,avatar:'mine'}}})
 })
 await page.goto('/')
 await expect(page.getByRole('img',{name:'Creator of this application',exact:true})).toBeVisible()
 await expect(page.locator('.artist-portrait img')).toHaveAttribute('src',avatarAsset('mine'))
 // Phones have no style switch, so each style is chosen at desktop width and then checked at every width.
 for(const style of ['gallery','editorial']){
  await page.setViewportSize({width:1440,height:1000})
  await page.getByRole('button',{name:`${style} style`,exact:true}).click()
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width===1440?1000:844})
   const portrait=page.locator('.artist-portrait'),box=(await portrait.boundingBox())!
   expect(Math.abs(box.width-box.height)).toBeLessThan(1)
   await expect(portrait).toHaveCSS('border-radius','50%')
   await expect(page.locator('.creator-badge')).toBeVisible()
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
   await page.screenshot({path:`.reference-analysis/pfp/${style}-${width}.png`})
  }
 }
 await page.getByRole('button',{name:'Switch to dark theme'}).click()
 await page.screenshot({path:'.reference-analysis/pfp/editorial-320-dark.png'})
 await page.getByRole('button',{name:'Edit artist profile'}).click()
 await expect(page.locator('.avatar-choices button')).toHaveCount(13)
 await expect(page.getByRole('button',{name:'Mine, creator profile picture'})).toHaveAttribute('aria-pressed','true')
 await expect.poll(()=>page.locator('.avatar-choices img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true)
 await page.screenshot({path:'.reference-analysis/pfp/creator-menu.png'})
 await page.getByRole('button',{name:'Close dialog'}).click()
 await page.route('**/api/auth/me',route=>route.fulfill({json:{user:null}}))
 await page.goto(`/#@${account.username}`)
 await page.reload()
 await expect(page.getByRole('img',{name:'Creator of this application',exact:true})).toBeVisible()
 await expect(page.locator('.artist-portrait img')).toHaveAttribute('src',avatarAsset('mine'))
 await expect(page.getByRole('button',{name:'Follow',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Edit artist profile'})).toHaveCount(0)
})
