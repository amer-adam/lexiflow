// ─────────────────────────────────────────────────────────────────────────
//  LexiFlow YouTube overlay. Injected on *.youtube.com/watch* pages.
//  Mirrors TheaterOverlay + SubtitleSettings in
//  frontend/src/views/WatchView.tsx: one unified, draggable subtitle bar
//  (no per-token boxes) plus an auto-hiding playback control pill
//  (prev/play/next/replay/loop/pause-at-end/settings). All job/account
//  controls (connect, add video, progress) live in the popup — this script
//  only ever draws the subtitle overlay once a job is ready.
// ─────────────────────────────────────────────────────────────────────────

const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

const DEFAULT_SETTINGS = {
  showPinyin: true,
  showCharacters: true,
  showTranslation: true,
  showHskColors: true,
  subtitleScale: 1, // 0.8 - 1.6
  subtitleBgOpacity: 55, // 0 - 100
  subtitlePositionY: 82, // 5 - 95, % from top
  autoLoopLine: false,
  autoPauseAtLineEnd: false,
};
async function getSettings() {
  const { playerSettings } = await chrome.storage.local.get("playerSettings");
  return { ...DEFAULT_SETTINGS, ...(playerSettings ?? {}) };
}
async function updateSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ playerSettings: next });
  return next;
}

function getVideoId() {
  return new URLSearchParams(window.location.search).get("v");
}
function getVideoEl() {
  return document.querySelector("video.html5-main-video") || document.querySelector("video");
}
const hskColor = (lvl) => `hsl(var(--hsk-${lvl ?? 0}))`;

let root, host, stage, barWrap, bar, panelBody, translationEl, progressEl;
let controlsEl, settingsPopover;
let currentVideoId = null;
let lastSegments = null;
let lastJobId = null;
let activeSegIdx = -1;
let settings = DEFAULT_SETTINGS;
let hideTimer = null;

async function ensureHost() {
  if (host) return;
  const player = document.querySelector("#movie_player") || document.querySelector("#player") || document.body;
  host = document.createElement("div");
  host.id = "lexiflow-overlay-host";
  host.style.position = "absolute";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  // YouTube's own player layers (controls, captions, gradients) declare
  // their own z-index, so a sibling with no z-index of its own — even
  // appended last — renders *underneath* them. Outbid every layer.
  host.style.zIndex = "2147483000";
  player.style.position = player.style.position || "relative";
  player.appendChild(host);
  root = host.attachShadow({ mode: "open" });

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("content/overlay.css");
  root.appendChild(link);

  settings = await getSettings();
  buildStage();
}

