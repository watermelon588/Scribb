import type { Book } from '../Profile'
import { formats, papers, type Artwork, type Placement } from '../data/presets'
import { defaultPlacement } from '../components/PlacementEditor'
import { inkFor } from '../components/Sketchbook'

export const shareFormats = [
  { id: 'story', name: 'Story', ratio: '9:16', width: 1080, height: 1920 },
  { id: 'square', name: 'Square', ratio: '1:1', width: 1080, height: 1080 },
  { id: 'landscape', name: 'Landscape', ratio: '4:3', width: 1080, height: 810 },
] as const
export type ShareFormat = (typeof shareFormats)[number]

export const shareLayouts = [
  { id: 'spread', name: 'Open spread', description: 'A reading view with a full spread and the front cover.', paper: '#eee8d8', ink: '#242d21', accent: '#49563c' },
  { id: 'contact', name: 'Contact sheet', description: 'The cover beside a grid of recent works.', paper: '#d9dec9', ink: '#252c20', accent: '#3a513c' },
  { id: 'pinboard', name: 'Pinboard', description: 'Overlapping prints, tape and a dark paper ground.', paper: '#343c30', ink: '#f5efdf', accent: '#dce2c3' },
  { id: 'exhibition', name: 'Exhibition', description: 'A row of mounted prints with a small cover plate.', paper: '#f2ede7', ink: '#3d2726', accent: '#754c46' },
  { id: 'folio', name: 'Folio', description: 'A large front cover with a column of artwork details.', paper: '#eddfd4', ink: '#3a2c2c', accent: '#713f45' },
] as const
export type ShareLayout = (typeof shareLayouts)[number]

type Rect = [x: number, y: number, width: number, height: number]
type Context = CanvasRenderingContext2D
export type ShareArt = { artwork: Artwork; image: HTMLImageElement }
export type ShareAssets = { cover?: HTMLImageElement; mark: HTMLImageElement; paper: HTMLImageElement; works: ShareArt[] }

function loadImage(src: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    function clear() {
      signal.removeEventListener('abort', abort)
      image.onload = null
      image.onerror = null
    }
    function abort() {
      clear()
      image.removeAttribute('src')
      reject(signal.reason)
    }
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    image.onload = () => { clear(); resolve(image) }
    image.onerror = () => { clear(); reject(new Error('An image could not load for sharing. Try again.')) }
    image.src = src
  })
}

export async function loadShareAssets(book: Book, signal: AbortSignal): Promise<ShareAssets> {
  const recent = book.artworks.filter(art => art.src && !art.blank).slice(-5).reverse()
  const [cover, mark, paper, works] = await Promise.all([
    book.coverImage ? loadImage(book.coverImage, signal) : undefined,
    loadImage('/brand/scribb-mark.png', signal),
    loadImage(papers.find(paper => paper.id === book.paper)?.src ?? '/paper.svg', signal),
    Promise.all(recent.map(async artwork => ({ artwork, image: await loadImage(artwork.src, signal) }))),
    Promise.allSettled([
      document.fonts.load('450 72px "Newsreader Variable"', book.title),
      document.fonts.load('400 26px "Manrope Variable"', `${book.owner?.username} ${book.caption ?? ''}`),
      document.fonts.load('600 42px "Caveat Variable"'),
    ]),
  ])
  return { cover, mark, paper, works }
}

const serif = '"Newsreader Variable", Georgia, serif'
const sans = '"Manrope Variable", sans-serif'
const paperWhite = '#f5f0e5'
const bookRatio = (book: Book) => formats.find(format => format.id === book.format)?.ratio ?? .75

function fill(ctx: Context, rect: Rect, color: string | CanvasGradient) {
  ctx.fillStyle = color
  ctx.fillRect(...rect)
}

function clip(ctx: Context, rect: Rect) {
  ctx.beginPath()
  ctx.rect(...rect)
  ctx.clip()
}

function line(ctx: Context, x: number, y: number, width: number, color: string) {
  fill(ctx, [x, y, width, 1.5], color)
}

