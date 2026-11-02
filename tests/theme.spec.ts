import {test,expect} from '@playwright/test'
test('two coordinated styles retain both previews and theme persists everywhere',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'library style'})).toHaveCount(0);await expect(page.locator('.portfolio-header').getByRole('button',{name:'New sketchbook'})).toHaveCount(0);
 await page.getByRole('button',{name:'Switch to dark theme'}).click();
 for(const style of ['gallery','editorial']){await page.getByRole('button',{name:`${style} style`,exact:true}).click();await page.getByRole('button',{name:'Bookshelf',exact:true}).click();await expect(page.getByRole('group',{name:'Sketchbook bookshelf'})).toBeVisible();await page.getByRole('button',{name:'Gallery',exact:true}).click();await expect(page.locator('.book-collection')).toBeVisible();expect(await page.locator('.portfolio-app').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(24, 28, 26)')}
 for(const route of ['/#feed','/#new','/']){await page.goto(route);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:`.reference-analysis/dark-${route.replace(/[^a-z]/g,'')||'profile'}.png`,fullPage:true})}
 await page.getByRole('button',{name:'Open Quiet observations',exact:true}).click();expect(await page.locator('dialog').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(24, 28, 26)');await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Switch to light theme'}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
test('smooth scrolling is reduced-motion aware and phone theme stays usable',async({page})=>{
 await page.goto('/#feed');await expect(page.locator('html')).toHaveClass(/lenis/);await page.mouse.move(900,600);await page.mouse.wheel(0,650);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(200);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('html')).not.toHaveClass(/lenis/);await page.setViewportSize({width:320,height:844});await page.getByRole('button',{name:'Switch to dark theme'}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.reference-analysis/dark-mobile.png',fullPage:false});
});
