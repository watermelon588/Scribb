import ElasticBand from './ElasticBand'
import {placementStyle} from './PlacementEditor'
import type {Placement} from '../data/presets'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useMemo, type CSSProperties, type ReactNode } from 'react'
import { PageFlip } from 'page-flip'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, ArrowRight, BookOpen, CornersOut, Cube, ArrowUpRight, ArrowCounterClockwise, SidebarSimple } from '@phosphor-icons/react'
import type { Artwork, BookPreset, TurnStyle } from '../data/presets'

gsap.registerPlugin(useGSAP)

const THUMB = 72

export interface SketchbookProps {
  preset: BookPreset
  coverColor: string
  aspectRatio: number
  turnStyle: TurnStyle
  title: string
  caption?: string
  artworks: Artwork[]
  texture?: boolean
  paper?: string
  coverImage?: string
  initiallyClosed?: boolean
  coverPlacement?: Placement
  bandColor?: string
  /** Prepared `.book-page` leaves, for books that are not artwork pages. */
  pages?: ReactNode[]
  /** Width of the fixed sheet that leaves are drawn on, scaled to the page. */
  sheetWidth?: number
  maxPage?: number
  kicker?: string
  /** Journal cover layouts, drawn over the cover material. */
  front?: ReactNode
  back?: ReactNode
  /** Turns to a cover whenever this changes, e.g. while that cover is being edited. */
  show?: { side: 'front' | 'back'; at: number }
  /** Drawn over the front cover after its layout, e.g. a journal's stickers. */
  overlay?: ReactNode
  /** Page to open on, e.g. a journal's latest entry. Overrides initiallyClosed. */
  startPage?: number
}

/** Cover text color that stays readable on the chosen cover color. */
export function inkFor(color: string) {
  const rgb = color.slice(1).match(/.{2}/g)!.map(channel => parseInt(channel, 16) / 255)
  return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > .57 ? '#303a34' : '#f3f0df'
}

export function Cover({ preset, title, count, caption, back = false, coverImage, coverPlacement, kicker = 'SKETCHBOOK', face, overlay }: { preset: BookPreset; title: string; count: number; caption?: string; back?: boolean; coverImage?: string; coverPlacement?: Placement; kicker?: string; face?: ReactNode; overlay?: ReactNode }) {
  return <div className={`book-page cover material-${preset.id} ${back ? 'back-cover' : ''} ${coverImage && !back ? 'image-cover' : ''}`} data-density="hard">
    {coverImage && !back && <img className="cover-art-image" src={coverImage} alt="" style={placementStyle(coverPlacement)} />}
    <div className="cover-spine" />
    {!back && caption && !face && <div className="cover-phrase">{caption}</div>}
    {back || face ? null : <>
      <div className="cover-kicker">{kicker} {preset.number}</div>
      <div className="cover-type"><span>{title}</span><small>{preset.subtitle}</small></div>
      {preset.id === 'linen' && <div className="cover-window"><img src="/artworks/roses.jpg" alt="" /><span>STUDIES IN NATURE</span></div>}
      {preset.id === 'spiral' && <img className="spiral-illustration" src="/covers/love.jpg" alt="" />}
      {preset.id === 'spiral' && <div className="spiral-frame"><BookOpen size={32} weight="thin" /><span>A PERSONAL COLLECTION</span></div>}
      {preset.id === 'watercolor' && <div className="watercolor-lines"><i /><i /><i /><span>VOL. 01 / WORKS & OBSERVATIONS</span></div>}
      <div className="cover-bottom"><span>ART, IN YOUR OWN TIME.</span><span>01—{String(count).padStart(2, '0')}</span></div>
    </>}
    {face}
    {!back && overlay}
  </div>
}

function ArtworkPage({ artwork, index }: { artwork: Artwork; index: number }) {
  if (artwork.blank) return <div className="book-page endpaper" />
  return <div className={`book-page art-page ${index % 2 === 0 ? 'page-left' : 'page-right'}`}>
    <div className="page-inner">
      <div className="page-topline"><span>OBSERVATIONS / {String(index + 1).padStart(2, '0')}</span><span>○</span></div>
      <figure className={`artwork-mount ${artwork.spreadSide ? `spread-art spread-${artwork.spreadSide}` : ''}`}>
        <div className="art-image-frame"><img src={artwork.src} alt={`${artwork.title} by ${artwork.artist}`} draggable={false} style={placementStyle(artwork.placement)} /></div>
      </figure>
      <div className="page-caption"><span>{artwork.title}</span><small>{artwork.medium}</small></div>
      <div className="page-number">{String(index + 1).padStart(2, '0')}</div>
    </div>
  </div>
}

