import {test,expect,seedBook,seedJournal,signUp} from './fixtures'
import type {Browser} from '@playwright/test'

test('weekly ranking, recent sorting and journal sharing work on desktop and phones', async ({page,context,account,browser}, testInfo)=>{
 test.setTimeout(90_000)
 const ranked=await seedBook(context.request,{title:'Weekly studies'})
 const recent=await seedJournal(context.request,'Today’s journal',[{texts:{p0:'A page for today.'}}],{},'public')
 const fan=await browser.newContext({baseURL:'http://127.0.0.1:5174'})
 try{
  await signUp(fan,'fan')
  for(const client of [context,fan])expect((await client.request.put(`/api/books/${ranked}/like`)).ok()).toBe(true)
 }finally{await fan.close()}
 await context.grantPermissions(['clipboard-read','clipboard-write'])
 await page.goto('/explore')
 const cards=page.locator('.feed-card'), sort=page.getByRole('group',{name:'Sort posts'})
 await expect(sort.getByRole('button',{name:'Top this week'})).toHaveAttribute('aria-pressed','true')
 await expect(cards.first().getByRole('heading')).toHaveText('Weekly studies')
 await expect(cards.first().locator('.feed-weekly-badge')).toHaveText('Top this week')
 await expect(page.locator('.feed-weekly-badge')).toHaveCount(1)
 await page.screenshot({path:testInfo.outputPath('weekly-desktop.png')})
 await page.getByRole('button',{name:'Like Weekly studies'}).click()
 await page.getByRole('button',{name:'Like Today’s journal'}).click()
 await expect(cards.first().getByRole('heading')).toHaveText('Today’s journal')
 await expect(cards.first().locator('.feed-weekly-badge')).toBeVisible()
 await page.getByRole('button',{name:'Like Today’s journal'}).click()
 await expect(cards.first().getByRole('heading')).toHaveText('Weekly studies')
 await sort.getByRole('button',{name:'Recent'}).click()
 await expect(cards.first().getByRole('heading')).toHaveText('Today’s journal')
 const url=new URL(`/@${account.username}/${recent}`,page.url()).href
 await cards.first().getByRole('button',{name:'Share Today’s journal'}).click()
 await expect(page.getByRole('heading',{name:'Share journal'})).toBeVisible()
 await page.getByRole('button',{name:'Copy book link'}).click()
 await expect(page.getByRole('status')).toHaveText('Book link copied.')
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(url)
 await expect(page).toHaveURL(/\/explore$/)
 await page.getByRole('button',{name:'Close dialog'}).click()
 await cards.first().getByRole('button',{name:'Open Today’s journal'}).click()
 await page.getByRole('button',{name:'Share journal',exact:true}).click()
 await expect(page.getByLabel('Public link')).toHaveValue(url)
 await page.getByRole('button',{name:'Back to book'}).click()
 await expect(page.getByRole('button',{name:'Share journal',exact:true})).toBeFocused()
 await page.getByRole('button',{name:'Close dialog'}).click()

 for(const width of [320,390]){
  await page.setViewportSize({width,height:844})
  await page.getByRole('button',{name:'Showing For you. Change view'}).click()
  await expect(sort.getByRole('button',{name:'Recent'})).toHaveAttribute('aria-pressed','true')
  await page.screenshot({path:testInfo.outputPath(`sort-phone-${width}.png`)})
  await sort.getByRole('button',{name:'Top this week'}).click()
  await expect(cards.first().getByRole('heading')).toHaveText('Weekly studies')
  await expect(cards.first().getByRole('button',{name:'Share Weekly studies'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:testInfo.outputPath(`weekly-phone-${width}.png`)})
  await page.getByRole('button',{name:'Showing For you. Change view'}).click()
  await sort.getByRole('button',{name:'Recent'}).click()
  await expect(cards.first().getByRole('heading')).toHaveText('Today’s journal')
 }

 await page.setViewportSize({width:1440,height:1000})
 await page.goto('/')
 await page.getByRole('button',{name:'Bookshelf',exact:true}).click()
 const volume=page.getByRole('button',{name:'Select Weekly studies'})
 await volume.hover()
 await expect(volume.locator('.shelf-front')).toHaveCSS('translate','0px -6px')
 await expect(volume).toHaveAttribute('aria-pressed','true')
 await page.screenshot({path:testInfo.outputPath('bookshelf-hover.png')})
 await page.emulateMedia({reducedMotion:'reduce'})
 await expect(volume.locator('.shelf-front')).toHaveCSS('translate','none')
})

/** Another artist with published books, newest first in the order given. Titles share a tag so the feed search finds only them. */
async function artist(browser:Browser,books:{title:string;format?:string}[]){
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5174'}),account=await signUp(context,'a')
 for(const {title,format='3:4'} of [...books].reverse())await seedBook(context.request,{title:`${account.username} ${title}`,category:'Watercolor',design:{format}})
 await context.close()
 return account.username
}

test('feed reactions, artist portfolios, following and book preview',async({page,browser})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 const mira=await artist(browser,[{title:'A small kind of wonder'},{title:'Tide pools'},{title:'Late light'}]),wonder=`${mira} A small kind of wonder`
 const search=()=>page.getByLabel('Search the feed').fill(mira)
 await page.goto('/#feed');await search();await expect(page.locator('.feed-card')).toHaveCount(3);await expect(page.locator('.feed-intro')).toHaveCount(0)
 expect(await page.locator('.feed-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(3);await expect(page.getByRole('button',{name:'gallery style',exact:true})).toHaveText('')
 await page.getByRole('button',{name:`Like ${wonder}`,exact:true}).click();await expect(page.getByRole('button',{name:`Like ${wonder}`,exact:true})).toContainText('1')
 await page.getByRole('button',{name:`Save ${wonder}`,exact:true}).click()
 await page.reload();await search();await expect(page.getByRole('button',{name:`Like ${wonder}`,exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByLabel('Show saved books').click();await expect(page.locator('.feed-card')).toHaveCount(1);await page.getByLabel('Show saved books').click()
 await page.getByRole('button',{name:`View ${mira}'s portfolio`,exact:true}).first().click();await expect(page).toHaveURL(new RegExp(`/@${mira}$`))
 await expect(page.locator('.artist-details h1')).toHaveText(`${mira}.`);await expect(page.locator('.collection-book')).toHaveCount(3);await expect(page.getByRole('button',{name:'New sketchbook'})).toHaveCount(0);await expect(page.getByRole('button',{name:/^Edit /})).toHaveCount(0)
 await page.getByRole('button',{name:'Follow',exact:true}).click();await expect(page.getByRole('button',{name:'Following',exact:true})).toHaveAttribute('aria-pressed','true')
 // The preview opens at the latest artwork, past the elastic.
 await page.getByRole('button',{name:`Open ${wonder}`,exact:true}).click();await expect(page.getByRole('button',{name:'Previous pages',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Release band',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Attached elastic loop',exact:true})).toHaveCount(0)
 await expect(page.locator('.dialog-edit')).toHaveCount(0);await page.getByRole('button',{name:'Close dialog'}).click()
 await page.goto('/#feed');await page.getByRole('group',{name:'Feed'}).getByRole('button',{name:'Following'}).click();await expect(page.locator('.feed-card')).toHaveCount(3)
 expect(errors).toEqual([])
})

test('guests read the feed, and liking asks them to sign in',async({browser})=>{
 const mira=await artist(browser,[{title:'Open to all'}])
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5174'}),page=await context.newPage()
 await page.goto('/#feed');await page.getByLabel('Search the feed').fill(mira);await expect(page.locator('.feed-card')).toHaveCount(1)
 await page.getByRole('button',{name:`Like ${mira} Open to all`,exact:true}).click();await expect(page.getByRole('heading',{name:'Sign in to Scribb'})).toBeVisible()
 await page.goto('/#new');await expect(page.getByRole('heading',{name:'Sign in to Scribb'})).toBeVisible();await expect(page.getByLabel('Sketchbook name')).toHaveCount(0)
 await context.close()
})

test('all feed styles and thumbnail formats fit desktop and phone',async({page,browser})=>{
 const tag=await artist(browser,[{title:'Upright',format:'3:4'},{title:'Wide',format:'16:9'},{title:'Square',format:'1:1'},{title:'Landscape',format:'4:3'}])
 await page.goto('/#feed');await page.getByLabel('Search the feed').fill(tag);await expect(page.locator('.feed-card')).toHaveCount(4)
 // Styles are chosen at desktop width; phones always draw the Gallery style.
 for(const style of ['gallery','editorial']){await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:`${style} style`,exact:true}).click();for(const width of [1440,390,320]){
 await page.setViewportSize({width,height:900});await expect(page.locator('.feed-card').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
// Cards lie open at the newest page, so each page keeps the book's ratio.
 const ratios=await page.locator('.feed-card .feed-leaf.recent').evaluateAll(es=>es.slice(0,4).map(e=>{const r=e.getBoundingClientRect();return r.width/r.height}));for(const [i,r] of [.75,16/9,1,4/3].entries())expect(ratios[i]).toBeCloseTo(r,1);
 await page.screenshot({path:`.reference-analysis/feed-${style}-${width}.png`,fullPage:false});
 }}
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollbarWidth)).toBe('none');
});
test('all editor dimensions reach the actual renderer on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#new');await page.getByRole('navigation',{name:'Tools'}).getByRole('button',{name:'Paper',exact:true}).click()
 for(const [format,ratio] of [['16:9',16/9],['1:1',1],['3:4',.75],['4:3',4/3]] as const){await page.getByRole('button',{name:`${format} format`,exact:true}).click();await expect.poll(async()=>{const b=await page.locator('.book-mount').boundingBox();return Math.abs(b!.width/b!.height-ratio)}).toBeLessThan(.03)}
});
test('phone navigation preserves draft and touch turns an open sketchbook',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5174',viewport:{width:390,height:844},isMobile:true,hasTouch:true});await signUp(context);const page=await context.newPage();await page.goto('/#new');await page.getByRole('button',{name:'Save',exact:true}).tap();await page.getByLabel('Sketchbook name',{exact:true}).fill('Phone sketchbook');await page.locator('input[type=file]').last().setInputFiles(['public/artworks/roses.jpg','public/artworks/irises.jpg','public/artworks/venice.jpg','public/artworks/cypresses.jpg']);await expect(page.locator('.artwork-edit-card')).toHaveCount(4);
 await page.getByRole('button',{name:'Back to portfolio',exact:true}).tap();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Explore',exact:true}).tap();await expect(page.locator('.feed-phone-menu')).toBeVisible();await expect(page.locator('.feed-toolbar')).toBeHidden();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Create',exact:true}).tap();await expect(page.getByLabel('Sketchbook name',{exact:true})).toHaveValue('Phone sketchbook');
 await page.getByRole('navigation',{name:'Tools'}).getByRole('button',{name:'Binding',exact:true}).tap();await page.getByRole('button',{name:'Linen',exact:true}).tap();await page.getByRole('button',{name:'Open book',exact:true}).tap();await expect(page.getByRole('button',{name:'Next pages',exact:true})).toBeEnabled();
 await page.locator('.book-mount').scrollIntoViewIfNeeded();
 const box=(await page.locator('.book-mount').boundingBox())!;const x=box.x+box.width*.9,y=box.y+box.height*.55;const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-box.width*.7*i/12,y}]});await page.waitForTimeout(18)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.locator('.stage-topline').getByRole('button',{name:'Pages',exact:true}).tap();await expect(page.getByRole('button',{name:'Page 2',exact:true})).toHaveAttribute('aria-current','true');await context.close();
});

