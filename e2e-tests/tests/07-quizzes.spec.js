const { test, expect } = require('@playwright/test');

test.describe('UC14 Generate Quizzes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("Quizzes")').first().click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-25: quiz configuration page loads with question-type options', async ({ page }) => {
    const noListState = page.getByText(/need a vocabulary list first/i);
    if (await noListState.isVisible().catch(() => false)) {
      test.skip(true, 'Test account has no vocabulary list yet to generate a quiz from.');
      return;
    }
    await expect(page.getByRole('button', { name: 'Generate quiz' })).toBeVisible({ timeout: 10_000 });
  });

  test('TC-26: a quiz can be generated and its first question rendered', async ({ page }) => {
    const noListState = page.getByText(/need a vocabulary list first/i);
    if (await noListState.isVisible().catch(() => false)) {
      test.skip(true, 'Test account has no vocabulary list yet to generate a quiz from.');
      return;
    }
    const generateBtn = page.getByRole('button', { name: 'Generate quiz' });
    await generateBtn.click();
    await expect(page.getByRole('button', { name: /Next|Submit/i })).toBeVisible({ timeout: 20_000 });
  });
});
