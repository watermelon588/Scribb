# Deploy Scribb with the Vercel dashboard

Prepared 3 November 2026. Repository: https://github.com/watermelon588/Scribb.
Use branch **codex/hosting-ready**, root directory **.**. This isolated branch
excludes the other chat's unfinished creator badge/avatar changes.

The owner confirmed the service names, public paths, private binding and Singapore
region on 3 November 2026. No hosted deployment, production
migration or live Gemini request was performed as part of preparation.

## 1. Import the repository

1. Open https://vercel.com/new and sign in with GitHub.
2. Import **watermelon588/Scribb**. If missing, allow Vercel access to that repository.
3. Choose your project name, for example **scribb**. Root Directory: **.**.
4. Select branch **codex/hosting-ready**. If the import screen does not offer a
   branch choice, select it in Settings > Git > Production Branch before using
   the production deployment.
5. Leave build/install/output overrides unset: `vercel.json` sets them separately
   for each service. Node.js version: **22.x**.
6. Add the existing environment values in the next section. Your computer's
   `.env` is not uploaded by GitHub. Import its values using Vercel's environment
   variable editor, or paste each value into its matching field. Never upload
   the file to the repository.
7. Deploy. A missing or unsafe setting fails the API build with its variable
   name; values are not printed. After changing values, use Deployments >
   Redeploy. Environment changes do not alter an already-built deployment.

All three services share this Vercel project and domain. There is no Render
project to create for this configuration. Existing Neon, Cloudinary and Resend
resources stay in use.

## 2. Environment variables

Copy your existing populated values unless a value below is explicit. Apply to
**Production**. Configure Preview separately with test resources if you use it.
Do not enable `LOCAL_ONLY` or turn rate limiting off on hosted deployments.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Existing application Postgres connection string. |
| `SESSION_SECRET` | Existing random session secret, at least 32 characters. |
| `APP_ORIGIN` | Exact public site origin, e.g. `https://scribb.vercel.app`; no path or trailing slash. Use the actual assigned domain. |
| `CLOUDINARY_CLOUD_NAME` | Existing Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Existing Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Existing Cloudinary secret. |
| `GOOGLE_CLIENT_ID` | Existing Google OAuth web client ID, if Google sign-in is enabled. |
| `VITE_GOOGLE_CLIENT_ID` | Exactly the same client ID; the only public provider identifier. |
| `GOOGLE_CLIENT_SECRET` | Not used by the current Google ID-token sign-in flow; no need to add it. |
| `RESEND_API_KEY` | Existing Resend API key for verification/password reset. |
| `MAIL_FROM` | Existing sender on your verified Resend domain. |
| `AI_ENABLED` | `true` when the existing AI database role and provider values below are ready; otherwise `false` while launching core accounts/books. |
| `AI_TICKET_SECRET` | Existing AI shared secret, at least 32 characters and different from `SESSION_SECRET`. Both server services read it. |
| `AI_DATABASE_URL` | Existing TLS Postgres connection string for the restricted **scribb_ai** role, not the database owner. |
| `GEMINI_API_KEY` | Existing Google AI Studio key. |
| `GEMINI_TEXT_MODEL` | Existing configured model ID. |
| `GEMINI_FALLBACK_MODELS` | Existing optional comma-separated fallback model IDs, or omit. |
| `MEDIA_QUOTA_MB` | Optional; default `300`. |
| `AI_DAILY_QUOTA` | Optional; default `20`. |
| `AI_GLOBAL_DAILY` | Optional; default `300`. |

**Do not create `AI_URL` in Vercel.** The binding injects the private Python URL
into the API function at runtime. It is not available during builds and is never
sent to the frontend. Remove a manually configured old Render/localhost `AI_URL`.
`ALLOWED_ORIGINS` is no longer used: Python is internal and the browser calls the
same-origin API. Do not create a `VITE_` variable for any secret or database URL.

Set `APP_ORIGIN` to the domain shown by Vercel. If you later add `scribb.xyz` in
Settings > Domains, update `APP_ORIGIN`, Google authorized JavaScript origins and
redeploy. Use one canonical domain so sign-in cookies work consistently. Choose your final
domain before sharing the install link; installed apps belong to that origin.

