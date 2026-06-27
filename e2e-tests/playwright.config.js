// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const isCI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // Flaky live-network/Auth0 hiccups get one free retry in CI; locally we
  // want failures to surface immediately.
  retries: isCI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results/results.json' }],
    ...(isCI ? [['github']] : []),
  ],
  use: {
    // Override with LEXIFLOW_BASE_URL to point the whole suite at a staging
    // deployment instead of production (recommended once this runs in CI).
    baseURL: process.env.LEXIFLOW_BASE_URL || 'https://lexiflow.amerai.top',
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.js/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
      dependencies: ['setup'],
    },
  ],
});
