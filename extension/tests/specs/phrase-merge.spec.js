const { test, expect, seedAuthAndJob } = require("../fixtures");

test("drag-selecting adjacent tokens merges them into one saveable phrase", async ({ context, extensionId }) => {
  await seedAuthAndJob(context, extensionId, { videoId: "test123", panelOpen: true });

  const page = await context.newPage();
  await page.goto("https://www.youtube.com/watch?v=test123");

  const tokens = page.locator(".lf-tok");
  await expect(tokens).toHaveCount(2, { timeout: 10_000 }); // "我" + "认为"

  const first = await tokens.nth(0).boundingBox();
  const second = await tokens.nth(1).boundingBox();

  // Drag from the middle of the first token to the middle of the second —
  // this is the gap Language Reactor reviewers complain about (single-word
  // only); our segments are already word-tokenized so adjacent tokens can
  // be merged into one phrase before saving.
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 5 });
  await page.mouse.up();

  const popover = page.locator(".lf-word-popover");
  await expect(popover).toBeVisible();
  await expect(popover.locator(".lf-wp-char")).toHaveText("我认为");
  await expect(popover.locator(".lf-wp-pinyin")).toHaveText("wǒ rènwéi");
});
