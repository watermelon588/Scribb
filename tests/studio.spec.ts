import { test, expect } from '@playwright/test'

test('all three material studies support opening, forward and reverse browsing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  for (const preset of ['The Linen', 'The Archive', 'The Softcover']) {
    await page.getByRole('button', { name: new RegExp(preset) }).click()
    await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
    await expect(page.locator('.page-navigation')).toContainText('01—02')
    await page.getByRole('button', { name: 'Next pages' }).click()
    await expect(page.locator('.page-navigation')).toContainText('03—04')
    await expect(page.getByRole('button', { name: 'Previous pages' })).toBeEnabled()
    await page.getByRole('button', { name: 'Previous pages' }).click()
    await expect(page.locator('.page-navigation')).toContainText('01—02')
    await expect(page.getByRole('button', { name: 'View cover' })).toBeEnabled()
    await page.getByRole('button', { name: 'View cover' }).click()
    await expect(page.locator('.page-navigation')).toContainText('COVER')
    await expect(page.getByRole('button', { name: 'Open book' })).toBeEnabled()
    await page.getByRole('button', { name: 'Open book' }).click()
    await expect(page.locator('.page-navigation')).toContainText('01—02')
    await expect(page.getByRole('button', { name: 'Next pages' })).toBeEnabled()
  }
  expect(errors).toEqual([])
})

test('customization survives reload, preserves the spread, and handles the back cover', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'French blue cover' }).click()
  for (const ratio of ['1:1', '4:3', '16:9', '3:4']) {
    await page.getByRole('button', { name: new RegExp(`${ratio} .* format`) }).click()
    await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
    const size = await page.locator('.book-mount').evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }))
    const [w, h] = ratio.split(':').map(Number)
    expect((size.width / 2) / size.height).toBeCloseTo(w / h, 1)
  }
  for (const motion of ['Hinge', 'Float', 'Curl']) {
    await page.getByRole('button', { name: `${motion} page turn` }).click()
    await page.getByRole('button', { name: 'Next pages' }).click()
    await expect(page.locator('.page-navigation')).toContainText(motion === 'Hinge' ? '03—04' : motion === 'Float' ? '05—06' : 'THE END')
    await expect(page.getByRole('button', { name: 'Previous pages' })).toBeEnabled()
  }
  await expect(page.getByRole('button', { name: 'Next pages' })).toBeDisabled()
  await page.getByRole('button', { name: 'Open book' }).click()
  await expect(page.locator('.page-navigation')).toContainText('05—06')
  await page.getByRole('switch', { name: 'Paper texture' }).click()
  await page.getByLabel('On the cover').fill('A new collection')
  await page.reload()
  await expect(page.getByLabel('On the cover')).toHaveValue('A new collection')
  await expect(page.getByRole('button', { name: 'French blue cover' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('switch', { name: 'Paper texture' })).toHaveAttribute('aria-checked', 'false')
})

test('one uploaded artwork, odd page count, restored samples and invalid files', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles('public/artworks/roses.jpg')
  await expect(page.locator('.page-navigation')).toContainText('/ 01')
  await expect(page.locator('.book-mount .book-page')).toHaveCount(4)
  await expect(page.getByRole('status')).toContainText('1 artwork added')
  await page.getByRole('button', { name: 'Restore sample artworks' }).click()
  await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
  await page.locator('input[type="file"]').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('status')).toContainText('Choose JPG')
  await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
})

test('mobile layout fits and reduced motion supports immediate keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('region', { name: /Interactive sketchbook/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.page-navigation')).toContainText('03—04')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.page-navigation')).toContainText('01—02')
  await page.keyboard.press('Home')
  await expect(page.locator('.page-navigation')).toContainText('COVER')
  await page.screenshot({ path: '.reference-analysis/studio-mobile.png', fullPage: true })
})

test('dragging the paper turns it forward and back without replacing artwork', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
  const box = (await page.locator('.book-mount').boundingBox())!
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 20)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .7, { steps: 25 })
  await page.mouse.up()
  await expect(page.locator('.page-navigation')).toContainText('03—04')
  await expect(page.getByRole('button', { name: 'Previous pages' })).toBeEnabled()
  await page.mouse.move(box.x + 12, box.y + box.height - 20)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .7, { steps: 25 })
  await page.mouse.up()
  await expect(page.locator('.page-navigation')).toContainText('01—02')
  await expect(page.locator('.book-mount').getByAltText('Roses by Vincent van Gogh')).toBeVisible()
})

test('touch swipes turn in both directions and vertical gestures scroll the studio', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await page.goto('http://localhost:5173/')
  await expect(page.locator('.book-mount .book-page')).toHaveCount(8)
  const cdp = await context.newCDPSession(page)
  async function swipe(direction: 'left' | 'right' | 'up') {
    const box = (await page.locator('.book-mount').boundingBox())!
    const start = { x: direction === 'right' ? box.x + 12 : box.x + box.width - 12, y: box.y + box.height * .65 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (let i = 1; i <= 15; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: start.x + (direction === 'left' ? -1 : direction === 'right' ? 1 : 0) * box.width * .65 * i / 15,
      y: start.y - (direction === 'up' ? 110 * i / 15 : 0),
    }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await swipe('left')
  await expect(page.locator('.page-navigation')).toContainText('03—04')
  await expect(page.getByRole('button', { name: 'Previous pages' })).toBeEnabled()
  await swipe('right')
  await expect(page.locator('.page-navigation')).toContainText('01—02')
  await expect(page.getByRole('button', { name: 'Next pages' })).toBeEnabled()
  await swipe('up')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(page.locator('.page-navigation')).toContainText('01—02')
  await context.close()
})
