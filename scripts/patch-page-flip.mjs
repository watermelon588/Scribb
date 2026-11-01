import { readFile, writeFile } from 'node:fs/promises'

// Upstream 2.0.7 never stops Render.start()'s RAF loop in PageFlip.destroy().
// Apply the same minimal lifecycle fix to both distributed entry points.
// Fail clearly if upgrading the pinned library changes the expected source.
const original = 'start(){this.update();const t=e=>{this.render(e),requestAnimationFrame(t)};requestAnimationFrame(t)}'
const replacement = 'start(){this.update();const t=e=>{this.render(e),this.frameId=requestAnimationFrame(t)};this.frameId=requestAnimationFrame(t)}stop(){cancelAnimationFrame(this.frameId)}'
const destroy = 'destroy(){this.ui.destroy(),this.block.remove()}'
const safeDestroy = 'destroy(){this.render.stop(),this.ui.destroy(),this.block.remove()}'

for (const entry of ['page-flip.browser.js', 'page-flip.module.js']) {
  const file = new URL(`../node_modules/page-flip/dist/js/${entry}`, import.meta.url)
  const source = await readFile(file, 'utf8')
  if (source.includes(replacement) && source.includes(safeDestroy)) continue
  if (!source.includes(original) || !source.includes(destroy)) {
    throw new Error(`PageFlip lifecycle patch needs review: ${entry} no longer matches 2.0.7.`)
  }
  await writeFile(file, source.replace(original, replacement).replace(destroy, safeDestroy))
}
console.log('PageFlip: animation loop cleanup verified.')