function type(ctx: Context, text: string, x: number, y: number, max: number, size: number, color: string, family = sans, weight = 400) {
  ctx.font = `${weight} ${size}px ${family}`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  const characters = Array.from(text)
  let fitted = text
  while (characters.length && ctx.measureText(fitted).width > max) {
    characters.pop()
    fitted = `${characters.join('').trimEnd()}…`
  }
  ctx.fillText(fitted, x, y)
  return ctx.measureText(fitted).width
}

function fit([x, y, w, h]: Rect, ratio: number): Rect {
  const width = Math.min(w, h * ratio)
  const height = width / ratio
  return [x + (w - width) / 2, y + (h - height) / 2, width, height]
}

function picture(ctx: Context, image: HTMLImageElement, box: Rect, crop = false, placement: Placement = defaultPlacement, padX = 0, padY = 0) {
  const [x, y, w, h] = box
  const ratio = image.naturalWidth / image.naturalHeight
  const width = crop ? Math.max(w, h * ratio) : Math.min(w * (1 - 2 * padX), h * (1 - 2 * padY) * ratio)
  const height = width / ratio
  ctx.save()
  clip(ctx, box)
  const dw = width * placement.scale
  const dh = height * placement.scale
  ctx.drawImage(image, x + (w - dw) / 2 + w * placement.x / 100, y + (h - dh) / 2 + h * placement.y / 100, dw, dh)
  ctx.restore()
}

function shadow(ctx: Context, rect: Rect, color: string, depth = 1) {
  ctx.save()
  const scale = ctx.getTransform().a || 1
  ctx.shadowColor = '#1c1d1b46'
  ctx.shadowBlur = 27 * Math.abs(scale) * depth
  ctx.shadowOffsetY = 12 * Math.abs(scale) * depth
  fill(ctx, rect, color)
  ctx.restore()
}

function paper(ctx: Context, assets: ShareAssets, rect: Rect) {
  fill(ctx, rect, paperWhite)
  ctx.save()
  ctx.globalAlpha = .64
  picture(ctx, assets.paper, rect, true)
  ctx.restore()
}

function binding(ctx: Context, book: Book, [x, y, w, h]: Rect, closed: boolean) {
  if (book.presetId === 'spiral') {
    const r = Math.min(w, h) * .035
    ctx.lineWidth = Math.max(1, r * .24)
    for (let n = 1; n < 15; n++) {
      const yy = y + n * h / 15
      ctx.beginPath()
      ctx.ellipse(x + (closed ? 0 : w / 2), yy, r, r * .43, -.12, 0, 2 * Math.PI)
      ctx.strokeStyle = '#272725'
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(x + (closed ? 0 : w / 2), yy - r * .12, r, r * .43, -.12, Math.PI, 2 * Math.PI)
      ctx.strokeStyle = '#b6b4a9'
      ctx.stroke()
    }
  } else if (closed && book.presetId === 'watercolor') {
    const bx = x + w * .86
    const bw = w * .043
    fill(ctx, [bx + 2, y, bw, h], '#1c1d1b50')
    fill(ctx, [bx, y, bw, h], book.bandColor ?? '#2464ed')
    for (let i = 1; i < 7; i++) fill(ctx, [bx + bw * i / 7, y, .75, h], '#fff3')
  }
}

export function drawShareCover(ctx: Context, book: Book, assets: ShareAssets, box: Rect) {
  const [x, y, w, h] = fit(box, bookRatio(book))
  shadow(ctx, [x + 3, y + 5, w, h], '#d1c6af')
  ctx.save()
  clip(ctx, [x, y, w, h])
  fill(ctx, [x, y, w, h], book.color)
  if (assets.cover) picture(ctx, assets.cover, [x, y, w, h], true, book.coverPlacement)
  else {
    const ink = inkFor(book.color)
    type(ctx, 'S K E T C H B O O K', x + w * .12, y + h * .17, w * .75, w * .044, ink)
    type(ctx, book.title, x + w * .12, y + h * .47, w * .75, w * .115, ink, serif)
    line(ctx, x + w * .12, y + h * .56, w * .49, ink)
  }
  const spine = ctx.createLinearGradient(x, y, x + w * .065, y)
  spine.addColorStop(0, '#18170f61')
  spine.addColorStop(.35, '#ffffff1a')
  spine.addColorStop(1, '#231f1400')
  fill(ctx, [x, y, w * .065, h], spine)
  if (book.caption) {
    ctx.textAlign = 'center'
    ctx.globalCompositeOperation = 'difference'
    type(ctx, book.caption, x + w * .47, y + h * .93, w * .72, w * .028, '#fff')
  }
  ctx.restore()
  binding(ctx, book, [x, y, w, h], true)
}

