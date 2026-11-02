# Prepared cover assets

## Current collections — 2026-11-02

The new delivery contains **40 flat cover designs**: 20 sketchbook covers and 20 journal covers. The journal set contains 15 general covers and five anime covers. There is one lossless WebP master per design, not four deliverable variants.

- Sketchbook: `public/covers/sketchbook/`
- Journal: `public/covers/journal/`; anime: its `anime/` subfolder
- Combined frontend manifest: `public/covers/collections.json`
- Per-collection manifests: `manifest.json` in the two collection folders
- Complete reference mapping, export hashes, methods and built-in editing prompts: `docs/COVER-COLLECTIONS.json`
- Findings for all 103 references: `docs/COVER-REFERENCE-AUDIT.md`
- Collection previews and 160 four-ratio crop previews: `docs/cover-previews/`

Normal quotes and ordinary captions are retained. Commercial titles, creator credits, signatures, wordmarks and logos were removed from the selected edited designs. No watermarks were added. The Japanese handwriting on `blue-table` is an ordinary caption, so its original artwork was retained.

21 standalone originals retain their decoded RGB pixels exactly, at their native resolution, without artificial upscaling. 19 designs use the **built-in image editing tool** for flattening photographed covers, credit removal, resolution reconstruction or crop framing. These are faithful AI reconstructions, not pixel-identical photographic extractions. No CLI/API fallback was used. All final WebP exports preserve their selected input pixels losslessly and omit EXIF/XMP payloads. All 103 reference file hashes were verified unchanged.

Use `src`, native `width`/`height`, and the selected ratio's `objectPosition` from the manifest when importing. Positions are percentages for CSS `object-fit: cover` / `object-position`. The same master supports 16:9, 1:1, 4:3 and 3:4 through cropping; outer portions of a composition vary between formats. To show an entire original composition, preserve its native ratio or use the existing placement controls. Do not stretch artwork. Front covers use these flat designs; back covers remain plain material/color.

This delivery prepares assets and manifests for import. It does not change the app's active presets, renderer, gestures or persistence. Verification used asset decoding, pixel comparisons, checksums, metadata inspection and visual crop review; app build/tests were not run for this asset-only task.

## Earlier preset preparation (historical)

The following records the earlier preset batch. Its wordmark-preservation prompts are historical and are superseded by the current text policy above.

Prepared on 2026-11-02 using the built-in image generation/editing tool, not the CLI.
Original reference files are unchanged. These are AI-flattened reconstructions;
they are not claimed to be pixel-identical photographic crops.

| Output (project-relative) | Reference | Treatment |
| --- | --- | --- |
| public/covers/mobiliza-flat.png | 2baf3fdf1764655bc37b534cbc9b44c1.jpg | Flat black cover, cobalt/cream geometry; scene and blue strap removed |
| public/covers/rabiloo-flat.png | 13a41157bbb2ee9d009887d7439723cc.jpg | Cobalt/white cover, perspective corrected; scene, pages and strap removed |
| public/covers/itau-flat.png | 090afe22b13a67064d08bc51c7b8ccc0.jpg | Woven blue cover and illustrated band; orange scene and elastic removed |
| public/covers/stripes-flat.png | cover/acfeea0270084f01e1ff6f1a53f16b75.jpg | Central striped artwork extracted from stack, white frame/text/other books removed |

The references live under texture and cover layout and colour reference/.

## Prompt set
Shared instruction for the three notebook photographs: Extract the front cover
print into a flat full-bleed rectangular 3:4 portrait texture. Correct perspective
and rotation. Preserve typography, original colors and illustration. Remove the
outside scene, shadows, pages, spine, physical edges, rounded corners, bookmarks
and elastic strap; reconstruct the print under the strap. Output only the flat
cover print, with no margins and no notebook mockup.

Mobiliza: Preserve the wordmark and geometric band placement. Inpaint the blue
strap area with matching black material and blue/cream shapes.

Rabiloo: Keep the cobalt upper area and white lower area with Rabiloo / Grow
Together lettering.

Itau: Keep the blue woven surface, 2025, Portuguese text, the illustrated horizontal
band of four people and small Itau logo.

Stripes: Extract only the frontmost diagonal cover's blue, vermilion, peach and
mustard composition and black gestural drawing. Remove surrounding books, scene,
white frame, author/publisher/title typography, perspective and shadows. Reconstruct
hidden edges to fill a portrait rectangle without adding decorations.

## Other presets
17 existing files are standalone artwork rather than book mockups. Those remain
available with edge-to-edge cover fitting and editable scale/position. Nine raw
book/layout photographs were removed from the active picker. The overlapping-book
preset already stored in a user's library maps to stripes-flat.png on loading.
Other removed mockup selections become plain covers; artwork and other book data
are preserved. The picker contains 21 usable presets including the four prepared
assets, plus custom cover uploads and a separate solid-color mode.
