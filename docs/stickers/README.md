# Journal sticker cutouts

Individual application assets are in `public/stickers/<category>/*.png`.
Open `index.html` in this folder to browse every cutout on a transparency checkerboard.
The category JPGs are review contact sheets, not application assets.

`public/stickers/manifest.json` contains stable IDs, names, categories, root-relative
URLs, exact byte sizes, dimensions, original source filenames and crop coordinates.
The application can fetch `/stickers/manifest.json` when the sticker gallery is implemented.
This preparation does not change journal controls or rendering.

## Preparation

- All 14 supplied source sheets remain unchanged in `journal inspiration/stickers`.
- 204 individual PNGs, grouped into 13 categories.
- Original-pixel crops and exterior background masks; no regenerated artwork in the final library.
- Transparent square canvases, up to 320 px; artwork proportions are preserved and smaller sources are not enlarged.
- 8 px transparent padding. Printed panels, quote-paper textures, and white character interiors remain part of the design.
- Indexed PNGs with up to 256 colors, compressed with a strict 100,000-byte maximum per sticker.
- Calendar cards retain the original **2017** artwork and dates; they are decorative reference cutouts.
- The crop list includes the full calendar cards, not additional duplicates of the cats printed on those same cards.

Reproduce the assets with:

```powershell
npm install --prefix .reference-analysis/sticker-tools --no-save --package-lock=false sharp
node scripts/prepare-stickers.mjs
```

The dependency stays in the ignored preparation directory and is not added to the application's dependencies.
Manual crop regions and mask refinements are recorded in `regions.json`.

## Image-editing pilot

The built-in imagegen tool was tried on the colorful faces sheet. Its output shifted
some original edges, so the final assets instead use the source pixels and local masks.
The generated pilot is not included in `public/stickers`.

Pilot prompt:

> Use case: background-extraction. Edit target: supplied sticker sheet. Remove ONLY the exterior white sheet background to actual transparency. Preserve all TEN colorful face stickers exactly as shown, including texture, ink, facial expressions, size and position. Keep their relative layout and original portrait canvas. No new illustration, no restyling, no text additions. Keep all detached eyebrows as part of their face stickers. Remove the artist signature near the top. This transparent sheet will be split into individual small journal sticker PNGs.

The source actually contains eleven faces; the final crop list includes all eleven.
