import { useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────
//  User settings — persisted to localStorage and applied across the app.
//  These are real, usable preferences (not decoration): the Watch player reads
//  its subtitle defaults from here, and the dashboard reads the daily goal.
// ─────────────────────────────────────────────────────────────────────────

export type Lang = "en" | "es" | "fr" | "ar" | "de" | "ja";
export const LANGUAGES: { code: Lang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "ar", name: "العربية" },
];

export interface Settings {
  translationLanguage: Lang;
  // Watch player defaults
  showPinyin: boolean;
  showCharacters: boolean;
  showTranslation: boolean;
  showHskColors: boolean;
  autoLoopLine: boolean;
  autoPauseAtLineEnd: boolean;
  subtitleScale: number; // 0.8 – 1.6
  subtitleBgOpacity: number; // 0-100, theater mode background
  subtitlePositionY: number; // 5-95%, theater mode vertical position
  // Study
  dailyGoal: number; // cards per day
  // Library
  libraryTitlesEnglish: boolean; // show translated (vs original) video titles
}

export const DEFAULT_SETTINGS: Settings = {
  translationLanguage: "en",
  showPinyin: true,
  showCharacters: true,
  showTranslation: true,
  showHskColors: true,
  autoLoopLine: false,
  autoPauseAtLineEnd: false,
  subtitleScale: 1,
  subtitleBgOpacity: 55,
  subtitlePositionY: 82,
  dailyGoal: 20,
  libraryTitlesEnglish: false,
};

const KEY = "lexiflow_settings_v1";
const listeners = new Set<() => void>();
let cache: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getSettings(): Settings {
  return cache;
}

export function updateSettings(patch: Partial<Settings>) {
  cache = { ...cache, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  emit();
}

export function resetSettings() {
  cache = { ...DEFAULT_SETTINGS };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive hook — re-renders any component when settings change. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
