const { test, expect } = require('@playwright/test');

test.describe('UC02 Login / Dashboard / UC03 Profile basics', () => {
  test('TC-04: authenticated session lands on dashboard with user identity shown', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Hello, /i)).toBeVisible();
    await expect(page.getByText('bot@lexiflow.com').first()).toBeVisible();
  });

  test('TC-05: Learning Activity Dashboard stats are rendered', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Words in your lists/i)).toBeVisible();
    await expect(page.getByText(/Videos/i).last()).toBeVisible();
    await expect(page.getByText(/Your activity|TODAY/i).first()).toBeVisible();
  });

  test('TC-06: light/dark theme toggle switches the document theme', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /switch to (dark|light) mode/i });
    await expect(toggle).toBeVisible();
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(after).not.toBe(before);
  });

  test('TC-07: "Guide" button reopens the product tour', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /guide/i }).first().click();
    await expect(page.getByText('Welcome to LexiFlow').first()).toBeVisible();
    // This suite's storage state pre-seeds the "tour seen" flag (see
    // global.setup.js) specifically so the *auto*-triggered tour does not
    // block every other test behind LF-BUG-01 (see 00-bug-guidetour.spec.js).
    // Manually re-opening it via the "Guide" button is a secondary path;
    // it is closed here so it doesn't affect the rest of this file either way.
    await page.getByRole('button', { name: 'Close', exact: true }).first().click({ timeout: 3000 }).catch(() => {});
  });
});
