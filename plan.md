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

## Journal Part 17, layered and spread layouts — DONE (2026-11-02, Claude)
Scope: journal layouts only. Subtitle box, five Layered layouts, three two-page Spread layouts starting on a left page. See journaling-plan.md part 17.

## Journal sticker board — DONE (2026-11-03, Claude; taken over from the unfinished Codex task)
Scope: journals only. Sketchbooks are unchanged. Do not start this again.
- [x] Graphify query of the journal cover/page/scribble code; read docs/stickers/README.md and the plans.
- [x] Compact sticker tray (src/components/Stickers.tsx `StickerTray`): 13 vibe filters as icon buttons, lazy-loaded from /stickers/manifest.json, skeleton while loading, retry on failure.
- [x] One shared `StickerLayer` for the front cover and pages. Records are percentages of the surface (src/data/stickers.ts), so editor, book, shelf and every format match.
- [x] Pages: tray in JournalDesk, up to 8 per page (writing entries: on the page being edited). Cover: tray in JournalCoverSettings, up to 5 on the front cover, arranged on a flat cover in the canvas (`editing==='stickers'`, sticker button in the canvas actions).
- [x] Tap to add, drag from the tray to drop exactly there (mouse/pen), drag to move, corner handle to resize and turn, remove button; keyboard: arrows move, Shift+arrows turn/resize, Delete removes, Escape deselects.
- [x] GSAP press-in on add, lift while held, shrink on remove; all instant under reduced motion. Only prepared /stickers/*.png sources are drawn.
- [x] Tests (journal.spec.ts sticker tests), desktop and 390px visual review, build.

## Welcome, information pages and Ask my journal — 2 November 2026
- [x] Replace the guest text hero with the supplied modest centered animation and one account prompt. Preserve the source GIF; serve silent looping MP4s with matched light/dark backgrounds, posters, a pause control and reduced-motion behavior.
- [x] Add Privacy and Terms routes, shared footer links and account-creation links. Describe actual storage/deletion limits and verified Gemini free-tier processing.
- [x] Connect Ask my journal to consent, verified email, cold-start status, actual Gemini streaming, source dates, retry, stop, clear and withdrawal. Keep conversations in memory and mint a fresh ticket after waking without charging for health checks.
- [x] Review desktop and 320px/390px layouts in both appearances. Correct the new pages' muted-text contrast without changing the established palette.
- [x] Build and validate locally: 16 API tests and 20 Python tests passed. The full browser run passed 47/50 including all four new page tests; the two timed-out existing journal/theme checks passed focused reruns. The remaining elastic check passed after its immediate SVG assertion became an awaited poll of the same expected value. No renderer or gesture code changed.

AI checks used mocks and local test storage; no journal content was sent to a live provider. Streaming needs the updated AI service deployed with the app; the client also supports the older JSON response. Media provenance is in public/media/README.md; surface design and maintenance are in docs/PUBLIC-PAGES.md.

## UI system: buttons, fields, type, spacing, dividers — DONE (2026-11-02, Claude)
Scope: app chrome only. Book pages, covers, journal sheets, stickers and scribbles are unchanged. Rules in docs/UI-SYSTEM.md and AGENTS.md (Rendering and design).
- [x] Audited every stylesheet and page: profile (Gallery, Bookshelf, Editorial), preview, Explore, another artist, New sketchbook, New journal, journal desk, cover editors, sticker tray, dialogs, sign-in, guest, Ask, legal; light and dark.
- [x] src/system.css (loads last): spacing, type and weight scales, `--radius` 0, `--control` 40/44px. Colors stay in theme.css (`--app-danger` added).
- [x] Five button roles replace solid-, outline-, quiet-, icon-, text-button and journal-tool: `button-primary`, `button-secondary`, `button-quiet`, `button-icon`, `button-link`. Old one-off button rules removed from profile, theme, variants, account, pages, journal, feed and responsive CSS. Round buttons are square; swatches and avatars stay round.
- [x] One field style: underlined text fields, boxed writing areas, 16px inputs, muted placeholders. Focus turns the border accent with an outside underline; no outline over text or placeholders. Buttons and links keep a 2px focus ring outside.
- [x] Type and spacing normalized to the scale (chrome text ≥12px); stray dividers removed (toolbar, card captions, footers, tool groups).
- [x] Phones: Gallery/Bookshelf switch gets its own row, the studio header wraps so Save fits at 320px.
- [x] npm run build passes; API tests 18/18. Browser suite on spare ports: all passing except feed.spec "feed reactions…", flaky (passed once, failed once at a different step on repeat). Screenshots at 1440/390/320 in light and dark reviewed.

## Phone editor hierarchy and artwork corrections — 5 November 2026
- [x] Shared PhonePanel gives each top-level tool separate feature tabs and only the selected options. Cover artwork/color/elastic, paper/format/turn, journal layout groups, stickers, and page styling no longer run into each other. Desktop keeps its existing DOM layout.
- [x] Preserve the large preview and compact editing panel. Verified 320px and 390px with no document overflow; writing, formatting, microphone and alignment remain accessible.
- [x] Add phone draft undo (40 snapshots), checkmark Save, plus-only add controls. Save first opens Details/Visibility/Category, then the checkmark commits. Undo refreshes live journal writing as well as design values.
- [x] Move phone information links into Settings beside the owner profile. Include account settings, About, Terms, Privacy, Feedback and Install. Remove header overflow menu; phone companion appears only on Portfolio.
- [x] Correct desktop sidebar image-frame offset and feed picture geometry. Unpaired feed artwork uses one page; continuous spreads retain their fold.
- [x] Production build passes. Local-only API suite: 24 passed. Phone screenshot inspection completed; physical phone hardware was not available. Browser regression results recorded after the final rerun below.
- [x] Regression verification: full npm test ran (24 API checks, 76 browser checks). Initial browser failures were resolved and verified in focused reruns, including all five phone/frame checks, phone navigation, journal covers, notifications, installation, and persisted cover/spread placement. Final sticker test passes after keeping selected editing handles above overlapping stickers. Build rerun after that fix.
