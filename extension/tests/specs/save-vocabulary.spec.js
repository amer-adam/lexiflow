const { test, expect, seedAuthAndJob, API_BASE } = require("../fixtures");

test("clicking a word opens the save popover and saves it to a list", async ({ context, extensionId }) => {
  await seedAuthAndJob(context, extensionId, { videoId: "test123", panelOpen: true });

  const page = await context.newPage();
  await page.goto("https://www.youtube.com/watch?v=test123");

  // The content script polls for a tracked job once a second; wait for the
  // subtitle bar to render the first segment's tokens.
  const firstToken = page.locator(".lf-tok").first();
  await expect(firstToken).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".lf-char").first()).toHaveText("我");

  let savedRequestBody = null;
  await context.route(/\/lists\/list-1\/words$/, (route) => {
    savedRequestBody = route.request().postDataJSON();
    route.fulfill({ contentType: "application/json", body: "{}" });
  });

  await firstToken.click();

  const popover = page.locator(".lf-word-popover");
  await expect(popover).toBeVisible();
  await expect(popover.locator(".lf-wp-char")).toHaveText("我");
  await expect(popover.locator(".lf-wp-translations")).toContainText("I");

  await popover.locator(".lf-wp-select").selectOption("list-1");
  await popover.locator(".lf-wp-save").click();

  await expect(page.locator(".lf-toast")).toBeVisible();
  await expect(page.locator(".lf-toast")).toContainText("Saved");

  expect(savedRequestBody).toMatchObject({
    simplified: "我",
    pinyin: "wǒ",
    sourceVideoId: "job-test-123",
    contextSentence: "我认为",
    contextTranslation: "I think",
  });
});
