import { useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────
//  Persists the "you saved N words" summary across navigation, refreshes,
//  and opening another video. It's cleared only when the user dismisses it.
// ─────────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  videoTitle?: string;
  saved: number; // words explicitly saved this watch session
  tracked: number; // words added to the "Seen" list
  at: number; // epoch ms
}

const KEY = "lexiflow_session_summary_v1";
const listeners = new Set<() => void>();
let cache: SessionSummary | null = load();

function load(): SessionSummary | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getSessionSummary(): SessionSummary | null {
  return cache;
}

export function setSessionSummary(s: SessionSummary) {
  cache = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  emit();
}

export function clearSessionSummary() {
  cache = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSessionSummary(): SessionSummary | null {
  return useSyncExternalStore(subscribe, getSessionSummary, getSessionSummary);
}
