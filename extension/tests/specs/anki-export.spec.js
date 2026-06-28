const { test, expect, seedAuthAndJob, API_BASE } = require("../fixtures");

test("popup exports a saved-words list to Anki", async ({ context, extensionId }) => {
  await seedAuthAndJob(context, extensionId, { videoId: "test123" });

  await context.route(`${API_BASE}/lists/list-1/export*`, (route) =>
    route.fulfill({
      contentType: "application/octet-stream",
      headers: { "content-disposition": 'attachment; filename="my-vocabulary.apkg"' },
      body: Buffer.from("fake-apkg-bytes"),
    })
  );

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const exportSection = page.locator("#export-section");
  await expect(exportSection).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#export-select option")).toHaveCount(1);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-btn").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("my-vocabulary.apkg");
  await expect(page.locator("#export-status")).toHaveText("Downloaded ✓");
});
