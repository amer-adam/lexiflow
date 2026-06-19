// ─────────────────────────────────────────────────────────────────────────
//  LexiFlow — demo data layer
//  Mirrors the real Prisma schema (VocabularyItem, VocabularyList,
//  FlashcardDeck/Flashcard with FSRS, Quiz/QuestionType, Video subtitles).
//  Everything here is illustrative sample data so the whole product can be
//  explored end-to-end without a backend.
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

// ── Character-level subtitle token (matches CharacterDisplay.vue) ──────────
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
  channel: string;
  duration: string; // mm:ss
  topic: string;
  thumbHue: number;
  newWords: number;
  knownPct: number; // % of words already in the learner's known set
  visibility: "private" | "public";
  segments?: Segment[];
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

// ── Vocabulary catalogue ────────────────────────────────────────────────────
export const VOCAB: Vocab[] = [
  { simplified: "护理师", traditional: "護理師", pinyin: "hùlǐshī", meaning: "nurse (professional)", hskLevel: 5, frequencyRank: 4210 },
  { simplified: "病床", pinyin: "bìngchuáng", meaning: "hospital bed", hskLevel: 4, frequencyRank: 6100 },
  { simplified: "医院", pinyin: "yīyuàn", meaning: "hospital", hskLevel: 1, frequencyRank: 980 },
  { simplified: "立法", pinyin: "lìfǎ", meaning: "legislation; to legislate", hskLevel: 6, frequencyRank: 5300 },
  { simplified: "改变", pinyin: "gǎibiàn", meaning: "to change; transformation", hskLevel: 3, frequencyRank: 740 },
  { simplified: "经验", pinyin: "jīngyàn", meaning: "experience", hskLevel: 3, frequencyRank: 690 },
  { simplified: "趋势", pinyin: "qūshì", meaning: "trend; tendency", hskLevel: 5, frequencyRank: 3100 },
  { simplified: "影响", pinyin: "yǐngxiǎng", meaning: "influence; to affect", hskLevel: 3, frequencyRank: 410 },
  { simplified: "风险", pinyin: "fēngxiǎn", meaning: "risk", hskLevel: 5, frequencyRank: 2900 },
  { simplified: "权益", pinyin: "quányì", meaning: "rights and interests", hskLevel: 6, frequencyRank: 4800 },
  { simplified: "标准", pinyin: "biāozhǔn", meaning: "standard; criterion", hskLevel: 4, frequencyRank: 880 },
  { simplified: "环境", pinyin: "huánjìng", meaning: "environment", hskLevel: 3, frequencyRank: 520 },
  { simplified: "照顾", pinyin: "zhàogù", meaning: "to look after; care for", hskLevel: 3, frequencyRank: 1100 },
  { simplified: "研究", pinyin: "yánjiū", meaning: "research; to study", hskLevel: 3, frequencyRank: 360 },
  { simplified: "条件", pinyin: "tiáojiàn", meaning: "condition; requirement", hskLevel: 4, frequencyRank: 700 },
  { simplified: "保护", pinyin: "bǎohù", meaning: "to protect; protection", hskLevel: 4, frequencyRank: 950 },
  { simplified: "确保", pinyin: "quèbǎo", meaning: "to ensure; guarantee", hskLevel: 5, frequencyRank: 2600 },
  { simplified: "辛苦", pinyin: "xīnkǔ", meaning: "hard; exhausting; arduous", hskLevel: 4, frequencyRank: 1500 },
  { simplified: "知道", pinyin: "zhīdào", meaning: "to know", hskLevel: 1, frequencyRank: 120 },
  { simplified: "需要", pinyin: "xūyào", meaning: "to need; to require", hskLevel: 2, frequencyRank: 150 },
];

const v = (s: string) => VOCAB.find((x) => x.simplified === s)!;

