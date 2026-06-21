const { test, expect } = require('@playwright/test');

// These run unauthenticated against the public landing page, so they
// intentionally use a fresh context with no storageState.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Public landing page (unauthenticated)', () => {
  test('TC-01: landing page loads with sign-in call to action', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LexiFlow/i);
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });

  test('TC-02: unauthenticated landing preview clip is present and gated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/press play to see subtitles sync live/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-03: direct navigation to a client-side route serves the SPA, not a raw 404', async ({ page }) => {
    // EXPECTED: nginx should fall back to index.html for any unknown path so
    // the React Router app can render its own "please sign in" / not-found
    // state. ACTUAL (see LF-BUG-02 in the Test Execution Report): nginx has
    // no SPA fallback configured, so a direct hit or browser refresh on any
    // client-side route (e.g. /library) returns a bare "404 Not Found"
    // page served by nginx itself, with none of the app's UI.
    const res = await page.goto('/library');
    expect(res?.status()).toBe(200);
  });
});
