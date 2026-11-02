# Ask my journal: production diagnosis, 3 November 2026

## Confirmed incident

The browser uses `https://www.scribb.xyz`, while the Render AI service allowed only
`https://scribb.xyz`. Public probes reproduced a 200 health response without CORS
headers for www and a 400 OPTIONS preflight on /ask. Both requests worked for the
apex origin. A healthy Render process therefore did not mean browsers could use it.

`allowed_origins()` now includes both Scribb origins when either is configured,
normalizes trailing slashes, and keeps unrelated origins blocked. The blueprint
and example environment include both names explicitly.

## Deployment and verification

1. In the existing Render AI service set `ALLOWED_ORIGINS` to
   `https://scribb.xyz,https://www.scribb.xyz` and restart/redeploy. This environment
   change fixes the observed CORS failure even before the code update ships.
2. Deploy the AI changes and the frontend changes through the normal production
   release. Editing render.yaml alone does not update an existing service's env.
3. GET /health and OPTIONS /ask with each Origin must return that exact origin in
   Access-Control-Allow-Origin. OPTIONS must allow authorization and content-type.
4. Sign in with a verified email, grant AI consent, save a nonsensitive test journal
   entry, then ask about it. Verify /api/ai/status, /api/ai/ticket, and /ask in order.
   Health is liveness only: it deliberately does not contact Postgres or Gemini.
5. If asking still fails, check safe AI logs and Render's AI_DATABASE_URL (restricted
   reader role), GEMINI_API_KEY, model and the shared AI_TICKET_SECRET. Never paste
   credentials or journal text into logs. The local .env AI database URL failed
   password authentication during diagnosis; Render's credentials were not read or
   verified. A minimal local-config Gemini request without journal data succeeded.

No remote deployment or authenticated production journal request was performed by
this task. The CORS incident is confirmed; post-deployment end-to-end verification
remains required.

## Voice conversation

The microphone starts a turn-based browser speech session: listen, submit after a
pause, receive a protected /ask answer, read it aloud, then listen again. It is not
a full-duplex Gemini Live call. The microphone stops before answer playback to
avoid transcribing its own response. End, clear, consent withdrawal and navigation
cancel the session. Inactive listening times out. Browser speech services may
process audio; the UI discloses this while listening and before starting. Browsers
without recognition/synthesis retain typing and show an unavailable voice button.

Automated voice checks mock browser speech and AI; actual microphone permission,
recognition quality and audio playback require a supported browser and hardware.
