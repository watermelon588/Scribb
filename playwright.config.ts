import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 1100 }, screenshot: 'only-on-failure' },
  // Each server is one node process (no npm or watcher in between) so Playwright can stop it on Windows.
  // Tests run their own app and API on 5174 and 3101, so the dev servers on 5173 and 3001 keep running. The API always starts
  // fresh on local services (an in-memory database, .data/uploads, mail in the log), even when .env names real ones. Every test signs up its own account (tests/fixtures.ts).
  webServer: [
    { command: 'node --import tsx server/dev.ts', url: 'http://127.0.0.1:3101/api/health', reuseExistingServer: false, env: { LOCAL_ONLY: '1', API_PORT: '3101', PGLITE_DIR: 'memory://' } },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: { API_PORT: '3101' } },
  ],
})
