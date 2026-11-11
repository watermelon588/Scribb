import {test,expect,seedBook} from './fixtures'

test('new studio uses visual controls, prepared covers and plain backs',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#studio');await expect(page.getByLabel('Sketchbook name')).toBeVisible();
 await expect(page.locator('select')).toHaveCount(0);await expect(page.getByText('Original',{exact:true})).toHaveCount(0);
 await expect(page.locator('.cover-choice')).toHaveCount(20);
 await expect(page.locator('.book-mount .cover-art-image')).toHaveCount(1);
 await expect(page.locator('.book-mount .back-cover img')).toHaveCount(0);
 for(const format of ['1:1','16:9','4:3','3:4']){await page.getByRole('button',{name:`${format} format`,exact:true}).click();await expect(page.getByRole('button',{name:`${format} format`,exact:true})).toHaveAttribute('aria-pressed','true')}
 await page.getByRole('button',{name:'Dotted paper',exact:true}).click();await page.getByRole('button',{name:'hinge page turn'}).click();
 await page.screenshot({path:'.reference-analysis/revised-studio.png',fullPage:true});
 expect(errors).toEqual([]);
});

test('elastic recoils and disappears when opening completes, then recloses',async({page})=>{
 await page.goto('/#studio');const band=page.getByRole('button',{name:'Release elastic band',exact:true});await band.hover();
 const box=(await band.boundingBox())!;const ribbon=band.locator('svg > path').first();
 await page.mouse.move(box.x+7,box.y+box.height*.25);await page.mouse.down();await page.mouse.move(box.x+32,box.y+box.height*.25,{steps:10});
 await expect.poll(()=>ribbon.getAttribute('d')).toContain('32.5');await page.mouse.up();await expect(band).toBeEnabled();
 await expect.poll(async()=>await ribbon.getAttribute('d')).not.toContain('32.5');
 await page.getByRole('button',{name:'Release band',exact:true}).click();
 await expect(page.locator('.book-stage')).not.toHaveClass(/is-closed/);
 const loop=page.getByRole('button',{name:'Attached elastic loop',exact:true});await expect(loop).toHaveCount(0);

 await expect(page.getByRole('button',{name:'View cover'})).toBeEnabled();await page.screenshot({path:'.reference-analysis/attached-elastic.png'});
 await page.getByRole('button',{name:'View cover'}).click();await expect(page.locator('.book-stage')).toHaveClass(/is-closed/);await expect(band).toBeVisible();
 expect(await page.locator('.book-mount').evaluate(e=>getComputedStyle(e,'::before').content)).toBe('none');
});

test('each binding opens and turns both ways',async({page})=>{
 await page.goto('/#studio');await page.locator('input[type=file]').last().setInputFiles(['public/artworks/roses.jpg','public/artworks/irises.jpg','public/artworks/venice.jpg','public/artworks/cypresses.jpg']);
 await expect(page.locator('.artwork-edit-card')).toHaveCount(4);
 for(const material of ['Linen','Spiral','Watercolor']){
 await page.getByRole('button',{name:material,exact:true}).click();
 if(material==='Watercolor')await page.getByRole('button',{name:'Release band',exact:true}).click();else await page.getByRole('button',{name:'Open book',exact:true}).click();
 await expect(page.locator('.page-navigation')).toContainText('01—02');await expect(page.getByRole('button',{name:'Next pages'})).toBeEnabled();
 await page.getByRole('button',{name:'Next pages'}).click();await expect(page.locator('.page-navigation')).toContainText('03—04');
 await expect(page.getByRole('button',{name:'Previous pages'})).toBeEnabled();await page.getByRole('button',{name:'Previous pages'}).click();await expect(page.locator('.page-navigation')).toContainText('01—02');
 }
});

test('mobile visual controls and reduced motion navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#studio');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Release band',exact:true}).click();await expect(page.locator('.book-stage')).not.toHaveClass(/is-closed/);
 await page.getByRole('region',{name:/Interactive sketchbook/}).focus();await page.keyboard.press('Home');await expect(page.locator('.book-stage')).toHaveClass(/is-closed/);
 await page.screenshot({path:'.reference-analysis/revised-mobile.png',fullPage:true});
});

test('back cover stays plain, shows only the elastic anchors and turns back to the front',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#new');await page.getByRole('button',{name:'Release band',exact:true}).click();
 await page.getByRole('button',{name:'Next pages'}).click();await expect(page.locator('.book-stage')).toHaveClass(/is-back/);
 await expect(page.locator('.book-mount .back-cover')).toBeVisible();await expect(page.locator('.book-mount .back-cover img')).toHaveCount(0);
 await expect(page.locator('.book-stage .elastic-anchors')).toHaveCount(1);await expect(page.locator('.book-stage .elastic-band')).toHaveCount(0);
 await page.getByRole('button',{name:'Pages',exact:true}).click();await expect(page.locator('.page-rail-count')).toHaveText(/^\d+ artworks?$/);await page.getByRole('button',{name:'Pages',exact:true}).click()
 await page.getByRole('button',{name:'Back to start'}).click();await expect(page.locator('.book-stage')).not.toHaveClass(/is-back/);
 await expect(page.locator('.book-stage .elastic-anchors')).toHaveCount(0);await expect(page.getByRole('button',{name:'Release band',exact:true})).toBeVisible();
});

test('the desktop sketchbook preview tilts and returns flat on phones',async({page})=>{
 await seedBook(page.request,{title:'Sketchbook in 3D',visibility:'private',pages:['roses','irises','venice','cypresses'].map(id=>({id,src:`/artworks/${id}.jpg`,layout:'page'}))})
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.goto('/')
 await page.getByRole('button',{name:'Open Sketchbook in 3D',exact:true}).click()
 const stage=page.locator('.portfolio-dialog .book-stage')
 const toggle=stage.getByRole('button',{name:'3D view',exact:true})
 const position=stage.locator('.page-navigation [aria-live]')
 await expect(position).toContainText('03—04')
 await expect(toggle).toHaveAttribute('aria-pressed','false')
 await toggle.click()
 await expect(toggle).toHaveAttribute('aria-pressed','true')
 await expect(stage.locator('.book-slab')).toBeAttached()
 const area=stage.getByRole('region',{name:/Sketchbook in 3D/})
 await area.focus()
 await page.keyboard.press('ArrowRight')
 await expect(stage.locator('.book-orbit')).toHaveAttribute('style',/rotateY/)
 await expect(position).toContainText('03—04')
 await stage.getByRole('button',{name:'Previous pages',exact:true}).click()
 await expect(position).toContainText('01—02')
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844})
  await expect(toggle).toHaveCount(0)
  await expect(stage.locator('.book-slab')).toHaveCount(0)
  await expect.poll(()=>stage.locator('.book-orbit').evaluate(node=>node.style.transform)).toBe('')
  await expect(stage.getByRole('region',{name:/Interactive sketchbook/})).toBeVisible()
 }
 await page.setViewportSize({width:1440,height:1100})
 await expect(toggle).toHaveAttribute('aria-pressed','false')
})
