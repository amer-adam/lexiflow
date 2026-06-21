const { test, expect } = require('@playwright/test');

test.describe('UC03 Manage Profile / Account deletion (verification only)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('bot@lexiflow.comView profile').click().catch(async () => {
      await page.getByText(/View profile/i).first().click();
    });
    await page.waitForLoadState('networkidle');
  });

  test('TC-27: profile page shows the authenticated Auth0 identity', async ({ page }) => {
    await expect(page.getByText('bot@lexiflow.com').first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-28: "Delete my account" control is present with a destructive confirmation', async ({ page }) => {
    // INTENTIONALLY NOT EXECUTED PAST THE CONFIRM DIALOG: this is the
    // shared, reusable test account for the whole suite. We only verify the
    // control exists and that the native confirm() prompt appears with the
    // correct warning text, then dismiss it (Playwright auto-dismisses
    // unhandled dialogs) so the account is never actually deleted by CI.
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: /Delete my account/i }).click();
    await page.waitForTimeout(500);
    expect(dialogMessage).toMatch(/permanently removes your vocabulary lists/i);
  });
});
