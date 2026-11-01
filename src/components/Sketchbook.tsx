import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PageFlip } from 'page-flip'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, ArrowRight, BookOpen, CornersOut, ArrowUpRight } from '@phosphor-icons/react'
import type { Artwork, BookPreset, TurnStyle } from '../data/presets'

gsap.registerPlugin(useGSAP)

export interface SketchbookProps {
  preset: BookPreset
  coverColor: string
  aspectRatio: number
  turnStyle: TurnStyle
  title: string
  artworks: Artwork[]
  texture?: boolean
}

function Cover({ preset, title, count, back = false }: { preset: BookPreset; title: string; count: number; back?: boolean }) {
  return <div className={`book-page cover material-${preset.id} ${back ? 'back-cover' : ''}`} data-density="hard">
    <div className="cover-spine" />
    {back ? <div className="back-cover-mark"><BookOpen weight="thin" size={24} /><span>Room for more.</span></div> : <>
      <div className="cover-kicker">SKETCHBOOK {preset.number}</div>
      <div className="cover-type"><span>{title}</span><small>{preset.subtitle}</small></div>
      {preset.id === 'linen' && <div className="cover-window"><img src="/artworks/roses.jpg" alt="" /><span>STUDIES IN NATURE</span></div>}
      {preset.id === 'archive' && <div className="archive-frame"><BookOpen size={32} weight="thin" /><span>A PERSONAL COLLECTION</span></div>}
      {preset.id === 'softcover' && <div className="softcover-lines"><i /><i /><i /><span>VOL. 01 / WORKS & OBSERVATIONS</span></div>}
      <div className="cover-bottom"><span>ART, IN YOUR OWN TIME.</span><span>01—{String(count).padStart(2, '0')}</span></div>
    </>}
  </div>
}

function ArtworkPage({ artwork, index }: { artwork: Artwork; index: number }) {
  return <div className={`book-page art-page ${index % 2 === 0 ? 'page-left' : 'page-right'}`}>
    <div className="page-inner">
      <div className="page-topline"><span>OBSERVATIONS / {String(index + 1).padStart(2, '0')}</span><span>○</span></div>
      <figure className="artwork-mount">
        <img src={artwork.src} alt={`${artwork.title} by ${artwork.artist}`} draggable={false} />
      </figure>
      <div className="page-caption"><span>{artwork.title}</span><small>{artwork.medium}</small></div>
      <div className="page-number">{String(index + 1).padStart(2, '0')}</div>
    </div>
  </div>
}

/** The only book renderer. PageFlip owns cloned DOM; React owns the source pages.
 * Keeping those trees separate makes cleanup safe under StrictMode and resizing. */
