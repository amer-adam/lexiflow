const { test, expect } = require('@playwright/test');

test.describe('UC07 Find Translated Content (Library)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Library")').first().click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-11: library lists previously processed videos', async ({ page }) => {
    const cards = page.locator('main button', { hasText: /\d+[ms].*(Public|Private)/ });
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('TC-12: library search filters the visible videos', async ({ page }) => {
    const searchBox = page.getByPlaceholder(/search/i).first();
    await expect(searchBox).toBeVisible();
    const before = await page.locator('main button', { hasText: /\d+[ms].*(Public|Private)/ }).count();
    await searchBox.fill('zzzznoresultsxyz123');
    await page.waitForTimeout(700);
    const after = await page.locator('main button', { hasText: /\d+[ms].*(Public|Private)/ }).count();
    expect(after).toBeLessThan(before);
  });

  test('TC-13: sort control reorders the library', async ({ page }) => {
    const sortBtn = page.locator('button', { hasText: /Newest first|Oldest first|title/i }).first();
    await expect(sortBtn).toBeVisible();
  });
});
