> Revision: books stay straight, with no presentation rotation or tilt. Current designs: Linen, Spiral (visible wire loops), and Watercolor (elastic closure). Float is removed. Five muted and five bright cover colors; four original reference textures plus a dotted pattern. This revision supersedes earlier preset/motion descriptions below.

# Design contract

## Direction

A quiet artist's worktable, with the sketchbook as a physical object. Use generous
space, fine borders, soft daylight-like shadows, and regular/light typography.
The stage supports the art; it is not another card full of interface controls.

The light neutral application shell remains consistent. Stage tints and selected
controls respond to the chosen material. Do not add gradients, decorative motion,
heavy headings, badges, or social features to this milestone.

## Material studies

| Study | Font | Form | Motion |
| --- | --- | --- | --- |
| Linen | Manrope, 350–400 | Cloth weave, inset spine, artwork plate, soft corner | Soft page curl; almost level book |
| Archive | Newsreader, 350–400 | Fine-grain cover, inset frame, centered title | Rigid hinge; slightly raised perspective |
| Softcover | DM Sans, 350–400 | Thin stock, offset rules, landscape default | Faster soft turn with gentle book lift |

Newsreader is intentional for the Archive's publication/archive character. The
other two studies use sans-serif typography. The wordmark and functional small
labels stay Manrope to retain a common identity across the experiment.

## The page

Off-white base `#f6f3e9`; subtle repeating SVG grain; a shaded inner gutter.
Artwork uses `object-fit: contain`, with approximately 10% horizontal page margins.
The artwork frame occupies at most 67% of the page height. No artwork cropping or
full-bleed pages. Each side is a page, with exactly one artwork and a quiet caption.
An odd artwork count receives an endpaper, rather than repeating an image.

Cover color uses a CSS variable and updates without reconstructing the page engine.
Cover ink adapts to the selected color's luminance. The displayed binding edge
shares the same color, so open books also reflect cover customization.

Supported page aspect ratios are 3:4, 1:1, 4:3, and 16:9. Ratios describe individual
pages, not spreads. The renderer fits two pages into its available space and
preserves the ratio; it never stretches artwork. A ResizeObserver measures the
stage, including fullscreen changes.

## Motion contract

Motion communicates the physical relationship between cover, spine, and pages.
There is no looping decorative animation or pointer-following effect.

- Curl: flexible pages, 850 ms nominal turn, subtle dynamic page shadows.
- Hinge: hard page density, 1000 ms nominal turn, sculptural presentation.
- Float: flexible pages, 620 ms nominal turn, 12 px book lift and 2° extra rotation.
- Cover centering: 650 ms, `power3.inOut`, keeping closed and open books centered.
- Book pose: 500 ms, `power3.out`, retargeted instead of stacking tweens.
- Ordinary button/toggle feedback: 150–200 ms. Hover changes only for fine pointers.

Page turns are deliberately slower than ordinary interface transitions: they are
the experience being explored. Buttons are disabled during a turn to prevent
overlapping flips. Keyboard navigation is immediate. Reduced-motion mode removes
book tilt/lift and animated centering, disables drag/corner peeks, and uses immediate
page navigation. Both previous/next buttons and keyboard operation remain available.

GSAP contexts are scoped to each book and cleaned up on unmount. The PageFlip RAF
patch is necessary for equivalent cleanup of that library's render loop. A small
touch adapter starts the engine's drag after horizontal intent is established,
avoiding the upstream delayed-start swipe ambiguity. Vertical touch gestures
remain native scrolling. It uses the same engine and page renderer as mouse turns.

## Interaction and persistence

The first spread is visible initially so the art leads. View cover animates back
to the front. Open book opens either the front or back cover in the appropriate
direction. Page arrows never wrap around the book. Clicking an artwork turns the
page; there are no navigation links inside the page surface in this prototype.

Customization is stored in versioned localStorage with validation. Artwork is
temporary, decoded before use, and represented by object URLs that are revoked
when replaced or unmounted. No simulated cloud save, accounts, likes, or upload
progress. Clearly describe the local preview next to the upload action.

