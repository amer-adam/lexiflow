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

  test('TC-24: a full review session can be completed and is rescheduled by FSRS', async ({ page }) => {
    const reviewBtn = page.getByRole('button', { name: /Review|Start/i }).first();
    if (!(await reviewBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No flashcard deck with due cards exists yet for this test account.');
      return;
    }
    await reviewBtn.click();
    await page.waitForTimeout(800);

    const ratingBtn = page.getByRole('button', { name: /^Good$/ });
    if (!(await ratingBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Reached the deck chooser dialog rather than a live card; no due cards to rate.');
      return;
    }

    // Rate every card in the session with "Good" until FSRS reports the
    // session summary, rather than stopping after a single card. Bounded so
    // a stuck UI fails the test instead of hanging the whole CI run.
    const summary = page.getByText(/FSRS has rescheduled each one based on your ratings/i);
    for (let i = 0; i < 60; i++) {
      if (await summary.isVisible().catch(() => false)) break;
      const btn = page.getByRole('button', { name: /^Good$/ });
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click();
      await page.waitForTimeout(300);
    }

    await expect(summary).toBeVisible({ timeout: 10_000 });
  });

  test('TC-24b: the four FSRS recall ratings (Again/Hard/Good/Easy) are all present on a live card', async ({ page }) => {
    const reviewBtn = page.getByRole('button', { name: /Review|Start/i }).first();
    if (!(await reviewBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No flashcard deck with due cards exists yet for this test account.');
      return;
    }
    await reviewBtn.click();
    await page.waitForTimeout(800);

    if (!(await page.getByRole('button', { name: /^Good$/ }).isVisible().catch(() => false))) {
      test.skip(true, 'Reached the deck chooser dialog rather than a live card; no due cards to rate.');
      return;
    }
    for (const label of ['Again', 'Hard', 'Good', 'Easy']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${label}$`) })).toBeVisible();
    }
  });
});