export default function Sketchbook({ preset, coverColor, aspectRatio, turnStyle, title, artworks, texture = true }: SketchbookProps) {
  const stage = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const pose = useRef<HTMLDivElement>(null)
  const center = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const source = useRef<HTMLDivElement>(null)
  const flip = useRef<PageFlip | null>(null)
  const index = useRef(1)
  const previousArtworks = useRef(artworks)
  const [page, setPage] = useState(1)
  const [turning, setTurning] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [reduced, setReduced] = useState(false)
  const lastPage = artworks.length + (artworks.length % 2) + 1
  const closed = page === 0 || page === lastPage
  const pageWidth = Math.max(90, Math.floor(Math.min((size.width - 68) / 2, (size.height - 64) * aspectRatio, 370)))
  const pageHeight = Math.round(pageWidth / aspectRatio)
  const rgb = coverColor.slice(1).match(/.{2}/g)!.map(channel => parseInt(channel, 16) / 255)
  const coverInk = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > .57 ? '#303a34' : '#f3f0df'

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }))
    if (area.current) observer.observe(area.current)
    return () => { observer.disconnect(); media.removeEventListener('change', update) }
  }, [])

  // Rebuild only when page geometry/content changes. Color and paper are CSS variables.
  useEffect(() => {
    if (!size.width || !mount.current || !source.current) return
    if (previousArtworks.current !== artworks) {
      index.current = 1
      previousArtworks.current = artworks
    }
    const book = document.createElement('div')
    book.className = 'flip-engine'
    mount.current.appendChild(book)
    const nodes = Array.from(source.current.children).map(node => {
      const clone = node.cloneNode(true) as HTMLElement
      if (!clone.classList.contains('cover')) clone.dataset.density = turnStyle === 'hinge' ? 'hard' : 'soft'
      book.appendChild(clone)
      return clone
    })
    const engine = new PageFlip(book, {
      width: pageWidth, height: pageHeight, size: 'fixed',
      showCover: true, usePortrait: false, startPage: Math.min(index.current, lastPage),
      flippingTime: turnStyle === 'curl' ? 850 : turnStyle === 'hinge' ? 1000 : 620,
      drawShadow: true, maxShadowOpacity: turnStyle === 'hinge' ? .22 : .18,
      showPageCorners: !reduced, mobileScrollSupport: true,
      clickEventForward: false, swipeDistance: 24, disableFlipByClick: reduced,
      useMouseEvents: !reduced,
    })
    flip.current = engine
    setTurning(false)
    engine.on('flip', event => {
      index.current = Number(event.data)
      setPage(Number(event.data))
    })
    engine.on('changeState', event => setTurning(event.data !== 'read'))
    engine.loadFromHTML(nodes)
    // Start touch drags when horizontal intent is clear. Upstream waits 250 ms,
    // which can misread a medium-speed swipe as a click on the opposite page.
    // Vertical gestures remain available to the browser for ordinary scrolling.
    const surface = book.querySelector<HTMLElement>('.stf__block')!
    let gesture: { start: { x: number; y: number }; active: boolean } | null = null
    const point = (touch: Touch) => {
      const bounds = surface.getBoundingClientRect()
      return { x: touch.clientX - bounds.left, y: touch.clientY - bounds.top }
    }
    const touchStart = (event: TouchEvent) => {
      event.stopPropagation()
      if (event.touches.length !== 1) {
        if (gesture?.active) { engine.userMove(gesture.start, true); engine.userStop(gesture.start) }
        gesture = null
        return
      }
      gesture = { start: point(event.touches[0]), active: false }
    }
    const touchMove = (event: TouchEvent) => {
      event.stopPropagation()
      if (!gesture || !event.touches[0]) return
      const current = point(event.touches[0])
      const dx = Math.abs(current.x - gesture.start.x)
      const dy = Math.abs(current.y - gesture.start.y)
      if (!gesture.active) {
        if (dy > 8 && dy > dx) { gesture = null; return }
        if (dx < 8) return
        engine.startUserTouch(gesture.start)
        gesture.active = true
      }
      if (event.cancelable) event.preventDefault()
      engine.userMove(current, true)
    }
    const touchEnd = (event: TouchEvent) => {
      event.stopPropagation()
      if (!gesture || !event.changedTouches[0]) return
      if (event.cancelable) event.preventDefault()
      if (!gesture.active) engine.startUserTouch(gesture.start)
      engine.userStop(point(event.changedTouches[0]))
      gesture = null
    }
    const touchCancel = (event: TouchEvent) => {
      event.stopPropagation()
      if (gesture?.active) { engine.userMove(gesture.start, true); engine.userStop(gesture.start) }
      gesture = null
    }
    const handlers = { touchstart: touchStart, touchmove: touchMove, touchend: touchEnd, touchcancel: touchCancel }
    if (!reduced) for (const [name, handler] of Object.entries(handlers)) surface.addEventListener(name, handler as EventListener, { capture: true, passive: false })
    return () => {
      for (const [name, handler] of Object.entries(handlers)) surface.removeEventListener(name, handler as EventListener, { capture: true })
      flip.current = null
      engine.destroy()
      book.remove()
    }
  }, [pageWidth, pageHeight, size.width, turnStyle, artworks, lastPage, title, reduced])

  useGSAP(() => {
    const shift = page === 0 ? -pageWidth / 2 : page === lastPage ? pageWidth / 2 : 0
    gsap.to(center.current, { x: shift, duration: reduced ? 0 : .65, ease: 'power3.inOut', overwrite: true })
    const rotation = preset.id === 'archive' ? -3 : preset.id === 'softcover' ? 2 : -1.4
    gsap.to(pose.current, {
      rotation: reduced ? 0 : rotation + (turning && turnStyle === 'float' ? -2 : 0),
      rotationX: reduced ? 0 : preset.id === 'archive' ? 10 : 0,
      rotationY: reduced ? 0 : preset.id === 'archive' ? -8 : 0,
      y: turning && turnStyle === 'float' && !reduced ? -12 : 0,
      duration: reduced ? 0 : .5, ease: 'power3.out', overwrite: true,
    })
  }, { scope: stage, dependencies: [page, pageWidth, turning, turnStyle, preset.id, reduced] })

  function navigate(direction: 'next' | 'previous', instant = false) {
    const engine = flip.current
    if (!engine || turning) return
    if (reduced || instant) {
      if (direction === 'next') engine.turnToNextPage()
      else engine.turnToPrevPage()
    } else if (direction === 'next') engine.flipNext('bottom')
    else engine.flipPrev('bottom')
  }

  function toggleCover() {
    if (turning || !flip.current) return
    if (closed) {
      if (page === 0) navigate('next')
      else navigate('previous')
    } else if (reduced) flip.current.turnToPage(0)
    else flip.current.flip(0, 'bottom')
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate('next', true) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate('previous', true) }
    if (event.key === 'Home') { event.preventDefault(); flip.current?.turnToPage(0) }
  }

  const visibleStart = Math.min(page, artworks.length)
  const visibleEnd = Math.min(page + 1, artworks.length)
  return <div ref={stage} className={`book-stage preset-${preset.id} ${texture ? 'textured' : ''} ${closed ? 'is-closed' : ''}`}
    style={{ '--cover': coverColor, '--cover-ink': coverInk, '--page-width': `${pageWidth}px`, '--title-scale': Math.max(.58, Math.min(1, 20 / title.length)) } as CSSProperties}>
    <div className="stage-topline"><span><i /> LIVE PREVIEW</span><button className="icon-button" aria-label="Enter fullscreen preview" onClick={() => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void stage.current?.requestFullscreen().catch(() => {})
    }}><CornersOut weight="light" size={18} /></button></div>
    <div className="book-area" ref={area} tabIndex={0} role="region" aria-label="Interactive sketchbook. Use left and right arrow keys to turn pages." onKeyDown={onKeyDown}>
      <div className="book-ground-shadow" style={{ width: closed ? pageWidth * .9 : pageWidth * 1.6 }} />
      <div ref={pose} className="book-pose">
        <div ref={center} className="book-centering">
          <div ref={mount} className="book-mount" style={{ width: pageWidth * 2, height: pageHeight }} />
        </div>
      </div>
    </div>
    <div hidden ref={source} aria-hidden="true">
      <Cover preset={preset} title={title} count={artworks.length} />
      {artworks.map((artwork, i) => <ArtworkPage key={artwork.id} artwork={artwork} index={i} />)}
      {artworks.length % 2 === 1 && <div className="book-page endpaper"><span>To be continued.</span></div>}
      <Cover preset={preset} title={title} count={artworks.length} back />
    </div>
    <div className="stage-bottomline">
      <span className="gesture-hint">{reduced ? 'Use the arrows to explore.' : 'Drag a corner. Discover a page.'}</span>
      <div className="page-navigation">
        <button className="icon-button" aria-label="Previous pages" disabled={page === 0 || turning} onClick={() => navigate('previous')}><ArrowLeft size={18} weight="light" /></button>
        <span aria-live="polite" aria-atomic="true">{closed ? page === 0 ? 'COVER' : 'THE END' : `${String(visibleStart).padStart(2, '0')}—${String(visibleEnd).padStart(2, '0')}`}<small> / {String(artworks.length).padStart(2, '0')}</small></span>
        <button className="icon-button" aria-label="Next pages" disabled={page === lastPage || turning} onClick={() => navigate('next')}><ArrowRight size={18} weight="light" /></button>
      </div>
      <button className="cover-toggle" onClick={toggleCover} disabled={turning}>{closed ? 'Open book' : 'View cover'}{closed ? <ArrowUpRight size={15} /> : <BookOpen size={16} weight="light" />}</button>
    </div>
  </div>
}
