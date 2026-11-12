import { readFile } from 'node:fs/promises'
import { test, expect, seedBook } from './fixtures'

test('exports five different boards in Instagram sizes and renders a ten-second MP4', async ({ page, context, account }, testInfo) => {
  test.setTimeout(90_000)
  const names = ['Roses', 'Cypresses', 'Irises', 'Oleanders', 'Olives']
  const id = await seedBook(context.request, {
    title: 'A field guide to looking',
    design: { caption: 'Collected slowly, over one summer.' },
    pages: names.map((title, i) => ({ id: `art-${i}`, title, src: `/artworks/${title.toLowerCase()}.jpg`, artist: '', medium: '', layout: i === 3 ? 'spread' : 'page' })),
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const path = `/@${account.username}/${id}`
  await page.goto(path)
  await page.getByRole('button', { name: 'Share sketchbook' }).click()
  const link = new URL(path, page.url()).href
  await page.getByRole('button', { name: 'Copy book link' }).click()
  await expect(page.getByText('Book link copied.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)

  const layouts = ['Open spread', 'Contact sheet', 'Pinboard', 'Exhibition', 'Folio']
  const layoutGroup = page.getByRole('group', { name: 'Layout' })
  const downloadImage = page.getByRole('button', { name: 'Download image' })
  await expect(layoutGroup.getByRole('button')).toHaveCount(layouts.length)
  const images = new Set<string>()
  for (const name of layouts) {
    await layoutGroup.getByRole('button', { name, exact: true }).click()
    await expect(downloadImage).toBeEnabled()
    const preview = page.getByRole('img', { name: `${name} preview for A field guide to looking` })
    const result = await preview.evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height, canvas.toDataURL('image/jpeg', .4)])
    expect(result.slice(0, 2)).toEqual([1080, 1920])
    images.add(String(result[2]))
    await preview.screenshot({ path: testInfo.outputPath(`${name}.png`) })
  }
  expect(images.size).toBe(layouts.length)
  await page.locator('.share-dialog').screenshot({ path: testInfo.outputPath('desktop.png') })

  for (const [label, height] of [['Square 1:1', 1080], ['Landscape 4:3', 810]] as const) {
    await page.getByRole('button', { name: label }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), downloadImage.click()])
    const bytes = await readFile((await download.path())!)
    expect(download.suggestedFilename()).toMatch(/\.jpg$/)
    const dimensions = await page.evaluate(async data => {
      const image = new Image()
      image.src = `data:image/jpeg;base64,${data}`
      await image.decode()
      return [image.naturalWidth, image.naturalHeight]
    }, bytes.toString('base64'))
    expect(dimensions).toEqual([1080, height])
  }

  await page.getByRole('button', { name: 'Story 9:16' }).click()
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const dialog = page.locator('.share-dialog')
    expect(await dialog.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(width)
    await dialog.screenshot({ path: testInfo.outputPath(`phone-${width}.png`) })
  }
  await page.getByRole('button', { name: '10s video' }).click()
  await page.getByRole('button', { name: 'Create video' }).click()
  const video = page.locator('.share-stage video')
  await expect(video).toBeVisible({ timeout: 45_000 })
  await expect.poll(() => video.evaluate(node => Number.isFinite(node.duration) ? node.duration : 0)).toBeCloseTo(10, 0)
  expect(await video.evaluate(node => [node.videoWidth, node.videoHeight])).toEqual([1080, 1920])
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download video' }).click()])
  await download.saveAs(testInfo.outputPath('flipbook.mp4'))
  expect((await readFile((await download.path())!)).subarray(4, 8).toString()).toBe('ftyp')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Share sketchbook' })).toBeFocused()
  await expect(page).toHaveURL(link)
})

test('only offers artwork export to the owner of a published sketchbook', async ({ page, context, account, browser }) => {
  await seedBook(context.request, { title: 'Private studies', visibility: 'private' })
  const publicId = await seedBook(context.request, { title: 'Published studies' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Private studies' }).click()
  await expect(page.getByRole('heading', { name: 'Private studies', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share sketchbook' })).toHaveCount(0)

  const guest = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const reader = await guest.newPage()
    await reader.goto(`/@${account.username}/${publicId}`)
    await expect(reader.locator('dialog').getByRole('heading', { name: 'Published studies' })).toBeVisible()
    await reader.getByRole('button', { name: 'Share sketchbook' }).click()
    await expect(reader.getByLabel('Public link')).toHaveValue(new URL(`/@${account.username}/${publicId}`, page.url()).href)
    await expect(reader.getByRole('button', { name: 'Download image' })).toHaveCount(0)
  } finally {
    await guest.close()
  }
})