// ── A worked subtitle for the Watch demo ────────────────────────────────────
const tok = (char: string, pinyin: string, hsk: HskLevel, tr: string[]): CharToken =>
  ({ char, pinyin, hsk_level: hsk, translations: tr });

export const DEMO_SEGMENTS: Segment[] = [
  {
    start: 0, end: 4.2,
    translated_text: "Have you ever had an experience like this?",
    tokens: [
      tok("你", "nǐ", 1, ["you"]), tok("有", "yǒu", 1, ["to have"]),
      tok("这样", "zhèyàng", 2, ["like this", "such"]),
      tok("的", "de", 1, ["(possessive particle)"]),
      tok("经验", "jīngyàn", 3, ["experience"]),
      tok("吗", "ma", 1, ["(question particle)"]),
    ],
  },
  {
    start: 4.2, end: 9.6,
    translated_text: "You go to see a doctor and need to be hospitalised, but there are no beds.",
    tokens: [
      tok("去", "qù", 1, ["to go"]), tok("看病", "kànbìng", 3, ["to see a doctor"]),
      tok("需要", "xūyào", 2, ["to need"]), tok("住院", "zhùyuàn", 4, ["to be hospitalised"]),
      tok("但", "dàn", 3, ["but"]), tok("没有", "méiyǒu", 1, ["there is no"]),
      tok("病床", "bìngchuáng", 4, ["hospital bed"]),
    ],
  },
  {
    start: 9.6, end: 15.0,
    translated_text: "One big reason for this is that there are not enough nurses.",
    tokens: [
      tok("这些", "zhèxiē", 2, ["these"]), tok("状况", "zhuàngkuàng", 5, ["situation", "condition"]),
      tok("一大", "yīdà", 2, ["one major"]), tok("原因", "yuányīn", 3, ["reason", "cause"]),
      tok("就是", "jiùshì", 2, ["is precisely"]),
      tok("护理师", "hùlǐshī", 5, ["nurse"]), tok("不够", "búgòu", 3, ["not enough"]),
    ],
  },
  {
    start: 15.0, end: 21.0,
    translated_text: "Research shows that for each extra patient a nurse cares for, patient mortality risk rises 7%.",
    tokens: [
      tok("研究", "yánjiū", 3, ["research"]), tok("显示", "xiǎnshì", 4, ["to show", "to indicate"]),
      tok("护理师", "hùlǐshī", 5, ["nurse"]), tok("照顾", "zhàogù", 3, ["to care for"]),
      tok("病人", "bìngrén", 3, ["patient"]),
      tok("死亡", "sǐwáng", 5, ["death", "mortality"]), tok("风险", "fēngxiǎn", 5, ["risk"]),
      tok("增加", "zēngjiā", 3, ["to increase"]),
    ],
  },
];

// ── Video library ───────────────────────────────────────────────────────────
export const VIDEOS: VideoMeta[] = [
  { id: "nurse-ratio", title: "Why Taiwan's nurse-to-patient law matters", channel: "8分钟看农天下", duration: "8:12", topic: "News · Health policy", thumbHue: 8, newWords: 34, knownPct: 71, visibility: "public", segments: DEMO_SEGMENTS },
  { id: "street-food", title: "Eating my way through a Chengdu night market", channel: "馋猫日记", duration: "12:40", topic: "Food · Vlog", thumbHue: 32, newWords: 21, knownPct: 84, visibility: "public" },
  { id: "tea-history", title: "A short history of Chinese tea, in 6 minutes", channel: "文化小课", duration: "6:05", topic: "Culture · Documentary", thumbHue: 145, newWords: 28, knownPct: 66, visibility: "public" },
  { id: "tech-news", title: "This week in Chinese tech: chips & AI", channel: "科技快报", duration: "9:55", topic: "Technology · News", thumbHue: 205, newWords: 41, knownPct: 58, visibility: "private" },
  { id: "hsk4-dialog", title: "HSK 4 graded dialogue: making a reservation", channel: "LexiFlow Originals", duration: "4:30", topic: "Lesson · Graded", thumbHue: 250, newWords: 12, knownPct: 92, visibility: "public" },
  { id: "history-doc", title: "The Silk Road, explained for learners", channel: "历史那些事", duration: "15:20", topic: "History · Documentary", thumbHue: 38, newWords: 37, knownPct: 63, visibility: "public" },
];

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
}