## Accessibility and responsive behavior

Use real buttons with names, visible keyboard focus, pressed state for selections,
and switch semantics for grain. Page changes have a polite live announcement.
Artwork has descriptive alt text. Hidden source pages are excluded from the
accessibility tree; only the engine's visible page copies are exposed.

At small widths the book stays first and the customization becomes a two-column
section below it. Preset cards stack vertically. Preserve natural page scrolling.
Never trap touch scrolling in the whole studio; gestures belong to the book only.

Current closure correction: no stationary spread-wide backing plane. Watercolor starts closed and secured; releasing the elastic (click or horizontal pull) stretches and snaps it clear before page navigation is enabled. Closing either cover secures it again. Off-white is restored alongside the five textures. Five custom cover presets remain deferred.

Elastic interaction revision: ElasticBand renders an anchored SVG ribbon. Pointer position controls the bend location and stretch; longer pulls thin the ribbon. Pulls under 48 px recoil and remain locked. Outward pulls beyond that threshold slip off the cover with a damped elastic recovery. Pointer cancellation recoils. Click/keyboard release follows the same path. All animations are scoped and honor reduced motion.


## Portfolio milestone
The root route is the profile; /#studio retains design exploration. Profile provides a gallery and compact upright bookshelf, search and incremental loading. Creation supports the original cover, all 26 supplied images in an overlapping hover/focus card rail, ten colors, paper, format and binding. Artwork stays contained. A full spread duplicates one image into aligned clipped halves with gutter shading; a blank page aligns spreads after odd single pages. Profile and books save locally (localStorage and IndexedDB), not to a remote account. Band material is charcoal woven elastic, with point-of-grab deformation and automatic opening after release.

## Current creation revision (2026-11-02)
This supersedes the earlier two-layout and studio descriptions. Only Gallery is
active. New Sketchbook is the unified creation studio; /#studio and /#new enter it.
The new front covers are flat prepared artwork, full bleed, with plain backs.
Cover and page artwork placement can be dragged and resized; visual single-page
and full-spread choices persist with each artwork. Visual format, paper and motion
buttons replace dropdowns. Book chrome is icon-led. The ribbon remains attached
when released and the cover opens automatically. See docs/COVER-ASSETS.md for
asset provenance, generated reconstruction prompts and the active preset policy.

## 2026-11-02: portfolio style exploration
Gallery keeps the original open grid and right-hand editor controls. Editorial
uses a sticky artist sidebar, alternating catalog rows, Newsreader typography and
left-hand editing tools. Library uses a centered artist masthead, the reference
spine rail and a full-width editing workbench with grouped controls beneath it.
The style picker switches the shared UI without resetting drafts or library data.

The re-examined 6-second reference shows neighboring spines sliding aside as a
selected spine becomes a full front cover. Bookshelf uses adjacent variable-height
spines and one expanding cover, keyboard arrows and horizontal scrolling. It does
not copy the reference's slight rotations: prior user instructions keep books straight.

Captions are optional, capped at 48 characters, and typeset on the front cover.
Back covers remain plain. ArtworkCropper applies a selected crop to encoded image
pixels; PlacementEditor handles position/scale independently. Both work on the same
saved artwork used by the single Sketchbook renderer.

## Feed and phone milestone
The latest scope includes Explore at /#feed. Gallery uses two columns, Editorial a
reading-room sidebar and larger single-column books, and Library a compact three-column
collection. Each collapses to a legible phone feed. Four fictional artists and twelve
books demonstrate the existing bindings, all aspect ratios, covers and full spreads.
Likes/bookmarks are local only; no comments or server claims.

The existing elastic release sequence is preserved. On completion of the cover turn,
the elastic unmounts with no fade; later page turns do not reintroduce it. Shared
BookObject thumbnails fit their available space while maintaining the saved ratio.
All scrollbar chrome is hidden without disabling scrolling. Mobile navigation,
safe-area padding, larger controls and full-screen dialogs support touch use.
