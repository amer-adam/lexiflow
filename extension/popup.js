const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connect-btn");
const notYoutubeEl = document.getElementById("not-youtube");
const videoSection = document.getElementById("video-section");
const addBtn = document.getElementById("add-btn");
const progressEl = document.getElementById("progress");
const progressLabel = progressEl.querySelector(".lf-progress-label");
const progressFill = progressEl.querySelector(".lf-progress-fill");
const readySection = document.getElementById("ready-section");
const togglePanelBtn = document.getElementById("toggle-panel-btn");
const moreBtn = document.getElementById("more-btn");

let activeTab = null;
let currentVideoId = null;
let panelShown = false;
let pollTimer = null;

function getVideoIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname) || u.pathname !== "/watch") return null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

async function refresh() {
  const { connected } = await send({ type: "GET_AUTH_STATUS" });
  statusEl.textContent = connected ? "Connected to LexiFlow" : "Not connected";
  statusEl.classList.toggle("connected", Boolean(connected));
  connectBtn.style.display = connected ? "none" : "block";

  if (!connected) {
    videoSection.style.display = "none";
    notYoutubeEl.style.display = "none";
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  currentVideoId = tab?.url ? getVideoIdFromUrl(tab.url) : null;

  if (!currentVideoId) {
    videoSection.style.display = "none";
    notYoutubeEl.style.display = "block";
    clearInterval(pollTimer);
    return;
  }
  notYoutubeEl.style.display = "none";
  videoSection.style.display = "block";

  const { job } = await send({ type: "GET_TRACKED_JOB", videoId: currentVideoId });
  renderJob(job);
}

function renderJob(job) {
  clearInterval(pollTimer);
  if (!job) {
    addBtn.style.display = "block";
    addBtn.disabled = false;
    addBtn.textContent = "Add to LexiFlow";
    progressEl.style.display = "none";
    readySection.style.display = "none";
    return;
  }
  if (job.status === "completed" || job.status === "done") {
    addBtn.style.display = "none";
    progressEl.style.display = "none";
    readySection.style.display = "block";
    panelShown = Boolean(job.panelOpen);
    togglePanelBtn.textContent = panelShown ? "Hide transcript on video" : "Show transcript on video";
    return;
  }
  if (job.status === "failed") {
    addBtn.style.display = "block";
    addBtn.disabled = false;
    addBtn.textContent = "Try again";
    progressEl.style.display = "none";
    readySection.style.display = "none";
    return;
  }
  // queued / processing
  addBtn.style.display = "none";
  readySection.style.display = "none";
  progressEl.style.display = "block";
  const pct = job.progress ?? 0;
  progressLabel.textContent = job.status === "queued" ? "Queued…" : `Processing… ${pct}%`;
  progressFill.style.width = `${pct}%`;
  pollTimer = setInterval(async () => {
    const { job: updated } = await send({ type: "POLL_JOB", videoId: currentVideoId });
    renderJob(updated);
  }, 4000);
}

connectBtn.addEventListener("click", async () => {
  const { config } = await send({ type: "GET_CONFIG" });
  chrome.tabs.create({ url: `${config.appOrigin}/extension-connect` });
});

addBtn.addEventListener("click", async () => {
  if (!currentVideoId || !activeTab?.url) return;
  addBtn.disabled = true;
  addBtn.textContent = "Submitting…";
  const { job, error } = await send({ type: "SUBMIT_JOB", videoId: currentVideoId, url: activeTab.url });
  if (error) {
    addBtn.disabled = false;
    addBtn.textContent = "Try again";
    return;
  }
  renderJob(job);
});

togglePanelBtn.addEventListener("click", async () => {
  panelShown = !panelShown;
  await send({ type: "SET_PANEL_OPEN", videoId: currentVideoId, open: panelShown });
  if (activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, { type: "LEXIFLOW_TOGGLE_PANEL", open: panelShown });
  }
  togglePanelBtn.textContent = panelShown ? "Hide transcript on video" : "Show transcript on video";
});

moreBtn.addEventListener("click", async () => {
  const { config } = await send({ type: "GET_CONFIG" });
  const { job } = await send({ type: "GET_TRACKED_JOB", videoId: currentVideoId });
  if (!job) return;
  chrome.tabs.sendMessage(activeTab.id, { type: "LEXIFLOW_GET_CURRENT_TIME" }, (res) => {
    const t = res?.time ? Math.floor(res.time) : 0;
    chrome.tabs.create({ url: `${config.appOrigin}/?id=${job.jobId}&t=${t}` });
  });
});

refresh();
