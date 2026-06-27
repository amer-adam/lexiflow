const { test: setup, expect } = require('@playwright/test');

const TEST_EMAIL = process.env.LEXIFLOW_TEST_EMAIL || 'bot@lexiflow.com';
const TEST_PASSWORD = process.env.LEXIFLOW_TEST_PASSWORD || 'Yeah1234';

// Logs in once via the real Auth0 Universal Login flow and saves the
// authenticated storage state for every other test to reuse, so we are not
// hammering Auth0's rate limits with one login per spec file.
//
// We also pre-seed the GuideTour "seen" flag under the *correct* key
// (see KNOWN ISSUE LF-BUG-01 in the Test Execution Report: the in-app
// Skip/Close/Escape controls for this dialog do not actually work, which
// blocks every other test from reaching the UI behind it). This lets the
// rest of the suite exercise the real features instead of being perpetually
// blocked by that one defect, which is recorded as its own failing test case.
setup('authenticate', async ({ page, context }) => {
  await context.addInitScript((email) => {
    try { localStorage.setItem(`lexiflow_guide_seen_v1:${email}`, '1'); } catch {}
  }, TEST_EMAIL);

  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL(/auth0\.com/, { timeout: 15_000 });
  await page.fill('input[name="username"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"], button[name="action"]');
  await page.waitForURL(/lexiflow\.amerai\.top/, { timeout: 20_000 });
  await expect(page.getByText(/Hello, /i)).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: 'storageState.json' });
});
