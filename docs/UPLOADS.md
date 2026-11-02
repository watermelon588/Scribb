# Local image upload contract

Both cover and artwork uploads use src/lib/images.ts. JPG, PNG and WebP only.
- Maximum 10 MiB per file; 40 MiB per selected batch.
- Maximum 20 million decoded pixels; 8192 pixels on either edge.
- Maximum 40 artworks in one sketchbook.
- MIME allowlist plus signature and header dimension inspection before decode.
- Images must decode successfully. Re-encode decoded pixels as WebP; originals,
  metadata, appended content and active document formats are not stored.
- Resize the stored raster to a maximum edge of 2560 pixels.
- Process sequentially, close decoded bitmaps and commit the batch only if it succeeds.
- Reject failed input with an inline notification, preserving the current draft.

This is browser-local ingestion, not a malware scanning service or server-side
security boundary. When remote storage is introduced, the backend must enforce
limits and validate/re-encode uploads independently; client checks can be bypassed.
Current source files never leave the device. Crop output is also re-encoded pixels.