/** The only book renderer. PageFlip owns cloned DOM; React owns the source pages.
 * Keeping those trees separate makes cleanup safe under StrictMode and resizing. */
export default function Sketchbook({ preset, coverColor, aspectRatio, turnStyle, title, caption, artworks, texture = true, paper = "/paper.svg", coverImage, coverPlacement, bandColor = '#2464ed', initiallyClosed = false, pages, sheetWidth, maxPage = 370, kicker, front, back, overlay, show, startPage }: SketchbookProps) {
  const stage = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const pose = useRef<HTMLDivElement>(null)
  const orbitBox = useRef<HTMLDivElement>(null)
  const angle = useRef({ x: 0, y: 0, z: 0 })
  const turnTo = useRef<((next: { x: number; y: number; z: number }) => void) | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [orbit, setOrbit] = useState(false)
  const center = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const source = useRef<HTMLDivElement>(null)
  const [bindingHost, setBindingHost] = useState<HTMLElement | null>(null)
  const flip = useRef<PageFlip | null>(null)
  const firstPage = startPage ?? (preset.id === 'watercolor' || initiallyClosed ? 0 : 1)
  const index = useRef(firstPage)
  const snap = useRef(false)
  const [rail, setRail] = useState(false)
  const previousArtworks = useRef(artworks)
  const [page, setPage] = useState(firstPage)
  const [bandReleased, setBandReleased] = useState(false)
  const [bandBusy, setBandBusy] = useState(false)
  const [bandOpening, setBandOpening] = useState(false)
  const [turning, setTurning] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [reduced, setReduced] = useState(false)
  const pageArtworks = useMemo(() => {
    const pages: Artwork[] = []
    artworks.forEach(art => {
      if (art.layout === 'spread') {
        if (pages.length % 2) pages.push({...art, id: art.id+'-blank', blank: true})
        pages.push({...art, id: art.id+'-left', spreadSide: 'left'}, {...art, id: art.id+'-right', spreadSide: 'right'})
      } else pages.push(art)
    })
    return pages
  }, [artworks])
  const leafCount = pages?.length ?? pageArtworks.length
  const lastPage = leafCount + (leafCount % 2) + 1
  const closed = page === 0 || page === lastPage
  const bandLocked = preset.id === 'watercolor' && closed && !bandReleased
  // Prepared pages stay readable on phones by showing one page at a time.
  const portrait = Boolean(pages) && size.width > 0 && size.width < 640
  const pageWidth = Math.max(90, Math.floor(Math.min(portrait ? size.width - 24 : (size.width - 68) / 2, (size.height - 64) * aspectRatio, maxPage)))
  const pageHeight = Math.round(pageWidth / aspectRatio)
  const coverInk = inkFor(coverColor)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }))
    if (area.current) observer.observe(area.current)
    return () => { observer.disconnect(); media.removeEventListener('change', update) }
  }, [])

  // Declared before the rebuild effect, so a rebuild in the same commit also opens on this cover.
  useEffect(() => {
    if (!show) return
    const target = show.side === 'front' ? 0 : lastPage
    index.current = target
    setPage(target)
    flip.current?.turnToPage(target)
  }, [show, lastPage])

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
      showCover: true, usePortrait: portrait, startPage: Math.min(index.current, lastPage),
      flippingTime: turnStyle === 'curl' ? 850 : turnStyle === 'hinge' ? 1000 : 620,
      drawShadow: true, maxShadowOpacity: turnStyle === 'hinge' ? .22 : .18,
      showPageCorners: !reduced && preset.id !== 'watercolor', mobileScrollSupport: true,
      clickEventForward: false, swipeDistance: 24, disableFlipByClick: reduced,
      useMouseEvents: !reduced,
    })
    flip.current = engine
    setTurning(false)
    engine.on('flip', event => {
      index.current = Number(event.data)
      setPage(Number(event.data))
      if (Number(event.data) === 0 || Number(event.data) === lastPage) setBandReleased(false)
    })
    engine.on('changeState', event => {setTurning(event.data !== 'read');if(event.data === 'read')setBandOpening(false)})
    engine.loadFromHTML(nodes)
    // Start touch drags when horizontal intent is clear. Upstream waits 250 ms,
    // which can misread a medium-speed swipe as a click on the opposite page.
    // Vertical gestures remain available to the browser for ordinary scrolling.
    const surface = book.querySelector<HTMLElement>('.stf__block')!
    setBindingHost(surface)
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
  }, [pageWidth, pageHeight, size.width, turnStyle, artworks, pages, portrait, lastPage, title, caption, reduced, coverImage, coverPlacement, front, back, overlay])

  useGSAP(() => {
    const shift = portrait ? 0 : page === 0 ? -pageWidth / 2 : page === lastPage ? pageWidth / 2 : 0
    // Turning the book over swaps covers while it is edge-on, so the cover must not slide.
    gsap.to(center.current, { x: shift, duration: reduced || snap.current ? 0 : .65, ease: 'power3.inOut', overwrite: true })
    snap.current = false
    gsap.set(pose.current, { rotation: 0, rotationX: 0, rotationY: 0, y: 0 })
  }, { scope: stage, dependencies: [page, pageWidth, portrait, turning, turnStyle, preset.id, reduced] })

  // Journals only: the 3D view turns the whole book as one object. Short eased follow-through makes drags feel weighted.
  useGSAP(() => {
    if (!orbitBox.current) return
    const options = { duration: reduced ? 0 : .5, ease: 'power3.out' }
    const rx = gsap.quickTo(orbitBox.current, 'rotationX', options), ry = gsap.quickTo(orbitBox.current, 'rotationY', options), rz = gsap.quickTo(orbitBox.current, 'rotation', options)
    turnTo.current = next => {
      angle.current = { x: Math.max(-65, Math.min(65, next.x)), y: next.y, z: Math.max(-40, Math.min(40, next.z)) }
      rx(angle.current.x); ry(angle.current.y); rz(angle.current.z)
    }
  }, { scope: stage, dependencies: [reduced, Boolean(pages)] })

  function toggleOrbit() {
    const next = !orbit
    setOrbit(next)
    pointers.current.clear()
    turnTo.current?.(next ? { x: 16, y: -28, z: 0 } : { x: 0, y: 0, z: 0 })
    // Flat again: drop the transform so the page-turn engine measures an untransformed book.
    gsap.to(orbitBox.current, { scale: next ? .84 : 1, duration: reduced ? 0 : .6, ease: 'power3.inOut', overwrite: 'auto', onComplete: () => { if (!next) gsap.set(orbitBox.current, { clearProps: 'transform' }) } })
  }
  function orbitDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!orbit || (event.target as HTMLElement).closest('button')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  function orbitMove(event: React.PointerEvent<HTMLDivElement>) {
    const last = pointers.current.get(event.pointerId)
    if (!orbit || !last) return
    const next = { ...angle.current }
    if (pointers.current.size === 2) {
      // Two fingers twist the book, like turning a real one on a table.
      const other = [...pointers.current].find(([id]) => id !== event.pointerId)![1]
      const before = Math.atan2(last.y - other.y, last.x - other.x), after = Math.atan2(event.clientY - other.y, event.clientX - other.x)
      next.z += (after - before) * 180 / Math.PI
    } else if (event.shiftKey) next.z += (event.clientX - last.x) * .3
    else { next.y += (event.clientX - last.x) * .4; next.x -= (event.clientY - last.y) * .3 }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    turnTo.current?.(next)
  }
  const orbitUp = (event: React.PointerEvent) => { pointers.current.delete(event.pointerId) }


  function navigate(direction: 'next' | 'previous', instant = false) {
    const engine = flip.current
    if (!engine || turning || bandLocked || bandBusy) return
    if (reduced || instant) {
      if (direction === 'next') engine.turnToNextPage()
      else engine.turnToPrevPage()
    } else if (direction === 'next') engine.flipNext('bottom')
    else engine.flipPrev('bottom')
  }

  function toggleCover() {
    if (bandBusy || !flip.current) return
    if (bandLocked) { setBandBusy(true); return }
    if (turning) return
    if (closed) {
      if (page === 0) navigate('next')
      else navigate('previous')
    } else if (reduced) flip.current.turnToPage(0)
    else flip.current.flip(0, 'bottom')
  }

  function goTo(target: number) {
    const engine = flip.current
    if (!engine || turning || bandLocked || bandBusy || target === page) return
    if (portrait) setRail(false)
    if (reduced) engine.turnToPage(target)
    else engine.flip(target, 'bottom')
  }

  // From the back cover, turn the closed book over like a real one, then show the front.
  function backToStart() {
    const engine = flip.current
    if (!engine || turning) return
    const front = () => { snap.current = true; index.current = 0; setPage(0); engine.turnToPage(0) }
    if (reduced || orbit) { front(); return }
    gsap.timeline({ onComplete: () => { gsap.set(orbitBox.current, { clearProps: 'transform' }) } })
      .to(orbitBox.current, { rotationY: 90, duration: .3, ease: 'power2.in', onComplete: front })
      .fromTo(orbitBox.current, { rotationY: -90 }, { rotationY: 0, duration: .4, ease: 'power2.out' })
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest('button')) return
    if (orbit) {
      const step: Record<string, [number, number, number]> = { ArrowUp: [8, 0, 0], ArrowDown: [-8, 0, 0], ArrowLeft: event.shiftKey ? [0, 0, -6] : [0, -12, 0], ArrowRight: event.shiftKey ? [0, 0, 6] : [0, 12, 0] }
      const move = step[event.key]
      if (move) { event.preventDefault(); const { x, y, z } = angle.current; turnTo.current?.({ x: x + move[0], y: y + move[1], z: z + move[2] }) }
      return
    }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate('next', true) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate('previous', true) }
    if (bandLocked || bandBusy) return
    if (event.key === 'Home') { event.preventDefault(); flip.current?.turnToPage(0) }
  }

  const sheets = [
    <Cover key="cover-front" preset={preset} title={title} caption={caption} count={leafCount} coverImage={coverImage} coverPlacement={coverPlacement} kicker={kicker} face={front} overlay={overlay} />,
    ...(pages ?? pageArtworks.map((artwork, i) => <ArtworkPage key={artwork.id} artwork={artwork} index={i} />)),
    leafCount % 2 === 1 && <div key="filler" className="book-page endpaper"><span>To be continued.</span></div>,
    <Cover key="cover-back" preset={preset} title={title} caption={caption} count={leafCount} coverImage={coverImage} coverPlacement={coverPlacement} back face={back} />,
  ].filter(Boolean)
  // Page i is showing: alone in portrait, otherwise beside its partner in the spread (1-2, 3-4, …).
  const showing = (i: number) => portrait ? i === page : Math.ceil(i / 2) === Math.ceil(page / 2)
  const visibleStart = Math.min(page, leafCount)
  const visibleEnd = Math.min(page + 1, leafCount)
  return <div ref={stage} className={`book-stage preset-${preset.id} ${pages ? 'is-journal' : ''} ${portrait ? 'is-portrait' : ''} ${texture ? 'textured' : ''} ${closed ? 'is-closed' : ''} ${page === lastPage ? 'is-back' : ''} ${bandLocked ? 'band-locked' : ''} ${orbit ? 'is-orbit' : ''} ${rail ? 'has-rail' : ''}`}
    style={{ '--band-color': bandColor, '--paper-image': `url("${paper}")`, '--cover': coverColor, '--cover-ink': coverInk, '--page-width': `${pageWidth}px`, '--sheet-scale': sheetWidth ? pageWidth / sheetWidth : undefined, '--title-scale': Math.max(.58, Math.min(1, 20 / title.length)) } as CSSProperties}>
    <div className="stage-topline">{pages && <button className="icon-button" aria-label="Pages" aria-pressed={rail} title={rail ? 'Hide pages' : 'Show pages'} onClick={() => setRail(!rail)}><SidebarSimple weight="light" size={18} /></button>}{pages && <button className="icon-button orbit-toggle" aria-label="3D view" aria-pressed={orbit} title={orbit ? 'Back to flat view' : '3D view: drag to turn, Shift-drag or two fingers to twist'} onClick={toggleOrbit}><Cube weight="light" size={18} /></button>}<button className="icon-button" aria-label="Enter fullscreen preview" onClick={() => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void stage.current?.requestFullscreen().catch(() => {})
    }}><CornersOut weight="light" size={18} /></button></div>
    <div className="book-area" ref={area} tabIndex={0} role="region" aria-label={orbit ? 'Journal in 3D. Use arrow keys to turn it and Shift with left or right to twist it. Turn pages with the buttons.' : `Interactive ${pages ? 'journal' : 'sketchbook'}. Use left and right arrow keys to turn pages.`} onKeyDown={onKeyDown}
      // While locked or turned in 3D, the page-turn engine never sees the gesture; its maths assume a flat page.
      onMouseDownCapture={e=>{if(bandLocked||orbit)e.stopPropagation()}} onMouseMoveCapture={e=>{if(bandLocked||orbit)e.stopPropagation()}} onTouchStartCapture={e=>{if(orbit)e.stopPropagation()}} onTouchMoveCapture={e=>{if(orbit)e.stopPropagation()}}
      // A native image drag would cancel the pointer and stop the turn.
      onPointerDown={orbitDown} onPointerMove={orbitMove} onPointerUp={orbitUp} onPointerCancel={orbitUp} onDragStart={e=>{if(orbit)e.preventDefault()}}>
      <div className="book-ground-shadow" style={{ width: closed ? pageWidth * .9 : pageWidth * 1.6 }} />
      <div ref={orbitBox} className="book-orbit">
      <div ref={pose} className="book-pose">
        <div ref={center} className="book-centering">
          <div ref={mount} className="book-mount" style={{ width: pageWidth * (portrait ? 1 : 2), height: pageHeight }} />
          {preset.id === 'spiral' && bindingHost && createPortal(<div className={`spiral-binding ${closed ? 'binding-closed' : ''}`}>{Array.from({length: 13}, (_,i) => <i key={i} />)}</div>, bindingHost)}
          {preset.id === 'watercolor' && (closed || bandOpening || bandBusy) && <ElasticBand
            height={pageHeight + 6} reduced={reduced} releasing={bandBusy} released={bandReleased || !closed} color={bandColor} edgeOffset={pageWidth * .12}
            onReleaseRequest={() => setBandBusy(true)}
            onReleased={() => { setBandOpening(!reduced); setBandReleased(true); setBandBusy(false); if (page === 0) { if (reduced) flip.current?.turnToNextPage(); else flip.current?.flipNext('bottom') } else { if (reduced) flip.current?.turnToPrevPage(); else flip.current?.flipPrev('bottom') } }} />}


        </div>
        {orbit && <div className={`book-slab ${closed ? page === 0 ? 'is-front' : 'is-back' : ''}`} aria-hidden="true" style={{ width: pageWidth * (closed || portrait ? 1 : 2), height: pageHeight, '--depth': `${Math.round(Math.min(26, pageWidth * .025 + leafCount * .35))}px` } as CSSProperties}><i className="slab-back" /><i className="slab-left" /><i className="slab-right" /><i className="slab-top" /><i className="slab-bottom" /></div>}
      </div>
      </div>
    </div>
    <div hidden ref={source} aria-hidden="true">{sheets}</div>
    {rail && <nav className="page-rail" aria-label="Pages" data-lenis-prevent ref={node => { node?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' }) }}>
      {sheets.map((sheet, i) => <button key={i} className="page-thumb" aria-label={i === 0 ? 'Front cover' : i === lastPage ? 'Back cover' : `Page ${i}`} aria-current={showing(i) || undefined} onClick={() => goTo(i)}
        style={{ width: THUMB, aspectRatio, '--sheet-scale': sheetWidth ? THUMB / sheetWidth : undefined } as CSSProperties}>{sheet}</button>)}
    </nav>}
    <div className="stage-bottomline">
      
      <div className="page-navigation">
        <button className="icon-button" aria-label="Previous pages" disabled={page === 0 || turning || bandLocked || bandBusy} onClick={() => navigate('previous')}><ArrowLeft size={18} weight="light" /></button>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{closed ? page === 0 ? 'COVER' : 'THE END' : `${String(visibleStart).padStart(2, '0')}—${String(visibleEnd).padStart(2, '0')}`}<small> / {String(leafCount).padStart(2, '0')}</small></span>
        <button className="cover-toggle" aria-label={bandLocked ? 'Release band' : closed ? 'Open book' : 'View cover'} title={bandLocked ? 'Release band' : closed ? 'Open book' : 'Close book'} onClick={toggleCover} disabled={(turning && !bandLocked) || bandBusy}>{closed ? <ArrowUpRight size={20} /> : <BookOpen size={20} weight="light" />}</button>
        {pages && page === lastPage
          ? <button className="icon-button" aria-label="Back to start" title="Back to start" disabled={turning} onClick={backToStart}><ArrowCounterClockwise size={18} weight="light" /></button>
          : <button className="icon-button" aria-label="Next pages" disabled={page === lastPage || turning || bandLocked || bandBusy} onClick={() => navigate('next')}><ArrowRight size={18} weight="light" /></button>}
      </div>
    </div>
  </div>
}