function pageContent(ctx: Context, assets: ShareAssets, rect: Rect, work?: ShareArt) {
  paper(ctx, assets, rect)
  if (work) picture(ctx, work.image, rect, false, work.artwork.placement, .05, .08)
}

export function drawShareSpread(ctx: Context, book: Book, assets: ShareAssets, box: Rect, primary?: ShareArt, companion?: ShareArt) {
  const [x, y, w, h] = fit(box, bookRatio(book) * 2)
  const half = w / 2
  shadow(ctx, [x - 3, y + 7, w + 6, h], book.color)
  if (primary?.artwork.layout === 'spread') pageContent(ctx, assets, [x, y, w, h], primary)
  else {
    pageContent(ctx, assets, [x, y, half, h], companion?.artwork.layout === 'page' || !companion?.artwork.layout ? companion : undefined)
    pageContent(ctx, assets, [x + half, y, half, h], primary)
  }
  const fold = ctx.createLinearGradient(x + half - w * .05, y, x + half + w * .05, y)
  fold.addColorStop(0, '#463b2400')
  fold.addColorStop(.48, '#463b2438')
  fold.addColorStop(.5, '#463b2466')
  fold.addColorStop(.53, '#fff7')
  fold.addColorStop(1, '#fff0')
  fill(ctx, [x + half - w * .05, y, w * .1, h], fold)
  binding(ctx, book, [x, y, w, h], false)
}

function print(ctx: Context, work: ShareArt, [x, y, w, h]: Rect, angle = 0, tape = false) {
  const pad = Math.min(w, h) * .045
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(angle)
  shadow(ctx, [-w / 2, -h / 2, w, h], '#f7f1e7', .55)
  picture(ctx, work.image, [-w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2])
  if (tape) {
    ctx.rotate(-angle * 1.55)
    fill(ctx, [-w * .16, -h / 2 - 11, w * .32, 25], '#ead8a6ba')
    line(ctx, -w * .16, -h / 2 + 13, w * .32, '#fff6')
  }
  ctx.restore()
}

function titleBlock(ctx: Context, book: Book, layout: ShareLayout, y: number, wide: boolean) {
  const left = 76
  type(ctx, `@${book.owner?.username ?? ''}`, left, y, 780, 24, layout.accent, sans, 550)
  const size = wide ? 66 : 78
  type(ctx, book.title, left, y + (wide ? 47 : 57), 928, size, layout.ink, serif, 450)
  if (book.caption) type(ctx, book.caption, left, y + (wide ? 90 : 108), 928, 24, layout.accent)
}

function watermark(ctx: Context, assets: ShareAssets, color: string, x: number, y: number) {
  ctx.drawImage(assets.mark, x, y - 23, 46, 46)
  type(ctx, 'Scribb', x + 51, y, 130, 39, color, '"Caveat Variable", cursive', 600)
}

function linkSticker(ctx: Context, text: string, x: number, y: number, color: string) {
  ctx.save()
  ctx.font = `550 24px ${sans}`
  const w = Math.min(714, ctx.measureText(text).width + 72)
  ctx.beginPath()
  ctx.roundRect(x, y - 24, w, 48, 11)
  ctx.fillStyle = color
  ctx.fill()
  type(ctx, '↗', x + 16, y, 31, 26, '#fff9e8')
  type(ctx, text, x + 47, y, w - 57, 24, '#fff9e8', sans, 550)
  ctx.restore()
}

export function shareBookUrl(book: Book) {
  return `${location.origin}/@${encodeURIComponent(book.owner!.username)}/${encodeURIComponent(book.id)}`
}

