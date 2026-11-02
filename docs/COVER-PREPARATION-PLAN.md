# Reference cover preparation — 2026-11-02

## Deliverables

- Inspect all 46 sketchbook, 39 general journal and 18 anime references.
- Prepare 20 sketchbook covers and 20 journal covers, including five anime images.
- Preserve normal quotes and inspirational wording. Remove creator credits, commercial names, logos and watermarks.
- Preserve clean standalone artwork pixels. Use the built-in image editor for signature removal, reconstruction and flattening photographed notebooks.
- Keep one master file per design in WebP format; do not create four deliverable variants.
- Save collections under `public/covers/sketchbook/` and `public/covers/journal/`, with anime under `journal/anime/`.
- Keep every original reference unchanged. Do not alter frontend behavior or existing presets in this asset-preparation task.

## Checks

- Review every final image for physical book edges, straps, scene backgrounds, credits and unintended text.
- Review 16:9, 1:1, 4:3 and 3:4 crops. Record focal positions for frontend object-position; single-master crops necessarily trim different parts of the artwork.
- Decode every output, check dimensions and file sizes, and produce a source manifest, reference audit and review contact sheets.
- Record actual processing methods and prompts in `docs/COVER-ASSETS.md`. Do not describe AI reconstructions as pixel-identical extractions.

## Completed

- All 103 reference images inspected; findings recorded in `COVER-REFERENCE-AUDIT.md`.
- Exactly 20 sketchbook and 20 journal masters exported; five journal covers are anime.
- 21 standalone originals retain their decoded RGB pixels exactly. 19 covers use built-in image edits for flattening, credit removal or framing; they are faithful reconstructions, not pixel-identical extractions.
- Normal quotes and ordinary captions retained. No new commercial text, creator credits, logos or watermarks introduced.
- One lossless WebP master per design; all 40 decode and match their export input pixels exactly, with metadata removed.
- All 103 original reference file hashes verified unchanged.
- Four-ratio crop positions recorded in the manifests; collection and crop review sheets saved under `docs/cover-previews/`.
- Public collection manifests and a detailed source/prompt manifest prepared for later frontend import. Existing app code and presets were not changed.
