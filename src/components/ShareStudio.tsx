import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ArrowSquareOut, DownloadSimple, FilmStrip, Image, LinkSimple, ShareNetwork } from '@phosphor-icons/react'
import type { Book } from '../Profile'
import { message } from '../lib/api'
import { canvasFile, drawShareBoard, loadShareAssets, shareBookUrl, shareFormats, shareLayouts, type ShareAssets, type ShareFormat, type ShareLayout } from '../lib/shareArtwork'

function Group({ label, children }: { label: string; children: ReactNode }) {
  return <div className="share-group" role="group" aria-label={label}>
    <span className="share-label">{label}</span>
    {children}
  </div>
}

function Board({ book, assets, layout, format, small = false }: { book: Book; assets?: ShareAssets; layout: ShareLayout; format: ShareFormat; small?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current && assets) drawShareBoard(canvas.current, book, assets, layout, format, small ? 216 : format.width)
  }, [book, assets, layout, format, small])
  return <canvas ref={canvas} width={format.width} height={format.height} aria-hidden={small || undefined}
    role={small ? undefined : 'img'} aria-label={small ? undefined : `${layout.name} preview for ${book.title}`}
    style={{ background: layout.paper }} />
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function canShare(file: File | null) {
  return Boolean(file && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }))
}

