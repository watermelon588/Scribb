import {test,expect} from './fixtures'

const shots='.impeccable/review'

test('edit profile keeps only username, bio and links, and closes from the backdrop',async({page,account})=>{
 await page.goto('/')
 await page.getByRole('button',{name:'Edit artist profile'}).click()
 const dialog=page.locator('dialog[open]')
 await expect(dialog.getByLabel('Name',{exact:true})).toHaveCount(0)
 await expect(dialog.getByLabel('City')).toHaveCount(0)
 await expect(dialog.getByLabel('Instagram address')).toHaveCount(0)
 await dialog.getByRole('button',{name:'Add link'}).click()
 await dialog.getByRole('group',{name:'Platform'}).getByRole('button',{name:'Instagram'}).click()
 await dialog.getByLabel('Instagram address').fill('https://instagram.com/someone')
 await page.screenshot({path:`${shots}/settings-links.png`})
 await dialog.getByRole('button',{name:'Save profile',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Profile saved')
 await page.mouse.click(10,10)
 await expect(dialog).toHaveCount(0)
 await expect(page.locator('.artist-details h1')).toHaveText(`${account.username}.`)
 await expect(page.getByRole('link',{name:'Instagram'})).toHaveAttribute('href','https://instagram.com/someone')
 // A press inside the panel that ends on the backdrop keeps it open.
 await page.getByRole('button',{name:'Edit artist profile'}).click()
 const box=(await page.locator('dialog[open] h2').first().boundingBox())!
 await page.mouse.move(box.x+4,box.y+4);await page.mouse.down();await page.mouse.move(10,10,{steps:4});await page.mouse.up()
 await expect(page.locator('dialog[open]')).toHaveCount(1)
})

test('the floating companion opens Ask my journal and studio controls show one-word hints',async({page})=>{
 await page.goto('/')
 const companion=page.locator('a.companion')
 await expect(companion).toBeVisible()
 await expect(page.getByRole('button',{name:/Ask my journal/})).toHaveCount(0)
 await companion.hover()
 await expect(page.locator('.companion-bubble')).toHaveCSS('opacity','1')
 await page.screenshot({path:`${shots}/companion.png`})
 await companion.click()
 await expect(page).toHaveURL(/#ask$/)
 await expect(page.getByRole('heading',{name:'Ask my journal.'})).toBeVisible()
 await expect(companion).toBeHidden()
 await page.screenshot({path:`${shots}/ask-consent.png`,fullPage:true})
 await page.goto('/#new')
 await expect(page.locator('a.companion')).toBeHidden()
 await page.getByRole('button',{name:'Upload cover',exact:true}).hover()
 await expect(page.locator('.hint-tip')).toHaveText('Upload')
 await expect(page.locator('.hint-tip')).toBeVisible()
 await page.screenshot({path:`${shots}/studio-hint.png`})
 await page.locator('.book-area').hover()
 await expect(page.locator('.hint-tip')).toHaveText(/Pull|Drag/)
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await page.goto('/')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:`${shots}/companion-${width}.png`})
 }
})
