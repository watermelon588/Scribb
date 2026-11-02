# Scribb backend plan

**Status:** the Express API (accounts, Google sign-in, email, password reset, AI tickets), the migrations and the AI service skeleton are built and tested locally. Nothing is deployed, and the frontend is not connected yet.
**Source brief:** `scribb_architecture_journal_ai_brief.md`
**Facts checked:** 2 November 2026 (see [Sources](#sources))
**Budget:** ₹0 beyond the `scribb.xyz` domain. Every service runs on its free tier.

## Summary

Scribb gets one Node/Express API on Vercel, one Neon Postgres database and Cloudinary for images. A separate Python AI service on Render handles journal questions and voice only.

Express decides who a user is and what they may do. Before any AI use, it issues a 60-second, one-time ticket. The browser shows that ticket to the AI service, so the AI service never decides identity, and Scribb works normally while Render is asleep.

```text
Browser ── scribb.xyz ──> Vite frontend + Express API (one Vercel project)
   │                            │          │
   │                            v          v
   │                          Neon     Cloudinary
   │                            ^
   │  one-time ticket from      │ restricted role, one user's rows only
   │  Express, AI use only      │
   └──────────────────> FastAPI + LangGraph (Render) ──> Gemini free tier
                        text chat, Listen, live voice calls      (text + Gemini Live)
```

## Decided

| Topic | Decision |
|---|---|
| Sign-in | Minimal. Create an account with a username and password, or use Sign in with Google. No email or OTP at sign-up. Adding and verifying an email is optional, in Settings. |
| Profile pictures | Chosen from 12 preset avatars, no uploads. Placeholder art for now. |
| Guests | Read only: Explore, profiles and public books. Liking, saving, following and creating ask the guest to sign in. |
| Voice | Koe-style. A live voice call with your journal, plus typed chat. Every answer exists as text, and Listen plays it in the same Gemini voice. Audio is never stored. |
| Journal privacy | Per journal. Each journal book is public or private. Private journals are never shown to anyone but their owner. |
| Search by meaning | Keywords first. Gemini expands the question into related words, and Postgres full-text search finds entries. Embeddings are added only if testing shows too many misses. |
| Money | None. Free tiers only, no ads or payments, so Vercel Hobby is allowed. |
| Region | Singapore, for users in India. |
| Demo content | Demo data is removed. Two real accounts of yours are the first creators. |

## Where this differs from the brief

| # | Brief | Plan | Why |
|---|---|---|---|
| 1 | Express calls the AI service | **The browser calls Render directly**, using a one-time ticket that Express issues | Live voice needs a long WebSocket, which Vercel functions do not suit. Express still checks sign-in, consent and quota, so the security boundary is unchanged. One path serves text and voice. |
| 2 | Journal entries can be private or public | **Visibility per journal book** | Your decision. It matches a real diary and gives one switch to get right. |
| 3 | Vector retrieval for conceptual questions | **Full-text search with Gemini query expansion, no embeddings yet** | Your decision. Only the passages a question needs go to Google, never a whole journal for indexing. Embeddings come back if the 20-question test misses more than 2. |
| 4 | Upload coordination | **Images go through Express** instead of directly to Cloudinary | Cloudinary has no per-upload size limit. Files are 1 MB or less, under Vercel's 4.5 MB body limit, so Express enforces size and type before storing anything. |
| 5 | Durable LangGraph checkpoints where useful | **No checkpointer in v1** | Checkpoints would copy private journal text into another table. The browser keeps the conversation for the session. |
| 6 | LangGraph orchestrates the AI request | **LangGraph runs typed chat. Live calls use Gemini Live's own turn loop.** Both call the same retrieval tool. | This is how Koe works. Putting speech-to-text, LangGraph and speech output in a chain would add seconds to every spoken turn. |
| 7 | bcrypt or equivalent | **Node's built-in `crypto.scrypt`** | No new dependency, and OWASP ranks it above bcrypt. |

## Gemini free tier: privacy terms

The free tier works for your own use, as in Koe. For other people's private journals, Google's terms say three things:

- **Use of content:** submitted content is used to improve Google's products.
- **Human review:** reviewers may read input and output.
- **Personal data:** the terms ask developers not to send personal information to the free tier.

The plan keeps the free tier and limits what reaches Google:

- AI is **off until each user turns it on**, after a notice in plain words, like Koe's privacy page. Consent is stored and can be withdrawn.
- Each question sends Google only the passages that question needs. Whole journals, bulk indexing and journal images are never sent.
- AI is **unavailable in the EEA, UK and Switzerland**. Google requires the paid tier there. Express reads Vercel's country header.
- The privacy policy says all of this plainly.

This is a known risk you are accepting. Switching to the paid tier later changes one setting, not the design.

## Technical decisions

### Repo and hosting
- Same repo, one Vercel project. `server/` holds the Express app, `api/index.ts` re-exports it, and `/api/*` rewrites to it. `ai/` holds the Python service, deployed by Render from that folder.
- Same origin for the app and API means no CORS, and the auth cookie stays first-party.
- Render accepts browser requests only from `scribb.xyz`, plus `localhost:5173` in development.
- Local development keeps Vite on 5173 and proxies `/api` to Express on 3001.
- Vercel's zero-config docs cover Express-only projects. Vite plus Express in one project needs proving first, which is why it is Task 1.
- Vercel, Neon and Render all run in Singapore.

### Database access
- Node uses `@neondatabase/serverless` over HTTP with tagged, parameterised SQL. No ORM.
- Migrations are numbered `.sql` files in `db/migrations/`, run by a short script. Node and Python share one schema.
- Tests run against a dedicated Neon branch with `node:test` and `pytest`. Existing Playwright tests stay.

### Authentication
Sign-up is one screen: username and password, or the Google button. Nothing is verified at sign-up.

**Username and password**
- Usernames are 3 to 30 characters: lowercase letters, digits, `.` and `_`. They are unique, and a short reserved list blocks names like `admin` and `api`.
- Passwords are 8 to 128 characters, hashed with `crypto.scrypt` (N=2^17, r=8, p=1).
- Sign-in accepts the username, or the email once one is verified.

**Sign in with Google**
- The frontend uses Google Identity Services. It returns an ID token, and Express verifies it with `jose` against Google's public keys, checking audience, issuer and expiry. This is free and needs only an OAuth client ID.
- A new Google user gets a username made from their email, which they can change in Settings. Their email counts as verified.
- If a Google email matches an email a Scribb user has already verified, it signs in to that account. Unverified emails are never linked, so nobody can take over an account by claiming its email.

**Email, optional, in Settings**
- A user adds an email in Settings and gets a verification link.
- Forgot password works only for a verified email. Sign-up says so in one line: "Add an email in Settings if you want to be able to reset your password."
- Without an email, a forgotten password cannot be recovered. That is the trade-off for minimal sign-up.
- Tokens are random, stored only as a SHA-256 hash, and single use. Verification lasts 24 hours and reset lasts 1 hour. Mail is sent with Resend.
- Forgot password always answers the same way, so it does not reveal which emails exist.

**Sessions**
- JWT signed with `jose`, in an `HttpOnly; Secure; SameSite=Lax` cookie named `__Host-scribb`, valid for 30 days.
- Each user has a `token_version`, checked on every protected request. A password reset or change increases it, which signs out every device.

**Abuse**
- Register, login and forgot are rate limited per IP by a Postgres counter. In-memory limits do not work on serverless.
- Write requests must carry a matching `Origin` header.
- Guests get every public `GET`. Every write needs a session.
- Scribb AI needs a verified email. Nothing else does.

### Guest mode in the frontend
- Like, save, follow, New Sketchbook and the phone Create tab stay visible to guests. Using one opens the sign-in dialog, then returns to the same place and completes the action.
- Signed-in drafts autosave on the device, as today, until Save succeeds.

### Images
- Keep the browser pipeline in `src/lib/images.ts`: validate, then re-encode.
- Add a 1 MB target for artwork, using the step-down loop journal images already use. Journal images stay under 200 KB.
- Express re-checks size, signature and dimensions, because the browser is not a trust boundary.
- Each image gets a random Cloudinary ID and a `media` row that tracks owner, size and kind.

| Kind | Cloudinary type | Delivery |
|---|---|---|
| Artwork and covers | `upload` (public, unguessable ID) | Two named transformations, with Strict Transformations on so nobody can burn credits on arbitrary sizes |
| Journal images | `authenticated` | A signed URL, created only for someone allowed to see that journal. Images are already under 200 KB, so no transformations are needed. |

- Journal images stay `authenticated` even in public journals, so making a journal private needs no file changes.
- Cloudinary's signed URLs do not expire, because expiring tokens need a paid plan. A journal image URL someone was shown keeps working if they copy it.
- Deleting an entry, book or account also deletes its Cloudinary files. Saving deletes any file the book or entry no longer references.

### Journals
- Express sanitises journal HTML again with `sanitize-html`, allowing `b i u mark br`, and derives `plain_text` and `word_count`. Limits are shared by importing them from `src/data/journal.ts`.
- `entry_date` stays a calendar date, so "January 12" means the writer's January 12.
- Entry IDs stay client-generated UUIDs, so retries cannot create duplicates.
- A `version` number on books and entries returns `409` instead of overwriting newer work from another device. The local draft is kept.
- `books.visibility` is `private` or `public` for both sketchbooks and journals. New books start private, and publishing is a deliberate step.
- A private journal returns `404` to everyone except its owner, including its entries and image URLs.

### Privacy at the AI boundary
- The AI service uses a Postgres role that can read `journal_entries` and nothing else.
- Row-level security requires `user_id = current_setting('app.user_id')`, set inside each transaction from the ticket. A retrieval bug cannot return another user's rows.
- AI requests have no user field. Identity comes only from the ticket.
- The AI searches all of the signed-in user's own journals, both private and public.
- Logs record IDs, timings and counts, never journal text, questions or audio. LangSmith tracing stays off.
- **For the privacy policy:** journals are encrypted at rest but not end to end. Someone with database access could technically read them.

### AI service
- Packages: `fastapi`, `uvicorn`, `langgraph`, `google-genai`, `psycopg`, `pyjwt`. No LangChain model wrappers, and no `pgvector` yet.
- Models: `gemini-3.5-flash-lite` for text, falling back to other free Flash models, and `gemini-3.8-live` for voice. Koe confirmed the Live model on the free tier on 12 October 2026.
- Port Koe's `gemini.py` fallback chain: when a model is busy (503), try the next one; when quota is used up (429), rest that model and say so. Single short attempts, with SDK retries off.
- All model calls live in one module, so changing provider or tier touches one file.
- The LLM returns a validated filter object. It never writes SQL.

**One retrieval tool, two callers.** `search_journal(date_from, date_to, words)` runs the scope gate and then a bounded query. Typed chat calls it from LangGraph, and live calls receive it as a Gemini Live function declaration.

| Question type | Retrieval |
|---|---|
| Explicit date or range | SQL on `entry_date` |
| Named thing or exact word | Postgres full-text search |
| Theme or feeling | Full-text search over words Gemini adds, such as "stuck" giving "unmotivated, blocked, tired" |
| Any of these with a date | Same search, with the date filter applied |

**Typed chat (LangGraph):**

```text
understand ─> out of scope ──────────────────────────> fixed reply
     │
     └─> search_journal ─> too broad ────────────────> ask to narrow, no LLM answer
              │
              └─> nothing found ─────────────────────> say so, no LLM answer
              │
              └─> build context ─> answer ─> text, streamed ─> Listen (optional)
```

**Live call (Koe's pattern):**
1. The browser records 16 kHz PCM from the microphone through an AudioWorklet.
2. Audio goes over a WebSocket to Render, which relays it to Gemini Live.
3. Gemini's voice detection decides when the user has stopped talking.
4. Gemini calls `search_journal` when it needs entries.
5. Spoken replies stream back as 24 kHz PCM and play without gaps.
6. Talking over the reply interrupts it, and both sides are transcribed live on screen.
7. When the call ends, the transcript can be copied as text. Nothing is stored.

**Listen** sends an answer's text to Gemini Live with Koe's "read this aloud exactly" prompt. The audio streams to the same player and is never saved.

- **Ported from Koe:** `mic.ts`, `mic-worklet.js`, `player.ts`, a trimmed `useCall.ts` and `voice_call.py`, without music, approvals or other tools. Also `speak()` from `app_channel.py`, streaming instead of saving.
- The scope gate runs `count(*)` and `sum(word_count)` before loading any text, so a huge request is refused cheaply.
- Answers name the dates of the entries they used.

### Cold start and tickets
Opening Scribb sends nothing to Render. The AI panel is lazy loaded.

1. The user opens "Ask my journal" and accepts the notice if needed.
2. The panel asks Express for a ticket. Express checks the session, verified email, consent, country and daily quota.
3. Express returns the Render URL and a 60-second, one-time ticket signed with a secret only Express and Render share.
4. The panel polls Render's `/health` every 3 seconds for up to 90 seconds, showing "Starting Scribb AI...". A failed or non-JSON response counts as still starting, because Render can return a loading page.
5. Typed questions use `POST /ask`, which streams text back. A call opens `WS /call` and sends the ticket in its first frame, never in the URL, as Koe does.
6. On timeout or failure, only the panel shows a retry. The rest of Scribb keeps working.

Render remembers used ticket IDs in memory. A restart clears that memory, but every ticket has expired by then.

## Limits

Gemini's free quota is per Google project and shared by every Scribb user. These caps keep one person from using it all. They are environment variables, so they can be set from AI Studio's rate-limit page.

| Limit | Value | Enforced by |
|---|---|---|
| JSON body | 256 KB | Express |
| Artwork and cover | 1 MB, JPG/PNG/WebP | Browser and Express |
| Journal image | Under 200 KB, 40 per journal | Browser and Express |
| Artworks per book | 40 | Express |
| Entries per journal | 200, then start a new volume (default) | Express |
| Page size | 24 for feeds, 50 for entries, keyset cursors only | SQL |
| Media per user | 300 MB (default) | Express |
| Typed questions and Listen | 20 per user per day (default) | Express, at ticket time |
| Live calls | 3 per user per day, 10 minutes each (default) | Express and Render |
| All AI use | Global daily cap (default 300) | Express |
| Question length | 500 characters | Express and Render |
| Listen text | 2,000 characters | Render |
| Conversation history | Last 6 turns | Render |
| Entries in one summary | 31 | Scope gate |
| Words sent to Gemini per answer | 8,000 | Scope gate |
| Passages per search | 8 | SQL |
| Model output | 600 tokens | Model call |
| Typed answer time | 30 seconds after wake | Render |

A global `AI_ENABLED` variable switches AI off instantly without a deploy.

## Data model

`id` is a UUID unless noted. Every table has `created_at`.

| Table | Key columns |
|---|---|
| `users` | `password_hash` (null for Google-only accounts), `google_sub` (unique, nullable), `email` (citext, nullable), `email_verified_at`, `token_version`, `ai_consent_at`. A verified email is unique. |
| `profiles` | `user_id` (PK), `handle` (the username, citext unique), `display_name`, `bio`, `city`, `avatar` (preset ID), `links` jsonb |
| `email_tokens` | `user_id`, `purpose`, `token_hash`, `expires_at`, `used_at` |
| `rate_limits` | `key`, `window_start`, `count` (composite PK). Also counts AI use per user per day. |
| `media` | `user_id`, `public_id`, `kind`, `delivery`, `bytes`, `width`, `height` |
| `books` | `user_id`, `kind`, `title`, `visibility`, `category`, `design` jsonb, `pages` jsonb, `like_count`, `save_count`, `version`, `published_at`, `updated_at` |
| `journal_entries` | `book_id`, `user_id`, `entry_date`, `layout`, `texts` jsonb, `images` jsonb, `plain_text`, `word_count`, `search` tsvector (generated), `version`, `updated_at` |
| `likes`, `saves` | `user_id`, `book_id` (composite PK) |
| `follows` | `follower_id`, `followee_id` (composite PK, cannot follow yourself) |
| `notifications` | `user_id`, `actor_id`, `type`, `book_id`, `read_at` |

Main indexes:
- `journal_entries (user_id, entry_date desc, id)`
- `journal_entries (book_id, entry_date, id)`
- GIN on `journal_entries.search`
- `books (published_at desc, id)` where public
- `books (user_id, updated_at desc)`
- `notifications (user_id, created_at desc)`

Notes:
- `books.pages` holds the artwork list as JSON, because the app reads and saves a book whole and it is capped at 40 items. It can move to its own table with one migration if artwork-level features arrive.
- Likes and saves attach to books, as the current feed does.
- `pages`, `design` and `texts` reject `data:` URLs. Image bytes never reach Postgres.
- Counters change in the same statement as the like or save, so they cannot drift.
- With no embeddings, Neon's free 1 GB holds several hundred thousand entries (estimate).

## API

Express routes are under `/api`. Errors return `{ error: { code, message } }`. Guests can call every public `GET`.

| Area | Routes |
|---|---|
| Auth | `POST auth/register`, `auth/login`, `auth/google`, `auth/logout`, `auth/forgot`, `auth/reset`, `auth/verify-email`; `GET auth/me` |
| Account | `PATCH me/profile` (name, bio, avatar preset, links, username), `PUT me/email`, `PUT me/password`, `DELETE me`, `GET me/saved` |
| People | `GET users/:handle`, `GET users/:handle/books`, `PUT` and `DELETE users/:handle/follow` |
| Books | `GET books/:id`, `PUT books/:id`, `DELETE books/:id`, `PUT` and `DELETE books/:id/like`, `PUT` and `DELETE books/:id/save` |
| Feed | `GET feed?tab=explore\|following&category=&cursor=` |
| Journal | `GET books/:id/entries?from=&to=&cursor=`, `PUT entries/:id`, `DELETE entries/:id` |
| Media | `POST media?kind=artwork\|cover\|journal` |
| Notifications | `GET notifications`, `POST notifications/read` |
| AI | `POST ai/consent`, `DELETE ai/consent`, `POST ai/ticket?mode=ask\|listen\|call` |

Render exposes `GET /health`, `POST /ask`, `POST /speak` and `WS /call`. Everything except `/health` needs a ticket.

## Build order

Each task is a vertical slice. After any task that changes rendering, gestures, controls or persistence, run `npm run build` and `npm test`, as `AGENTS.md` requires.

### Phase 0: Setup

**Task 0: Repo and accounts**
- Commit the current frontend and push it to a private GitHub repo. There is no remote today, and Vercel and Render deploy from one.
- Create free Neon, Vercel, Render, Cloudinary, Resend and Google AI Studio accounts, and a Google Cloud OAuth client ID for Sign in with Google.
- Done when: the repo is on GitHub and `.env.example` lists every secret. No secrets are in the repo.

### Phase 1: Foundation

**Task 1: Prove the deployment** (S)
- Add Express beside Vite, with `GET /api/health` running one Neon query.
- Done when: a Vercel preview serves the frontend and `/api/health`, and the frontend works unchanged.

**Task 2: Username and password accounts** (M)
- Add the migration runner, `users`, `profiles`, the session cookie, password change and rate limits.
- Done when: cookie flags are correct, a bad password fails, a taken or reserved username is refused, repeated logins get `429`, and a changed `token_version` rejects the old cookie.

**Task 3: Google sign-in, email and password reset** (M)
- Add `auth/google`, optional email with verification, `email_tokens`, Resend, forgot and reset.
- Done when: a forged or wrong-audience Google token is refused, a Google email links only to a verified matching email, reset tokens work once and expire, reset signs out other devices, and forgot answers identically for unknown emails.

**Task 4: Accounts and guest mode in the frontend** (M)
- Add `src/lib/api.ts`, the one-screen sign-up and sign-in with the Google button, Settings (email, password, username, avatar), the forgot and reset screens, and the sign-in prompt on every guest action.
- Add the 12-avatar picker with placeholder art in `public/avatars/`.
- Update `AGENTS.md`, which still lists authentication and cloud sync as out of scope.
- Done when: Playwright shows a guest can browse but every interaction asks for sign-in and completes afterwards, at desktop, 320px and 390px.

**Checkpoint:** a real person can create and verify an account on a preview URL. Review before continuing.

### Phase 2: Profiles and sketchbooks

**Task 5: Profiles** (S)
- Done when: a public profile loads signed out, and a user can edit only their own.

**Task 6: Image upload** (M)
- Add the 1 MB artwork path, `POST /api/media` and Cloudinary upload.
- Done when: a renamed non-image, an oversized file and an over-quota upload are all rejected and nothing is stored.

**Task 7: Sketchbooks on the server** (M)
- Add the `books` routes with visibility, and move `Profile.tsx` from IndexedDB to the API.
- Done when: a published book renders the same on a second browser, a private one returns `404` to others, an old `version` returns `409`, and the draft survives.

**Checkpoint:** a sketchbook made on one device opens intact on another, with spreads, crop placement and captions. Your two accounts can start uploading real work.

### Phase 3: Journals

**Task 8: Entries API** (M)
- Add `journal_entries`, sanitising, word limits, keyset pagination, date filters and full-text search.
- Done when: `<script>` is stripped, limits are enforced server-side, and date-range and word queries use their indexes.

**Task 9: Journal privacy** (S)
- Add journal visibility and signed journal images.
- Done when: a guest and a second account get `404` for a private journal, its entries and its images.

**Task 10: Journals in the frontend** (M)
- Move journal saving to the API, keeping on-device autosave until Save succeeds.
- Done when: a failed save shows an error and keeps the entry, and all 10 layouts and Writing still match between editor and book.

**Checkpoint:** run the cross-user privacy suite. Journals work with no AI service deployed at all.

### Phase 4: Social

**Task 11: Explore, likes and saves** (M)
- Remove the demo data in `Feed.tsx` and `src/data/feed.ts`.
- Done when: a repeated like is ignored, counts stay correct, cursors do not skip or repeat, and an empty Explore shows a designed empty state.

**Task 12: Follows and notifications** (M)
- Done when: the following tab shows only followed artists, and likes and follows create one notification each.

**Checkpoint:** the whole product works with AI absent. Phases 4 and 5 do not depend on each other, so they can swap.

### Phase 5: Journal AI

**Task 13: AI service skeleton** (M)
- Deploy FastAPI to Render with `/health`, ticket checks, the CORS allow list, the restricted role and row-level security.
- Measure memory, because the free instance has 512 MB and 0.1 CPU.
- Done when: a ticket for user A cannot read user B's rows even with deliberately broken query code, a reused or expired ticket is refused, and memory stays under 400 MB.

**Task 14: Tickets in Express** (S)
- Add verified-email, consent, country and quota checks.
- Done when: a user without consent, a user in an EEA country and the 21st question of the day are each refused before Render is contacted.

**Task 15: Date questions** (M)
- Add `search_journal`, the scope gate and the LangGraph flow with streamed text, ported from Koe's fallback chain.
- Done when: "What did I write on January 12, 2027?" returns that entry, an empty date says nothing was found, and "Summarize 2024" is refused without loading text.

**Task 16: Topic questions** (M)
- Add query expansion over full-text search, and 20 test questions over a synthetic journal. No real writing goes in fixtures.
- Done when: the right entry is found for at least 18 of 20. If not, add embeddings as a separate task and re-plan.

**Task 17: Ask my journal panel** (M)
- Add the notice, cold-start states, streaming text, entry dates and retry.
- Done when: Playwright confirms normal routes make no requests to Render or `/api/ai`, and the rest of Scribb stays usable while AI starts.

**Task 18: Listen** (S)
- Add `POST /speak` with Gemini Live reading the answer, streamed to Koe's player.
- Done when: playback starts within a few seconds, can be stopped, and nothing is written to disk or the database.

**Task 19: Live voice call** (M)
- Add `WS /call` and the call UI, ported from Koe, with `search_journal` as the only tool.
- Done when, on a real phone and on desktop: the call answers spoken date and topic questions, interruptions work, the transcript can be copied, and calls end at the 10-minute cap.

**Checkpoint:** run the brief's section 20 failure cases (Render down, Gemini quota used up, no results, too broad, another user's journal), in both chat and calls.

### Phase 6: Launch

**Task 20: Production launch and backups** (M)
- Point `scribb.xyz` at Vercel, verify the mail domain and turn on security headers.
- Publish privacy and terms pages that include the Gemini free-tier terms, and add account deletion.
- Add a weekly GitHub Actions workflow that encrypts a `pg_dump` with `age` and keeps it as an artifact for 90 days. This costs ₹0 within the free Actions allowance.
- Done when: a fresh account completes the full journey on `scribb.xyz` on desktop and phone, deleting an account removes its rows and files, and a backup restores into a scratch Neon branch.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini free tier: Google may use content and humans may read it | High | Your accepted decision. Opt-in consent, minimum passages, never images or bulk text, no AI in the EEA, UK or Switzerland, and plain privacy wording. |
| One person makes many accounts to drain the shared AI quota | Low | AI needs a verified email and each account has a daily allowance, plus per-IP sign-up limits and the global daily cap. |
| A user without an email forgets their password | Low | Sign-up and Settings say plainly that an email is needed for resets. |
| Free Gemini quota shared by all users runs out | Medium | Per-user and global caps, Koe's model fallback, and a clear "AI is resting, try later" message. |
| Google changes or removes free models, especially Live | Medium | Model names are environment variables. Text chat survives without voice. |
| Vite and Express do not combine cleanly on Vercel | Medium | Task 1 proves it first. The fallback is a second free Vercel project on `api.scribb.xyz`. |
| Render's 512 MB and 0.1 CPU are not enough for audio relay plus LangGraph | Medium | Koe already relays calls on Render free. Task 13 measures memory before features. |
| Neon free history is only 6 hours | High | The weekly encrypted backup from Task 20. Deleted data stays in backups up to 90 days, so say so in the privacy policy. |
| Keyword search misses entries phrased differently | Medium | The 20-question test in Task 16 decides whether embeddings are needed. |
| Cloudinary's 25 monthly credits cover storage, bandwidth and transformations together | Medium | Size limits, per-user quotas and Strict Transformations. Watch usage from launch. |
| Vercel free limits: 4 hours of active CPU and 10 GB origin transfer a month | Low | Password hashing and uploads use the most. If uploads dominate, move to signed direct uploads. |
| Neon free limits: 100 CU-hours and 5 GB egress a month | Low | Scale to zero stays on, with bounded queries. Exceeding either suspends the database until next month, so set alerts. |
| Resend free limit of 100 emails a day | Low | Fine for launch, but a signup spike could delay verification. |

## Skipped for now

| Skipped | Add when |
|---|---|
| Embeddings and `pgvector` | The 20-question test misses more than 2 |
| Gemini paid tier | Money becomes available, or other people's private journals need stronger terms |
| LangGraph checkpointer | Users need conversations across sessions or devices |
| Importing books saved in a browser before sign-in existed | Someone other than you has local books worth keeping |
| Redis, queues, background workers | A measured need appears |
| Direct-to-Cloudinary uploads | Uploads strain Vercel's transfer allowance |
| Artwork table and per-artwork likes | The product adds artwork-level features |
| Hiding single entries inside a public journal | Users ask for it |
| Comments, recommendations, search across users | Not in v1 |
| Uploaded profile pictures | The preset avatars are not enough |
| Bring your own Gemini key | Users want more than the daily allowance |
| Data export | Before opening beyond early users, or if required by law |

## Defaults to confirm while building

None of these block work. Change any number at any time.

- 200 entries per journal before starting a new volume.
- 20 typed questions or Listens, and 3 calls of up to 10 minutes, per user per day.
- New books start private until published.

## Assumptions

- Journal and sketchbook UI work in `journaling-plan.md` continues. Entry fields added by later parts stay inside `texts` and `images`.
- "Should journals ever be public?" in `journaling-plan.md` is now answered: yes, per journal.
- The AI searches only the signed-in user's own journals, both public and private.
- The word limits already in the frontend apply on the server too.
- Koe's voice code can be copied into Scribb. Both are your projects.

## Sources

- [Gemini API terms](https://ai.google.dev/gemini-api/terms), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- Koe: `backend/koe/voice_call.py`, `backend/koe/gemini.py`, `backend/koe/app_channel.py`, `frontend/src/call/`, `docs/DECISIONS.md`
- [Neon pricing](https://neon.com/pricing), [serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Render free services](https://render.com/docs/free), [compute plans](https://render.com/docs/compute-plans)
- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [function limits](https://vercel.com/docs/functions/limitations), [fair use](https://vercel.com/docs/limits/fair-use-guidelines)
- [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media), [plans and credits](https://cloudinary.com/documentation/billing_and_plans), [upload presets](https://cloudinary.com/documentation/upload_presets)
- [Resend pricing](https://resend.com/pricing)
- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

Not confirmed from primary sources: Cloudinary's exact credit conversion, and free-tier Gemini rate limits, which Google shows only in AI Studio. Grok is not used.