export function drawShareBoard(canvas: HTMLCanvasElement, book: Book, assets: ShareAssets, layout: ShareLayout, format: ShareFormat, width: number = format.width) {
  const height = Math.round(width * format.height / format.width)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.scale(width / 1080, width / 1080)
  const story = format.id === 'story'
  const wide = format.id === 'landscape'
  const heading = story ? 243 : wide ? 55 : 73
  const top = heading + (book.caption ? (wide ? 119 : 145) : (wide ? 104 : 123))
  const footer = format.height - (story ? 291 : 65)
  const field = footer - top - (story ? 96 : 53)
  const area = (x: number, y: number, w: number, h: number): Rect => [76 + x * 928, top + y * field, w * 928, h * field]
  const [a, b, c, d, e] = assets.works

  fill(ctx, [0, 0, 1080, format.height], layout.paper)
  titleBlock(ctx, book, layout, heading, wide)

  if (!a) drawShareCover(ctx, book, assets, area(.15, .02, .7, .93))
  else if (layout.id === 'spread') {
    const spread = assets.works.find(work => work.artwork.layout === 'spread')
    drawShareSpread(ctx, book, assets, area(0, 0, story ? 1 : .74, story ? .72 : .97), spread ?? a, b)
    const detail = assets.works.find(work => work !== (spread ?? a) && (spread || work !== b))
    if (story && detail) print(ctx, detail, area(.04, .69, .5, .29), -.055)
    drawShareCover(ctx, book, assets, area(story ? .54 : .77, story ? .64 : .29, story ? .4 : .23, story ? .36 : .62))
  } else if (layout.id === 'contact') {
    const cover = story ? area(.13, 0, .74, .38) : area(.015, .11, .34, .78)
    drawShareCover(ctx, book, assets, cover)
    const columns = Math.min(assets.works.length, story ? 3 : 2)
    const rows = Math.ceil(assets.works.length / columns)
    assets.works.forEach((work, i) => {
      const row = Math.floor(i / columns)
      const items = Math.min(columns, assets.works.length - row * columns)
      const stepX = (story ? .99 : .59) / columns
      const stepY = (story ? .54 : .97) / rows
      const left = (story ? .005 : .41) + stepX * (i % columns + (columns - items) / 2)
      const slot = area(left + .008, (story ? .445 : .012) + row * stepY, stepX - .019, stepY - .024)
      print(ctx, work, slot)
    })
  } else if (layout.id === 'pinboard') {
    if (d) print(ctx, d, area(.55, .02, .41, .42), .105, true)
    if (c) print(ctx, c, area(.08, .49, .43, .47), -.09, true)
    if (b) print(ctx, b, area(.55, .52, .43, .45), .079, true)
    drawShareCover(ctx, book, assets, area(.03, .005, .45, .61))
    print(ctx, a, area(.36, .19, .46, .53), -.036, true)
  } else if (layout.id === 'exhibition') {
    line(ctx, 76, top + field * .045, 928, layout.accent)
    const gallery = [a, b, c].filter((work): work is ShareArt => Boolean(work))
    if (story) {
      print(ctx, a, area(.07, .085, .86, .46))
      if (b) print(ctx, b, area(.015, .59, .34, .29))
      if (c) print(ctx, c, area(.375, .59, .29, .29))
      drawShareCover(ctx, book, assets, area(.69, .58, .29, .4))
    } else {
      const cell = 1 / gallery.length
      gallery.forEach((work, index) => print(ctx, work, area(index * cell + .015, .11, cell - .03, .54)))
      drawShareCover(ctx, book, assets, area(.77, .69, .21, .31))
    }
    type(ctx, a.artwork.title, 78, top + field * .945, 620, 22, layout.accent, serif)
  } else {
    fill(ctx, area(0, .045, .57, .91), layout.accent)
    drawShareCover(ctx, book, assets, area(.04, .1, .49, .8))
    const details = [a, b, c, e ?? d].filter((work): work is ShareArt => Boolean(work))
    const cell = .93 / details.length
    details.forEach((work, i) => print(ctx, work, area(.625, .04 + i * cell, .375, cell - .028)))
  }

  const domain = new URL(shareBookUrl(book)).host
  linkSticker(ctx, `${domain}/@${book.owner!.username}`, 76, footer, layout.id === 'pinboard' ? '#62674a' : layout.accent)
  watermark(ctx, assets, layout.ink, 865, footer)
}

export function canvasFile(canvas: HTMLCanvasElement, name: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(new File([blob], name, { type: 'image/jpeg' })) : reject(new Error('The image could not be exported. Try again.')), 'image/jpeg', .94)
  })
}