## 3. Existing provider settings

- In Google Cloud > APIs & Services > Credentials, open the existing OAuth web
  client and add the exact production HTTPS origin to Authorized JavaScript
  origins. The app verifies Google ID tokens server-side; it has no OAuth
  redirect callback to configure.
- Keep the existing Neon schema and restricted AI role. This setup does not run
  migrations automatically or reset data. New database setup is outside this
  already-configured deployment; the role definition remains in
  `db/migrations/002_journals.sql`.
- Keep your verified Resend sender and Cloudinary keys. Uploads are stored in
  Cloudinary, not on ephemeral Vercel disk.

## 4. Public routes and private communication

| Service | Framework / root | Public traffic | Calls |
| --- | --- | --- | --- |
| `app` | Vite / `.` | Catch-all `/(.*)` after API rule | Browser uses `/api/*` on the same domain. No runtime binding in static frontend builds. |
| `api` | Express / `.`; entry `server/app.ts` | `/api/:path*`; Express already mounts `/api` | Private `scribb-ai` through bound `AI_URL`. |
| `scribb-ai` | FastAPI / `ai`; entry `scribb_ai.main:app` | None | Gemini and restricted Neon reads. |

API root stays `.` because server modules share validation and journal types with
`src/`. Each service builds independently. The old root `api/index.ts` adapter
was removed so Vite does not also publish duplicate API functions.

Browser flow: consent and verified account -> `/api/ai/status` ->
`/api/ai/health` -> `/api/ai/ask`. Express enforces consent, region and quota,
signs a fresh 60-second subject-scoped ticket and streams the private AI answer
back with cancellation/backpressure. The browser gets neither ticket nor
internal service URL. Python still verifies tickets, even on the private route.
Binding URLs are read at request time and preserve any injected path prefix.
There is no public `/ask` or `/health` Python route; those paths fall through to
the website. `/api/health` is the application health endpoint.

For developers: `npm run dev:services` invokes `vercel dev --local --listen 5173`
and injects bindings without requiring Vercel login. The ordinary isolated
browser test runner remains on Vite plus a `LOCAL_ONLY` API, never Neon. On
Windows, put a space-free/short-name path to `uv.exe` on PATH if the CLI cannot
launch uv from a user directory containing spaces.

## 5. Installable phone and desktop app

No separate distribution service is needed. Once the site is live on HTTPS:

1. Open the site and use **Install app** in the footer.
2. Chrome/Edge/Android offer the browser install prompt when eligible. Otherwise
   the button explains the browser-menu option.
3. On iPhone/iPad, open in Safari, choose Share > Add to Home Screen, keep Open
   as Web App enabled if shown, and Add.
4. On supported Mac Safari, use File > Add to Dock.

The manifest and 192/512px, maskable and Apple touch icons are included. Installed
mode hides the install button. Updates are served from the website; there is no
APK to maintain. This release is online-first and adds no service worker or
private-response cache. Internet is needed for sign-in, saving/loading cloud
books and AI. Local drafts stay in the browser/app storage where created and
may not transfer between browser and installed mode. Save to your account before
switching. Installation itself is controlled by each device/browser.

## 6. Check the deployed site

Using the graphical website, create an account, sign out/in, upload a picture,
save a private book, reload and reopen it. Confirm Explore shows only published
books. Visit Privacy/Terms in both themes and try the Install app button on a
phone and desktop. On an AI-ready verified account, enable AI consent, ask a
question, stop/retry and turn consent off. Nothing should call the AI on load.

Check Vercel's Functions/logs if a request fails, without logging journal text or
secrets. API and AI functions are limited to 60 seconds; the provider answer has
a 30-second budget, proxy 40 seconds. Set provider quotas/billing to your intended
limits. The current Gemini free-tier disclosure and region restriction remain.

For a bad release, use the Vercel deployment menu to promote/roll back to the
previous successful deployment. Turning `AI_ENABLED=false` and redeploying keeps
core accounts/books usable while AI is unavailable.

Official references: https://vercel.com/docs/services,
https://vercel.com/docs/services/bindings,
https://vercel.com/docs/services/routing,
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable.
