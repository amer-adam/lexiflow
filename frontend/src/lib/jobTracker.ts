import { useSyncExternalStore } from "react";
import type { Api } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────
//  Tracks the single in-flight "add a video" job across the whole app —
//  not just while RequestView is mounted. Persisted to localStorage so it
//  survives navigation and page reloads; polling continues in the
//  background regardless of which page is open. Powers both the floating
//  JobStatusWidget (every page) and the waiting screen on RequestView.
// ─────────────────────────────────────────────────────────────────────────

export interface TrackedJob {
  jobId: string;
  title: string; // URL or filename the user submitted, for display
  status: "queued" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  queue: number;
  eta: number | null;
  startedAt: number;
}

const KEY = "lexiflow_active_job_v1";
const POLL_MS = 12_000; // 5x/min — the floating widget should feel live, not stale

let cache: TrackedJob | null = load();
const listeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setTimeout> | undefined;
// Set by RequestView while it's mounted and showing this job's waiting
// screen — lets the poller skip the completion notification when the user
// can already see the result on screen.
let onWaitingScreen = false;

function load(): TrackedJob | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function persist() {
  try {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getActiveJob(): TrackedJob | null {
  return cache;
}
export function useActiveJob(): TrackedJob | null {
  return useSyncExternalStore(subscribe, getActiveJob, getActiveJob);
}

export function setOnWaitingScreen(active: boolean) {
  onWaitingScreen = active;
}

export function clearTrackedJob() {
  cache = null;
  clearTimeout(pollTimer);
  persist();
  emit();
}

/** Start tracking a freshly-created job (called right after the create/upload call resolves). */
export function startTrackingJob(api: Api, jobId: string, title: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => { /* ignore */ });
  }
  cache = { jobId, title, status: "queued", progress: 0, queue: 0, eta: null, startedAt: Date.now() };
  persist();
  emit();
  poll(api);
}

/** Resume polling a job that was already being tracked before a page reload. */
export function resumeTracking(api: Api) {
  if (cache && cache.status !== "completed" && cache.status !== "failed") poll(api);
}

function poll(api: Api) {
  clearTimeout(pollTimer);
  const jobId = cache?.jobId;
  if (!jobId) return;
  api.getJobFresh(jobId).then((job) => {
    if (!cache || cache.jobId !== jobId) return; // tracking changed mid-flight
    if (job.status === "completed" || (job.segments?.length ?? 0) > 0) {
      cache = { ...cache, status: "completed", progress: 100 };
      persist();
      emit();
      if (!onWaitingScreen) notifyJobDone(cache);
      return;
    }
    if (job.status === "failed") {
      cache = { ...cache, status: "failed" };
      persist();
      emit();
      return;
    }
    cache = {
      ...cache,
      status: "processing",
      progress: job.progress ?? 0,
      queue: job.queueNumber ?? 0,
      eta: typeof job.eta === "number" ? job.eta : null,
    };
    persist();
    emit();
    pollTimer = setTimeout(() => poll(api), POLL_MS);
  }).catch(() => {
    pollTimer = setTimeout(() => poll(api), POLL_MS);
  });
}

function notifyJobDone(job: TrackedJob) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification("Your video is ready", {
      body: `${job.title || "Your video"} finished processing — open it to start watching.`,
    });
    n.onclick = () => window.focus();
  } catch { /* ignore */ }
}
