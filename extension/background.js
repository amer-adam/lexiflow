// ─────────────────────────────────────────────────────────────────────────
//  LexiFlow extension background service worker.
//  Holds the Auth0 token (relayed from the web app), proxies all API calls
//  to the LexiFlow Node backend, and drives job-status polling via
//  chrome.alarms (service workers can't rely on long-lived setInterval).
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  apiBase: "https://api-test.amerai.top/lexiflow",
  appOrigin: "https://test.amerai.top",
};

async function getConfig() {
  const { config } = await chrome.storage.local.get("config");
  return { ...DEFAULT_CONFIG, ...(config ?? {}) };
}

async function getToken() {
  const { auth } = await chrome.storage.local.get("auth");
  return auth?.token ?? null;
}

async function apiFetch(path, init = {}) {
  const [{ apiBase }, token] = await Promise.all([getConfig(), getToken()]);
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Job tracking (per YouTube video id), persisted in chrome.storage.local ──
async function getTrackedJobs() {
  const { jobs } = await chrome.storage.local.get("jobs");
  return jobs ?? {};
}
async function setTrackedJob(videoId, job) {
  const jobs = await getTrackedJobs();
  jobs[videoId] = job;
  await chrome.storage.local.set({ jobs });
}

async function submitJob(videoId, url) {
  const res = await apiFetch("/jobs", { method: "POST", body: JSON.stringify({ url }) });
  const job = { jobId: res.job_id, status: res.status ?? "queued", progress: 0, title: res.title, thumbnail: res.thumbnail, panelOpen: false };
  await setTrackedJob(videoId, job);
  ensurePolling();
  return job;
}

async function pollJob(videoId) {
  const jobs = await getTrackedJobs();
  const tracked = jobs[videoId];
  if (!tracked) return null;
  const raw = await apiFetch(`/jobs/${tracked.jobId}`);
  const segs = raw?.result?.segments ?? raw?.segments ?? [];
  const updated = {
    ...tracked,
    status: raw.status,
    progress: raw.progress ?? tracked.progress,
    segments: segs.length ? segs : tracked.segments,
    title: raw.title ?? raw.result?.title ?? tracked.title,
  };
  await setTrackedJob(videoId, updated);
  return updated;
}

async function ensurePolling() {
  const existing = await chrome.alarms.get("poll-jobs");
  if (!existing) chrome.alarms.create("poll-jobs", { periodInMinutes: 0.166 }); // ~10s
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "poll-jobs") return;
  const jobs = await getTrackedJobs();
  const pending = Object.entries(jobs).filter(([, j]) => j.status !== "completed" && j.status !== "failed" && j.status !== "done");
  if (pending.length === 0) {
    chrome.alarms.clear("poll-jobs");
    return;
  }
  await Promise.all(pending.map(([videoId]) => pollJob(videoId).catch(() => null)));
});

// ── Message router — content scripts / popup talk to this worker only ──────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "SET_TOKEN": {
          await chrome.storage.local.set({ auth: { token: msg.token, savedAt: Date.now() } });
          sendResponse({ ok: true });
          break;
        }
        case "GET_AUTH_STATUS": {
          const token = await getToken();
          sendResponse({ ok: true, connected: Boolean(token) });
          break;
        }
        case "GET_CONFIG": {
          sendResponse({ ok: true, config: await getConfig() });
          break;
        }
        case "SUBMIT_JOB": {
          const job = await submitJob(msg.videoId, msg.url);
          sendResponse({ ok: true, job });
          break;
        }
        case "GET_TRACKED_JOB": {
          const jobs = await getTrackedJobs();
          sendResponse({ ok: true, job: jobs[msg.videoId] ?? null });
          break;
        }
        case "SET_PANEL_OPEN": {
          const jobs = await getTrackedJobs();
          const job = jobs[msg.videoId];
          if (job) await setTrackedJob(msg.videoId, { ...job, panelOpen: msg.open });
          sendResponse({ ok: true });
          break;
        }
        case "POLL_JOB": {
          const job = await pollJob(msg.videoId);
          sendResponse({ ok: true, job });
          break;
        }
        case "DICTIONARY": {
          const entry = await apiFetch(`/dictionary?word=${encodeURIComponent(msg.word)}`);
          sendResponse({ ok: true, entry });
          break;
        }
        case "SPEAK": {
          const { apiBase } = await getConfig();
          const r = await apiFetch(`/tts?text=${encodeURIComponent(msg.text)}`);
          const url = r.url.startsWith("http") ? r.url : `${apiBase.replace(/\/lexiflow$/, "")}${r.url}`;
          sendResponse({ ok: true, url });
          break;
        }
        default:
          sendResponse({ ok: false, error: "unknown message type" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message ?? e) });
    }
  })();
  return true; // keep the message channel open for the async response
});
