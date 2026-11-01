import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { BookOpen, ArrowUpRight, Check, Plus, ArrowCounterClockwise, UploadSimple, Circle, X } from '@phosphor-icons/react'
import Sketchbook from './components/Sketchbook'
import { formats, presets, sampleArtworks, turnStyles, type Artwork, type Format, type PresetId, type TurnStyle } from './data/presets'

interface Settings { presetId: PresetId; color: string; format: Format; turnStyle: TurnStyle; texture: boolean; title: string }
const initialSettings: Settings = { presetId: 'linen', color: presets[0].color, format: '3:4', turnStyle: 'curl', texture: true, title: presets[0].title }
function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('untitled-studio-v1') ?? 'null') as Settings | null
    if (saved && presets.some(p => p.id === saved.presetId) && formats.some(f => f.id === saved.format) && turnStyles.some(t => t.id === saved.turnStyle) && /^#[\da-f]{6}$/i.test(saved.color) && typeof saved.title === 'string' && typeof saved.texture === 'boolean') return { ...saved, title: saved.title.slice(0, 36) }
  } catch { /* Storage can be unavailable in a private browsing session. */ }
  return initialSettings
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [artworks, setArtworks] = useState<Artwork[]>(sampleArtworks)
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])
  const preset = presets.find(p => p.id === settings.presetId)!
  const ratio = formats.find(f => f.id === settings.format)!.ratio
  const colorName = preset.colors.find(c => c.value === settings.color)?.name ?? 'Custom'
  const isSample = artworks === sampleArtworks

  useEffect(() => {
    try { localStorage.setItem('untitled-studio-v1', JSON.stringify(settings)) } catch { /* Keep the studio usable without storage. */ }
  }, [settings])
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), [])
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 6000)
    return () => window.clearTimeout(timer)
  }, [message])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) { setSettings(current => ({ ...current, [key]: value })) }
  function choosePreset(id: PresetId) {
    const next = presets.find(p => p.id === id)!
    setSettings({ presetId: id, color: next.color, format: next.format, turnStyle: next.turnStyle, texture: true, title: next.title })
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    if (files.length > 12) { setMessage('Choose up to 12 artworks for this sketchbook.'); return }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 15 * 1024 * 1024)) {
      setMessage('Choose JPG, PNG, WebP or AVIF images, up to 15 MB each.'); return
    }
    const nextUrls = files.map(file => URL.createObjectURL(file))
    try {
      await Promise.all(nextUrls.map(src => new Promise<void>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(); img.onerror = reject; img.src = src
      })))
      urls.current.forEach(url => URL.revokeObjectURL(url))
      urls.current = nextUrls
      setArtworks(files.map((file, i) => ({ id: `upload-${i}-${file.lastModified}`, src: nextUrls[i], title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), artist: 'You', medium: 'From your collection' })))
      setMessage(`${files.length} artwork${files.length === 1 ? '' : 's'} added. Your images stay in this browser session.`)
    } catch { nextUrls.forEach(url => URL.revokeObjectURL(url)); setMessage('One of those images could not be opened. Try a different file.') }
  }

  return <div className={`app theme-${preset.id}`} style={{ '--selected-cover': settings.color } as CSSProperties}>
    <header className="site-header">
      <a className="wordmark" href="#studio" aria-label="Untitled studio home"><BookOpen weight="thin" size={29} /><span>untitled<span className="wordmark-dot">.</span></span></a>
      <div className="header-center"><span className="tiny-dot" /> The sketchbook studio</div>
      <span className="header-edition">AN ARTIST’S SPACE, IN THE MAKING <ArrowUpRight size={14} weight="light" /></span>
    </header>

    <main id="studio">
      <section className="intro" aria-labelledby="studio-heading">
        <div><div className="eyebrow">LESS SCROLLING. MORE FEELING.</div><h1 id="studio-heading">Your art. A book of its own.</h1></div>
        <p>A familiar feeling, in a new form. <br />A little space to collect, create, and just be.</p>
      </section>

      <div className="workspace">
        <section className="preview-column" aria-label="Sketchbook preview">
          <Sketchbook key={preset.id} preset={preset} coverColor={settings.color} aspectRatio={ratio} turnStyle={settings.turnStyle} title={settings.title} artworks={artworks} texture={settings.texture} />
          <div className="preview-caption"><div><span className="caption-number">{preset.number}</span><h2>{preset.name}</h2><span className="caption-material">{preset.material}</span></div><span className="caption-aside">A book that feels like you.</span></div>
        </section>

        <aside className="inspector" aria-label="Customize your sketchbook">
          <div className="inspector-heading"><h2>Make it yours</h2><button className="icon-button reset-button" aria-label="Reset this preset" title="Reset this preset" onClick={() => choosePreset(preset.id)}><ArrowCounterClockwise size={17} weight="light" /></button></div>
          <div className="control-group color-group"><div className="control-label"><h3>Cover color</h3><span>{colorName}</span></div><div className="color-options">
            {preset.colors.map(color => <button key={color.value} className={`color-swatch ${settings.color === color.value ? 'selected' : ''}`} style={{ background: color.value }} onClick={() => update('color', color.value)} aria-label={`${color.name} cover`} aria-pressed={settings.color === color.value}>{settings.color === color.value && <Check size={15} weight="light" />}</button>)}
            <label className="custom-color" title="Choose a custom cover color"><Plus size={17} weight="light" /><input type="color" value={settings.color} aria-label="Custom cover color" onChange={event => update('color', event.target.value)} /></label>
          </div></div>

          <div className="control-group"><div className="control-label"><h3>Page format</h3><span>{formats.find(f => f.id === settings.format)?.label}</span></div><div className="format-options">{formats.map(format => <button key={format.id} className={`format-option ${settings.format === format.id ? 'selected' : ''}`} aria-pressed={settings.format === format.id} aria-label={`${format.id} ${format.label} format`} onClick={() => update('format', format.id)}><span className="format-shape" style={{ aspectRatio: format.ratio, height: format.ratio > 1 ? 17 : 23 }} /><span>{format.id}</span></button>)}</div></div>

          <div className="control-group"><div className="control-label"><h3>Page turn</h3><span>A little movement</span></div><div className="turn-options">{turnStyles.map(style => <button key={style.id} aria-label={`${style.name} page turn`} title={style.description} aria-pressed={settings.turnStyle === style.id} className={settings.turnStyle === style.id ? 'selected' : ''} onClick={() => update('turnStyle', style.id)}>{style.name}</button>)}</div></div>

          <div className="control-group paper-group"><div className="paper-sample" /><div><h3>Off-white, always</h3><p>A little texture. Room to breathe.</p></div><button role="switch" aria-checked={settings.texture} aria-label="Paper texture" className={`switch ${settings.texture ? 'on' : ''}`} onClick={() => update('texture', !settings.texture)}><span /></button></div>

          <div className="control-group title-group"><label htmlFor="book-title">On the cover</label><input id="book-title" maxLength={36} value={settings.title} onChange={event => update('title', event.target.value)} onBlur={() => { if (!settings.title.trim()) update('title', preset.title) }} placeholder={preset.title} /></div>

          <button className="upload-button" onClick={() => input.current?.click()}><UploadSimple size={17} weight="light" /> Try your own artwork <ArrowUpRight size={15} weight="light" /></button>
          <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={upload} />
          <p className="upload-note">Just a preview. Your art stays with you.</p>
          {!isSample && <button className="restore-samples" onClick={() => { setArtworks(sampleArtworks); urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = [] }}>Restore sample artworks</button>}
        </aside>
      </div>

      <section className="presets-section" aria-labelledby="presets-heading"><div className="presets-heading"><h2 id="presets-heading">A different cover. A different feeling.</h2><span>THREE STUDIES, ENDLESS POSSIBILITIES</span></div>
        <div className="preset-options">{presets.map(item => <button key={item.id} className={`preset-card ${item.id === preset.id ? 'selected' : ''}`} aria-pressed={item.id === preset.id} onClick={() => choosePreset(item.id)}>
          <div className={`mini-book-scene mini-${item.id}`}><div className="mini-book" style={{ background: item.color }}><span>{item.id === 'linen' ? 'In good\nnature' : item.id === 'archive' ? 'Collected\nmoments' : 'Notes on\nseeing'}</span><i /></div></div>
          <div className="preset-card-content"><span className="preset-index">{item.number} / {item.font}</span><h3>{item.name}</h3><p>{item.description}</p></div><span className="preset-indicator">{item.id === preset.id ? <Check size={16} weight="light" /> : <ArrowUpRight size={17} weight="light" />}</span>
        </button>)}</div>
      </section>

      <footer><span><Circle size={10} weight="light" /> A work in progress, just like the good things.</span><span>{isSample ? 'Sample art courtesy of The Met · Public domain' : 'Your art, in your own space.'}</span><span>UNTITLED / DESIGN STUDY 001</span></footer>
    </main>
    {message && <div className="notification" role="status"><span>{message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setMessage('')}><X size={16} /></button></div>}
  </div>
}
