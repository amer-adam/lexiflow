// ─────────────────────────────────────────────────────────────────────────
//  Playwright fixture for testing the LexiFlow MV3 extension end-to-end
//  without touching the real youtube.com or LexiFlow backend:
//   - launches a persistent Chromium context with the unpacked extension
//     loaded from extension/ (one level up from this file)
//   - intercepts https://www.youtube.com/watch* and fulfills it with a
//     local fixture page that has just enough DOM (#movie_player, a
//     <video>) for the content script's selectors to find
//   - intercepts the configured API/app origins with sane default mock
//     responses; individual specs override specific routes as needed
// ─────────────────────────────────────────────────────────────────────────
const path = require("path");
const fs = require("fs");
const base = require("@playwright/test");
const { fakeCompletedJobResponse, FAKE_JOB_ID } = require("./fixtures/job");

const EXTENSION_PATH = path.join(__dirname, "..");
const YOUTUBE_HTML = fs.readFileSync(path.join(__dirname, "fixtures/youtube-watch.html"), "utf8");

// Matches the extension's background.js DEFAULT_CONFIG.
const API_BASE = "https://api-lexiflow.amerai.top/lexiflow";
const APP_ORIGIN = "https://lexiflow.amerai.top";

const test = base.test.extend({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "lf-ext-"));
    // MV3 extensions need Chromium's *new* headless mode (`--headless=new`)
    // — Playwright's own `headless: true` flag uses the old headless mode,
    // which silently refuses to load extensions at all (no error, the
    // service worker just never registers). Passing `headless: false` here
    // stops Playwright injecting that old flag, and we add the new-headless
    // flag ourselves instead (skipped entirely when HEADED=1 for debugging).
    const context = await base.chromium.launchPersistentContext(userDataDir, {
      headless: false,
      acceptDownloads: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        ...(process.env.HEADED ? [] : ["--headless=new"]),
      ],
    });

    // ── Default network mocks (specs can re-register more specific routes
    //    after this fixture resolves; Playwright matches most-recently
    //    registered handlers first). ────────────────────────────────────
    await context.route("https://www.youtube.com/watch*", (route) =>
      route.fulfill({ contentType: "text/html", body: YOUTUBE_HTML })
    );
    await context.route(`${API_BASE}/jobs`, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeCompletedJobResponse()) });
    });
    await context.route(`${API_BASE}/jobs/${FAKE_JOB_ID}`, (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeCompletedJobResponse()) })
    );
    await context.route(`${API_BASE}/lists`, (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ id: "list-new", name: "New list", type: "USER_CREATED" }),
        });
      }
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([{ id: "list-1", name: "My Vocabulary", type: "USER_CREATED" }]),
      });
    });
    await context.route(/\/lists\/[^/]+\/words$/, (route) =>
      route.fulfill({ contentType: "application/json", body: "{}" })
    );
    await context.route(`${API_BASE}/tts*`, (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ url: "/media/tts/fake.mp3" }) })
    );

    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    await use(worker.url().split("/")[2]);
  },
});

// Seeds chrome.storage.local with a fake auth token + (optionally) a
// pre-tracked job, the same way the extension itself would after a real
// "Connect to LexiFlow" + "Add to LexiFlow" flow — lets specs skip the
// connect handshake and jump straight to the behaviour under test.
async function seedAuthAndJob(context, extensionId, { videoId = "test123", panelOpen = false } = {}) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.evaluate(
    ({ videoId, panelOpen }) =>
      chrome.storage.local.set({
        auth: { token: "fake-token", savedAt: Date.now() },
        jobs: {
          [videoId]: {
            jobId: "job-test-123",
            status: "completed",
            progress: 100,
            title: "Test video",
            panelOpen,
          },
        },
      }),
    { videoId, panelOpen }
  );
  await page.close();
}

module.exports = { test, expect: base.expect, seedAuthAndJob, API_BASE, APP_ORIGIN, FAKE_JOB_ID };
