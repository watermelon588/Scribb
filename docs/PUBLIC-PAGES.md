# Welcome, information and journal questions

Recorded 2 November 2026. These routes extend the existing application. The olive
light/dark palette, Gallery/Editorial styles, navigation, controls and typefaces
remain the design authority. This document records the new surfaces rather than
replacing the incumbent product or design documents.

## Routes and composition

| Route | Surface | Decision |
| --- | --- | --- |
| `/`, `/#portfolio` for guests | Welcome | Center the supplied illustration above a modest account prompt and one account-creation button. Signed-in visitors keep their artist profile. |
| `/#privacy` | Privacy | A readable, left-aligned document with dated sections and links to provider policies. |
| `/#terms` | Terms | The same reading layout, hierarchy and return link as Privacy. |
| `/#ask` | Ask my journal | A centered introduction followed by consent or a linear journal conversation and composer. |

The footer offers Install app and links to Ask my journal, Privacy and Terms. Account creation also links
to the information pages. These routes share the existing appearance and style
preferences; they do not create another studio, profile style or palette.

## Visual inheritance

`src/pages.css` uses the tokens in `src/theme.css`. Body text and controls inherit
Manrope; Editorial substitutes Newsreader for the welcome heading, reading
headings, consent heading and conversation questions. Light weights, generous
spacing, thin separators and existing solid/outline/text buttons continue the
incumbent interface.

Secondary text on these surfaces uses `--page-muted`, a mix of 90% existing
`--app-muted` and 10% existing `--app-ink`. This local contrast adjustment does not
change the global palette. Links use the existing accent and underlines. The
composer uses the existing background, ink, border and button tokens.

The welcome film is at most 520px wide. Reading pages are at most 860px wide and
Ask is at most 760px; legal copy is capped at 72 characters per line. On phones,
content becomes one column with 24px reading gutters, the existing safe-area
navigation and natural vertical scrolling. The composer keeps 16px input text.
Longer consent text and links wrap instead of forcing horizontal scrolling.

## Media and content provenance

The welcome illustration comes from the supplied GIF preserved in the repository
root. `public/media/welcome-light.mp4` and `welcome-dark.mp4` are silent H.264
conversions; matching WebP files are posters. Each version matches its appearance
background. `Welcome.tsx` uses multiply blending in light appearance and lighten
blending in dark appearance. The illustration's colors are not application
palette tokens. These conversions do not establish ownership or a new identity.

The video loops silently with inline playback and a named play/pause control.
Reduced-motion preference pauses it by default; an explicit Play remains
available. Preference listeners are removed when the component unmounts.

Privacy and Terms are maintained in `src/components/Legal.tsx`; the consent
summary is in `src/components/AskJournal.tsx`. Keep their descriptions consistent
with the implemented service: private books are access-controlled, media deletion
has a current limitation, and Gemini's free tier has provider data-use conditions.
The README records a check of [Gemini API terms](https://ai.google.dev/gemini-api/terms)
on 2 November 2026. That dated record is not a promise that provider terms remain
unchanged. Review provider, operator and retention details when deployment or
processing changes, and update the visible legal-page date with content changes.

## Ask states and maintenance

Guests see a sign-in prompt. Signed-in users need verified email and explicit AI
consent, including the adult acknowledgement, before the composer appears. Reading
the page or consent notice does not wake the AI service. Only submission starts
the wake-up and answer flow. Consent withdrawal stops future requests and clears
the local conversation.

The conversation remains in component memory. Answers render as plain React text;
they do not become journal HTML or saved journal entries. The UI exposes wake-up,
answering, completion, failure, retry and stop states, with journal source dates
after completed answers. Keep these states and the provider disclosure visible
when changing the layout or streaming client.

`tests/pages.spec.ts` covers welcome playback and reduced motion, legal navigation,
appearance persistence, 320px/390px widths, consent/email gates, mocked streaming,
retry, withdrawal and cancellation. Its AI answers are fixtures, not evidence of
live provider quality. `ai/tests/test_streaming.py` covers the streaming boundary
without external model calls. Review captures under `.impeccable/review/` show
desktop and phone compositions; refresh them after visual changes. Run checks in
the project's isolated local-only test environment, following `AGENTS.md`.

The older `docs/PRODUCT.md` and `docs/DESIGN.md` contain prototype-era statements
about frontend-only storage, removed studies/styles and earlier feed layouts.
They were preserved for this ordinary extension. Use the current project contract
and implementation for those later milestones until a separately authorized
documentation reconciliation.


## Private AI routing and installation (3 November 2026)

The browser uses only `/api/ai/status`, `/api/ai/health` and `/api/ai/ask`.
The API service calls internal FastAPI with the runtime `AI_URL` binding and a
server-only ticket. This replaces direct-browser AI URLs and tickets.
The shared footer offers Install app with a browser prompt or platform
instructions. Manifest installation needs HTTPS in production. It adds no
private caches and does not promise offline accounts or cloud access.
