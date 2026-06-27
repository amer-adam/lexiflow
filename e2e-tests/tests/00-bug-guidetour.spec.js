const { test, expect } = require('@playwright/test');

// LF-BUG-01: the auto-triggered onboarding GuideTour cannot be dismissed.
//
// Root cause hypothesis (frontend/src/App.tsx:69 + src/lib/guide.ts):
// `const autoGuide = session.isAuthenticated && !hasSeenGuide(session.email)`
// is recomputed from `session.email` on every render. On a fresh sign-in,
// Auth0's profile claims (including email) can resolve a render or two
// *after* `isAuthenticated` first flips true. If the user clicks
// Skip/Close before `session.email` has resolved, `markGuideSeen(session.email)`
// (called from `onFinish`) writes the "seen" flag under
// `lexiflow_guide_seen_v1` (the un-suffixed key, since email was still
// `undefined` at call time). Once email resolves on a later render,
// `autoGuide` is recomputed against `lexiflow_guide_seen_v1:<real email>`,
// which was never written -- so `hasSeenGuide` returns false again and the
// dialog springs back open, now permanently blocking the dashboard behind a
// full-screen, pointer-events-intercepting overlay with no working way out
// except a manual page reload performed late enough that email has already
// resolved before the tour mounts (not guaranteed).
//
// These tests intentionally do NOT use the shared `storageState.json` /
// pre-seeded localStorage workaround used by the rest of the suite, because
// that workaround exists specifically to route around this bug. Each test
// performs its own fresh Auth0 login to reproduce the real first-time-user
// experience.

const TEST_EMAIL = process.env.LEXIFLOW_TEST_EMAIL || 'bot@lexiflow.com';
const TEST_PASSWORD = process.env.LEXIFLOW_TEST_PASSWORD || 'Yeah1234';

test.use({ storageState: { cookies: [], origins: [] } });

async function freshLogin(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL(/auth0\.com/, { timeout: 15_000 });
  await page.fill('input[name="username"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"], button[name="action"]');
  // Wait for the post-Auth0 redirect back to the app itself, whatever host
  // that is (don't hardcode a specific domain -- baseURL is configurable).
  await page.waitForURL((url) => !url.hostname.includes('auth0.com'), { timeout: 20_000 });
  await expect(page.getByText('Welcome to LexiFlow').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('LF-BUG-01: onboarding tour cannot be dismissed', () => {
  test('TC-B1: Skip button does not close the auto-triggered tour', async ({ page }) => {
    await freshLogin(page);
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(page.getByText('Welcome to LexiFlow').first()).toBeHidden({ timeout: 3000 });
  });

  test('TC-B2: Close (x) button does not close the auto-triggered tour', async ({ page }) => {
    await freshLogin(page);
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(page.getByText('Welcome to LexiFlow').first()).toBeHidden({ timeout: 3000 });
  });

  test('TC-B3: Escape key does not close the auto-triggered tour', async ({ page }) => {
    await freshLogin(page);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Welcome to LexiFlow').first()).toBeHidden({ timeout: 3000 });
  });

  test('TC-B4: the tour overlay blocks all sidebar navigation while open', async ({ page }) => {
    await freshLogin(page);
    // Even a forced click (bypassing Playwright's actionability checks)
    // cannot reach the Library nav button underneath the overlay.
    await expect(async () => {
      await page.locator('button:has-text("Library")').first().click({ timeout: 2000 });
    }).rejects.toThrow();
  });
});
