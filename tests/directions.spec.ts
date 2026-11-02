import {test,expect} from '@playwright/test'

test('two coordinated styles share profile and draft, including the reference bookshelf',async({page})=>{
 await page.goto('/');
 for(const style of ['gallery','editorial']){
  await page.getByRole('button',{name:`${style} style`,exact:true}).click();await expect(page.locator('.portfolio-app')).toHaveClass(new RegExp(`style-${style}`));
  await page.screenshot({path:`.reference-analysis/style-${style}-profile.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Bookshelf',exact:true}).click();
 await expect(page.getByRole('group',{name:'Sketchbook bookshelf'})).toBeVisible();
 await page.getByRole('button',{name:'Select Things that bloom'}).click();await expect(page.getByRole('button',{name:'Select Things that bloom'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Next sketchbook',exact:true}).click();await expect(page.getByRole('button',{name:'Select The everyday'})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Open sketchbook',exact:true}).click();await expect(page.locator('.portfolio-dialog')).toBeVisible();await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'New sketchbook',exact:true}).last().click();await page.getByLabel('Sketchbook name').fill('One shared draft');await page.getByLabel('Cover caption').fill('Look a little closer.');
 for(const style of ['gallery','editorial']){
  await page.getByRole('button',{name:`${style} style`}).click();await expect(page.getByLabel('Sketchbook name')).toHaveValue('One shared draft');await expect(page.locator('.book-mount .cover-phrase')).toHaveText('Look a little closer.');
  await page.screenshot({path:`.reference-analysis/style-${style}-editor.png`,fullPage:true});
 }
});

test('caption and applied crop persist in the notebook',async({page})=>{
 await page.goto('/#new');await page.getByLabel('Sketchbook name').fill('Cropped observations');await page.getByLabel('Cover caption').fill('A quieter kind of seeing.');
 await page.locator('input[type=file]').last().setInputFiles('public/artworks/roses.jpg');
 await page.getByRole('button',{name:'Position roses'}).click();await page.getByRole('button',{name:'Crop artwork',exact:true}).click();
 await page.getByRole('slider',{name:'Crop w',exact:true}).fill('0.5');await page.getByRole('slider',{name:'Crop h',exact:true}).fill('0.5');
 await page.getByRole('button',{name:'Apply crop'}).click();await expect(page.getByRole('group',{name:'Position artwork'})).toBeVisible();
 const cropped=await page.getByRole('group',{name:'Position artwork'}).locator('img').getAttribute('src');expect(cropped).toMatch(/^data:image\/webp/);
 await page.getByRole('button',{name:'Preview book',exact:true}).first().click();await page.getByRole('button',{name:'Save sketchbook',exact:true}).click();await expect(page.getByRole('status')).toContainText('saved');
 await page.goto('/');await page.getByRole('button',{name:'Open Cropped observations'}).click();await expect(page.locator('.book-mount .cover-phrase')).toHaveText('A quieter kind of seeing.');await expect(page.locator('.book-mount .back-cover .cover-phrase')).toHaveCount(0);
 await expect(page.locator('.book-mount .art-image-frame img')).toHaveAttribute('src',cropped!);
});

test('rejects renamed active content, oversized files and oversized pixel dimensions',async({page})=>{
 await page.goto('/#new');const input=page.locator('input[type=file]').last();
 await input.setInputFiles({name:'pretend.png',mimeType:'image/png',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')});await expect(page.getByRole('status')).toContainText('not a supported image');await expect(page.locator('.artwork-edit-card')).toHaveCount(0);
 await input.setInputFiles({name:'large.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(10*1024*1024+1)});await expect(page.getByRole('status')).toContainText('10 MB');
 const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(9000,16);png.writeUInt32BE(9000,20);
 await input.setInputFiles({name:'huge.png',mimeType:'image/png',buffer:png});await expect(page.getByRole('status')).toContainText('20 megapixels');
 await input.setInputFiles('public/artworks/roses.jpg');await expect(page.locator('.artwork-edit-card')).toHaveCount(1);await expect(page.locator('.artwork-edit-preview img')).toHaveAttribute('src',/^data:image\/webp/);
 await page.locator('input[type=file]').first().setInputFiles({name:'bad.jpg',mimeType:'image/jpeg',buffer:Buffer.from('<html>no image</html>')});await expect(page.getByRole('status')).toContainText('not a supported image');
});

test('all profile and editor directions fit mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const style of ['gallery','editorial']){
 await page.getByRole('button',{name:`${style} style`}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.reference-analysis/style-${style}-mobile.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'New sketchbook',exact:true}).last().click();
 for(const style of ['gallery','editorial']){await page.getByRole('button',{name:`${style} style`}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
});
