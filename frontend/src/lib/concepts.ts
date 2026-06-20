// ─────────────────────────────────────────────────────────────────────────
//  Concept glossary
//  Every domain term in LexiFlow that a first-time user might not know is
//  defined once here, then surfaced anywhere via <InfoTip id=…/>.
//  Keep each entry: a short title, a one-line "what", and a "why it matters".
// ─────────────────────────────────────────────────────────────────────────

export interface Concept {
  title: string;
  what: string;
  why: string;
  more?: string[];
}

export const CONCEPTS: Record<string, Concept> = {
  lexiflow: {
    title: "What is LexiFlow?",
    what: "A tool for learning Mandarin Chinese from real video. You give it a YouTube link or a file; it transcribes the audio, translates it, and turns every line into an interactive, tappable subtitle.",
    why: "Learners remember words far better in context than from isolated lists. LexiFlow turns any video you enjoy into graded study material — then helps you keep the words with flashcards and quizzes.",
    more: [
      "Pipeline: Watch → Save words → Build lists → Drill with flashcards → Test with quizzes.",
      "All Chinese text is colour-coded by difficulty (HSK level) so your blind spots are always visible.",
    ],
  },
  hsk: {
    title: "HSK levels (难度分级)",
    what: "HSK (Hànyǔ Shuǐpíng Kǎoshì) is the official Chinese proficiency scale. It runs from HSK 1 (beginner, ~150 words) to HSK 6 (advanced, ~5,000+ words).",
    why: "LexiFlow colours every character by its HSK level, so at a glance you can tell which words are within your level and which are stretch vocabulary worth saving.",
    more: [
      "Green → red = easy → hard (HSK 1 → 6).",
      "Grey means the word isn't on an official HSK list (e.g. names, slang).",
    ],
  },
  tapLookup: {
    title: "Tap-to-look-up",
    what: "While watching, hover or tap any Chinese character in a subtitle to see its pinyin, meaning, and HSK level instantly — no need to leave the video.",
    why: "Removes the biggest friction in immersion learning: stopping to open a dictionary. One tap also lets you save the word with the exact sentence it appeared in.",
  },
  pinyin: {
    title: "Pinyin",
    what: "The standard romanisation of Mandarin pronunciation. Tone marks (like ā á ǎ à) show which of the four tones to use.",
    why: "Lets learners read the pronunciation before they've memorised a character. LexiFlow can show or hide the pinyin row so you can test yourself.",
  },
  contextSentence: {
    title: "Context sentence",
    what: "When you save a word, LexiFlow stores the exact subtitle line it came from, plus that line's translation.",
    why: "A word remembered with a real sentence sticks far better than a bare definition. The context also disambiguates words that have several meanings.",
  },
  listTypes: {
    title: "The four list types",
    what: "Every vocabulary list has a type that says where it came from.",
    why: "It keeps automatically-tracked words separate from the lists you curate, so your study material stays meaningful.",
    more: [
      "USER_CREATED — a list you built by hand.",
      "SAVED — words you tapped to save while watching.",
      "SEEN — auto-collected: every word a subtitle has ever shown you.",
      "OFFICIAL — bundled reference lists like the HSK levels (read-only).",
    ],
  },
  importList: {
    title: "Import a list",
    what: "Load a list someone shared with you back into LexiFlow — accepts .csv (full fidelity) or .txt (the Anki export format).",
    why: "Export → send the file → import is the easiest way to share a vocabulary list between two LexiFlow users, no account linking needed.",
    more: [
      "Only .csv and .txt are supported — both match this app's own export formats exactly.",
      "Importing always creates a brand-new list; it never merges into an existing one.",
    ],
  },
  familiarity: {
    title: "Familiarity score",
    what: "A 0–100% estimate of how well you know a word, based on how often you've seen it and how your flashcard reviews have gone.",
    why: "Drives sorting and filtering — you can instantly surface the words you're weakest on and ignore the ones you've mastered.",
  },
  srs: {
    title: "Spaced repetition (SRS)",
    what: "A review schedule that shows you a card again right before you're likely to forget it — soon for new words, then at growing intervals (1 day, 3 days, a week, a month…).",
    why: "It's the most efficient known way to move vocabulary into long-term memory: you spend review time only on words that actually need it.",
  },
  fsrs: {
    title: "FSRS algorithm",
    what: "Free Spaced Repetition Scheduler — the modern algorithm LexiFlow uses. For each card it tracks Stability (how many days until you'd drop to 90% recall) and Difficulty (how hard the card is for you).",
    why: "FSRS adapts each card's schedule to your real performance, fitting more learning into less review time than older fixed-interval methods.",
    more: [
      "State: New → Learning → Review → Relearning (if you forget).",
      "Your rating (Again / Hard / Good / Easy) updates Stability & Difficulty and sets the next due date.",
    ],
  },
  fsrsRating: {
    title: "Review ratings",
    what: "After flipping a card you grade your recall: Again, Hard, Good, or Easy.",
    why: "The rating is the single input FSRS uses to reschedule the card. 'Again' means you forgot → see it again soon; 'Easy' pushes the next review far out.",
  },
  dueToday: {
    title: "Due today",
    what: "The number of cards whose next-review date has arrived. These are the cards at the edge of being forgotten.",
    why: "Clearing your 'due' pile each day is the whole discipline of spaced repetition — it keeps every word fresh with minimum effort.",
  },
  deck: {
    title: "Flashcard deck",
    what: "A set of flashcards generated 1-to-1 from a vocabulary list. You choose what goes on the front and back (character, pinyin, meaning).",
    why: "Decks turn a passive word list into active recall practice without retyping anything — change the list, regenerate the deck.",
  },
  quizGen: {
    title: "AI-generated quizzes",
    what: "LexiFlow builds a fresh quiz from any list, mixing four question formats. You choose the list, the length, and which formats to include.",
    why: "Quizzes test recall in a different shape than flashcards (recognition, production, judgement), which strengthens and checks real understanding.",
  },
  distractors: {
    title: "Distractors",
    what: "The wrong answers in a multiple-choice question. LexiFlow picks plausible ones — words of similar meaning, level, or sound — rather than random noise.",
    why: "Good distractors make a question actually test understanding. Obviously-wrong options let you guess; near-misses force genuine recall.",
  },
  questionTypes: {
    title: "Question formats",
    what: "Four complementary ways to test a word.",
    why: "Each format exercises a different skill, so a mixed quiz gives a rounder picture of what you really know.",
    more: [
      "Multiple choice — recognise the meaning.",
      "Fill in the blank — recall the word in a sentence.",
      "Short answer — produce pinyin + meaning from memory.",
      "True / False — quick judgement of a claim.",
    ],
  },
  requestMode: {
    title: "Request mode (adding a video)",
    what: "Where you submit content for LexiFlow to process — paste a YouTube URL or upload a local file. It's then transcribed, translated and graded automatically.",
    why: "This is the front door of the whole product: it turns any video into study material. The job runs in a queue and you can watch its progress.",
  },
  pipeline: {
    title: "Processing pipeline",
    what: "The automatic steps a submitted video goes through: download → speech-to-text (Whisper) → segment into lines → translate → tag each character with pinyin & HSK level.",
    why: "Understanding the pipeline explains why processing takes a little time, and where each piece of the interactive subtitle comes from.",
  },
  theaterMode: {
    title: "Theater mode",
    what: "A focused, full-width player where the subtitle card floats over the video and can be dragged to any height.",
    why: "Keeps your eyes on the picture while reading, and lets you position subtitles where they don't cover the action.",
  },
  segmentLoop: {
    title: "Segment loop & pause",
    what: "Playback controls that repeat the current subtitle line, or auto-pause at its end.",
    why: "Lets you re-listen to a tricky sentence as many times as you need — core to listening practice — without fiddling with the timeline.",
  },

  // ── FSRS internals ─────────────────────────────────────────────────────
  stability: {
    title: "Stability (S)",
    what: "An FSRS memory value: the number of days that can pass before your chance of recalling the card drops to 90%. A card with stability 30 means you'd still remember it about 30 days from now.",
    why: "Stability is what spacing actually grows. Each successful review multiplies it, so reviews get further and further apart — that's the whole efficiency of spaced repetition. The 'Next due' date is essentially today + stability.",
    more: [
      "New cards start near 0; a few good reviews push stability into weeks, then months.",
      "Pressing 'Again' collapses stability back down so you see the card again soon.",
    ],
  },
  difficulty: {
    title: "Difficulty (D)",
    what: "An FSRS value from 1 (very easy) to 10 (very hard) capturing how intrinsically tough a card is for you. Unlike stability, it changes slowly.",
    why: "Difficulty scales how much each review grows stability: hard cards gain spacing more slowly, so you review them more often. It lets the scheduler treat your stubborn words differently from your easy ones.",
    more: [
      "Rating 'Easy' nudges difficulty down; 'Hard' / 'Again' nudges it up.",
      "Two cards due on the same day can get very different next-intervals because of difficulty.",
    ],
  },
  retrievability: {
    title: "Retrievability (R)",
    what: "Your estimated probability of recalling a card right now, from 0 to 100%. It decays over time since the last review, faster for low-stability cards.",
    why: "FSRS schedules each card to come back when retrievability falls to about 90% — the sweet spot where a review is challenging enough to strengthen memory but not so late that you've forgotten.",
  },
  fsrsStates: {
    title: "Card states (New → Review)",
    what: "Every card sits in one of four FSRS states: New (never studied), Learning (being introduced), Review (graduated, on long intervals), or Relearning (forgotten and being recovered).",
    why: "The state tells you and the scheduler where a word is in its memory lifecycle, and changes how the next interval is calculated.",
    more: [
      "New → first time you'll see it.",
      "Learning → in the short-interval introduction phase.",
      "Review → known; intervals now measured in days/weeks/months.",
      "Relearning → you pressed 'Again' on a known card; it's being rebuilt.",
    ],
  },
  scheduledDays: {
    title: "Scheduled interval",
    what: "The gap, in days, FSRS sets until a card's next review — derived from its stability and capped between 1 and 365 days.",
    why: "This is the concrete output of the algorithm: it's what fills your 'due today' queue on any given day.",
  },
  fsrsWeights: {
    title: "The FSRS model",
    what: "FSRS uses a set of 17 trained weights to convert your rating + the card's current stability/difficulty into the next schedule. LexiFlow computes this server-side on every review.",
    why: "These weights are what make FSRS more accurate than older fixed-step systems (like SM-2/Anki's default): the schedule is fitted to real human forgetting curves.",
  },

  // ── Vocabulary internals ───────────────────────────────────────────────
  frequencyRank: {
    title: "Frequency rank",
    what: "Where a word sits on a list of Chinese words ordered by how often they appear in real text — rank 100 is extremely common, rank 6000 is rare.",
    why: "Learning high-frequency words first gives the fastest comprehension gains, so LexiFlow can prioritise common words you don't yet know.",
  },
  simplifiedTraditional: {
    title: "Simplified vs. Traditional",
    what: "Chinese is written in two character sets: Simplified (used in mainland China, e.g. 护) and Traditional (used in Taiwan/Hong Kong, e.g. 護). Many characters are identical in both.",
    why: "LexiFlow stores both forms per word so learners of either variety see the script they're studying.",
  },
  tones: {
    title: "The four tones",
    what: "Mandarin is tonal: the same syllable said with a different pitch contour is a different word. The marks on pinyin (ā á ǎ à) show tone 1–4; an unmarked syllable is the neutral tone.",
    why: "Getting tones wrong changes meaning entirely, so LexiFlow always shows tone-marked pinyin rather than plain letters.",
  },
  segment: {
    title: "Subtitle segment",
    what: "One timed line of the transcript — a start time, an end time, the Chinese characters (each tagged with pinyin/HSK), and an English translation.",
    why: "Segments are the unit everything is built on: they drive the synced subtitle, the loop/pause controls, and the context sentence saved with each word.",
  },

  // ── Pipeline internals ─────────────────────────────────────────────────
  whisper: {
    title: "Whisper (speech-to-text)",
    what: "An open speech-recognition model that converts the video's Chinese audio into time-stamped text. It's the first AI step in the processing pipeline.",
    why: "Accurate transcription is the foundation — every subtitle, translation and saved word ultimately comes from what Whisper heard.",
  },
  queueEta: {
    title: "Queue & ETA",
    what: "Processing jobs run on shared workers, so a new submission may wait behind others. The queue position and ETA estimate when yours will start and finish.",
    why: "It sets expectations: transcription + translation of a full video is real compute, not instant, so LexiFlow shows you where you are in line.",
  },
  caching: {
    title: "Smart caching",
    what: "LexiFlow reuses work it has already done — if a video was processed before, or a word's translation, audio or quiz distractors were generated earlier, it serves the cached copy instantly.",
    why: "Caching keeps the app fast and cheap: you skip the whole pipeline when someone has already added the same video.",
  },

  // ── App-level ──────────────────────────────────────────────────────────
  auth: {
    title: "Your account",
    what: "Sign-in is handled by Auth0. It gives the app a secure token that's sent with every request so the backend knows which data is yours.",
    why: "It keeps each learner's vocabulary and progress private and saved to your own account.",
  },
  syncDeck: {
    title: "Sync list → deck",
    what: "Generating (or refreshing) a flashcard deck from a vocabulary list. Each word becomes a card with your chosen front/back layout; existing cards keep their memory state.",
    why: "It keeps your study material in sync with your word lists without ever retyping — add words to the list, re-sync, and the new cards appear.",
  },
  cardLayout: {
    title: "Card layout (front / back)",
    what: "You choose what shows on each side of a card — character, pinyin, and/or meaning. For example: character on the front, pinyin + meaning on the back.",
    why: "Different layouts train different skills: character→meaning tests reading; meaning→character tests production. You can tune it per deck.",
  },
  translationReport: {
    title: "Crowd-reported translation errors",
    what: "Flag a subtitle line if its translation, pinyin, or text looks wrong. Each report is anonymous and tied to that exact line.",
    why: "Once enough viewers of a video (a percentage threshold, not a fixed count) flag the same line, it's queued for an AI review pass that can correct the translation automatically — so error fixing scales with the audience instead of needing a human moderator for every video.",
    more: [
      "A line shows a report badge once it crosses the threshold.",
      "AI review is not wired up yet — flagged lines are currently just visible to you.",
    ],
  },
  speak: {
    title: "Listen (text-to-speech)",
    what: "Tap the speaker icon to hear any word or sentence read aloud in Mandarin.",
    why: "Hearing pronunciation alongside characters and pinyin reinforces tone and sound — useful everywhere a word appears: subtitles, dictionary lookups, flashcards, and quizzes.",
  },
};

export type ConceptId = keyof typeof CONCEPTS;
