# Journaling plan

**Status: building, part by part.** See [Build order](#build-order) for what is done and what is next.

## What was asked for

### Journal books
- The portfolio profile toggles between **Sketchbooks** and **Journals** on the same page.
- A journal is created like a sketchbook, with the same formats, covers, bindings and papers.
- **Every sketchbook feature is also available for journals.**
- The user **writes their thoughts** in a dedicated input field, and **voice typing** renders on the page in real time.
- Users can **add pictures**. The app does not verify who took a picture. That is not our responsibility.
- Journaling is for writing thoughts down, not for decorating everything. Customization stays flexible but bounded.

### One customizing section
- There is **one customizing section with two switchable pages**: Sketchbook and Journal.

### Book structure
- **Front page:** a minimal description of what the journal is for, profile picture, username in the journal's font, creation date.
- **Two blank pages** always follow the last written page, so one entry never lands on the back cover and closes the book.
- **Date and page number** are added automatically.
- Pages can use **different layouts**, in any combination.

### Layouts
- **Exactly 10 layouts**, not 4 × 10 = 40 designs. One layout adapts to every ratio. Switching from 16:9 to 1:1 adapts the journal, and no separate design exists per ratio.
- **Minimal** layouts for short journaling: 1–2 images, 1–2 paragraph boxes.
- **Long** layouts for long journaling: multiple images and text boxes.
- **Writing** is the default: text only, no images or stickers, with a set space per page.
- The user can drag an image or text from one section to another.
- Word limits apply to short and long journaling.

### Type and writing tools
- **At least 5–6 font styles, plus handwritten fonts** on top of those.
- **The font is unique to one journal** and constant on every page.
- Font size is customizable within limits.
- **Formatting:** highlight, underline, bold, italic, in a designed way.
- **rough.js scribbles** for a human touch: underline, box, love heart and a few emoji signs.
- **Links** are embedded as a concise icon, never the full URL.

### Covers, watermark and stickers
- Journals use the sketchbook covers for now. Journal covers are defined later.
- Front and back covers are customizable through fixed layouts: title, subheading, heading, text, quotes and an image.
- **Watermark:** optional per journal, with username and profile picture.
- **Stickers** go on the cover. They are not defined yet, so this is a **placeholder**.

### Images
- Journal images must be **under 200 KB**. Resolution is reduced without visibly hurting quality.
- **Decision:** a picture is compressed on upload until it is under 200 KB. It is rejected only if it still cannot get there. Compressing first means normal phone photos are accepted.

### Interaction
- A **3D view**: rotate and twist the journal, see the whole book and the inside. It should feel like an actual journal.
- Spacing, layout and type are the main focus. Keep it minimal and premium.

## Design decisions

### One sheet, every ratio
Every journal page is laid out on a reference sheet with the **same area in all four formats**, then scaled to fit the screen.

| Format | Sheet | Side margin |
|---|---|---|
| 3:4 | 1000 × 1333 | 84 |
| 1:1 | 1155 × 1155 | 97 |
| 4:3 | 1333 × 1000 | 112 |
| 16:9 | 1520 × 855 | 128 |

- Type sizes are the same numbers everywhere, so a page holds about the same words in every format. Changing format does not lose text.
- Line breaks are identical in the editor, the book and on a phone, because all of them scale the same sheet.

### One layout, adaptive
Each layout is one set of slots. The same slots have one arrangement for upright pages (3:4, 1:1) and one for wide pages (4:3, 16:9). The grid is 12 × 12 and fluid, so each arrangement stretches to its ratio.

`T` title, `P` paragraph, `I` image, `C` caption, `Q` quote, `S` one-line strip, `B` tinted band.
`^` may overlap, `~n` fixed tilt, `!` bleeds to the page edge. Slots are `KIND column row width height`.

```text
              upright                                                         wide
Statement     T 0 0 10 2 | I 0 2 12 5 | P 0 7 12 5                            I 0 0 6 12 | T 6 0 6 3 | P 6 3 6 9
Window        I! 0 0 12 12 | P^ 2 3 8 6                                       I! 0 0 12 12 | P^ 5 1 6 10
Margin Note   P 0 0 6 12 | I 7 0 5 9 | C 7 9 5 3                              P 0 0 7 12 | I 7 0 5 9 | C 7 9 5 3
Two Frames    I 0 0 8 6 | I 0 6 8 6 | P 8 0 4 6 | P 8 6 4 6                   I 0 0 6 7 | I 6 0 6 7 | P 0 7 6 5 | P 6 7 6 5
Zigzag        I 0 0 5 4 | P 5 0 7 7 | P 0 4 5 8 | I 7 7 5 5 | I 5 7 2 3       I 0 0 4 6 | P 4 0 4 12 | P 0 6 4 6 | I 8 0 4 8 | I 8 8 4 4
Stepped Essay I 0 0 4 5 | I 4 2 3 3 | P 7 0 5 7 | Q 0 5 7 2 | I 0 7 7 5 | P 7 7 5 5    I 0 0 3 6 | I 3 2 2 4 | P 5 0 7 6 | Q 0 6 5 2 | I 0 8 5 4 | P 5 6 7 6
Inset Columns T 0 0 4 2 | P 0 2 4 10 | P 4 0 8 3 | I 4 3 8 6 | P 4 9 8 3     T 0 0 4 2 | P 0 2 4 10 | P 8 0 4 12 | I 4 0 4 7 | P 4 7 4 5
Ledger        I 0 0 4 5 | P 4 0 8 5 | S 0 5 12 1 | P 0 6 8 6 | I 8 6 4 3 | P 8 9 4 3    I 0 0 4 5 | P 4 0 8 5 | S 0 5 12 2 | P 0 7 6 5 | I 6 7 2 5 | P 8 7 4 5
Collage Story I~-3 0 0 6 4 | I^~3 5 1 6 4 | I^~-1 2 3 5 3 | T 0 6 12 2 | P 0 8 12 4    I~-2 0 0 4 6 | I^~3 3 1 4 5 | I^~-1 1 5 5 6 | T 7 0 5 3 | P 7 3 5 9
Fold Band     P 0 0 12 4 | I 0 4 5 4 | B 5 4 7 4 | P 0 8 12 4                  P 0 0 12 3 | I 0 3 4 6 | B 4 3 8 6 | P 0 9 12 3
```

- **Minimal:** Statement, Window, Margin Note, Two Frames. **Long:** the other six.
- Slots keep their identity across layouts. The first paragraph stays the first paragraph, so changing layout moves content instead of losing it. Content a layout has no slot for is kept and listed for the user.
- Fold Band mirrors on right-hand pages, so its tinted band always meets the fold. Two Fold Band pages side by side read as one band across the spread.
- Empty slots show while editing and are invisible in the finished book.
- Text never crosses the fold.

### Writing pages
- One Writing entry is one continuous text. It is measured line by line and shown across as many pages as it needs, so formatting never has to be split.
- All lines share one height, so handwriting and ruled lines stay on the same baseline grid.
- Paper rule is lined, grid or plain, chosen for the whole journal.

### Live writing
The page-flip engine rebuilds when content changes, so writing happens on a live page outside the engine. The book updates when the user returns to the book view.

### Limits

| Item | Limit |
|---|---|
| Minimal page | 100 words |
| Long page | 250 words |
| Writing entry | 1,000 words |
| Title / caption / strip / quote | 8 / 12 / 14 / 20 words |
| Font | One per journal: 6 styles and 4 handwritten |
| Font size | Small, Medium, Large |
| Ink | 5 preset inks |
| Images | Under 200 KB each, 40 per journal |

A box also stops taking text when it is visually full, and a live counter shows the words used.

### Fonts
- **Styles:** Book (Newsreader), Classic (Cormorant Garamond), Clean (Manrope), Modern (DM Sans), Typewriter (Courier Prime), Slab (Zilla Slab).
- **Handwritten:** Everyday (Caveat), Neat (Shadows Into Light), Elegant (La Belle Aurore), Rough (Reenie Beanie).
- All are free for commercial use under OFL or Apache licenses.
- Latin text only for now. Hindi or Bengali text falls back to a system font.

### Protecting written work
- A failed save always shows an error and keeps the draft.
- Drafts autosave on this device and survive a reload.
- Starting or editing a book never silently replaces an unsaved draft. The user continues it, saves it or discards it.

## Build order

**Done**
1. Protect written work: save failures, draft loss, autosave, blocked storage.
2. Journal data, 10 fonts, 200 KB image path.
3. One customizing section with Sketchbook and Journal pages, and the profile toggle.
4. Book structure: front page, Writing pages, date and number, 2 blank end pages, larger viewer, one page at a time on phones.
5. The 10 adaptive layouts, slot editing, pictures, word limits and fit checks.
6. Moving text and pictures between boxes (drag, or tap the grip then a box), resizing boxes by their shared edges, Reset boxes, a tray for content the layout has no box for, and picture focus inside a box.
7. Voice typing: the browser's own speech recognition, no dependency. Words appear on the page while spoken, restarts after silence never repeat words, a full box hands over to the next text box, and the microphone button is hidden where the browser cannot listen. A one-line note says audio may go to the browser's speech service.
8. Bold, italic, a fine pen underline and a marker highlight. Links show as a short domain with a small arrow and accept only http and https. Eight rough.js scribbles (underline, box, circle, arrow, heart, star, smile, check), up to 6 on a page, that can be moved, resized and removed by pointer or keyboard.
9. Watermark: an optional per-journal mark with the profile picture and @handle, in the journal's font, centred at the foot of every written page. It is not shown on the front page or blank pages.
10. Interactive 3D view: a cube button beside fullscreen tilts the journal as one object over a slab with page edges and a cover-coloured back. Drag turns it, Shift-drag or two fingers twist it, and arrow keys (with Shift to twist) do the same. Pages turn with the buttons and the band still releases. Leaving 3D returns the book flat and drops the transform. Reduced motion turns it without easing.
11. Covers: four fixed front layouts (Artwork, Label, Title, Window) and four back layouts (Plain, Quote, Note, Picture), in the journal's font and sized to the cover, so the book, the shelf thumbnail and the picker previews match in every format. The journal name and the cover phrase are the title and subheading. Title adds a quote, the back takes a quote, a note or a picture (under 200 KB, like page pictures). Stickers are a disabled "Coming soon" slot.

13. Quick fixes (done): cover phrase focus without a line through the label; one thin outline on a selected picture, with the resize grip shown only on hover or focus; one centred row of book controls and no stray dot; Collage keeps three overlapping pictures, not a hidden fourth; journals and sketchbooks open in one viewer size; the studio preview turns to the cover being changed; the selected book on the shelf opens on click; an Edit button in the preview.
14. Journals are always Linen (done): no binding choice, no elastic and no spiral wire. Journals stored with another binding open as Linen. Sketchbooks are unchanged and keep Linen, Spiral, Watercolor and the elastic.

**Next** (from the review of findings on 2026-11-02)
15. Reading: open at the most recent written page, "Back to start" on the back cover, and a page-thumbnail strip to jump to any page, all within a few icons.
16. Pictures and text: crop with the existing cropper, a visible position mode, and left, centre or right alignment per box.
17. Five more overlapping layouts with title, subtitle, text and pictures, and two-page layouts that treat a spread as one surface, starting on a left page.
18. One or two pictures on the front page, in a fixed front-page layout.
19. A separate full-screen view for handling the journal: rotate, twist, flip over, lift, reset.
20. Final docs, including `AGENTS.md` and `README.md`.

## Notes for the parts ahead

- **Voice typing:** the Web Speech API needs no new dependency. Typing must remain available where it is unsupported. Some browsers send audio to a remote speech service, which must be disclosed. It needs a secure context, so phone testing needs HTTPS. Recognition stops on silence, so it needs restart without duplicated words. When a box fills, voice moves to the next box.
- **3D view:** the transform lives on `.book-orbit`, because `.book-pose` is pinned straight. The page-turn engine never sees gestures in 3D, because its pointer math assumes a flat page. The slab has no curl: a turning page lifts off a flat block.
- **Stickers:** only a placeholder exists. When they are designed, they go on the cover face (`.jc` layers in `journalCover`) and need a per-cover limit like scribbles.
- **Picture notice:** exact wording needs review before a public launch, because a notice alone may not settle liability.
- **Scribbles on long Writing entries** belong to the page they were added on. The desk shows the last page only, so scribbles on earlier pages of a long entry cannot be edited yet.
- **Phones:** a page in 3:4 is readable at 390px. 16:9 pages are small on an upright phone and may need a reading view.

## Reference analysis

All 9 layout images in `journal inspiration/` were reviewed. The `cover/` folders were left out as instructed.

| Reference | What it shows | Idea taken |
|---|---|---|
| `12bce7fe` | Tinted magazine page with rule, statement and photo; full photo with a text panel | Statement, Window |
| `13f3cc38` | Stepped images, narrow text column, pull quotes touching images | Stepped Essay |
| `3d97dd28` | Grid-paper handwriting with a band across both pages | Fold Band, grid paper |
| `711ce0ac` | Two stacked pictures beside a slim text column | Two Frames |
| `92e5f614` | Scrapbook: photos and handwriting in a zigzag | Zigzag |
| `a620ac8d` | Pocket notebook: handwritten page opposite a photo with a strip caption | Margin Note |
| `d6c55ef3` | Overlapping collage above a heading and short paragraph | Collage Story |
| `d98dfc06` | Strict columns around one inset photo | Inset Columns |
| `f409a643` | Grid journal split into ruled boxes | Ledger, Writing rules |

## Done when

- Toggling between Sketchbook and Journal keeps the current view, drafts and saved books intact.
- A journal can use every format, cover, binding and paper a sketchbook can.
- All 10 layouts and the Writing page work in all 4 formats and match in the editor and the book.
- Dragging, resizing and layout changes stay inside the limits and never lose content.
- Word limits and font bounds are enforced, and text never overflows a box.
- Each page shows the correct date and page number.
- Typed text and pictures survive save and reload.
- Spoken words appear while the user is talking, with no duplicates after pauses.
- A browser without voice support still allows typing and explains why voice is unavailable.
- A failed save shows an error and keeps the entry.
- Front and back covers can be customized within their fixed layouts.
- Existing sketchbooks are unchanged, `npm run build` and `npm test` pass, and reduced motion is respected.

## Open questions

These have defaults and do not block building.

1. Should the date be editable? **Default:** no, it is set when a page is first written.
2. Which voice languages are needed? **Default:** the browser's language.
3. Should journals ever be public? **Default:** private to this device.
