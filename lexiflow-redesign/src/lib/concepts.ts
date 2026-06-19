// ─────────────────────────────────────────────────────────────────────────
//  Concept glossary
//  Every domain term in LexiFlow that a first-time reviewer / examiner might
//  not know is defined once here, then surfaced anywhere via <InfoTip id=…/>.
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
};

export type ConceptId = keyof typeof CONCEPTS;
