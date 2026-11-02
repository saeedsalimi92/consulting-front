import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-integration',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:3001',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    // Auth flows contain passwords and Bearer tokens; keep them out of traces/videos.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3001 --strictPort',
    url: 'http://127.0.0.1:3001/account/login',
    reuseExistingServer: false,
    timeout: 120_000,
    // Credentials are consumed only by Playwright workers, never by the Nuxt server.
    env: {
      NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:8011/api',
      E2E_AUTH_MOBILE: '',
      E2E_AUTH_PASSWORD: '',
    },
  },
})
