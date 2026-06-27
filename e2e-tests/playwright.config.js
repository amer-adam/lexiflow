// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'results/results.json' }],
  ],
  use: {
    baseURL: 'https://lexiflow.amerai.top',
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
