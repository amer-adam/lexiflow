const { test, expect } = require('@playwright/test');

// Full-system baseline: drives the real deployed app like a normal user -
// paste a YouTube link, submit, wait for the real pipeline (download,
// transcribe, translate, post-process) to finish against the actual
// deployment at baseURL (see playwright.config.js) - then deletes the
// resulting video from the Library so repeat runs don't pile up. This is
// meant to replace manual click-through testing of the pipeline.
//
// The pipeline can legitimately take several minutes (Whisper + chunked LLM
// translation + post-processing), so this test gets a much longer timeout
// than the rest of the suite.
test.describe('UC04 Add Content (full pipeline, real deployment)', () => {
  test('TC-18 @slow: pasting a YouTube link produces a watchable, subtitled video, then cleans up', async ({ page }) => {
    test.setTimeout(15 * 60 * 1000); // 15 minutes - real download + transcribe + translate

    const videoUrl = process.env.LEXIFLOW_TEST_VIDEO_URL
      || 'https://www.youtube.com/watch?v=GC907UR2OL4&t=24s';

    await page.goto('/');
    await page.locator('button:has-text("Add a video")').first().click();
    await expect(page.getByText('YouTube URL')).toBeVisible();

    await page.getByPlaceholder(/youtube\.com\/watch/i).fill(videoUrl);
    await page.getByRole('button', { name: /process video/i }).click();

    // Pipeline is running - either we land on the waiting screen straight
    // away, or (if it's somehow already done) the result screen.
    await expect(page.getByText(/Processing your video|Ready to watch!|Processing failed/i))
      .toBeVisible({ timeout: 30_000 });

    await expect(page.getByText('Ready to watch!', { exact: false }))
      .toBeVisible({ timeout: 14 * 60 * 1000 });

    const failed = await page.getByText('Processing failed').isVisible().catch(() => false);
    expect(failed).toBe(false);

    // Confirm it's actually watchable, not just a status flag. Source is a
    // YouTube URL, so VideoPlayer renders the YouTube iframe API player, not
    // an HTML <video> tag (that path is only for direct file uploads).
    // This is a state-based SPA router (App.tsx swaps views by state, not a
    // real URL change), so there's no navigation event/URL to wait for here -
    // just wait for the player itself to mount.
    await page.getByRole('button', { name: /open in player/i }).click();
    await expect(page.locator('iframe[src*="youtube"]')).toBeVisible({ timeout: 15_000 });

    // Capture the real video title (h1) so cleanup below deletes *this*
    // video specifically, not just whatever delete button happens to be
    // first in a Library that may already contain other entries.
    const videoTitle = (await page.locator('h1').first().textContent())?.trim();
    expect(videoTitle, 'expected the watch page to show a video title').toBeTruthy();

    // --- Cleanup: delete this test video from the Library so the test is
    // repeatable and doesn't leave junk behind on every run. Deletion is a
    // native window.confirm() dialog (see LibraryView.tsx handleDelete), not
    // an in-page button. ---
    page.once('dialog', (dialog) => dialog.accept());

    await page.locator('button:has-text("Library")').first().click();
    await page.waitForLoadState('networkidle');

    const searchBox = page.getByPlaceholder(/search/i).first();
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill(videoTitle);
      await page.waitForTimeout(500);
    }

    const card = page.locator('main button', { hasText: videoTitle }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const deleteBtn = card.getByRole('button', { name: 'Delete video' });
    await deleteBtn.click();
    await expect(card).not.toBeVisible({ timeout: 10_000 });
  });
});