export default function ShareStudio({ book, onBack }: { book: Book; onBack: () => void }) {
  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [format, setFormat] = useState<ShareFormat>(shareFormats[0])
  const [layout, setLayout] = useState<ShareLayout>(shareLayouts[0])
  const [assets, setAssets] = useState<ShareAssets>()
  const [assetError, setAssetError] = useState('')
  const [reload, setReload] = useState(0)
  const [image, setImage] = useState<{ file: File; format: ShareFormat; layout: ShareLayout }>()
  const [video, setVideo] = useState<{ file: File; url: string; format: ShareFormat }>()
  const [progress, setProgress] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const operation = useRef<AbortController | null>(null)
  const back = useRef<HTMLButtonElement>(null)
  const bookUrl = shareBookUrl(book)
  const videoReady = video?.format === format ? video : null
  const currentImage = image?.format === format && image.layout === layout ? image.file : null
  const file = mode === 'image' ? currentImage : videoReady?.file ?? null
  const hasArt = book.artworks.some(art => art.src && !art.blank)
  const working = progress !== null
  const shareable = canShare(file)

  useEffect(() => {
    back.current?.focus()
    return () => operation.current?.abort()
  }, [])
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url) }, [video])
  useEffect(() => {
    const request = new AbortController()
    loadShareAssets(book, request.signal).then(result => {
      if (!request.signal.aborted) setAssets(result)
    }).catch(error => {
      if (!request.signal.aborted) setAssetError(message(error))
    })
    return () => request.abort()
  }, [book, reload])
  useEffect(() => {
    if (!assets || mode !== 'image') return
    let current = true
    const canvas = document.createElement('canvas')
    drawShareBoard(canvas, book, assets, layout, format)
    canvasFile(canvas, `scribb-${layout.id}-${format.id}.jpg`).then(file => {
      if (current) setImage({ file, layout, format })
    }).catch(error => {
      if (current) setError(message(error))
    })
    return () => { current = false }
  }, [assets, book, format, layout, mode])

  function changeChoice(change: () => void) {
    setError('')
    setStatus('')
    change()
  }

  async function copyLink() {
    setError('')
    try {
      await navigator.clipboard.writeText(bookUrl)
      setStatus('Book link copied.')
    } catch {
      setError('Could not copy the link. Open the public book to copy its address.')
    }
  }

  async function share(file: File) {
    setError('')
    setStatus('')
    try {
      // Keep the file hand-off in the tap handler. Instagram reads links from its own sticker tool.
      const shareData = { files: [file], url: bookUrl, title: book.title }
      await navigator.share(navigator.canShare(shareData) ? shareData : { files: [file] })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setError('Sharing did not open. Download the file and upload it in Instagram.')
    }
  }

  async function makeVideo() {
    if (!assets || operation.current) return
    const task = new AbortController()
    operation.current = task
    setError('')
    setStatus('')
    setProgress(0)
    try {
      const { exportFlipbook } = await import('../lib/shareVideo')
      task.signal.throwIfAborted()
      const blob = await exportFlipbook(book, assets, format, task.signal, setProgress)
      task.signal.throwIfAborted()
      const file = new File([blob], `scribb-page-turn-${format.id}.mp4`, { type: 'video/mp4' })
      setVideo({ file, url: URL.createObjectURL(file), format })
      setStatus('Your video is ready.')
    } catch (error) {
      if (!task.signal.aborted) setError(message(error, 'The video could not be created.'))
    } finally {
      if (operation.current === task) {
        operation.current = null
        if (!task.signal.aborted) setProgress(null)
      }
    }
  }

  function cancelVideo() {
    operation.current?.abort()
    operation.current = null
    setProgress(null)
  }

  return <section className="share-studio" aria-labelledby="share-heading">
    <header className="share-header">
      <button ref={back} className="button-icon" onClick={onBack} aria-label="Back to book" data-hint="Back to book"><ArrowLeft size={20} /></button>
      <div><h2 id="share-heading">Share sketchbook</h2><p>{book.title}</p></div>
    </header>

    <div className="share-workspace">
      <div className="share-stage" style={{ '--share-ratio': `${format.width} / ${format.height}` } as CSSProperties}>
        {mode === 'video' && videoReady ? <video src={videoReady.url} controls playsInline preload="metadata" aria-label="Page-turn video preview" /> :
          <Board book={book} assets={assets} layout={mode === 'image' ? layout : shareLayouts[0]} format={format} />}
      </div>

      <div className="share-controls">
        <Group label="Export type">
          <div className="share-options">
            <button className="button-secondary" aria-pressed={mode === 'image'} disabled={working} onClick={() => changeChoice(() => setMode('image'))}><Image size={17} /> Image</button>
            <button className="button-secondary" aria-pressed={mode === 'video'} disabled={!hasArt || working} onClick={() => changeChoice(() => setMode('video'))}><FilmStrip size={17} /> 10s video</button>
          </div>
        </Group>

        <Group label="Format">
          <div className="share-options">
            {shareFormats.map(option => <button key={option.id} className="button-secondary share-format" disabled={working}
              aria-pressed={format === option} onClick={() => changeChoice(() => setFormat(option))}>
              <span>{option.name}</span><small>{option.ratio}</small>
            </button>)}
          </div>
        </Group>

        {mode === 'image' && <Group label="Layout">
          <div className="share-layouts">
            {shareLayouts.map(option => <button key={option.id} className="button-quiet share-layout" aria-pressed={layout === option}
              onClick={() => changeChoice(() => setLayout(option))}>
              <Board book={book} assets={assets} layout={option} format={format} small />
              <span>{option.name}</span>
            </button>)}
          </div>
          <p className="share-note">{layout.description}</p>
        </Group>}

        {mode === 'video' && <p className="share-note">The front cover and up to five recent artworks in a silent, 10-second MP4.</p>}

        <div className="share-output">
          <div className="share-options">
            {working ? <>
              <progress value={progress ?? 0} max={1} aria-label="Creating video" />
              <button className="button-quiet" onClick={cancelVideo}>Cancel</button>
            </> : mode === 'video' && !videoReady ?
              <button className="button-primary" onClick={() => void makeVideo()} disabled={!assets}><FilmStrip size={17} /> Create video</button> : <>
                {shareable && file && <button className="button-primary" onClick={() => void share(file)}><ShareNetwork size={17} /> Share {mode}</button>}
                <button className={shareable ? 'button-secondary' : 'button-primary'} onClick={() => { if (file) download(file) }} disabled={!file}><DownloadSimple size={17} /> Download {mode}</button>
              </>}
          </div>
          <div className="share-link">
            <button className="button-quiet" onClick={() => void copyLink()}><LinkSimple size={17} /> Copy book link</button>
            <a className="button-icon" href={bookUrl} target="_blank" rel="noopener noreferrer" aria-label="Open public book in a new tab" data-hint="Open book"><ArrowSquareOut size={18} /></a>
          </div>
          <p className="share-note">{format.id === 'story' ? 'Paste the book link into Instagram’s Link sticker to make the Story tappable.' : 'Add the book link to your Instagram bio or share it in a Story.'}</p>
          {!assets && !assetError && <p className="share-note" role="status">Loading artwork…</p>}
          {assetError && <p className="share-error" role="alert">{assetError} <button className="button-link" onClick={() => { setAssetError(''); setReload(n => n + 1) }}>Retry</button></p>}
          {error && <p className="share-error" role="alert">{error}</p>}
          {status && <p className="share-note" role="status">{status}</p>}
        </div>
      </div>
    </div>
  </section>
}
