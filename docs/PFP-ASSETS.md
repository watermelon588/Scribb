# Profile picture cutouts

The twelve full-resolution transparent PNG cutouts live in `public/avatars/a01.png` through `a12.png`. `public/avatars/mine.png` is the reserved creator portrait. All eleven original reference images in `journal inspiration/stickers/pfp` are preserved. Multi-character sheets supply individual faces for the twelve public choices.

The app serves 128, 256 and 512px lossless RGBA WebP copies from `src/assets/avatars`. The browser selects a copy for the rendered size and pixel density, with the 1254px PNG available for larger displays. Generate the copies with Pillow's Lanczos resize and `lossless=True, exact=True, method=6`. Each decoded WebP matches the resized pixels exactly. Vite hashes the filenames so browsers can cache them between visits.

Prepared with the built-in image_gen editing tool, one edit target per output, requesting faithful background extraction, cleaner detail and true transparency. These are AI-assisted extractions rather than pixel-identical copies. The complete reference-to-output mapping and exact prompts are in [PFP-ASSETS.json](PFP-ASSETS.json). PNG export removes metadata without changing decoded RGBA pixels. No rectangular background, mockup, watermark or sticker border is added. Circular framing is applied in CSS, keeping the assets reusable as cutouts.

Existing public preset IDs are preserved so saved profiles now use the new illustrations automatically. Legacy SVG files remain unused for compatibility. `avatarSrc` resolves only the twelve allowed IDs and `mine`.

`server/creator.ts` derives creator identity from verified ownership of `maityrohit021@gmail.com`. The creator gets `mine` as the effective default and the extra menu choice. Other accounts cannot save that ID, including through direct API requests. Unverified email claims confer neither the avatar nor the star badge. A public profile exposes only the derived creator boolean, never the email. The Creator star appears beside the profile name to owners and visitors in both styles. This does not grant unrelated administrative powers.

Verification: API integration tests exercise ordinary accounts, forged roles, unverified claims, verified ownership and revoked verification. Browser tests check menu replacement, saving, creator and visitor displays, and circular profiles in Gallery/Editorial at desktop, 390px and 320px widths. Browser fixtures do not confer real account privileges.

Final checks: `npm run build` passed; all 17 API tests passed; both avatar browser tests passed. `npm test` completed its API stage but refused the API already running on port 3001. The browser suite was therefore run against an isolated in-memory API on port 3002, proxying the existing Vite server on 5173. Its first run passed 48 of 52 tests: the creator visitor test needed a full reload after changing its auth fixture (corrected and both avatar tests rerun successfully); the other three failures reproduce the earlier cover-integration run: two feed tests find no seeded cards, and the cover-sticker test times out. These unrelated features were left unchanged. Original reference SHA-256 hashes, RGBA export equality and alpha channels were verified; visual checks covered light and dark themes.

## Journal companion

`public/persona/calm.webp`, `thinking.webp` and `worried.webp` are 320px WebP copies of `a06`, `a05` and `a04` for the floating Ask my journal companion, so it never loads the 0.4 to 0.7 MB originals. Its other moods reuse `stickers/expressions/girl-dreaming.png` and `girl-sighing.png`.
