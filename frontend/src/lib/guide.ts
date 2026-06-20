import {
  Sparkles,
  Library,
  Play,
  Film,
  BookOpenCheck,
  Layers,
  CheckSquare,
  User,
  type LucideIcon,
} from "lucide-react";
import type { ViewId } from "@/app/nav";

export interface GuideStep {
  id: string;
  /** If set, the tour navigates the app to this page while the step is open. */
  view?: ViewId;
  icon: LucideIcon;
  title: string;
  body: string;
  bullets?: string[];
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Welcome to LexiFlow",
    body: "A quick tour of how everything fits together — add a video, tap words as you watch, then drill them into memory. Takes about a minute.",
  },
  {
    id: "library",
    view: "library",
    icon: Library,
    title: "Library",
    body: "Every video you've added lives here. Search, filter by HSK level, and pick up where you left off — your watch progress is tracked automatically.",
  },
  {
    id: "watch",
    view: "watch",
    icon: Play,
    title: "Watch & tap words",
    body: "Interactive subtitles run alongside the video. Tap any character to see its pinyin and meaning, then save it straight to a vocabulary list.",
    bullets: [
      "Colour-coded by HSK difficulty, easiest to hardest",
      "Loop or auto-pause on a line to catch every syllable",
    ],
  },
  {
    id: "request",
    view: "request",
    icon: Film,
    title: "Add a video",
    body: "Paste a YouTube link or upload your own file. LexiFlow fetches or generates subtitles so it's ready to study.",
  },
  {
    id: "vocab",
    view: "vocab",
    icon: BookOpenCheck,
    title: "Vocabulary lists",
    body: "Words you save are organised into lists automatically, grouped by the video and HSK level they came from.",
  },
  {
    id: "flashcards",
    view: "flashcards",
    icon: Layers,
    title: "Flashcards",
    body: "Turn saved words into spaced-repetition flashcards — the app schedules reviews right when you're about to forget a word, not before.",
  },
  {
    id: "quiz",
    view: "quiz",
    icon: CheckSquare,
    title: "Quizzes",
    body: "Adaptive quizzes pull from your own vocabulary to test recall, so practice always matches what you're actually learning.",
  },
  {
    id: "profile",
    view: "profile",
    icon: User,
    title: "Profile & settings",
    body: "Set your daily review goal, translation language, and subtitle defaults — every player session uses these automatically.",
  },
];

const KEY_PREFIX = "lexiflow_guide_seen_v1";

function guideSeenKey(email?: string) {
  return email ? `${KEY_PREFIX}:${email}` : KEY_PREFIX;
}

export function hasSeenGuide(email?: string): boolean {
  try {
    return localStorage.getItem(guideSeenKey(email)) === "1";
  } catch {
    return true;
  }
}

export function markGuideSeen(email?: string) {
  try {
    localStorage.setItem(guideSeenKey(email), "1");
  } catch {
    /* ignore */
  }
}
