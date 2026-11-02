import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT) || 5173
const apiPort = Number(process.env.API_PORT) || 3001

export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', viewport: { width: 1440, height: 1100 }, screenshot: 'only-on-failure' },
  // The API always starts fresh on local services (.data/pglite, .data/uploads, mail in the log), even when .env names real ones; a running API on 3001 stops the run
  // rather than being reused. Every test signs up its own account (tests/fixtures.ts).
  webServer: [
    { command: 'npm run dev:api', url: `http://127.0.0.1:${apiPort}/api/health`, reuseExistingServer: false, env: { LOCAL_ONLY: '1', API_PORT: String(apiPort) } },
    { command: `npm run dev -- --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_PORT, env: { API_PORT: String(apiPort) } },
  ],
})
