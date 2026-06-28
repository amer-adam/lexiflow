// @ts-check
const { defineConfig } = require("@playwright/test");

// MV3 extensions only load in a persistent (non-headless-"old") Chromium
// context, so every test launches its own context via the `extension`
// fixture in fixtures.js rather than Playwright's default browser/page.
module.exports = defineConfig({
  testDir: "./specs",
  fullyParallel: false, // one persistent context per test; keep it simple/serial
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
  },
  timeout: 30_000,
});
