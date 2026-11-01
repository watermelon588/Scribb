# Untitled — the sketchbook studio

A design prototype for an artist portfolio built around tactile digital
sketchbooks. **Untitled is a temporary name.** This milestone explores the book;
the future feed and artist profiles are deliberately deferred.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open [the local studio](http://localhost:5173/).

```sh
npm run build   # TypeScript check and production build
npm run preview # Serve the production build on port 4173
npm test        # Browser integration tests using installed Google Chrome
```

If Google Chrome is unavailable, install Chromium with `npx playwright install
chromium`, then remove `channel: 'chrome'` from `playwright.config.ts`.

## The three studies

| Preset | Cover | Typography | Default turn |
| --- | --- | --- | --- |
| The Linen | Woven cloth, small artwork plate | Manrope | Curl |
| The Archive | Fine-grain leather, inset frame | Newsreader | Hinge |
| The Softcover | Uncoated stock, graphic rules | DM Sans | Float |

Every preset supports all three turn styles, five color swatches and a custom
color picker, four page proportions, an editable cover title, and optional paper
grain. Changes are remembered locally. Selecting another preset loads its defaults.

The preview opens to the first spread. Use **View cover** to inspect the binding,
then **Open book**. Drag a page corner, swipe, use the arrow buttons, or focus the
book and use the left/right arrow keys. Home returns to the front cover.
Fullscreen is available from the preview's upper-right corner; Escape exits it.
Reduced-motion mode uses immediate page changes through the buttons and keyboard.

**Try your own artwork** replaces the samples with up to 12 JPG, PNG, WebP, or AVIF
images (15 MB each). Their selected order becomes the page order. This is a local
preview: uploads are not sent to a server and disappear on reload. Restore the
samples with the link below the upload control.

## One component

```tsx
<Sketchbook
  preset={presets[0]}
  coverColor="#526756"
  aspectRatio={3 / 4}
  turnStyle="curl"
  title="In good nature"
  artworks={sampleArtworks}
  texture={true}
/>
```

`SketchbookProps` and `Artwork` are typed in the source. New presets belong in
`src/data/presets.ts`; their material styles live in `src/styles.css`. All books
share the same renderer and lifecycle. See [the design contract](docs/DESIGN.md)
and [reference analysis](docs/REFERENCE-NOTES.md) before changing the interaction.

## Files

```text
src/
  App.tsx                   Studio and customization controls
  components/Sketchbook.tsx Shared page, cover, and interaction renderer
  data/presets.ts           Typed presets and sample artwork data
  styles.css                Layout, materials, paper, typography, responsiveness
  page-flip.d.ts            Used subset of the untyped library API
public/
  artworks/                 Bundled public-domain samples and credits
  paper.svg                 Deterministic subtle grain
docs/                       Design rules, product scope, reference observations
scripts/patch-page-flip.mjs  Reproducible upstream animation-loop cleanup fix
tests/studio.spec.ts        Integration checks in a real browser
AGENTS.md                   Instructions for continued project work
```

## Assets and dependencies

Sample paintings are CC0 public-domain images from The Metropolitan Museum of
Art's Open Access collection. Attribution and source URLs are in
`public/artworks/credits.json`. Fonts are self-hosted through Fontsource; their
OFL licenses ship with the respective packages. No live image/font service is
needed at runtime.

Page turns use [StPageFlip](https://nodlik.github.io/StPageFlip/); book positioning
and the floating turn use [GSAP](https://gsap.com/resources/React/). A small
idempotent postinstall patch stops StPageFlip 2.0.7's render loop on destruction.
It checks the exact upstream source and fails clearly if an upgrade needs review.

The local MP4 references remain untouched. Generated analysis images and QA
captures are ignored in `.reference-analysis/`. No backend or hosting is configured.
