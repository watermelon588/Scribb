<div align="center">

<img src="public/brand/scribb-mark.png" alt="Scribb companion" width="96" height="96" />

# Scribb

**A little space for what's on your mind.**

Free digital sketchbooks and journals with real page turns, covers and bindings.
Keep them private, or publish them to your profile at `scribb.xyz/@you`.

[Live site](https://scribb.xyz) · [Explore](https://scribb.xyz/explore) · [About](https://scribb.xyz/about/)

![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Postgres](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-AI%20service-009688?logo=fastapi&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white)

<img src="docs/readme/explore-light.jpg" alt="Explore: public sketchbooks and journals from every artist" width="900" />

</div>

---

## Contents

1. [Tour](#tour)
2. [Features](#features)
3. [Assets](#assets)
4. [Project structure](#project-structure)
5. [Run it locally](#run-it-locally)
6. [Tests](#tests)
7. [Deploy](#deploy)
8. [Feedback](#feedback)

---

## Tour

| Welcome | Welcome (dark) |
| --- | --- |
| <img src="docs/readme/welcome-light.jpg" alt="Welcome page in light mode" /> | <img src="docs/readme/welcome-dark.jpg" alt="Welcome page in dark mode" /> |

| Turn the pages | An artist's profile |
| --- | --- |
| <img src="docs/readme/book-preview.jpg" alt="A sketchbook open in the preview, showing a two-page spread" /> | <img src="docs/readme/profile.jpg" alt="Mira's profile with her sketchbooks" /> |

| Sketchbook studio | Journal studio |
| --- | --- |
| <img src="docs/readme/studio-sketchbook.jpg" alt="Sketchbook studio with cover, binding and visibility controls" /> | <img src="docs/readme/studio-journal.jpg" alt="Journal studio" /> |

| Explore (dark) | Feedback |
| --- | --- |
| <img src="docs/readme/explore-dark.jpg" alt="Explore in dark mode" /> | <img src="docs/readme/feedback.jpg" alt="Feedback dialog with a five-star rating and a note" /> |

<p align="center">
  <img src="docs/readme/mobile-explore.jpg" alt="Explore on a phone" width="260" />
  &nbsp;&nbsp;
  <img src="docs/readme/mobile-profile.jpg" alt="A profile on a phone" width="260" />
</p>

---

## Features

**Sketchbooks**
- Up to 40 artworks per book, on single pages or full two-page spreads across the fold
- Three bindings: **Linen**, **Spiral** (real wire loops) and **Watercolor** (ribbed elastic that recoils, releases and opens the cover)
- Cover art presets or your own image, solid colors, a 48-character cover caption, papers and page-turn styles
- Direct crop and placement for every artwork, with keyboard and slider alternatives

**Journals**
- Dated entries with 18 page layouts in four groups (Minimal, Long, Layered, Spread)
- One font, size and ink per journal, ruled lines drawn from font metrics
- Pictures, stickers, hand-drawn scribbles (rough.js) and voice typing
- **Ask my journal**: a companion that answers questions about your own entries

**Social**
- Profiles at `/@username`, every public book at `/@username/<book id>`
- Explore feed with likes, saves, follows and notifications
- Books are private until you publish them

**Built for search and AI search**
- Server-rendered profile, book and Explore pages with JSON-LD, Open Graph and a live sitemap
- `robots.txt` lets search and AI-search crawlers in and keeps AI-training crawlers out
- `llms.txt`, an About page with a FAQ, and IndexNow pings when a book is published

**Everything else**
- Accounts with username and password or Google, email verification and password reset
- Persistent light and dark themes, Gallery and Editorial styles, Gallery and Bookshelf views
- In-app feedback with a 1–5 rating, mailed straight to the founder
- Reduced motion respected everywhere

---

## Assets

All artwork ships in `public/` as prepared, flat images.

### Profile pictures
12 preset avatars, chosen in Edit profile (`public/avatars/a01`–`a12`).

<img src="docs/readme/avatars.jpg" alt="The twelve preset profile pictures" width="760" />

### The companion
Scribb's mark and the Ask my journal companion's moods (`public/brand/`, `public/persona/`).

<img src="docs/readme/companion.jpg" alt="The companion: calm, thinking and worried, plus the Scribb mark" width="560" />

### Cover art
42 flat cover images for sketchbooks and journals (`public/covers/sketchbook/`, `public/covers/journal/`), plus your own uploads.

<img src="docs/readme/covers.jpg" alt="A selection of sketchbook and journal cover art" width="760" />

| Sketchbook covers | Journal covers |
| --- | --- |
| <img src="docs/cover-previews/sketchbook.jpg" alt="Sketchbook cover collection" /> | <img src="docs/cover-previews/journal.jpg" alt="Journal cover collection" /> |

### Stickers
204 stickers in 13 vibes (`public/stickers/<vibe>/`), placed on journal covers and pages.

<img src="docs/stickers/preview.jpg" alt="A sample of Scribb stickers" width="560" />

<details>
<summary>Every sticker sheet</summary>

| | | |
| --- | --- | --- |
| <img src="docs/stickers/anime.jpg" alt="Anime stickers" /> | <img src="docs/stickers/cutesy.jpg" alt="Cutesy stickers" /> | <img src="docs/stickers/expressions.jpg" alt="Expression stickers" /> |
| <img src="docs/stickers/nature.jpg" alt="Nature stickers" /> | <img src="docs/stickers/music.jpg" alt="Music stickers" /> | <img src="docs/stickers/japanese.jpg" alt="Japanese stickers" /> |
| <img src="docs/stickers/gratitude.jpg" alt="Gratitude stickers" /> | <img src="docs/stickers/vintage.jpg" alt="Vintage stickers" /> | <img src="docs/stickers/travel.jpg" alt="Travel stickers" /> |

</details>

Sample artworks in `public/artworks/` are public-domain paintings from The Met Open Access (`credits.json`).

---

## Project structure

```text
.
├── index.html            App shell: meta tags, JSON-LD, prerendered homepage text
├── vercel.json           One Vercel project, three services (app, api, scribb-ai)
├── src/                  React app
│   ├── Profile.tsx       Root: routing, profile, studio, dialogs
│   ├── components/       Sketchbook (book renderer), Journal, Feed, Account, Feedback…
│   ├── data/             Presets, journal layouts, covers, stickers
│   ├── lib/              API client, image ingest, rich text, voice
│   └── *.css             Theme tokens (theme.css) and UI system (system.css)
├── server/               Express API (Vercel service "api")
│   ├── app.ts            Routes: auth, people, books, media, AI tickets, feedback
│   ├── seo.ts            Crawlable /@name, /@name/<id>, /explore and /sitemap.xml
│   ├── feedback.ts       In-app feedback, mailed to the founder
│   └── *.test.ts         API tests on an in-memory Postgres (PGlite)
├── ai/                   FastAPI service for Ask my journal (Vercel service "scribb-ai")
├── db/migrations/        SQL migrations
├── public/
│   ├── avatars/          Preset profile pictures
│   ├── brand/            Logo, favicons, share card
│   ├── covers/           Cover art (sketchbook/, journal/)
│   ├── stickers/         Stickers by vibe + manifest.json
│   ├── persona/          Companion moods
│   ├── artworks/         Public-domain sample art
│   ├── about/            About and FAQ page
│   └── robots.txt, llms.txt, 404.html
├── tests/                Playwright browser tests
├── scripts/              Asset preparation and the page-flip patch
└── docs/                 Design notes, asset docs, README images
```

---

## Run it locally

Requires Node.js 22 and npm.

```bash
npm install
```

```bash
npm run dev:api
```

```bash
npm run dev
```

Open http://localhost:5173. Without a `.env`, the API uses a local Postgres in `.data/pglite`, keeps uploads in `.data/uploads` and prints emails to the console, so nothing external is needed.

To use real services, copy `.env.example` to `.env` and fill in what you need:

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `SESSION_SECRET` | Signs the session cookie (32+ random bytes) |
| `APP_ORIGIN` | Public origin, used for canonical URLs and email links |
| `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` | Sign in with Google |
| `RESEND_API_KEY`, `MAIL_FROM` | Account emails and feedback mail |
| `FEEDBACK_TO` | Where feedback goes (defaults to the founder) |
| `CLOUDINARY_*` | Image hosting |
| `AI_TICKET_SECRET`, `AI_URL`, `GEMINI_API_KEY` | Ask my journal |

Run migrations against a real database with `npm run migrate`.

---

## Tests

```bash
npm run build
```

```bash
npm test
```

`npm test` runs the API tests (Node test runner on in-memory Postgres) and then Playwright, which starts its own app and API on ports 5174 and 3101 with `LOCAL_ONLY`, so it never touches real services.

---

## Deploy

One Vercel project with three services (`vercel.json`):

| Service | Serves | Source |
| --- | --- | --- |
| `app` | `/` | Vite build |
| `api` | `/api/*`, `/@*`, `/explore`, `/sitemap.xml` | `server/app.ts` |
| `scribb-ai` | `/ai/*` | `ai/` (FastAPI) |

The production branch is `main`. Set the variables above in Vercel, with `APP_ORIGIN=https://scribb.xyz`.

---

## Feedback

Use **Feedback** in the footer of the app: pick a rating, write what could be better, and it lands in the founder's inbox.
