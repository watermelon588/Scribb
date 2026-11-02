# Cover and creation corrections

- [x] Extract flat, front-facing cover artwork from the three new notebook photographs. Remove scene, perspective, page edges, and photographed elastic; retain original source files.
- [x] Audit existing presets. Remove unprocessed book mockups and collages from the picker. Use prepared artwork edge-to-edge, with adjustable crop/position; never put a book photo on another book.
- [x] Keep all back covers plain, using the selected material and color.
- [x] Rework elastic as a flat, ribbed fabric ribbon with reference-inspired colors. Keep its endpoints attached during release and leave the released loop visible beside the book. Open the cover automatically.
- [x] Remove Bookshelf and the separate Design Studio route. New Sketchbook becomes the single creation studio with all binding, format, paper, and page-turn controls.
- [x] Replace dropdowns with visual format/paper/motion choices. Remove the Original card; solid-color mode is separate from cover artwork.
- [x] Simplify book controls to accessible icons; hide preview labels, instructions, counters and page metadata from the visual canvas.
- [x] Add direct drag-to-position and drag-to-resize editing for cover crop and page artwork, with keyboard/range alternatives. Persist placement with each book.
- [x] Clean up the cover rail and artwork layout controls. Preserve responsive design, local persistence and the single Sketchbook renderer.
- [x] Verify images, release/close cycle, crop persistence, both artwork layouts, touch and keyboard interaction, and production build. Update documentation and leave the server running.

## Verification
- Production build passed.
- Eight browser tests passed: visual controls, prepared front/plain back covers, elastic recoil/attachment/reclosure, all bindings, mobile reduced motion, placement persistence, spread alignment and direct resize/upload.
- Desktop/mobile screenshots reviewed in .reference-analysis/.
- Four AI-flattened assets and prompts documented in docs/COVER-ASSETS.md; 21 active presets. Original source media retained.

## Caption, ingestion and portfolio directions
- [x] Embed an optional 48-character single-line cover phrase; preserve plain backs.
- [x] Keep one New Sketchbook editor for creation and editing in every style.
- [x] Validate image signatures, dimensions and size before decode; re-encode pixels and process sequentially. Share ingestion for covers and artworks.
- [x] Add explicit crop selection with apply/cancel/reset and accessible controls.
- [x] Follow the reference video with adjacent spines and a selected cover expanding in place.
- [x] Keep Gallery and add Editorial (sidebar/catalog) and Library (centered/spine rail), each with a distinct editor layout.
- [x] Verify switching styles preserves drafts/data, crop/caption persist, invalid and oversized files are rejected, bookshelf navigation and mobile layouts work.

Previous milestone completed: build and 12 browser tests passed; caption, crop, safe image ingestion and the three styles are implemented.

## Feed, formats and phone experience
- [x] Preserve the opening motion; remove the released elastic at opening completion without fading.
- [x] Respect saved aspect ratios in thumbnails, bookshelf, feed and interactive pages.
- [x] Hide scrollbars globally while retaining touch, wheel and keyboard scrolling.
- [x] Add Gallery, Editorial and Library feeds with varied demo books, likes, bookmarks, filters and creator portfolios.
- [x] Connect feed, portfolio and the single creator/editor with phone navigation.
- [x] Improve phone canvas sizing, touch targets, inputs, safe areas, dialogs and crop interactions.
- [x] Verify complete flows, responsive sizes, page gestures, state persistence and production build; update docs.

Verification: production build passed. All 16 browser checks passed (15 in the full run, then the corrected touch test passed in isolation after scrolling its target into view). Reviewed Gallery, Editorial and Library screenshots at desktop and 320/390px widths. Confirmed ratios numerically, elastic removal/reclosure, touch page turn, drafts, cropping, captions, invalid uploads and local persistence. Physical phone hardware was not available; phone verification used Chromium touch emulation. Dev server remains on port 5173.

Latest requests supersede the historical items above: Bookshelf is available, the feed is included, and the elastic disappears immediately after opening completes.

## Two coordinated styles, dark appearance and motion
- [x] Retain Gallery and Editorial with a shared palette and both collection preview modes; remove Library and migrate old style preference safely.
- [x] Remove New Sketchbook from top navigation; keep creation actions in the collection, feed and phone Create tab.
- [x] Add persistent light/dark appearance across profile, feed, editor, dialogs and mobile navigation, initialized before paint.
- [x] Add Lenis desktop wheel smoothing via the existing GSAP ticker with native touch and nested controls.
- [x] Add scoped, short GSAP entrance motion; respect reduced motion and clean up on updates/unmount.
- [x] Validate browser flows, theme persistence, reduced motion, scrolling, mobile and production build.

Verification: 18 browser tests passed; final production build passed. Reviewed desktop dark editor and 320px dark feed screenshots. Motion is bounded to short transform/opacity tweens; no per-frame React updates, extra scroll ticker or touch smoothing. Physical-device latency was not measured.

## Palette comparison
- [x] Preserve Original olive and add Midnight, Cobalt and Blue Slate colorways.
- [x] Pair beige light appearances with blue dark appearances; change UI colors only.
- [x] Add a compact visual palette chooser beside the appearance toggle.
- [x] Persist palette independently of light/dark and initialize it before paint.
- [x] Verify all eight combinations, draft/artwork preservation, reload/navigation and phone fit.

Reviewed desktop Midnight and phone palette chooser captures; all three new palettes captured in light/dark. Production build and 20 browser tests passed.

## Original palette and compact Explore
- [x] Roll back alternative palettes and picker, preserving original light/dark preference.
- [x] Remove Explore hero only; keep creator portfolios and existing interactions.
- [x] Three-column desktop Gallery feed with 24px gutters, responsive tablet/phone layouts.
- [x] Compact icon-only presentation switches, no decorative outlines; keep keyboard focus and accessible labels.
- [x] Build, regression checks and desktop/mobile visual review.

Production build and 18 browser tests passed. Reviewed compact three-column desktop Explore and 320px phone layout.

## Journal sticker board — IN PROGRESS
Owner: current Codex task (2026-11-03). Scope: replace the journal cover sticker placeholder only; existing journal/sketchbook features remain unchanged.
- [ ] Graphify architecture analysis and journal/sticker documentation review.
- [ ] Compact sticker browser using prepared cutouts, with vibe/category filters.
- [ ] Cover placement, positioning, size/rotation/removal, shared rendering and persistence.
- [ ] Existing palette/spacing, accessible icons, touch/keyboard support, reduced-motion GSAP.
- [ ] Tests, visual review and build; publish integration notes for other agents.