const li = (s: string, fam: number, seen: number, ctx?: [string, string], src?: string): ListItem =>
  ({ vocab: v(s), familiarity: fam, seenCount: seen, contextSentence: ctx?.[0], contextTranslation: ctx?.[1], sourceVideo: src });

export const LISTS: VList[] = [
  {
    id: "saved-news", name: "Words I saved from news videos", type: "SAVED",
    description: "Tap-to-save words you flagged while watching. Each keeps the sentence it came from.",
    hasDeck: true,
    items: [
      li("护理师", 0.35, 3, ["护理师人不够", "There aren't enough nurses"], "nurse-ratio"),
      li("立法", 0.1, 1, ["已经在5月正式完成立法", "Legislation was formally completed in May"], "nurse-ratio"),
      li("风险", 0.55, 4, ["病人的死亡风险会增加", "patients' mortality risk increases"], "nurse-ratio"),
      li("趋势", 0.2, 2, ["掌握大事趋势", "grasp the trend of big events"], "nurse-ratio"),
      li("权益", 0.15, 1, ["确保每一位病人的权益", "safeguard every patient's rights"], "nurse-ratio"),
      li("条件", 0.7, 5, ["更合理的工作条件", "more reasonable working conditions"], "nurse-ratio"),
      li("影响", 0.85, 6, ["对我们有什么影响", "what impact does it have on us"], "nurse-ratio"),
    ],
  },
  {
    id: "hsk3-official", name: "HSK 3 — Official list", type: "OFFICIAL",
    description: "The standard HSK 3 vocabulary, bundled with LexiFlow. Read-only.",
    hasDeck: false,
    items: [
      li("改变", 0.6, 4), li("经验", 0.9, 7), li("影响", 0.8, 6), li("环境", 0.45, 3),
      li("照顾", 0.3, 2), li("研究", 0.5, 3), li("知道", 1, 12), li("需要", 0.95, 9),
    ],
  },
  {
    id: "seen-auto", name: "Seen while watching (auto)", type: "SEEN",
    description: "Every word LexiFlow has shown you in a subtitle, counted automatically.",
    hasDeck: false,
    items: [
      li("医院", 1, 14), li("病床", 0.4, 3), li("标准", 0.5, 4), li("保护", 0.65, 5),
      li("确保", 0.25, 2), li("辛苦", 0.55, 4), li("照顾", 0.35, 3),
    ],
  },
  {
    id: "my-travel", name: "My travel pack 🧳", type: "USER_CREATED",
    description: "A list I built by hand for an upcoming trip.",
    hasDeck: true,
    items: [
      li("医院", 0.8, 6), li("需要", 0.9, 8), li("知道", 1, 11), li("环境", 0.3, 2),
    ],
  },
];

// ── Flashcard decks (FSRS) ──────────────────────────────────────────────────
export type FsrsState = 0 | 1 | 2 | 3; // New, Learning, Review, Relearning
export const FSRS_STATE_LABEL: Record<FsrsState, string> = {
  0: "New", 1: "Learning", 2: "Review", 3: "Relearning",
};
export interface Card {
  vocab: Vocab;
  front: { character: boolean; pinyin: boolean; meaning: boolean };
  back: { character: boolean; pinyin: boolean; meaning: boolean };
  stability: number;
  difficulty: number;
  state: FsrsState;
  dueInDays: number; // negative = overdue/due now
}
export interface Deck {
  id: string;
  name: string;
  listId: string;
  cards: Card[];
}