function icon(name) {
  const paths = {
    prev: '<path d="M6 5h2v14H6zM18 5l-9 7 9 7z"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    next: '<path d="M16 5h2v14h-2zM6 5l9 7-9 7z"/>',
    replay: '<path d="M12 5V2L7 7l5 5V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/>',
    repeat: '<path d="M17 2l4 4-4 4V8H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5h10zm-10 20l-4-4 4-4v2h10a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5H7z"/>',
    pauseEnd: '<rect x="4" y="4" width="6" height="16"/><rect x="14" y="4" width="6" height="16"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4a8.8 8.8 0 0 0-.15-1.6l2.1-1.65-2-3.45-2.45 1a8.6 8.6 0 0 0-2.8-1.6L15.3 2h-4.6l-.4 2.7a8.6 8.6 0 0 0-2.8 1.6l-2.45-1-2 3.45 2.1 1.65A8.8 8.8 0 0 0 3 12c0 .55.05 1.1.15 1.6l-2.1 1.65 2 3.45 2.45-1c.8.7 1.75 1.25 2.8 1.6l.4 2.7h4.6l.4-2.7a8.6 8.6 0 0 0 2.8-1.6l2.45 1 2-3.45-2.1-1.65c.1-.5.15-1.05.15-1.6z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" fill="none"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="currentColor">${paths[name] ?? ""}</svg>`;
}

function buildStage() {
  stage = document.createElement("div");
  stage.className = "lf-stage";
  stage.style.display = "none";
  stage.addEventListener("mousemove", showControlsTemporarily);
  stage.addEventListener("mouseenter", showControlsTemporarily);

  progressEl = document.createElement("div");
  progressEl.className = "lf-progress";
  progressEl.style.display = "none";
  stage.appendChild(progressEl);

  // ── Subtitle bar ──────────────────────────────────────────────────────
  barWrap = document.createElement("div");
  barWrap.className = "lf-bar-wrap";
  barWrap.style.display = "none";

  bar = document.createElement("div");
  bar.className = "lf-bar";

  const dragHandle = document.createElement("div");
  dragHandle.className = "lf-drag-handle";
  dragHandle.innerHTML = "<span></span><span></span><span></span>";
  bindDrag(dragHandle);
  bar.appendChild(dragHandle);

  panelBody = document.createElement("div");
  panelBody.className = "lf-panel-body";
  bar.appendChild(panelBody);

  translationEl = document.createElement("div");
  translationEl.className = "lf-translation";
  bar.appendChild(translationEl);

  barWrap.appendChild(bar);
  stage.appendChild(barWrap);

  // ── Auto-hiding controls ─────────────────────────────────────────────
  controlsEl = document.createElement("div");
  controlsEl.className = "lf-controls";
  controlsEl.style.display = "none";

  const inner = document.createElement("div");
  inner.className = "lf-controls-inner";

  const mkBtn = (name, title, onClick) => {
    const b = document.createElement("button");
    b.className = "lf-icon-btn";
    b.title = title;
    b.innerHTML = icon(name);
    b.addEventListener("click", onClick);
    return b;
  };

  const prevBtn = mkBtn("prev", "Previous line", () => jumpSeg(-1));
  const playBtn = mkBtn("play", "Play / pause", () => {
    const v = getVideoEl();
    if (!v) return;
    v.paused ? v.play() : v.pause();
  });
  const nextBtn = mkBtn("next", "Next line", () => jumpSeg(1));
  const replayBtn = mkBtn("replay", "Replay this line", replaySegment);
  const loopBtn = mkBtn("repeat", "Loop this line", async () => {
    settings = await updateSettings({ autoLoopLine: !settings.autoLoopLine, autoPauseAtLineEnd: false });
    syncToggleButtons();
  });
  const pauseEndBtn = mkBtn("pauseEnd", "Pause at end of line", async () => {
    settings = await updateSettings({ autoPauseAtLineEnd: !settings.autoPauseAtLineEnd, autoLoopLine: false });
    syncToggleButtons();
  });
  const settingsBtn = mkBtn("settings", "Subtitle settings", (e) => { e.stopPropagation(); toggleSettingsPopover(); });
  const closeBtn = mkBtn("close", "Hide", () => {
    stage.style.display = "none";
    send({ type: "SET_PANEL_OPEN", videoId: currentVideoId, open: false });
  });

  [prevBtn, playBtn, nextBtn, replayBtn, loopBtn, pauseEndBtn, settingsBtn, closeBtn].forEach((b) => inner.appendChild(b));
  inner.dataset.loopBtn = "";
  controlsEl._loopBtn = loopBtn;
  controlsEl._pauseEndBtn = pauseEndBtn;
  controlsEl._playBtn = playBtn;
  controlsEl._settingsBtn = settingsBtn;

  controlsEl.appendChild(inner);
  buildSettingsPopover();
  inner.appendChild(settingsPopover);
  stage.appendChild(controlsEl);

  stage.addEventListener("click", (e) => {
    if (settingsPopover.style.display === "block" && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
      settingsPopover.style.display = "none";
    }
  });

  root.appendChild(stage);
  syncToggleButtons();
}

function syncToggleButtons() {
  if (!controlsEl) return;
  controlsEl._loopBtn.classList.toggle("active", settings.autoLoopLine);
  controlsEl._pauseEndBtn.classList.toggle("active", settings.autoPauseAtLineEnd);
}

function showControlsTemporarily() {
  if (!controlsEl) return;
  controlsEl.style.display = "flex";
  controlsEl.classList.remove("hidden");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (settingsPopover.style.display === "block") return;
    controlsEl.classList.add("hidden");
  }, 2500);
}

// ── Settings popover, mirrors SubtitleSettings in WatchView.tsx ──────────
function buildSettingsPopover() {
  settingsPopover = document.createElement("div");
  settingsPopover.className = "lf-settings-popover";
  settingsPopover.style.display = "none";
  settingsPopover.addEventListener("click", (e) => e.stopPropagation());
  renderSettingsPopover();
}

