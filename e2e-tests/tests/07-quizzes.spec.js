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

  test('TC-26 @slow: a full quiz can be completed and produces a scored result', async ({ page }) => {
    // Tagged @slow and excluded from the fast/CI-on-every-push suite: quiz
    // generation calls the real AI-assisted distractor generation pipeline
    // (Chapter 5, Module 4) once per question across every selected
    // question format, which has been observed taking well over a minute
    // for a default-configuration quiz -- too slow to gate every push on.
    test.setTimeout(3 * 60 * 1000);

    const noListState = page.getByText(/need a vocabulary list first/i);
    if (await noListState.isVisible().catch(() => false)) {
      test.skip(true, 'Test account has no vocabulary list yet to generate a quiz from.');
      return;
    }

    // Explicitly pick a large official list (150 words) instead of trusting
    // whichever list the page defaults to. The default is whatever the API
    // returns first, which can be the tiny "Saved words" list (often just 1
    // word for this shared test account) -- generating a multiple-choice
    // quiz from a list with under 4 distinct words used to hang the backend
    // forever (see backend-fastapi/services/quiz/generator.py, the
    // distractor-fallback loop had no bound on the candidate pool size).
    await page.getByRole('button', { name: /^HSK Level 1/ }).click();

    await page.getByRole('button', { name: 'Generate quiz' }).click();
    await expect(page.getByRole('button', { name: /Next|Finish & see score/i })).toBeVisible({ timeout: 2 * 60 * 1000 });

    // Answer every question (MCQ/true-false get their first option clicked;
    // free-text question types get a non-empty placeholder answer) and
    // advance until the quiz is graded, rather than stopping after question 1.
    for (let i = 0; i < 50; i++) {
      const resultHeading = page.getByText('Quiz complete');
      if (await resultHeading.isVisible().catch(() => false)) break;

      const optionButtons = page.locator('.grid > button.rounded-md');
      const textInput = page.getByPlaceholder(/Type the missing word|Type your answer/i);

      if (await optionButtons.first().isVisible().catch(() => false)) {
        await optionButtons.first().click();
      } else if (await textInput.isVisible().catch(() => false)) {
        await textInput.fill('test answer');
      }

      const nextBtn = page.getByRole('button', { name: /Next|Finish & see score/i });
      const isFinishStep = await nextBtn.filter({ hasText: /Finish & see score/i }).isVisible().catch(() => false);
      await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
      await nextBtn.click();

      if (isFinishStep) {
        // Grading the final answer is a real backend call (and can take a
        // while, like quiz generation itself) -- wait for the result screen
        // directly instead of looping back to look for a Next button that
        // no longer exists once the quiz is submitted.
        await expect(resultHeading).toBeVisible({ timeout: 30_000 });
        break;
      }
      await page.waitForTimeout(300);
    }

    await expect(page.getByText('Quiz complete')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/You scored \d+%\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'New quiz' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    // The per-question breakdown lists each answered question as correct or
    // incorrect, not just the aggregate score.
    await expect(page.getByText(/Your answer:/).first()).toBeVisible();
  });
});
