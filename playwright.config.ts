import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for InsightHub.
 *
 * Run locally:   npx playwright test
 * Run in CI:     npx playwright test --project=chromium
 * Debug:         npx playwright test --debug
 * UI mode:       npx playwright test --ui
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',

  /* Fail the build on CI if test.only was left in source */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests once in CI */
  retries: process.env.CI ? 1 : 0,

  /* Single worker in CI for stability; parallel locally */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter: concise in CI, rich locally */
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }]]
    : [['html', { open: 'on-failure', outputFolder: 'e2e/playwright-report' }]],

  /* Shared settings for all tests */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Dev server — starts Next.js automatically for local runs */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* Uncomment to add more browsers:
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    */
  ],
});
