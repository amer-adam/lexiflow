// One-off script to capture thesis screenshots from the live production deployment.
// Not part of the regular e2e suite. Run with: node capture-thesis-screenshots.js
const { chromium } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'https://lexiflow.amerai.top';
const EMAIL = process.env.LEXIFLOW_TEST_EMAIL || 'bot@lexiflow.com';
const PASSWORD = process.env.LEXIFLOW_TEST_PASSWORD || 'Yeah1234';
const OUT_DIR = path.join(__dirname, 'thesis-screenshots');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await context.addInitScript((email) => {
    try { localStorage.setItem(`lexiflow_guide_seen_v1:${email}`, '1'); } catch {}
  }, EMAIL);

  await page.goto(BASE_URL);
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL(/auth0\.com/, { timeout: 15000 });
  await page.fill('input[name="username"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"], button[name="action"]');
  await page.waitForURL(/lexiflow\.amerai\.top/, { timeout: 20000 });
  await page.waitForTimeout(2000);

  // --- Subtitles (watch page) ---
  await page.locator('button:has-text("Library")').first().click();
  await page.waitForLoadState('networkidle');
  await page.locator('main button', { hasText: /\d+[ms].*(Public|Private)/ }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, 'subtitles-watch.png') });
  const tokens = page.locator('[title="Tap to look up"]').filter({ hasText: /[一-鿿]/ });
  if (await tokens.first().isVisible().catch(() => false)) {
    await tokens.first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'subtitles-lookup.png') });
  }

  // --- Crowd report ---
  const flagBtn = page.locator('[title="Report a translation error on this line"]').first();
  if (await flagBtn.isVisible().catch(() => false)) {
    await flagBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'crowd-report-dialog.png') });
    await page.keyboard.press('Escape').catch(() => {});
  }

  // --- Flashcards: ensure a deck exists from the HSK Level 1 reference list ---
  await page.goto(BASE_URL);
  await page.locator('button:has-text("Vocabulary")').first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^HSK Level 1/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'debug-vocab-list.png') });
  const createDeckBtn = page.getByRole('button', { name: /Create deck/i }).first();
  console.log('createDeckBtn visible:', await createDeckBtn.isVisible().catch(() => false));
  if (await createDeckBtn.isVisible().catch(() => false)) {
    await createDeckBtn.click();
    await page.waitForTimeout(800);
    const saveLayoutBtn = page.getByRole('button', { name: /Save layout/i });
    if (await saveLayoutBtn.isVisible().catch(() => false)) {
      await saveLayoutBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  await page.goto(BASE_URL);
  await page.locator('button:has-text("Flashcards")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'flashcards-deck.png') });
  const reviewBtn = page.getByRole('button', { name: /Review|Start/i }).first();
  if (await reviewBtn.isVisible().catch(() => false)) {
    await reviewBtn.click();
    await page.waitForTimeout(1000);
    const fiveCardsBtn = page.getByRole('button', { name: /^5 cards$/i });
    if (await fiveCardsBtn.isVisible().catch(() => false)) {
      await fiveCardsBtn.click();
      await page.waitForTimeout(1200);
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'flashcards-review-front.png') });
    await page.locator('body').click({ position: { x: 720, y: 400 } }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'flashcards-review-back.png') });
  }

  // --- Quizzes ---
  await page.goto(BASE_URL);
  await page.locator('button:has-text("Quizzes")').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, 'quizzes-config.png') });
  const generateBtn = page.getByRole('button', { name: 'Generate quiz' });
  if (await generateBtn.isVisible().catch(() => false)) {
    await generateBtn.click();
    await page.waitForSelector('button:has-text("Next"), button:has-text("Submit")', { timeout: 90000 }).catch((e) => console.log('quiz wait failed', e.message));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, 'quizzes-question.png') });
  }

  await browser.close();
  console.log('Done. Screenshots saved to', OUT_DIR);
})();