export const flipbookDuration = 10

/** A time-addressable composition so previewing and encoding use the same frames. */
export function composeFlipbook(book: Book, assets: ShareAssets, format: ShareFormat) {
  const layout = shareLayouts[0]
  const heading = format.id === 'story' ? 243 : format.id === 'landscape' ? 55 : 73
  const footer = format.height - (format.id === 'story' ? 291 : 65)
  const start = heading + (book.caption ? 153 : 130)
  const field: Rect = [79, start, 922, footer - start - 107]
  const [x, y, w, h] = fit(field, bookRatio(book) * 2)
  const half = w / 2
  const coverBox: Rect = [x + half / 2, y, half, h]

  function layer(draw: (ctx: Context) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = format.width
    canvas.height = format.height
    draw(canvas.getContext('2d')!)
    return canvas
  }

  const backdrop = layer(ctx => {
    fill(ctx, [0, 0, format.width, format.height], layout.paper)
    titleBlock(ctx, book, layout, heading, format.id === 'landscape')
    linkSticker(ctx, `${location.host}/@${book.owner!.username}`, 76, footer, layout.accent)
    watermark(ctx, assets, layout.ink, 865, footer)
  })
  const cover = layer(ctx => drawShareCover(ctx, book, assets, coverBox))
  const leaves = assets.works.map(work => layer(ctx => drawShareSpread(ctx, book, assets, field, work)))
  const turnTime = .55
  const opening = 1.1
  const ending = 8.6
  const pageTime = (ending - opening) / Math.max(1, leaves.length)

  function turn(ctx: Context, previous: HTMLCanvasElement, amount: number, fromCover: boolean) {
    const eased = (1 - Math.cos(Math.PI * amount)) / 2
    const angle = eased * Math.PI
    const hinge = x + half
    const strip = half / 32
    const shadowX = hinge + Math.cos(angle) * half
    const shade = ctx.createLinearGradient(Math.min(hinge, shadowX) - 32, y, Math.max(hinge, shadowX) + 32, y)
    shade.addColorStop(0, '#34281700')
    shade.addColorStop(.5, `rgba(52, 40, 23, ${.27 * Math.sin(angle)})`)
    shade.addColorStop(1, '#34281700')
    fill(ctx, [Math.min(hinge, shadowX) - 32, y, Math.abs(hinge - shadowX) + 64, h], shade)

    // Project narrow strips around the spine, with extra lift toward the free edge.
    for (let i = 31; i >= 0; i--) {
      const u = i / 32
      const project = (t: number) => hinge + Math.cos(angle + .35 * t * Math.sin(angle)) * half * t
      const a = project(u)
      const b = project((i + 1) / 32)
      const lift = Math.sin(angle) * u * h * .08
      const stripRect: Rect = [Math.min(a, b), y - lift, Math.abs(b - a) + .8, h + lift * .3]
      if (b > a) {
        ctx.drawImage(previous, (fromCover ? coverBox[0] : hinge) + strip * i, y, strip, h, ...stripRect)
        fill(ctx, stripRect, `rgba(49, 42, 31, ${.19 * Math.sin(angle) * (1 - u)})`)
      } else {
        fill(ctx, stripRect, `rgb(${245 - u * 18}, ${239 - u * 18}, ${225 - u * 16})`)
      }
    }
  }

  return (ctx: Context, seconds: number) => {
    ctx.drawImage(backdrop, 0, 0)
    if (seconds < opening || !leaves.length || seconds >= ending) {
      ctx.drawImage(cover, 0, 0)
      if (seconds >= ending) type(ctx, 'Open the full sketchbook', 76, footer - 58, 930, 34, layout.ink, serif)
      return
    }
    const i = Math.min(leaves.length - 1, Math.floor((seconds - opening) / pageTime))
    const elapsed = seconds - opening - pageTime * i
    const work = assets.works[i]
    ctx.drawImage(leaves[i], 0, 0)
    if (elapsed < turnTime) turn(ctx, leaves[i - 1] ?? cover, elapsed / turnTime, i === 0)
    type(ctx, work.artwork.title, 76, footer - 58, 900, 29, layout.accent, serif)
  }
}
