# Deploy Scribb

Prepared 2 November 2026. Repository: https://github.com/watermelon588/Scribb.
Deploy the **`codex/hosting-ready`** branch. It contains the completed app and this
hosting setup; the other active chat's unfinished creator badge/PFP changes are
intentionally excluded. Its original checkout and branch were left untouched.

## Where each part goes

| Part | Host | Notes |
| --- | --- | --- |
| React/Vite frontend and Express `/api/*` | One Vercel project | One origin keeps session cookies and uploads working. Do not deploy the Express API as a second Render service. |
| Accounts, books, entries and social records | Neon Postgres | Choose Singapore to match the app/AI region. |
| Uploaded artwork and journal pictures | Cloudinary | Required for hosted uploads; server disk is not persistent storage. |
| Verification and password recovery email | Resend | Required to verify an email or recover a password for username/password accounts. Google can also supply verified identity for AI. |
| Python journal AI | Render Web Service | Optional. Core books/accounts work with `AI_ENABLED=false`. |
| Text model | Google Gemini API | The current feature uses the unpaid tier and explicitly discloses its data use. |

No production accounts, billing plans or resources have been created by this task.
No real database migrations or live AI requests were run. Dashboard actions below
are the remaining setup you perform with your own accounts.

## 1. Create the database and image store

