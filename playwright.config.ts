import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    reporter: 'list',
    timeout: 30_000,
    expect: { timeout: 7_500 },
    use: {
        baseURL: 'http://127.0.0.1:3100',
        browserName: 'chromium',
        channel: 'chrome',
        headless: true,
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 3100 --strictPort',
        url: 'http://127.0.0.1:3100/account/login',
        reuseExistingServer: false,
        timeout: 120_000,
        // UI tests must never accidentally call the normal Laravel instance or its database.
        env: { NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:9/api' },
    },
})