test('feed cards open at the newest page and close to the cover',async({page,browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5174'}),account=await signUp(context,'p'),art=(id:string)=>({id,src:`/artworks/${id}.jpg`,title:id,artist:'',medium:'',layout:'page'})
 await seedBook(context.request,{title:`${account.username} Studies`,pages:[art('roses'),art('irises')]})
 await seedJournal(context.request,`${account.username} Days`,[{date:'2026-01-02',texts:{p0:'Rain on the window'}},{date:'2026-01-03',texts:{}}],{},'public')
 await context.close()
 await page.goto('/#feed');await page.getByLabel('Search the feed').fill(account.username);await expect(page.locator('.feed-card')).toHaveCount(2)
 const studies=page.locator('.feed-card',{hasText:'Studies'}),days=page.locator('.feed-card',{hasText:'Days'})
 // The newest artwork is on the right of the spread; the journal opens at its newest written entry, not the empty one after it.
 await expect(studies.locator('.feed-leaf').nth(1).locator('img')).toHaveAttribute('src','/artworks/irises.jpg')
 await expect(days.locator('.feed-spread')).toContainText('Rain on the window');await expect(days.locator('.collection-book-object')).toHaveCount(0)
 await page.screenshot({path:'.reference-analysis/feed-open.png'})
 await page.getByRole('button',{name:`Close ${account.username} Days`,exact:true}).click()
 await expect(days.locator('.feed-spread')).toHaveCount(0);await expect(days.locator('.collection-book-object')).toBeVisible();await expect(studies.locator('.feed-spread')).toBeVisible()
 await page.getByRole('button',{name:`Open ${account.username} Days at the newest page`,exact:true}).click();await expect(days.locator('.feed-spread')).toContainText('Rain on the window')
 await page.getByRole('button',{name:`Open ${account.username} Studies`,exact:true}).click();await expect(page.locator('.book-mount img[src="/artworks/irises.jpg"]').first()).toBeVisible();await expect(page.getByRole('button',{name:'Release band',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Close dialog'}).click();await page.setViewportSize({width:390,height:844});await expect(studies.locator('.feed-spread')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.reference-analysis/feed-open-phone.png'})
});
