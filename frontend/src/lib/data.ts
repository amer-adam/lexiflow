// ─────────────────────────────────────────────────────────────────────────
//  Domain types + display helpers. (No sample data — the app is fully live.)
//  Shapes mirror the Prisma schema: VocabularyItem, VocabularyList,
//  FlashcardDeck/Flashcard (FSRS), Quiz/QuestionType, and video subtitles.
// ─────────────────────────────────────────────────────────────────────────

export type HskLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ListType = "USER_CREATED" | "SAVED" | "SEEN" | "OFFICIAL";
export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "FILL_BLANK"
  | "SHORT_ANSWER"
  | "TRUE_FALSE";

export interface Vocab {
  simplified: string;
  traditional?: string;
  pinyin: string;
  meaning: string;
  hskLevel: HskLevel;
  frequencyRank?: number;
}

// ── Character-level subtitle token (matches CharacterDisplay) ──────────────
export interface CharToken {
  char: string;
  pinyin: string;
  hsk_level: HskLevel;
  translations: string[];
}
export interface Segment {
  start: number;
  end: number;
  tokens: CharToken[];
  translated_text: string;
}

export interface VideoMeta {
  id: string;
  title: string;
  channel?: string;
  description?: string;
  duration: string;
  topic?: string;
  thumbnail?: string;
  thumbHue: number; // fallback colour when no thumbnail
  dateAdded?: string;
  visibility: "private" | "public";
  ownedByMe: boolean;
}

// ── HSK colour ramp ────────────────────────────────────────────────────────
export const hskColor = (lvl: HskLevel) => `hsl(var(--hsk-${lvl}))`;
export const HSK_LABELS: Record<HskLevel, string> = {
  0: "Ungraded",
  1: "HSK 1 · Beginner",
  2: "HSK 2 · Elementary",
  3: "HSK 3 · Lower-Int.",
  4: "HSK 4 · Intermediate",
  5: "HSK 5 · Upper-Int.",
  6: "HSK 6 · Advanced",
};

// ── Vocabulary lists ────────────────────────────────────────────────────────
export interface ListItem {
  vocab: Vocab;
  familiarity: number; // 0..1
  seenCount: number;
  sourceVideo?: string;
  contextSentence?: string;
  contextTranslation?: string;
}
export interface VList {
  id: string;
  name: string;
  type: ListType;
  description: string;
  items: ListItem[];
  hasDeck: boolean;
  _count?: { items: number };
}

// ── Flashcards (FSRS) ───────────────────────────────────────────────────────
export type FsrsState = 0 | 1 | 2 | 3; // New, Learning, Review, Relearning
export const FSRS_STATE_LABEL: Record<FsrsState, string> = {
  0: "New", 1: "Learning", 2: "Review", 3: "Relearning",
};
export interface Card {
  id?: string;
  vocab: Vocab;
  front: { character: boolean; pinyin: boolean; meaning: boolean; audio: boolean };
  back: { character: boolean; pinyin: boolean; meaning: boolean; audio: boolean };
  stability: number;
  difficulty: number;
  state: FsrsState;
  dueInDays: number; // <= 0 means due now
}
export interface Deck {
  id: string;
  name: string;
  listId: string;
  cards: Card[];
  _count?: { flashcards: number };
}

// ── Quiz ─────────────────────────────────────────────────────────────────────
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  SHORT_ANSWER: "Short answer",
  TRUE_FALSE: "True / False",
};