// Built once; subsequent calls only patch the bits that changed instead of
// recreating the DOM, since rebuilding a <input type="range"> out from
// under an in-progress drag kills the native slider interaction.
let switchEls = {};
let sizeValueEl, sizeInputEl, bgValueEl, bgInputEl;

function renderSettingsPopover() {
  if (settingsPopover.childElementCount > 0) {
    // Already built — just sync values (e.g. after a toggle click).
    Object.entries(switchEls).forEach(([key, el]) => el.classList.toggle("on", settings[key]));
    sizeValueEl.textContent = `${Math.round(settings.subtitleScale * 100)}%`;
    sizeInputEl.value = settings.subtitleScale;
    bgValueEl.textContent = `${settings.subtitleBgOpacity}%`;
    bgInputEl.value = settings.subtitleBgOpacity;
    return;
  }

  const h = document.createElement("h4");
  h.textContent = "Subtitle settings";
  settingsPopover.appendChild(h);

  const toggles = [
    ["Show pinyin", "showPinyin"],
    ["Show characters", "showCharacters"],
    ["Show translation", "showTranslation"],
    ["Colour by HSK level", "showHskColors"],
  ];
  toggles.forEach(([label, key]) => {
    const row = document.createElement("div");
    row.className = "lf-settings-row";
    const span = document.createElement("span");
    span.textContent = label;
    const sw = document.createElement("button");
    sw.className = `lf-switch${settings[key] ? " on" : ""}`;
    sw.addEventListener("click", async () => {
      settings = await updateSettings({ [key]: !settings[key] });
      renderSettingsPopover();
      renderActiveSegment(activeSegIdx, true);
    });
    switchEls[key] = sw;
    row.appendChild(span);
    row.appendChild(sw);
    settingsPopover.appendChild(row);
  });

  const sizeRow = document.createElement("div");
  sizeRow.className = "lf-slider-row";
  const sizeLabel = document.createElement("div");
  sizeLabel.className = "lf-slider-label";
  sizeLabel.innerHTML = `<span>Subtitle size</span><span></span>`;
  sizeValueEl = sizeLabel.lastElementChild;
  sizeValueEl.textContent = `${Math.round(settings.subtitleScale * 100)}%`;
  sizeInputEl = document.createElement("input");
  sizeInputEl.type = "range";
  sizeInputEl.min = "0.8";
  sizeInputEl.max = "1.6";
  sizeInputEl.step = "0.1";
  sizeInputEl.value = settings.subtitleScale;
  sizeInputEl.addEventListener("input", (e) => {
    settings = { ...settings, subtitleScale: +e.target.value };
    sizeValueEl.textContent = `${Math.round(settings.subtitleScale * 100)}%`;
    applyBarStyle();
  });
  sizeInputEl.addEventListener("change", (e) => updateSettings({ subtitleScale: +e.target.value }));
  sizeRow.appendChild(sizeLabel);
  sizeRow.appendChild(sizeInputEl);
  settingsPopover.appendChild(sizeRow);

  const bgRow = document.createElement("div");
  bgRow.className = "lf-slider-row";
  const bgLabel = document.createElement("div");
  bgLabel.className = "lf-slider-label";
  bgLabel.innerHTML = `<span>Background</span><span></span>`;
  bgValueEl = bgLabel.lastElementChild;
  bgValueEl.textContent = `${settings.subtitleBgOpacity}%`;
  bgInputEl = document.createElement("input");
  bgInputEl.type = "range";
  bgInputEl.min = "0";
  bgInputEl.max = "100";
  bgInputEl.value = settings.subtitleBgOpacity;
  bgInputEl.addEventListener("input", (e) => {
    settings = { ...settings, subtitleBgOpacity: +e.target.value };
    bgValueEl.textContent = `${settings.subtitleBgOpacity}%`;
    applyBarStyle();
  });
  bgInputEl.addEventListener("change", (e) => updateSettings({ subtitleBgOpacity: +e.target.value }));
  bgRow.appendChild(bgLabel);
  bgRow.appendChild(bgInputEl);
  settingsPopover.appendChild(bgRow);
}

function toggleSettingsPopover() {
  const open = settingsPopover.style.display === "block";
  settingsPopover.style.display = open ? "none" : "block";
}

