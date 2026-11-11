import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeVideo } from 'mediabunny'
import type { Book } from '../Profile'
import { composeFlipbook, flipbookDuration, type ShareAssets, type ShareFormat } from './shareArtwork'

export async function exportFlipbook(book: Book, assets: ShareAssets, format: ShareFormat, signal: AbortSignal, onProgress: (value: number) => void) {
  const frameRate = 24
  const bitrate = 5_000_000
  const { width, height } = format
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })!
  const draw = composeFlipbook(book, assets, format)
  if (!(await canEncodeVideo('avc', { width, height, bitrate }))) {
    return recordMp4(canvas, draw, context, signal, onProgress, bitrate)
  }
  signal.throwIfAborted()

  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat(), target })
  const frames = new CanvasSource(canvas, { codec: 'avc', bitrate, latencyMode: 'quality' })
  output.addVideoTrack(frames, { frameRate })
  try {
    await output.start()
    const count = flipbookDuration * frameRate
    for (let i = 0; i < count; i++) {
      signal.throwIfAborted()
      draw(context, i / frameRate)
      await frames.add(i / frameRate, 1 / frameRate)
      if (i % 8 === 0) {
        onProgress((i + 1) / count)
        // Yield a task so the dialog can paint progress and cancel.
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
    frames.close()
    await output.finalize()
    signal.throwIfAborted()
    if (!target.buffer) throw new Error('The video could not be created. Try again.')
    return new Blob([target.buffer], { type: 'video/mp4' })
  } catch (error) {
    await output.cancel()
    throw error
  }
}

/** Safari can record H.264 on devices where its WebCodecs encoder is unavailable. */
function recordMp4(canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D, seconds: number) => void, ctx: CanvasRenderingContext2D, signal: AbortSignal, onProgress: (value: number) => void, videoBitsPerSecond: number) {
  const mimeType = ['video/mp4;codecs=avc1', 'video/mp4'].find(type => globalThis.MediaRecorder?.isTypeSupported(type))
  if (!mimeType || !canvas.captureStream) throw new Error('MP4 export is unavailable in this browser. Try a current version of Chrome, Edge, or Safari.')
  signal.throwIfAborted()
  draw(ctx, 0)
  const stream = canvas.captureStream(30)
  return new Promise<Blob>((resolve, reject) => {
    let request = 0
    let recorder: MediaRecorder
    const chunks: Blob[] = []
    function clean() {
      cancelAnimationFrame(request)
      signal.removeEventListener('abort', abort)
      document.removeEventListener('visibilitychange', visibility)
      stream.getTracks().forEach(track => track.stop())
    }
    function abort() {
      if (recorder.state !== 'inactive') recorder.stop()
      clean()
      reject(signal.reason)
    }
    function visibility() {
      if (!document.hidden) return
      reject(new Error('Keep Scribb visible while it records the video. Try again.'))
      if (recorder.state !== 'inactive') recorder.stop()
      clean()
    }
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond })
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => { clean(); reject(new Error('This browser could not record the MP4.')) }
      recorder.onstop = () => {
        clean()
        if (chunks.length) resolve(new Blob(chunks, { type: 'video/mp4' }))
        else reject(new Error('The video was empty. Try again.'))
      }
      signal.addEventListener('abort', abort, { once: true })
      document.addEventListener('visibilitychange', visibility)
      recorder.start()
      const start = performance.now()
      function frame(now: number) {
        const elapsed = (now - start) / 1000
        if (elapsed >= flipbookDuration) { recorder.stop(); return }
        draw(ctx, elapsed)
        onProgress(elapsed / flipbookDuration)
        request = requestAnimationFrame(frame)
      }
      request = requestAnimationFrame(frame)
    } catch (error) {
      clean()
      reject(error)
    }
  })
}
