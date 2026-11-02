// Asset preparation only. Install its isolated dependency with:
// npm install --prefix .reference-analysis/sticker-tools --no-save --package-lock=false sharp
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('../.reference-analysis/sticker-tools/node_modules/sharp');
const root = path.resolve(import.meta.dirname, '..');
const sources = path.join(root, 'journal inspiration', 'stickers');
const output = path.join(root, 'public', 'stickers');
const review = path.join(root, 'docs', 'stickers');
const regions = JSON.parse(await fs.readFile(path.join(review, 'regions.json'), 'utf8'));
const requested = new Set(process.argv.slice(2));
const catalog = requested.size ? JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8')).stickers : [];
if ([...requested].some(id => !Object.values(regions).flat().some(s => s[1] === id))) throw new Error('Unknown sticker ID');

function inside(x, y, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) yes = !yes;
  }
  return yes;
}
function morph(mask, w, h, dilate) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let value = dilate ? 0 : 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      const sample = xx >= 0 && xx < w && yy >= 0 && yy < h ? mask[yy * w + xx] : 0;
      value = dilate ? Math.max(value, sample) : Math.min(value, sample);
    }
    out[y * w + x] = value;
  }
  return out;
}
function fill(mask, w, h) {
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  let first = 0, last = 0;
  const add = (p) => { if (!mask[p] && !seen[p]) { seen[p] = 1; queue[last++] = p; } };
  for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
  while (first < last) {
    const p = queue[first++], x = p % w, y = Math.floor(p / w);
    if (x) add(p - 1); if (x < w - 1) add(p + 1);
    if (y) add(p - w); if (y < h - 1) add(p + w);
  }
  return Uint8Array.from(seen, v => v ? 0 : 255);
}
function clean(mask, w, h, options = {}) {
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  const groups = [];
  for (let p = 0; p < mask.length; p++) if (mask[p] && !seen[p]) {
    let first = 0, last = 1; queue[0] = p; seen[p] = 1;
    while (first < last) {
      const q = queue[first++], x = q % w, y = Math.floor(q / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, n = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && mask[n] && !seen[n]) { seen[n] = 1; queue[last++] = n; }
      }
    }
    groups.push(Array.from(queue.subarray(0, last)));
  }
  groups.sort((a, b) => b.length - a.length);
  const bounds = group => {
    let l = w, t = h, r = 0, b = 0;
    for (const p of group) { const x = p % w, y = Math.floor(p / w); l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
    return [l, t, r, b];
  };
  const main = bounds(groups[0]);
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i], [l,t,r,b] = bounds(group);
    const contained = l >= main[0] && t >= main[1] && r <= main[2] && b <= main[3];
    const extra = (options.extras ?? []).some(([x0,y0,x1,y1]) => l / w >= x0 && t / h >= y0 && r / w <= x1 && b / h <= y1);
    const keep = i < (options.keepComponents ?? 1) || (options.allComponents && group.length >= 4) || (contained && !options.mainOnly) || extra;
    if (!keep || group.length < 4) for (const p of group) mask[p] = 0;
  }
}

await fs.mkdir(output, { recursive: true });
for (const [source, items] of Object.entries(regions)) {
  for (const [category, id, box, mode, options = {}] of items) {
    if (requested.size && !requested.has(id)) continue;
    const [left, top, right, bottom] = box;
    const { data, info } = await sharp(path.join(sources, source)).extract({ left, top, width: right - left, height: bottom - top }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    let mask = new Uint8Array(w * h).fill(255);
    if (mode === 'cut') {
      const bg = options.background ?? 255;
      let barrier = new Uint8Array(w * h);
      for (let p = 0; p < barrier.length; p++) {
        const i = p * 4;
        const distance = Math.max(Math.abs(data[i] - bg), Math.abs(data[i + 1] - bg), Math.abs(data[i + 2] - bg));
        barrier[p] = distance > (options.threshold ?? 29) && (!options.darkOnly || Math.max(data[i], data[i + 1], data[i + 2]) < 145) ? 1 : 0;
      }
      if (options.polygon) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inside((x + 0.5) / w, (y + 0.5) / h, options.polygon)) barrier[y * w + x] = 0;
      }
      clean(barrier, w, h, options);
      barrier = morph(morph(barrier, w, h, true), w, h, false);
      if (options.hull) for (let y = 0; y < h; y++) {
        let a = w, b = -1;
        for (let x = 0; x < w; x++) if (barrier[y * w + x]) { a = Math.min(a, x); b = x; }
        for (let x = a; x <= b; x++) barrier[y * w + x] = 1;
      }
      mask = fill(barrier, w, h);
      if (options.polygon) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inside((x + 0.5) / w, (y + 0.5) / h, options.polygon)) mask[y * w + x] = 0;
      }
    } else if (mode === 'rounded') {
      const r = Math.min(w, h) * 0.085;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const cx = Math.max(r, Math.min(w - r - 1, x)), cy = Math.max(r, Math.min(h - r - 1, y));
        if (Math.hypot(x - cx, y - cy) > r) mask[y * w + x] = 0;
      }
    }
    for (const hole of options.holes ?? []) {
      const [cx, cy, r] = hole;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - cx * w, y - cy * h) < r * Math.min(w, h)) mask[y * w + x] = 0;
    }
    for (const poly of options.holesPolygon ?? []) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x / w, y / h, poly)) mask[y * w + x] = 0;
    if (mode === 'cut') mask = new Uint8Array(await sharp(Buffer.from(mask), { raw: { width: w, height: h, channels: 1 } }).blur(0.35).greyscale().raw().toBuffer());
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      data[p * 4 + 3] = mask[p];
      if (mask[p] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    if (x0 > x1 || y0 > y1) throw new Error(`Empty sticker: ${id}`);
    let cropped = sharp(data, { raw: { width: w, height: h, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
    if (options.rotate) cropped = cropped.rotate(options.rotate);
    const input = await cropped.png().toBuffer();
    const m = await sharp(input).metadata();
    const size = Math.min(320, Math.max(m.width, m.height) + 16);
    const scale = Math.min(1, (size - 16) / Math.max(m.width, m.height));
    const rw = Math.max(1, Math.round(m.width * scale)), rh = Math.max(1, Math.round(m.height * scale));
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    const padded = await sharp(input).resize(rw, rh).extend({ left: Math.floor((size - rw) / 2), right: Math.ceil((size - rw) / 2), top: Math.floor((size - rh) / 2), bottom: Math.ceil((size - rh) / 2), background: transparent }).png().toBuffer();
    let encoded;
    for (const colours of [256, 192, 128, 96, 64]) {
      encoded = await sharp(padded).png({ palette: true, colours, quality: 90, effort: 7, compressionLevel: 9, dither: 0.4 }).toBuffer();
      if (encoded.length <= 95000) break;
    }
    if (encoded.length > 100000) throw new Error(`Sticker exceeds 100 KB: ${id}`);
    const destination = path.join(output, category, `${id}.png`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, encoded);
    const record = { id, name: id.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' '), category, src: `/stickers/${category}/${id}.png`, width: size, height: size, bytes: encoded.length, source, crop: box };
    const existing = catalog.findIndex(s => s.id === id);
    if (existing >= 0) catalog[existing] = record; else catalog.push(record);
  }
  if (!requested.size) console.log(`${source}: ${items.length} stickers`);
}
const categories = [...new Set(catalog.map(s => s.category))].sort().map(id => ({ id, name: id === 'retro-tech' ? 'Retro Tech' : id[0].toUpperCase() + id.slice(1), count: catalog.filter(s => s.category === id).length }));
const totalBytes = catalog.reduce((sum, s) => sum + s.bytes, 0);
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ version: 1, format: 'image/png', maxEdge: 320, count: catalog.length, totalBytes, categories, stickers: catalog }, null, 2) + '\n');

