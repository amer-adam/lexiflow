const { test, expect } = require('@playwright/test');

test.describe('Error and empty states', () => {
  test('TC-32: an unmatched library search shows an empty-results state, not a blank or broken page', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Library")').first().click();
    await page.waitForLoadState('networkidle');

    const searchBox = page.getByPlaceholder(/search/i).first();
    await expect(searchBox).toBeVisible();
    await searchBox.fill('zzzznoresultsxyz123');
    await page.waitForTimeout(700);

    const cards = page.locator('main button', { hasText: /\d+[ms].*(Public|Private)/ });
    expect(await cards.count()).toBe(0);
    // The page itself must still be intact (header still present), not a
    // crashed/blank render.
    await expect(page.getByText('Library', { exact: true }).first()).toBeVisible();
  });

  test('TC-33: an unmatched vocabulary search shows an empty-results state', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Vocabulary")').first().click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^HSK Level 1/ }).click();

    const searchBox = page.getByPlaceholder(/search this list/i);
    await expect(searchBox).toBeVisible({ timeout: 10_000 });
    await searchBox.fill('zzzznoresultsxyz123');
    await page.waitForTimeout(500);
    await expect(page.getByText(/No words match/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('TC-34 @slow: submitting a non-YouTube garbage URL is rejected rather than silently accepted', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);

    await page.goto('/');
    await page.locator('button:has-text("Add a video")').first().click();
    await expect(page.getByText('YouTube URL')).toBeVisible();

    await page.getByPlaceholder(/youtube\.com\/watch/i).fill('https://not-a-real-video-host.invalid/abc123');
    await page.getByRole('button', { name: /process video/i }).click();

    // Either rejected immediately client/server-side, or accepted as a job
    // that then fails once the real worker can't actually fetch it -- both
    // are an acceptable "rejected" outcome; what must never happen is the
    // app silently treating it as a successfully processed video.
    const outcome = page.getByText(/Processing failed|Could not start processing|invalid|error/i);
    await expect(outcome).toBeVisible({ timeout: 4 * 60 * 1000 });
    await expect(page.getByText('Ready to watch!')).not.toBeVisible();
  });
});
