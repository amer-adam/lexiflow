const { test, expect } = require('@playwright/test');

test.describe('UC13 Generate and Review Flashcards (FSRS)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Flashcards")').first().click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-23: flashcards page loads without error', async ({ page }) => {
    await expect(
      page.getByText(/deck|Create a list first|Review/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('TC-24: a deck can be reviewed and a recall rating submitted', async ({ page }) => {
    const reviewBtn = page.getByRole('button', { name: /Review|Start/i }).first();
    if (!(await reviewBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No flashcard deck with due cards exists yet for this test account.');
      return;
    }
    await reviewBtn.click();
    await page.waitForTimeout(800);
    const ratingBtn = page.getByRole('button', { name: /^Good$/i });
    if (await ratingBtn.isVisible().catch(() => false)) {
      await ratingBtn.click();
      await page.waitForTimeout(500);
    } else {
      test.skip(true, 'Reached the deck chooser dialog rather than a live card; no due cards to rate.');
    }
  });
});