// Contact sheets are review artifacts, never loaded by the app gallery.
for (const category of categories) {
  const items = catalog.filter(s => s.category === category.id);
  const cols = 5, tile = 190, heading = 50, rows = Math.ceil(items.length / cols);
  const W = cols * tile, H = heading + rows * tile;
  const composites = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i], x = (i % cols) * tile, y = heading + Math.floor(i / cols) * tile;
    const thumb = await sharp(path.join(root, 'public', item.src)).resize(158, 150, { fit: 'contain', background: { r: 227, g: 227, b: 219, alpha: 1 } }).flatten({ background: '#e3e3db' }).png().toBuffer();
    composites.push({ input: thumb, left: x + 16, top: y + 8 });
    const label = `${item.id.slice(0, 29)}  ${Math.round(item.bytes / 1024)}K`;
    const svg = `<svg width="190" height="30"><text x="95" y="18" text-anchor="middle" font-family="Arial" font-size="10" fill="#222">${label}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left: x, top: y + 160 });
  }
  composites.push({ input: Buffer.from(`<svg width="950" height="50"><text x="20" y="32" font-family="Arial" font-size="24" fill="#222">${category.name} — ${items.length} stickers</text></svg>`), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#e3e3db' } }).composite(composites).jpeg({ quality: 88 }).toFile(path.join(review, `${category.id}.jpg`));
}
console.log(JSON.stringify({ count: catalog.length, totalBytes, largest: Math.max(...catalog.map(s => s.bytes)), average: Math.round(totalBytes / catalog.length), categories }, null, 2));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sections = categories.map(category => `<section id="${category.id}"><h2>${category.name} <small>${category.count}</small></h2><div class="grid">${catalog.filter(s => s.category === category.id).map(s => `<a class="card" href="../../public${s.src}"><div class="art"><img loading="lazy" src="../../public${s.src}" alt="${escape(s.name)}"></div><span>${escape(s.name)}</span><small>${(s.bytes / 1024).toFixed(1)} KB · ${s.width} × ${s.height}</small></a>`).join('')}</div></section>`).join('\n');
await fs.writeFile(path.join(review, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Journal sticker cutouts</title><style>body{font:16px system-ui;margin:32px auto;padding:0 20px;max-width:1200px;background:#f5f3eb;color:#262820}h1{font-weight:500}h2{font-weight:500;margin-top:48px}p,small{color:#66685e}nav{display:flex;flex-wrap:wrap;gap:10px}nav a{color:inherit;padding:6px 10px;background:#e9e6dc;border-radius:5px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:16px}.card{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit}.art{aspect-ratio:1;display:grid;place-items:center;background:repeating-conic-gradient(#e3e3db 0% 25%,#f1f1eb 0% 50%) 0 0/20px 20px;border-radius:6px}.art img{width:90%;height:90%;object-fit:contain}.card span{font-size:13px}.card small{font-size:12px}</style><h1>Journal sticker cutouts</h1><p>${catalog.length} transparent PNGs · ${(totalBytes / 1024 / 1024).toFixed(2)} MiB total · maximum 320 × 320 pixels. Select a sticker to open its PNG.</p><nav>${categories.map(c => `<a href="#${c.id}">${c.name}</a>`).join('')}</nav>${sections}</html>`);
