> Revision: books stay straight, with no presentation rotation or tilt. Current designs: Linen, Spiral (visible wire loops), and Watercolor (elastic closure). Float is removed. Five muted and five bright cover colors; four original reference textures plus a dotted pattern. This revision supersedes earlier preset/motion descriptions below.

# Scribb — sketchbooks and journals

A design prototype for an artist portfolio built around tactile digital
sketchbooks. **Scribb** is the product name; its mark is the companion's hand-drawn face (public/brand/). This milestone explores the book;
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


## Current application
- `/` or `/#portfolio`: your artist profile and locally saved sketchbooks and journals.
- `/#feed`: Explore, with 12 demo sketchbooks and four fictional artists. Open books, visit artist collections, filter/search, like and bookmark. Reactions persist only on this device.
- `/#new` and legacy `/#studio`: one creation/editing flow that switches between Sketchbook and Journal. Drafts autosave on this device.

Journals have 10 fonts, 10 layouts that adapt to all four formats, and a Writing page that continues across pages. Pictures are reduced under 200 KB. See `journaling-plan.md` for the parts still to come.

Gallery and Editorial have coordinated profile, editor and feed layouts with a shared palette. Both include Gallery and Bookshelf previews. Library has been removed.
The style switch preserves the draft. Phone navigation links Explore, Create and
Portfolio; Create resumes an in-memory draft when switching sections.

21 prepared/standalone covers, custom cover upload and solid colors are available.
All four formats apply to thumbnails and the interactive renderer. Front artwork
fills the cover; backs remain plain. An optional 48-character caption is printed
on the front. The elastic keeps its existing stretch/release/opening sequence and
is removed immediately when opening completes, without fading.

Cover and artwork editors support dragging, resizing and keyboard/range controls.
Artwork also supports explicit cropping and continuous two-page spreads with a
center fold. JPG/PNG/WebP uploads are validated before decoding and re-encoded:
10 MiB/file, 40 MiB/batch, 20 MP, 8192 pixels/edge and 40 artworks/book.
See docs/UPLOADS.md and docs/COVER-ASSETS.md.

The reference-inspired Bookshelf uses close-set spines and an expanding selected
front cover. Scrollbars are hidden while scrolling remains enabled. Phone layouts
use safe-area navigation, full-screen book dialogs and appropriately sized inputs.

Books/images use IndexedDB; profile, style and feed reactions use localStorage.
There is no backend, authentication or cloud sync. Clearing browser storage removes
saved work. Reference artwork is included for this local design exploration.

Run `npm run build` and `npm test` for validation. Browser checks cover desktop and
320/390px phone viewports, touch input, reduced motion, formats, persistence,
upload rejection, covers and spreads. Real-device testing remains a separate check.

Appearance: the header sun/moon button switches the entire application between light
and dark, remembers the preference, and initializes before paint. Artwork and paper
retain their original colors. New Sketchbook is available in the collection and
phone Create tab, not the top navbar.

Motion: Lenis 1.3.27 smooths desktop wheel scrolling through the existing GSAP ticker
(https://github.com/darkroomengineering/lenis). Touch, book gestures and nested
editors remain native. Reduced motion disables smoothing and entrance tweens.
Entrance motion is limited to transform/opacity and 360ms, with scoped cleanup.

Original olive light/dark appearance is restored. Explore opens directly to its
filters and books; Gallery uses three compact desktop columns, two on tablets
and one on phones. The Gallery/Editorial selector uses compact labeled icons.

## Backend (local)

The plan is in `backend-plan.md`. Copy `.env.example` to `.env` and fill in the keys.

- `npm run migrate` applies `db/migrations` to `DATABASE_URL`.
- `npm run dev:api` runs the Express API on port 3001; `npm run dev` proxies `/api` to it.
- `npm run test:api` runs the API tests against an in-process Postgres, so no database is needed.
- AI service: `cd ai`, `py -3 -m venv .venv`, `.venv/Scripts/pip install -r requirements.txt pytest`, then `.venv/Scripts/python -m pytest` or `.venv/Scripts/uvicorn scribb_ai.main:app --port 8000`.
- After the first migration, give the AI role a password once: `alter role scribb_ai login password '...'`, and use it in `AI_DATABASE_URL`.

## Welcome, information and journal questions

Guests see a centered animation and account prompt on `/`. The original supplied
GIF is preserved. `public/media/welcome-light.mp4` and `welcome-dark.mp4` are silent,
looping H.264 conversions with a background matched to each appearance; WebP stills
serve as posters. The animation pauses for reduced motion and has a play/pause button.

`/#privacy` and `/#terms` use the shared olive theme and Gallery/Editorial typography.
Links appear in the footer and account creation form. The privacy page documents
the current media-deletion limitation and Gemini free-tier processing rather than
promising complete deletion or confidential AI processing.

`/#ask` opens Ask my journal. A verified email and explicit AI consent are required.
`GET /api/ai/status` checks access and returns the configured service URL without
spending a turn. On submission the client polls `/health` for up to 90 seconds,
then mints a fresh, one-time 60-second ticket. No AI service is contacted on ordinary
app loads or while merely reading the consent notice. AI is disabled in local-only tests.

The AI `/ask` endpoint retains JSON compatibility and accepts
`Accept: text/event-stream` for real Gemini chunks (`delta`, `done` with journal source
dates, and `error`). Disconnecting cancels the generation task. Conversations live
only in page memory; retry, cancellation, consent withdrawal and route changes
do not write them into journal entries or device storage. Deploy the updated AI
service alongside the app to enable streamed answers; older services still return JSON.

Gemini data-use wording was checked against https://ai.google.dev/gemini-api/terms
on 2 November 2026. Operator-specific legal details and a provider change need a
content review before a public launch. `tests/pages.spec.ts` checks the new flows
with mocked AI responses; `ai/tests/test_streaming.py` tests the streaming boundary
without external model calls.
