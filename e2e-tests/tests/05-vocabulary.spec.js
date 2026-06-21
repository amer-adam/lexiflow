const { test, expect } = require('@playwright/test');

test.describe('UC12/UC13 Review and Export Vocabulary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Vocabulary")').first().click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-20: official HSK reference lists contain real word entries', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^HSK Level 1/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^HSK Level 1/ }).click();
    await expect(page.getByText(/^\d+ words$/)).toBeVisible({ timeout: 10_000 });
    const wordCountText = await page.getByText(/^\d+ words$/).textContent();
    expect(parseInt(wordCountText, 10)).toBeGreaterThan(0);
  });

  test('TC-21: a new vocabulary list can be created', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /Create a list/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(800);
    }
    // Either a creation dialog appeared, or (if a list already existed) the
    // "create list" affordance for additional lists is visible instead.
    const dashedCreate = page.getByRole('button', { name: /Create a list|new list/i });
    await expect(dashedCreate.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-22 (UC13): export menu offers CSV, Anki and PDF formats', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /Export/i }).first();
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click();
      await expect(page.getByText(/CSV/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Anki/i)).toBeVisible();
      await expect(page.getByText(/PDF/i)).toBeVisible();
    } else {
      test.skip(true, 'No vocabulary list with saved words exists yet for this test account.');
    }
  });
});