1. In [Neon](https://console.neon.tech), create a project/database in Singapore.
   Copy its app/owner Postgres connection string with TLS enabled. This is
   `DATABASE_URL` for Vercel, not the restricted AI connection described later.
2. In [Cloudinary](https://console.cloudinary.com), open your product environment's
   API Keys page. Copy **cloud name**, **API key** and **API secret**.
3. Generate a session secret locally:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Save the result in your password manager. Generate another, different result
   later for the shared AI ticket secret. Never add these values to GitHub.

## 2. Apply the database migrations once

Use a checkout of the deployment branch with Node 22:

```powershell
git clone --branch codex/hosting-ready https://github.com/watermelon588/Scribb.git scribb-hosting
cd scribb-hosting
npm ci
Copy-Item .env.example .env
```

Edit the ignored `.env` file and set `DATABASE_URL` to your Neon app/owner connection
string. Then run:

```powershell
npm run migrate
```

This is the explicit production database step: it applies `db/migrations/001` through
`004` in order, once each, including the media table. Run it again for future new
migrations. It records completed filenames in `schema_migrations`. It does not
reset or seed your database. Do not run browser tests against this database; tests
use a separate local Postgres substitute.

## 3. Create the Vercel project

1. Open [Vercel → Add New Project](https://vercel.com/new) and import
   `watermelon588/Scribb`.
2. Use **`codex/hosting-ready`** as the production branch. If the import screen
   initially uses the repository's default branch, change **Project Settings →
   Environments → Production → Branch Tracking** (or Git → Production Branch)
   before the final deployment.
3. Root directory: repository root (`.`). Framework: **Vite**. Node: **22.x**.
   Keep the committed install/build/output settings from `vercel.json`:
   `npm ci --include=dev`, `npm run check:deploy -- vercel && npm run build`, `dist`.
4. Pick your project name. Set `APP_ORIGIN` to the actual production origin, for
   example `https://your-project.vercel.app`, with no path. If a deployment is
   needed to obtain the assigned URL, it can fail the configuration check first;
   add the final `APP_ORIGIN` and redeploy. Do not leave the sample address in place.
5. Add the following environment variables for **Production**. Do not copy your
   production database and secrets into public Preview deployments. Use a separate
   Neon branch and credentials if you later enable fully functional previews.

| Vercel variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon app/owner connection string with TLS |
| `SESSION_SECRET` | The random session secret generated above |
| `APP_ORIGIN` | Your final HTTPS site origin |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `AI_ENABLED` | `false` for this first deployment |

6. Deploy, then open `https://YOUR-SITE/api/health`. It must return
   `{"ok":true,"db":"ok"}`. `db: "unconfigured"` means the environment is missing
   its connection string; `db: "down"` means the database could not be reached.
7. Create an account, save a private sketchbook with an image, reload, open it, and
   check it from a second signed-out browser. Private books must remain private.

Only `VITE_GOOGLE_CLIENT_ID` is an intended public frontend provider value. Never
prefix database URLs, Resend keys, Cloudinary secrets or AI secrets with `VITE_`.
The build validator refuses missing core credentials, local-test switches, unsafe
origins and common accidental public secret settings without displaying values.

## 4. Enable email and optional Google sign-in

For email:

1. Add a domain you control in [Resend](https://resend.com/domains), add the DNS
   records it supplies, and wait for verification. A default testing sender may
   only send to your own account and is not sufficient for public registrations.
2. Add `RESEND_API_KEY` and `MAIL_FROM` to Vercel. Example format:
   `Scribb <hello@YOUR-VERIFIED-DOMAIN>`.
3. Redeploy. In app Settings, add an email, receive its verification link and
   verify it. Also test the password-recovery email.

For Google sign-in:

1. Create an OAuth **Web application** client in Google Cloud / Google Auth
   Platform. Configure the consent/branding and audience settings it requests.
2. Add your exact site origin under **Authorized JavaScript origins**. This app
   uses Google Identity Services' credential callback, not a custom OAuth redirect
   route. Add `http://localhost:5173` only if you also want local development.
3. Set `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` in Vercel to that same public
   client ID. There is no Google client secret in this integration.
4. Redeploy so Vite includes the public ID in the frontend, then test Google sign-in.

Leave both Google IDs unset if you do not want the Google button yet.

## 5. Prepare the restricted AI database connection

Skip this and the next section if you want to launch without AI.

1. Generate two more separate random values with the command in step 1: an
   **AI database password** and an **AI ticket secret**. Neither is the session secret.
2. The migration created `scribb_ai` with no login and a narrow journal-reading
   grant. In the Neon SQL Editor, run this once with your generated AI database
   password (replace the quoted placeholder):

   ```sql
   alter role scribb_ai login password 'PASTE_YOUR_RANDOM_HEX_AI_DATABASE_PASSWORD';
   select rolname, rolsuper, rolbypassrls from pg_roles where rolname = 'scribb_ai';
   ```

   Both `rolsuper` and `rolbypassrls` must be false. Do not grant database-owner
   membership, `BYPASSRLS`, or broad table access to this role.
3. Construct `AI_DATABASE_URL` for the same Neon host, database and TLS settings,
   using username **`scribb_ai`** and this new password. If the Neon Connect dialog
   offers the role, select it there; otherwise replace the username/password in
   the connection string. A hex password avoids URL-escaping problems. Keep
   `sslmode=require` or stricter. Do not reuse the app/owner `DATABASE_URL`.

The AI sets the authenticated user's ID inside each transaction. Database row
level security restricts it to that user's journal text. The Render startup check
rejects an owner connection string and missing TLS; it does not query the database
or certify permissions, which is why the role check above matters.

## 6. Deploy the Python service on Render

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In [Render](https://dashboard.render.com), select **New → Blueprint**, connect
   `watermelon588/Scribb`, select **`codex/hosting-ready`**, and use `render.yaml`.
3. The Blueprint configures a **Python Web Service**, Singapore, `ai` root directory,
   free instance type, `pip install -r requirements.txt`, and this start command:

   ```text
   python -m scribb_ai.check_config && uvicorn scribb_ai.main:app --host 0.0.0.0 --port $PORT --no-access-log
   ```

   Health check: `/health`. `.python-version` selects Python 3.13 with the latest
   available patch. Remove an old dashboard `PYTHON_VERSION` override if reusing
   an existing service. No persistent disk or Render Postgres is needed.
4. Fill the secrets/origin fields when Render prompts:

| Render variable | Value |
| --- | --- |
| `AI_TICKET_SECRET` | Your AI ticket secret; exactly the same value will go in Vercel |
| `AI_DATABASE_URL` | Restricted `scribb_ai` Neon connection string |
| `GEMINI_API_KEY` | Your Google AI Studio API key |
| `ALLOWED_ORIGINS` | Exact HTTPS Vercel/custom-domain origin, no trailing slash; comma-separated if you use more than one |
| `GEMINI_TEXT_MODEL` | Blueprint default: `gemini-3.5-flash-lite` |

5. Deploy, copy the assigned `https://...onrender.com` URL, and visit its `/health`.
   Expect `{"ok":true}`. This checks that the process is reachable; it does not
   spend model quota or test the database/model connection.
6. In Vercel add `AI_URL` = that Render origin, add the identical
   `AI_TICKET_SECRET`, change `AI_ENABLED` to `true`, and redeploy. Verified email
   must already work through Resend or Google sign-in; the Vercel check requires
   at least one of these providers. Resend is still needed for verification and
   recovery emails for username/password accounts.
7. In the app, use an adult account with a verified email, create and save a short
   non-sensitive journal entry, open **Ask my journal**, read the disclosure and
   enable it. Ask about that entry. Verify the answer, dates, Stop and Retry.

Free Render services sleep after idle periods and can take about a minute to
wake. The app polls only after submission and obtains its one-time ticket after
the service wakes. Do not add external uptime pings just to defeat free-tier sleep.
Use a paid instance if you choose to require a consistently warm service. Provider
quotas and plans can change; this setup does not promise unlimited free usage.

The current Gemini unpaid-tier disclosure remains part of the feature. It warns
against sensitive/confidential/personal content and describes potential provider
review/improvement use. AI is optional and unavailable in EEA/UK/Switzerland with
the current free-tier integration. Do not remove the notice or restrictions merely
to make deployment pass.

## Custom domains, ongoing deploys and rollback

- Add a domain in Vercel, apply its DNS records, then update `APP_ORIGIN`, Google
  authorized origins, and Render `ALLOWED_ORIGINS` to the canonical HTTPS origin.
  Redirect any aliases to the canonical domain. Redeploy after variable changes.
- New pushes to your configured production branch can trigger automatic deploys.
  GitHub `Checks` runs build/types, deployment-validator tests, API tests, browser
  tests, Python tests and dependency audits without production credentials. Enable
  required checks in repository branch protection before merging later work.
- To disable AI quickly, set Vercel `AI_ENABLED=false` and redeploy. Core books
  continue to work. Vercel and Render offer previous-deployment rollback in their
  dashboards; keep compatible app/AI ticket secrets when rolling back.
- Migrations are not undone by rolling back application code. Keep a Neon backup
  or recovery point before future schema changes; do not delete migration records.
- Uploaded images currently remain on Cloudinary after account/book deletion.
  The Privacy page discloses this existing limitation. Operator/contact details and
  the legal text need your review before public launch.
- Cover metadata imported by Vite lives in `src/data/*-covers.json`. Public
  manifests remain the provenance records. When regenerating cover assets, update
  the bundled metadata too; `npm run test:deploy` checks that the two lists match.

## Sources checked for this setup

Local verification: production build, 16 API tests, 23 Python tests, six deployment
checks, npm production dependency audit and Python dependency audit passed. The
50-browser run passed 47 checks; two feed failures exposed hardcoded secondary
browser ports, which were corrected. Five focused checks then passed, including
those feed flows, guest access, phone navigation and the one sticker failure that
did not recur. The build retains the existing large-JavaScript-chunk advisory.
Hosted CI and live-provider smoke checks still run after GitHub/dashboard setup.

- [Vite and Vercel Functions](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render Python version selection](https://render.com/docs/python-version)
- [Render free-service behavior](https://render.com/docs/free)
- [Neon serverless driver and Node 22](https://neon.com/docs/serverless/serverless-driver)
- [Gemini API data-use terms](https://ai.google.dev/gemini-api/terms)