function applyBarStyle() {
  bar.style.background = `rgba(0,0,0,${settings.subtitleBgOpacity / 100})`;
  bar.style.fontSize = `${settings.subtitleScale}rem`;
  barWrap.style.top = `${settings.subtitlePositionY}%`;
}

// ── Drag the subtitle bar vertically, persisted as subtitlePositionY ────
function bindDrag(handle) {
  let dragging = false;
  let stageRect = null;
  const onMove = (e) => {
    if (!dragging || !stageRect) return;
    const pct = ((e.clientY - stageRect.top) / stageRect.height) * 100;
    settings.subtitlePositionY = Math.max(5, Math.min(95, pct));
    barWrap.style.top = `${settings.subtitlePositionY}%`;
  };
  const onUp = async () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    settings = await updateSettings({ subtitlePositionY: settings.subtitlePositionY });
  };
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    stageRect = stage.getBoundingClientRect();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function showProgress(job) {
  stage.style.display = "block";
  barWrap.style.display = "none";
  controlsEl.style.display = "none";
  progressEl.style.display = "block";
  progressEl.textContent = job.status === "failed" ? "Processing failed for this video." : `Processing… ${job.progress ?? 0}%`;
}

// ── Transcript playback: timeupdate-driven segment sync + loop/pause ────
function renderTranscript(job) {
  lastSegments = job.segments ?? [];
  lastJobId = job.jobId;
  stage.style.display = "block";
  progressEl.style.display = "none";
  barWrap.style.display = "block";
  controlsEl.style.display = "flex";
  applyBarStyle();
  showControlsTemporarily();
  activeSegIdx = -1;
  renderActiveSegment(0);

  const video = getVideoEl();
  if (video && !video.dataset.lexiflowBound) {
    video.dataset.lexiflowBound = "1";
    video.addEventListener("timeupdate", () => {
      const t = video.currentTime;
      const segs = lastSegments ?? [];
      const idx = segs.findIndex((s) => t >= s.start && t <= s.end);
      if (idx >= 0 && idx !== activeSegIdx) renderActiveSegment(idx);

      const seg = idx >= 0 ? segs[idx] : null;
      if (seg && t >= seg.end - 0.05) {
        if (settings.autoLoopLine) video.currentTime = seg.start;
        else if (settings.autoPauseAtLineEnd) video.pause();
      }
    });
    video.addEventListener("play", () => controlsEl._playBtn.innerHTML = icon("pause"));
    video.addEventListener("pause", () => controlsEl._playBtn.innerHTML = icon("play"));
  }
}

function renderActiveSegment(idx, force = false) {
  if (!force && (idx === activeSegIdx || !lastSegments?.[idx])) return;
  if (!lastSegments?.[idx]) return;
  activeSegIdx = idx;
  const seg = lastSegments[idx];
  panelBody.innerHTML = "";
  // `characters` is keyed by whole tokenized words (e.g. "认为"), not by
  // single hanzi — mirrors mapSegment in frontend/src/lib/api.ts:96-110.
  // Splitting seg.text char-by-char and looking each one up here was wrong:
  // it missed every multi-character word's entry entirely.
  const chars = seg.characters ?? {};
  const tokens = Object.keys(chars).map((key) => ({
    char: String(key).replace(/[[\]]/g, ""),
    pinyin: String(chars[key]?.pinyin ?? "").replace(/[[\]]/g, ""),
    hsk_level: chars[key]?.hsk_level ?? 0,
    translations: chars[key]?.translations ?? [],
  }));

  tokens.forEach((tok) => {
    const btn = document.createElement("button");
    btn.className = "lf-tok";

    if (settings.showPinyin) {
      const py = document.createElement("span");
      py.className = "lf-pinyin";
      py.style.color = settings.showHskColors ? hskColor(tok.hsk_level) : "#fff";
      py.textContent = tok.pinyin;
      btn.appendChild(py);
    }
    if (settings.showCharacters) {
      const charEl = document.createElement("span");
      charEl.className = "lf-char";
      charEl.style.color = settings.showHskColors ? hskColor(tok.hsk_level) : "#fff";
      charEl.textContent = tok.char;
      btn.appendChild(charEl);
    }

    btn.addEventListener("mouseenter", (e) => showTooltip(e, tok.char, tok));
    btn.addEventListener("mouseleave", hideTooltip);
    btn.addEventListener("click", () => speak(tok.char));
    panelBody.appendChild(btn);
  });

  translationEl.style.display = settings.showTranslation && seg.translated_text ? "block" : "none";
  translationEl.textContent = seg.translated_text ?? "";
}