const card = (s: string, state: FsrsState, stab: number, diff: number, due: number): Card => ({
  vocab: v(s),
  front: { character: true, pinyin: false, meaning: false },
  back: { character: false, pinyin: true, meaning: true },
  stability: stab, difficulty: diff, state, dueInDays: due,
});

export const DECKS: Deck[] = [
  {
    id: "deck-news", name: "News words", listId: "saved-news",
    cards: [
      card("护理师", 1, 1.2, 7.8, 0), card("立法", 0, 0, 5, 0), card("风险", 2, 9.4, 4.1, -1),
      card("趋势", 1, 0.8, 6.9, 0), card("权益", 0, 0, 5, 0), card("条件", 2, 16.0, 3.2, 2),
      card("影响", 2, 31.5, 2.4, 6),
    ],
  },
  {
    id: "deck-travel", name: "Travel pack", listId: "my-travel",
    cards: [
      card("医院", 2, 22.0, 2.8, 3), card("需要", 2, 40.0, 2.1, 9),
      card("知道", 2, 60.0, 1.9, 14), card("环境", 1, 0.9, 6.5, 0),
    ],
  },
];

// ── Quiz ─────────────────────────────────────────────────────────────────────
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  FILL_BLANK: "Fill in the blank",
  SHORT_ANSWER: "Short answer",
  TRUE_FALSE: "True / False",
};
export interface QuizQuestion {
  id: string;
  type: QuestionType;
  vocab: Vocab;
  prompt: string;
  options?: string[];
  answer: string;
  explanation: string;
}
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1", type: "MULTIPLE_CHOICE", vocab: v("护理师"),
    prompt: "What does 护理师 (hùlǐshī) mean?",
    options: ["nurse", "doctor", "patient", "pharmacist"],
    answer: "nurse",
    explanation: "护理 = nursing/care, 师 = a trained professional. Together: a professional nurse.",
  },
  {
    id: "q2", type: "FILL_BLANK", vocab: v("风险"),
    prompt: "病人的死亡 ___ 会增加。 (patients' mortality ___ increases)",
    answer: "风险",
    explanation: "风险 (fēngxiǎn) = risk. 死亡风险 = mortality risk.",
  },
  {
    id: "q3", type: "TRUE_FALSE", vocab: v("立法"),
    prompt: "立法 (lìfǎ) means \"to break the law\".",
    options: ["True", "False"],
    answer: "False",
    explanation: "立法 means to legislate / make law — 立 (establish) + 法 (law).",
  },
  {
    id: "q4", type: "SHORT_ANSWER", vocab: v("改变"),
    prompt: "Give the pinyin for 改变 and its English meaning.",
    answer: "gǎibiàn — to change",
    explanation: "改变 (gǎibiàn): to change / transformation. Common HSK 3 verb.",
  },
  {
    id: "q5", type: "MULTIPLE_CHOICE", vocab: v("趋势"),
    prompt: "Choose the best translation of 趋势 (qūshì).",
    options: ["trend", "speed", "promise", "fortune"],
    answer: "trend",
    explanation: "趋势 = trend / tendency, the direction in which something is developing.",
  },
];

// ── Learner snapshot for the dashboard ──────────────────────────────────────
export const LEARNER = {
  name: "Wei Chen",
  email: "wei.chen@example.com",
  streak: 12,
  wordsKnown: 642,
  wordsLearning: 88,
  dueToday: 23,
  minutesWatched: 1840,
  hskReached: 4 as HskLevel,
  hskProgress: [
    { level: 1 as HskLevel, known: 150, total: 150 },
    { level: 2 as HskLevel, known: 150, total: 150 },
    { level: 3 as HskLevel, known: 270, total: 300 },
    { level: 4 as HskLevel, known: 72, total: 600 },
    { level: 5 as HskLevel, known: 0, total: 1300 },
    { level: 6 as HskLevel, known: 0, total: 2500 },
  ],
};
