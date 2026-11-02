import {test,expect} from '@playwright/test'
test('feed reactions, artist portfolios, filtering and book preview',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#feed');await expect(page.locator('.feed-card')).toHaveCount(8);await expect(page.locator('.feed-intro')).toHaveCount(0);expect(await page.locator('.feed-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(3);await expect(page.getByRole('button',{name:'gallery style',exact:true})).toHaveText('');
 await page.getByRole('button',{name:'Like A small kind of wonder',exact:true}).click();await page.getByRole('button',{name:'Save A small kind of wonder',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'Like A small kind of wonder',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Show saved sketchbooks').click();await expect(page.locator('.feed-card')).toHaveCount(1);await page.getByLabel('Show saved sketchbooks').click();
 await page.getByRole('button',{name:"View Mira Sen's portfolio",exact:true}).first().click();await expect(page.locator('.feed-creator h1')).toHaveText('Mira Sen');await expect(page.locator('.feed-card')).toHaveCount(3);
 await page.getByRole('button',{name:'Open A small kind of wonder',exact:true}).click();await page.getByRole('button',{name:'Release band',exact:true}).click();await expect(page.getByRole('button',{name:'Attached elastic loop',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Next pages',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Next pages',exact:true}).click();await expect(page.getByRole('button',{name:'Attached elastic loop',exact:true})).toHaveCount(0);expect(errors).toEqual([]);
});
test('all feed styles and thumbnail formats fit desktop and phone',async({page})=>{
 await page.goto('/#feed');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});for(const style of ['gallery','editorial']){
 await page.getByRole('button',{name:`${style} style`,exact:true}).click();await expect(page.locator('.feed-card').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const ratios=await page.locator('.feed-card .collection-book-object').evaluateAll(es=>es.slice(0,4).map(e=>{const r=e.getBoundingClientRect();return r.width/r.height}));for(const [i,r] of [.75,16/9,1,4/3].entries())expect(ratios[i]).toBeCloseTo(r,1);
 await page.screenshot({path:`.reference-analysis/feed-${style}-${width}.png`,fullPage:false});
 }}
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollbarWidth)).toBe('none');
});
test('all editor dimensions reach the actual renderer on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#new');
 for(const [format,ratio] of [['16:9',16/9],['1:1',1],['3:4',.75],['4:3',4/3]] as const){await page.getByRole('button',{name:`${format} format`,exact:true}).click();await expect.poll(async()=>{const b=await page.locator('.book-mount').boundingBox();return Math.abs(b!.width/2/b!.height-ratio)}).toBeLessThan(.03)}
});
test('phone navigation preserves draft and touch turns an open sketchbook',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto('/#new');await page.getByLabel('Sketchbook name',{exact:true}).fill('Phone sketchbook');await page.locator('input[type=file]').last().setInputFiles(['public/artworks/roses.jpg','public/artworks/irises.jpg','public/artworks/venice.jpg','public/artworks/cypresses.jpg']);await expect(page.locator('.artwork-edit-card')).toHaveCount(4);
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Explore',exact:true}).tap();await expect(page.locator('.feed-toolbar')).toBeVisible();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Create',exact:true}).tap();await expect(page.getByLabel('Sketchbook name',{exact:true})).toHaveValue('Phone sketchbook');
 await page.getByRole('button',{name:'Linen',exact:true}).tap();await page.getByRole('button',{name:'Open book',exact:true}).tap();await expect(page.getByRole('button',{name:'Next pages',exact:true})).toBeEnabled();
 await page.locator('.book-mount').scrollIntoViewIfNeeded();
 const box=(await page.locator('.book-mount').boundingBox())!;const x=box.x+box.width*.9,y=box.y+box.height*.55;const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-box.width*.7*i/12,y}]});await page.waitForTimeout(18)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('.page-navigation')).toContainText('03—04');await context.close();
});
