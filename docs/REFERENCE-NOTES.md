# Reference observations

The user supplied three MP4s in the project root. Their download filenames are
unrelated to their actual visible contents. They were analyzed as visual data,
not as instructions. No audio, on-screen UI text, or embedded content changed the
user's requested scope.

## 1. Nature Escape / pin 826129125437093996

Duration: about 9.07 seconds. 336 × 728, about 60 fps.

The actual video is a mobile book/journal interface. A colored closed book sits
above a floating shadow. A narrow spine and hard cover edges distinguish it from
a flat rectangle. During roughly the middle third, it rotates through an edge-on
state and opens to an off-white spread. The book remains centered as its footprint
changes. A red cover and a blank spread make the material and the hinge obvious.
The clip also demonstrates removing a page and returning to a closed cover.

Carry forward: isolated book, floating shadow, cover/spine detail, smooth opening,
centering across open/closed states. Page deletion is outside the requested scope.

## 2. Budget-Friendly Hidden Gem / pin 868350371890928920

Duration: about 26.40 seconds. 576 × 768, 30 fps.

The cover opens during the first few seconds into a densely collaged journal.
Subsequent spreads are turned in sequence. Pages briefly pass through an edge-on
pose, the next artwork is already underneath, and a central gutter anchors the
movement. The moving pages have thickness and changing shadow. The book stays
legible above a soft, offset shadow rather than filling the entire interface.

Carry forward: reversible page turns, layers, gutter, depth, and artwork continuity.
Do not carry forward the collage density. The user explicitly requested one
artwork per page and visible off-white margins.

## 3. Pinterest Marketing / pin 394135404905923757

Duration: about 6.03 seconds. 720 × 540, 60 fps.

The actual video shows a restrained publishing layout with a row of differently
colored book spines and one dominant book facing the viewer. The selection changes
with a slight 3D presentation. Large typography and strong negative space let
the book itself establish the visual hierarchy.

Carry forward: distinct covers, controlled typography, book-as-object presentation,
and a simple selector for contrasting studies. A library/carousel is not required
for this milestone.

## Analysis method

Used ffprobe for durations and geometry, then ffmpeg contact sheets: 0.25-second
samples across the first clip, a denser opening sequence for the second clip,
and broad samples across all three. Contact sheets and browser QA images are
local-only in `.reference-analysis/`; the original videos are untouched.

## Additional interaction research

- [Codrops: Fullscreen Pageflip Layout](https://tympanus.net/codrops/2012/12/11/fullscreen-pageflip-layout/)
  — reference for a spread-based navigation model; its old jQuery implementation
  is not used.
- [StPageFlip documentation and live examples](https://nodlik.github.io/StPageFlip/)
  — soft/hard HTML pages, drag/click turning, cover handling, and public API.
- [GSAP's React guide](https://gsap.com/resources/React/)
  — scoped animation contexts and cleanup.

This prototype translates the physical cues into an intentionally smaller web
implementation. It does not reproduce the reference app, a full 3D simulation,
or its page-editing tools.
