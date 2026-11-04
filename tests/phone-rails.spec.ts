import {test,expect,seedBook} from './fixtures'

for(const width of [320,390]){
 test(`phone editor keeps its page interactive above the tool rail at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===320?640:844})
  await page.goto('/#new')
  const tools=page.getByRole('navigation',{name:'Tools'})
  await page.getByRole('group',{name:'Book type'}).getByRole('button',{name:'Journal'}).click()
  await page.getByRole('button',{name:'Write on page 1'}).click()
  await tools.getByRole('button',{name:'Layout',exact:true}).click()
  const controls=page.locator('.journal-composer')
  const last=controls.getByRole('button',{name:/ layout$/}).last()
  await last.click()
  await expect(last).toHaveAttribute('aria-pressed','true')
  expect(await controls.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true)
  await tools.getByRole('button',{name:'Style',exact:true}).click()
  await page.getByRole('button',{name:'Navy ink'}).click()
  await expect(page.getByRole('button',{name:'Navy ink'})).toHaveAttribute('aria-pressed','true')
  const preview=await page.locator('.creation-preview').boundingBox()
  expect(preview!.height).toBeGreaterThan((await controls.boundingBox())!.height*2)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width)
 })
}

test('phone Explore gives a single post a full page and keeps both halves of a spread',async({page})=>{
 await seedBook(page.request,{title:'Wide artwork',pages:[{id:'a',src:'/artworks/roses.jpg',layout:'spread'}]})
 await seedBook(page.request,{title:'Latest right page',pages:[{id:'a',src:'/artworks/roses.jpg'},{id:'b',src:'/artworks/irises.jpg'}]})
 await page.setViewportSize({width:390,height:844})
 await page.goto('/explore')
 const newest=page.getByRole('button',{name:'Open Latest right page',exact:true})
 await expect(newest.locator('.feed-leaf:visible')).toHaveCount(1)
 await expect(newest.locator('.feed-leaf:visible img')).toHaveAttribute('src','/artworks/irises.jpg')
 expect((await newest.locator('.feed-leaf:visible').boundingBox())!.width).toBeGreaterThan(300)
 await expect(page.getByRole('button',{name:'Open Wide artwork',exact:true}).locator('.feed-leaf:visible')).toHaveCount(2)
 await expect(page.locator('.site-footer')).toHaveCount(0)
 await page.getByRole('button',{name:'More options'}).click()
 await expect(page.getByRole('link',{name:'Privacy',exact:true})).toBeVisible()
})
