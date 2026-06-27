const { test, expect } = require('@playwright/test');

const TEST_EMAIL = process.env.LEXIFLOW_TEST_EMAIL || 'bot@lexiflow.com';

test.describe('UC01/UC02 Authentication edge cases', () => {
  // These tests start from a clean, unauthenticated browser context rather
  // than the shared storageState.json every other spec file reuses, since
  // they're specifically about the login/logout flow itself.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC-29: an unauthenticated visitor always sees the landing page, never the app shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Dashboard")')).toHaveCount(0);
  });

  test('TC-30: signing in with the wrong password is rejected by Auth0 and the app is never entered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.waitForURL(/auth0\.com/, { timeout: 15_000 });

    await page.fill('input[name="username"]', TEST_EMAIL);
    await page.fill('input[name="password"]', 'definitely-the-wrong-password-123');
    await page.click('button[type="submit"], button[name="action"]');

    // Stay on Auth0's own domain with an error shown, rather than being
    // bounced back into the authenticated app.
    await expect(page.getByText(/wrong email or password|invalid|incorrect/i).first())
      .toBeVisible({ timeout: 10_000 });
    expect(page.url()).toMatch(/auth0\.com/);
  });

  test('TC-31: signing out returns to the landing page and clears the session', async ({ page, context }) => {
    // This one test does need to be authenticated to exercise logout, so it
    // logs in for itself rather than reusing the shared storageState (kept
    // isolated from the rest of the suite via test.use above). It is not
    // testing the onboarding tour, so it pre-seeds the "seen" flag the same
    // way global.setup.js does, to route around LF-BUG-01 (the tour's
    // Skip/Close/Escape controls don't work, which would otherwise block
    // reaching the "Sign out" button entirely).
    await context.addInitScript((email) => {
      try { localStorage.setItem(`lexiflow_guide_seen_v1:${email}`, '1'); } catch {}
    }, TEST_EMAIL);

    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await page.waitForURL(/auth0\.com/, { timeout: 15_000 });
    await page.fill('input[name="username"]', TEST_EMAIL);
    await page.fill('input[name="password"]', process.env.LEXIFLOW_TEST_PASSWORD || 'Yeah1234');
    await page.click('button[type="submit"], button[name="action"]');
    await expect(page.getByText(/Hello, /i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 10_000 });

    // A fresh reload should not silently resume the old session.
    await page.reload();
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
