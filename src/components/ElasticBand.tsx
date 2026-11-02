import { useRef, useId } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

interface Props {
  height: number
  reduced: boolean
  released: boolean
  color: string
  edgeOffset: number
  releasing: boolean
  onReleaseRequest: () => void
  onReleased: () => void
}

/** Anchored ribbon: the grab location controls its bend, not a whole-element transform. */
export default function ElasticBand({ height, reduced, releasing, released, color, edgeOffset, onReleaseRequest, onReleased }: Props) {
  const weaveId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const shape = useRef({ x: 0, y: height / 2, anchor: 0, opacity: 1 })
  const drag = useRef<{ x: number; y: number; grabY: number; moved: number } | null>(null)

  function paint() {
    if (!svg.current) return
    const { x, y, anchor, opacity } = shape.current
    const root = 7.5 + anchor
    const grab = root + x
    const bendY = Math.max(8, Math.min(height - 8, y))
    // Both ends remain fixed while the two curves meet smoothly at the finger.
    const path = `M ${root} 0 C ${root} ${bendY * .35}, ${grab} ${bendY * .75}, ${grab} ${bendY} C ${grab} ${bendY + (height - bendY) * .25}, ${root} ${bendY + (height - bendY) * .65}, ${root} ${height}`
    const thickness = 11 / Math.sqrt(1 + Math.abs(x) / height * 2)
    svg.current.querySelectorAll(':scope > path').forEach((node, i) => {
      node.setAttribute('d', path)
      node.setAttribute('stroke-width', String(i === 0 ? thickness + 3 : i === 1 || i === 3 ? thickness : 1.4))
    })
    svg.current.style.opacity = String(opacity)
  }

  const { contextSafe } = useGSAP(() => {
    Object.assign(shape.current, { x: released ? 26 : 0, y: height / 2, anchor: released ? edgeOffset : 0, opacity: 1 })
    drag.current = null
    paint()
  }, { scope: button, dependencies: [height, released, edgeOffset], revertOnUpdate: true })

  const recoil = contextSafe(() => {
    gsap.killTweensOf(shape.current)
    gsap.to(shape.current, { x: 0, duration: reduced ? 0 : .85, ease: 'elastic.out(1, 0.28)', onUpdate: paint })
  })

  useGSAP(() => {
    if (!releasing) return
    drag.current = null
    gsap.killTweensOf(shape.current)
    // First tension the ribbon, then let the anchors slip past the cover edge.
    gsap.timeline({ onUpdate: paint, onComplete: onReleased })
      .to(shape.current, { x: Math.max(56, shape.current.x), duration: reduced ? 0 : .18, ease: 'power2.out' })
      .to(shape.current, { anchor: edgeOffset, x: 26, duration: reduced ? 0 : .65, ease: 'elastic.out(1, 0.32)' })
  }, { scope: button, dependencies: [releasing], revertOnUpdate: true })

  return <button ref={button} className={`elastic-band elastic-ribbon ${released ? 'is-released' : ''}`} aria-label={released ? 'Attached elastic loop' : 'Release elastic band'}
    data-hint="Pull right"
    disabled={releasing || released}
    onClick={event => { if (event.detail === 0 && !releasing) onReleaseRequest() }}
    onPointerDown={event => {
      if (releasing || released || !event.isPrimary) return
      gsap.killTweensOf(shape.current)
      const bounds = event.currentTarget.getBoundingClientRect()
      const grabY = Math.max(8, Math.min(height - 8, event.clientY - bounds.top))
      shape.current.y = grabY
      drag.current = { x: event.clientX - shape.current.x, y: event.clientY, grabY, moved: 0 }
      event.currentTarget.setPointerCapture(event.pointerId)
      paint()
    }}
    onPointerMove={event => {
      const current = drag.current
      if (!current || releasing) return
      const dx = event.clientX - current.x
      const dy = event.clientY - current.y
      current.moved = Math.max(current.moved, Math.abs(dx), Math.abs(dy))
      shape.current.x = Math.sign(dx) * (Math.abs(dx) <= 80 ? Math.abs(dx) : 80 + (Math.abs(dx) - 80) * .25)
      shape.current.y = Math.max(8, Math.min(height - 8, current.grabY + dy))
      paint()
    }}
    onPointerUp={() => {
      const current = drag.current
      if (!current || releasing) return
      drag.current = null
      if (current.moved < 5 || shape.current.x >= 48) onReleaseRequest()
      else recoil()
    }}
    onPointerCancel={() => { drag.current = null; recoil() }}
    onLostPointerCapture={() => { if (drag.current) { drag.current = null; recoil() } }}>
    <svg ref={svg} width="15" height={height} viewBox={`0 0 15 ${height}`} aria-hidden="true">
      <defs><pattern id={weaveId} width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill={color}/><path d="M0 0H3 M0 2H3" stroke="#ffffff" opacity=".32" strokeWidth=".45"/><path d="M1 0V3" stroke="#000000" opacity=".28" strokeWidth=".8"/></pattern></defs>
      <path fill="none" stroke="#13161c" strokeLinecap="butt" />
      <path fill="none" stroke={color} strokeLinecap="butt" />
      <path fill="none" stroke="#ffffff" opacity=".22" strokeLinecap="butt" />
      <path fill="none" stroke={`url(#${weaveId})`} strokeLinecap="butt" opacity=".72" />
    </svg>
  </button>
}

/** Back cover: the elastic runs around the front, so only its two anchored ends show at the outer edge. */
export function ElasticAnchors({ height, color }: { height: number; color: string }) {
  const weaveId = useId()
  const stub = Math.max(12, height * .06)
  const path = `M 7.5 0 V ${stub} M 7.5 ${height - stub} V ${height}`
  return <span className="elastic-anchors elastic-ribbon" aria-hidden="true">
    <svg width="15" height={height} viewBox={`0 0 15 ${height}`}>
      <defs><pattern id={weaveId} width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill={color}/><path d="M0 0H3 M0 2H3" stroke="#ffffff" opacity=".32" strokeWidth=".45"/><path d="M1 0V3" stroke="#000000" opacity=".28" strokeWidth=".8"/></pattern></defs>
      <path d={path} fill="none" stroke="#13161c" strokeWidth="14" />
      <path d={path} fill="none" stroke={color} strokeWidth="11" />
      <path d={path} fill="none" stroke="#ffffff" opacity=".22" strokeWidth="1.4" />
      <path d={path} fill="none" stroke={`url(#${weaveId})`} opacity=".72" strokeWidth="11" />
      <path d={`M 1 ${stub} H 14 M 1 ${height - stub} H 14`} stroke="#000000" opacity=".35" strokeWidth="1.5" />
    </svg>
  </span>
}