function jumpSeg(dir) {
  if (!lastSegments?.length) return;
  const idx = Math.max(0, Math.min(lastSegments.length - 1, activeSegIdx + dir));
  const video = getVideoEl();
  if (!video) return;
  video.currentTime = lastSegments[idx].start + 0.01;
  renderActiveSegment(idx, true);
}
function replaySegment() {
  if (!lastSegments?.[activeSegIdx]) return;
  const video = getVideoEl();
  if (!video) return;
  video.currentTime = lastSegments[activeSegIdx].start;
  video.play();
}

let tooltipEl = null;
function showTooltip(e, char, meta) {
  hideTooltip();
  const r = e.currentTarget.getBoundingClientRect();
  tooltipEl = document.createElement("div");
  tooltipEl.className = "lf-tooltip";
  tooltipEl.style.left = `${r.left + r.width / 2}px`;
  tooltipEl.style.top = `${r.top}px`;

  const head = document.createElement("div");
  head.className = "lf-tt-head";
  const charSpan = document.createElement("span");
  charSpan.className = "lf-tt-char";
  charSpan.textContent = char;
  const pinyinSpan = document.createElement("span");
  pinyinSpan.textContent = meta?.pinyin ?? "";
  head.appendChild(charSpan);
  head.appendChild(pinyinSpan);
  if (meta?.hsk_level != null) {
    const pill = document.createElement("span");
    pill.className = "lf-pill";
    pill.style.background = hskColor(meta.hsk_level);
    pill.textContent = meta.hsk_level === 0 ? "—" : `HSK ${meta.hsk_level}`;
    head.appendChild(pill);
  }
  tooltipEl.appendChild(head);

  const body = document.createElement("div");
  body.textContent = (meta?.translations ?? []).join("; ") || "No dictionary entry";
  tooltipEl.appendChild(body);

  root.appendChild(tooltipEl);
}
function hideTooltip() {
  tooltipEl?.remove();
  tooltipEl = null;
}

async function speak(text) {
  const { url, error } = await send({ type: "SPEAK", text });
  if (error || !url) return;
  new Audio(url).play().catch(() => {});
}

// ── Reacts to the popup's "show/hide transcript" toggle and reads back the
//    current playback time for the "Open in LexiFlow" deep link. ──────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "LEXIFLOW_TOGGLE_PANEL") {
    (async () => {
      await ensureHost();
      if (!msg.open) {
        stage.style.display = "none";
        return;
      }
      const { job } = await send({ type: "GET_TRACKED_JOB", videoId: getVideoId() });
      if (!job) return;
      if (job.status === "completed" || job.status === "done") renderTranscript(job);
      else showProgress(job);
    })();
  } else if (msg.type === "LEXIFLOW_GET_CURRENT_TIME") {
    sendResponse({ time: getVideoEl()?.currentTime ?? 0 });
  }
});

// React to job updates (progress ticks, completion) while the panel is open,
// without polling ourselves — the background worker is the only poller.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.jobs && currentVideoId && stage && stage.style.display !== "none") {
    const job = changes.jobs.newValue?.[currentVideoId];
    if (job) {
      if (job.status === "completed" || job.status === "done") {
        if (job.jobId !== lastJobId) renderTranscript(job);
      } else {
        showProgress(job);
      }
    }
  }
});

// YouTube is an SPA — watch for video-id changes without a full reload.
let lastSeenVideoId = null;
async function tick() {
  const videoId = getVideoId();
  if (!videoId || videoId === lastSeenVideoId) return;
  lastSeenVideoId = videoId;
  currentVideoId = videoId;
  lastJobId = null;
  await ensureHost();
  stage.style.display = "none";

  const { job } = await send({ type: "GET_TRACKED_JOB", videoId });
  if (job?.panelOpen && (job.status === "completed" || job.status === "done")) renderTranscript(job);
  else if (job?.panelOpen) showProgress(job);
}
setInterval(tick, 1000);
tick();
