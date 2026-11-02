import {test,expect} from '@playwright/test'

test('profile opens a single creation studio with collection view choices',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Bookshelf',exact:true})).toHaveCount(1);await expect(page.getByText('Design studio',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'.reference-analysis/revised-profile.png',fullPage:true});
 await page.getByRole('button',{name:'New sketchbook',exact:true}).last().click();await expect(page.getByLabel('Sketchbook name')).toBeVisible();
});

test('cover and artwork placement save, reload and align across the fold',async({page})=>{
 await page.goto('/#new');await page.getByLabel('Sketchbook name').fill('New cover studies');
 await page.getByRole('button',{name:'Choose Woven / tangerine',exact:true}).hover({position:{x:5,y:70}});await page.getByRole('button',{name:'Choose Woven / tangerine',exact:true}).click();
 await page.getByRole('button',{name:'Position cover',exact:true}).click();await page.getByRole('slider',{name:'Cover image size'}).fill('1.3');
 const surface=page.getByRole('group',{name:'Position cover image'});await surface.focus();await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'Preview book',exact:true}).first().click();
 await page.locator('input[type=file]').last().setInputFiles(['public/artworks/roses.jpg','public/artworks/irises.jpg']);
 await page.getByRole('button',{name:'Across both pages for irises'}).click();await page.getByRole('slider',{name:'Artwork size'}).fill('0.8');
 const art=page.getByRole('group',{name:'Position artwork'});const b=(await art.boundingBox())!;await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.55,b.y+b.height*.53,{steps:12});await page.mouse.up();
 await page.screenshot({path:'.reference-analysis/artwork-placement.png'});
 await page.getByRole('button',{name:'Preview book',exact:true}).first().click();await page.getByRole('button',{name:'Save sketchbook',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');
 await page.goto('/');await page.getByLabel('Find a sketchbook').fill('New cover studies');await page.getByRole('button',{name:'Open New cover studies'}).click();
 await expect(page.locator('.book-mount .cover-art-image')).toHaveCSS('transform',/matrix\(1.3/);
 await page.getByRole('button',{name:'Release band',exact:true}).click();await expect(page.getByRole('button',{name:'Next pages'})).toBeEnabled();await page.getByRole('button',{name:'Next pages'}).click();await expect(page.getByRole('button',{name:'Previous pages'})).toBeEnabled();
 const left=(await page.locator('.book-mount .spread-left img').boundingBox())!,right=(await page.locator('.book-mount .spread-right img').boundingBox())!;
 expect(Math.abs(left.x-right.x)).toBeLessThan(2);expect(Math.abs(left.width-right.width)).toBeLessThan(1);
 await expect(page.locator('.book-mount .spread-left img')).toHaveCSS('transform',/matrix\(0.8/);
 await page.screenshot({path:'.reference-analysis/revised-spread.png'});
});


test('resize handle and cover upload work with touch-sized controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#new');
 await page.locator('input[type=file]').first().setInputFiles('public/artworks/roses.jpg');
 await expect(page.getByRole('group',{name:'Position cover image'})).toBeVisible();
 const handle=page.getByRole('button',{name:'Drag to resize image'});await handle.scrollIntoViewIfNeeded();const h=(await handle.boundingBox())!;
 await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+24,h.y+h.height/2,{steps:10});await page.mouse.up();
 expect(Number(await page.getByRole('slider',{name:'Cover image size'}).inputValue())).toBeGreaterThan(1.1);
 await page.getByRole('group',{name:'Position cover image'}).focus();await page.keyboard.press('ArrowLeft');
 await expect(page.getByRole('group',{name:'Position cover image'}).locator('img')).not.toHaveCSS('transform','none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Preview book',exact:true}).first().click();await expect(page.locator('.book-mount .cover-art-image')).toHaveAttribute('src',/^data:image/);
 await page.getByRole('button',{name:'Solid color cover'}).click();await expect(page.locator('.book-mount .cover-art-image')).toHaveCount(0);
});
