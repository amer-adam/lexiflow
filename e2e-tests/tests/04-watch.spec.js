const { test, expect } = require('@playwright/test');

test.describe('UC06/UC08/UC09/UC10/UC11 Watch page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Library")').first().click();
    await page.waitForLoadState('networkidle');
    await page.locator('main button', { hasText: /\d+[ms].*(Public|Private)/ }).first().click();
    await page.waitForTimeout(2000);
  });

  test('TC-14: bilingual, pinyin-annotated subtitles render for a processed video', async ({ page }) => {
    await expect(page.locator('iframe').first()).toBeVisible({ timeout: 15_000 });
    // Pinyin-annotated character tokens are individually tappable.
    const tokens = page.locator('[title="Tap to look up"]');
    await expect(tokens.first()).toBeVisible({ timeout: 15_000 });
    expect(await tokens.count()).toBeGreaterThan(0);
  });

  test('TC-15: tapping a character opens the dictionary look-up panel', async ({ page }) => {
    const tokens = page.locator('[title="Tap to look up"]');
    await expect(tokens.first()).toBeVisible({ timeout: 15_000 });
    await tokens.first().click();
    await expect(page.getByText(/Save this word|Saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('TC-16: saving a tapped word adds it to a vocabulary list', async ({ page }) => {
    // Filter to an actual Chinese-character token (the subtitle line also
    // contains tappable English gloss words further down, which this test
    // is not targeting) so the test is deterministic across runs.
    const tokens = page.locator('[title="Tap to look up"]').filter({ hasText: /[\u4e00-\u9fff]/ });
    await expect(tokens.first()).toBeVisible({ timeout: 15_000 });
    await tokens.first().click();
    const saveBtn = page.getByRole('button', { name: /Save this word/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expect(page.getByRole('button', { name: /Saved/i })).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.getByRole('button', { name: /Saved/i })).toBeVisible();
    }
  });

  test('TC-17: previous/next line navigation controls are present and clickable', async ({ page }) => {
    const next = page.locator('[title="Next line"]').first();
    const prev = page.locator('[title="Previous line"]').first();
    await expect(next).toBeVisible({ timeout: 10_000 });
    await next.click();
    await expect(prev).toBeVisible();
    await prev.click();
  });

  test('TC-18: loop and pause-at-segment-end toggles are present', async ({ page }) => {
    await expect(page.locator('[title="Repeat the current line"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[title="Pause at the end of each line"]')).toBeVisible();
  });

  test('TC-19 (UC11): a subtitle line can be flagged for review', async ({ page }) => {
    const flagBtn = page.locator('[title="Report a translation error on this line"]').first();
    await expect(flagBtn).toBeVisible({ timeout: 10_000 });
    await flagBtn.click();
    // The report form/modal should open with a reason selector.
    await expect(page.getByText(/translation|pinyin|transcription/i).first()).toBeVisible({ timeout: 5000 });
  });
});
