// ─────────────────────────────────────────────────────────────────────────
//  API client — talks to the LexiFlow Node/Express backend (/lexiflow/*).
//  GET reads go through a 60s cache + in-flight de-dupe (see lib/cache) so the
//  UI stays responsive and never spams the API. Writes invalidate the cache.
// ─────────────────────────────────────────────────────────────────────────
import { ENV } from "@/app/session";
import { cachedFetch, invalidate } from "@/lib/cache";
import {
  type Vocab, type VList, type ListItem, type ListType, type HskLevel,
  type Deck, type Card, type FsrsState, type VideoMeta, type Segment,
  type CharToken, type QuestionType,
} from "@/lib/data";

type TokenGetter = () => Promise<string | null>;

const clampHsk = (n: unknown): HskLevel => {
  const v = Number(n);
  return (Number.isFinite(v) && v >= 1 && v <= 6 ? Math.round(v) : 0) as HskLevel;
};
const hashHue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return Math.abs(h);
};

// ── Mappers: backend shape → view model ─────────────────────────────────────
function mapVocab(v: any): Vocab {
  return {
    simplified: v?.simplified ?? "?",
    traditional: v?.traditional ?? undefined,
    pinyin: v?.pinyin ?? "",
    meaning: v?.meaning ?? "",
    hskLevel: clampHsk(v?.hskLevel),
    frequencyRank: v?.frequencyRank ?? undefined,
  };
}
function mapListItem(it: any): ListItem {
  return {
    vocab: mapVocab(it?.vocabulary ?? it),
    familiarity: typeof it?.familiarityScore === "number" ? it.familiarityScore : 0,
    seenCount: it?.seenCount ?? 1,
    sourceVideo: it?.sourceVideoId ?? undefined,
    contextSentence: it?.contextSentence ?? undefined,
    contextTranslation: it?.contextTranslation ?? undefined,
  };
}
function mapList(l: any): VList {
  return {
    id: l?.id,
    name: l?.name ?? "Untitled list",
    type: (l?.type ?? "USER_CREATED") as ListType,
    description: l?.sourceMetadata?.description ?? "",
    items: Array.isArray(l?.items) ? l.items.map(mapListItem) : [],
    hasDeck: Boolean(l?.flashcardDeck),
    _count: l?._count,
  };
}
function mapCard(c: any): Card {
  const cfg = (x: any) => ({
    character: Boolean(x?.character),
    pinyin: Boolean(x?.pinyin),
    meaning: Boolean(x?.meaning),
  });
  let dueInDays = 0;
  if (c?.nextReviewDate) {
    dueInDays = Math.round((new Date(c.nextReviewDate).getTime() - Date.now()) / 86_400_000);
  }
  return {
    id: c?.id,
    vocab: mapVocab(c?.vocabulary ?? c),
    front: cfg(c?.frontConfig),
    back: cfg(c?.backConfig),
    stability: c?.stability ?? 0,
    difficulty: c?.difficulty ?? 0,
    state: ((c?.state ?? 0) as FsrsState),
    dueInDays,
  };
}
function mapVideo(v: any): VideoMeta {
  const id = v?.id ?? v?.job_id;
  return {
    id,
    title: v?.title ?? "Untitled video",
    channel: v?.channel ?? undefined,
    description: v?.description ?? undefined,
    duration: v?.duration ?? "—",
    topic: v?.is_private ? "Private" : "Public",
    thumbnail: v?.thumbnail || undefined,
    thumbHue: hashHue(id ?? v?.title ?? "x"),
    dateAdded: v?.dateAdded ?? undefined,
    visibility: v?.is_private ? "private" : "public",
    ownedByMe: Boolean(v?.requested_by_user),
  };
}
function mapSegment(s: any): Segment {
  const chars = s?.characters ?? {};
  const tokens: CharToken[] = Object.keys(chars).map((key) => ({
    char: String(key).replace(/[[\]]/g, ""),
    pinyin: String(chars[key]?.pinyin ?? "").replace(/[[\]]/g, ""),
    hsk_level: clampHsk(chars[key]?.hsk_level),
    translations: chars[key]?.translations ?? [],
  }));
  return {
    start: s?.start ?? 0,
    end: s?.end ?? 0,
    tokens,
    translated_text: s?.translated_text ?? "",
  };
}

// ── Quiz live types ─────────────────────────────────────────────────────────
export interface LiveQuizQuestion { id: string; type: QuestionType; questionText: string; options: string[]; }
export interface LiveQuiz { id: string; title: string; questions: LiveQuizQuestion[]; }
export interface QuizGrade {
  score: number; totalQuestions: number; correctCount: number;
  breakdown: { questionId: string; questionText: string; correctAnswer: string; userAnswer: string; isCorrect: boolean }[];
}

export interface JobStatus {
  status?: string; progress?: number; title?: string; description?: string;
  videoUrl?: string; segments: Segment[]; eta?: number; queueNumber?: number;
}

export interface DictionaryEntry {
  word: string; pinyin: string; definitions: string[];
}
export interface SubtitleMatch {
  jobId: string; videoTitle: string; start: number; end: number;
  text: string; translatedText: string; pinyin?: string;
}
export interface VideoProgress {
  videoId: string; currentTime: number; duration: number; lastSegmentIndexSeen: number;
}

// ── Client ──────────────────────────────────────────────────────────────────
export class Api {
  private getToken: TokenGetter;
  constructor(getToken: TokenGetter) {
    this.getToken = getToken;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    };
    const res = await fetch(`${ENV.apiBase}/lexiflow${path}`, { ...init, headers });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.message ?? ""; } catch { /* ignore */ }
      throw new Error(detail || `${res.status} ${res.statusText}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // Vocabulary ----------------------------------------------------------------
  getLists(): Promise<VList[]> {
    return cachedFetch("lists", async () => (await this.req<any[]>("/lists")).map(mapList));
  }
  getListWords(listId: string): Promise<ListItem[]> {
    return cachedFetch(`listwords:${listId}`, async () =>
      (await this.req<any[]>(`/lists/${listId}/words`)).map(mapListItem)
    );
  }
  async createList(name: string, type: ListType = "USER_CREATED"): Promise<VList> {
    const raw = await this.req<any>("/lists", { method: "POST", body: JSON.stringify({ name, type }) });
    invalidate("lists");
    return mapList(raw);
  }
  async deleteList(listId: string): Promise<void> {
    await this.req<void>(`/lists/${listId}`, { method: "DELETE" });
    invalidate("lists");
    invalidate(`listwords:${listId}`);
  }
  async addWord(listId: string, word: Partial<Vocab> & {
    sourceVideoId?: string; contextSentence?: string; contextTranslation?: string;
  }): Promise<void> {
    await this.req<void>(`/lists/${listId}/words`, {
      method: "POST",
      body: JSON.stringify({
        simplified: word.simplified, pinyin: word.pinyin || "", meaning: word.meaning || "",
        traditional: word.traditional, hskLevel: word.hskLevel, sourceVideoId: word.sourceVideoId,
        contextSentence: word.contextSentence, contextTranslation: word.contextTranslation,
      }),
    });
    invalidate(`listwords:${listId}`);
    invalidate("lists");
  }
  /** Record every word in a video into the user's "Seen" list (on leaving). */
  async markVideoSeen(videoId: string): Promise<{ listId: string; listName: string; tracked: number }> {
    const r = await this.req<{ listId: string; listName: string; tracked: number }>("/lists/seen-from-video", {
      method: "POST",
      body: JSON.stringify({ videoId }),
    });
    invalidate("lists");
    invalidate("listwords:");
    return r;
  }
  /** Build a new named list from every word in a video. */
  async listFromVideo(videoId: string): Promise<{ listId: string; listName: string; wordsAdded: number }> {
    const r = await this.req<{ success: boolean; listId: string; listName: string; wordsAdded: number }>(
      "/lists/from-video", { method: "POST", body: JSON.stringify({ videoId }) }
    );
    invalidate("lists");
    return r;
  }
  /** Dictionary lookup for any word, independent of any particular video. */
  dictionary(word: string): Promise<DictionaryEntry> {
    return this.req<DictionaryEntry>(`/dictionary?word=${encodeURIComponent(word)}`);
  }
  /** Synthesize (or fetch cached) speech audio for any text; returns a playable URL. */
  async speak(text: string): Promise<string> {
    const r = await this.req<{ url: string }>(`/tts?text=${encodeURIComponent(text)}`);
    return r.url.startsWith("http") ? r.url : `${ENV.apiBase}${r.url}`;
  }
  /** File a crowd-report that a subtitle line's translation/pinyin/text looks wrong. */
  async reportSegment(jobId: string, segmentIndex: number, reason: "translation" | "pinyin" | "text" | "other", note?: string): Promise<void> {
    await this.req<void>("/reports", { method: "POST", body: JSON.stringify({ jobId, segmentIndex, reason, note }) });
    invalidate(`reports:${jobId}`);
  }
  /** Per-segment report counts + flagged status for a video. */
  getSegmentReports(jobId: string): Promise<{ jobId: string; viewerCount: number; threshold: { minReports: number; percent: number }; segments: { segmentIndex: number; count: number; percent: number; flagged: boolean }[] }> {
    return cachedFetch(`reports:${jobId}`, () => this.req(`/reports/${jobId}`));
  }
  /** Export a vocabulary list as a downloadable file (csv | anki | pdf). */
  async exportList(listId: string, format: "csv" | "anki" | "pdf"): Promise<Blob> {
    const token = await this.getToken();
    const res = await fetch(`${ENV.apiBase}/lexiflow/lists/${listId}/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.blob();
  }
  /** Search every subtitle line (across the user's videos) containing a word. */
  async searchSubtitles(word: string): Promise<SubtitleMatch[]> {
    const r = await this.req<{ results: any[] }>(`/search?word=${encodeURIComponent(word)}`);
    return (r.results ?? []).map((m) => ({
      jobId: m.job_id, videoTitle: m.title ?? "Untitled video",
      start: m.segment?.start ?? 0, end: m.segment?.end ?? 0,
      text: m.segment?.text ?? "", translatedText: m.segment?.translated_text ?? "",
      pinyin: m.segment?.pinyin,
    }));
  }

  // Videos --------------------------------------------------------------------
  getLibrary(): Promise<VideoMeta[]> {
    return cachedFetch("library", async () => (await this.req<any[]>("/library")).map(mapVideo));
  }
  private parseJob(raw: any): JobStatus {
    // The processed result payload holds segments at `result.segments`.
    const segs =
      raw?.result?.segments ??
      raw?.segments ??
      raw?.result?.subtitles?.segments ??
      raw?.subtitles?.segments ??
      [];
    return {
      status: raw?.status, progress: raw?.progress,
      title: raw?.title ?? raw?.result?.title,
      description: raw?.description ?? raw?.result?.description,
      videoUrl: raw?.videoUrl ?? raw?.url,
      segments: Array.isArray(segs) ? segs.map(mapSegment) : [],
      eta: raw?.eta, queueNumber: raw?.queue_number ?? raw?.queue_position,
    };
  }
  getJob(jobId: string): Promise<JobStatus> {
    return cachedFetch(`job:${jobId}`, async () => this.parseJob(await this.req<any>(`/jobs/${jobId}`)));
  }
  /** Uncached read for live job-progress polling. */
  async getJobFresh(jobId: string): Promise<JobStatus> {
    return this.parseJob(await this.req<any>(`/jobs/${jobId}`));
  }
  async createJob(url: string, isPrivate: boolean): Promise<any> {
    const r = await this.req<any>("/jobs", { method: "POST", body: JSON.stringify({ url, is_private: isPrivate }) });
    invalidate("library");
    return r;
  }
  /** Resume position for a video (cached; refresh after a save). */
  getProgress(videoId: string): Promise<VideoProgress> {
    return cachedFetch(`progress:${videoId}`, async () => {
      const r = await this.req<any>(`/videos/${videoId}/progress`);
      return {
        videoId, currentTime: r?.currentTime ?? 0, duration: r?.duration ?? 0,
        lastSegmentIndexSeen: r?.lastSegmentIndexSeen ?? -1,
      };
    });
  }
  /** Throttled progress save — call at most every ~15-30s while playing, and once on leave. */
  async saveProgress(videoId: string, currentTime: number, duration: number): Promise<void> {
    await this.req<void>(`/videos/${videoId}/progress`, {
      method: "POST", body: JSON.stringify({ currentTime, duration }),
    });
    invalidate(`progress:${videoId}`);
  }
  async uploadJob(file: File, title: string, isPrivate: boolean): Promise<any> {
    const token = await this.getToken();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    fd.append("is_private", String(isPrivate));
    const res = await fetch(`${ENV.apiBase}/lexiflow/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    invalidate("library");
    return res.json();
  }

  // Flashcards ----------------------------------------------------------------
  getDecks(): Promise<(Deck & { _count?: { flashcards: number } })[]> {
    return cachedFetch("decks", async () =>
      (await this.req<any[]>("/flashcards/decks")).map((d) => ({
        id: d?.id, name: d?.name ?? "Deck", listId: d?.listId,
        cards: Array.isArray(d?.flashcards) ? d.flashcards.map(mapCard) : [],
        _count: d?._count,
      }))
    );
  }
  getReview(deckId: string): Promise<Card[]> {
    return cachedFetch(`review:${deckId}`, async () => (await this.req<any[]>(`/flashcards/decks/${deckId}/review`)).map(mapCard));
  }
  async submitReview(cardId: string, rating: 1 | 2 | 3 | 4): Promise<void> {
    await this.req<void>(`/flashcards/cards/${cardId}/review`, { method: "POST", body: JSON.stringify({ rating }) });
    invalidate("review:");
    invalidate("decks");
  }
  async syncDeck(
    listId: string,
    name?: string,
    frontConfig?: { character: boolean; pinyin: boolean; meaning: boolean },
    backConfig?: { character: boolean; pinyin: boolean; meaning: boolean }
  ): Promise<any> {
    const r = await this.req<any>("/flashcards/sync", {
      method: "POST", body: JSON.stringify({ listId, name, frontConfig, backConfig }),
    });
    invalidate("decks");
    invalidate("lists");
    return r;
  }
  async deleteDeck(deckId: string): Promise<void> {
    await this.req<void>(`/flashcards/decks/${deckId}`, { method: "DELETE" });
    invalidate("decks");
  }
  async updateDeckLayout(
    deckId: string,
    frontConfig: { character: boolean; pinyin: boolean; meaning: boolean },
    backConfig: { character: boolean; pinyin: boolean; meaning: boolean }
  ): Promise<void> {
    await this.req<void>(`/flashcards/decks/${deckId}/layout`, {
      method: "PUT", body: JSON.stringify({ frontConfig, backConfig }),
    });
    invalidate("decks");
    invalidate("review:");
  }
  async resetDeck(deckId: string): Promise<void> {
    await this.req<void>(`/flashcards/decks/${deckId}/reset`, { method: "POST" });
    invalidate("decks");
    invalidate("review:");
  }

  // Quizzes -------------------------------------------------------------------
  generateQuiz(vocabularyListId: string, count: number, allowedTypes: QuestionType[]): Promise<LiveQuiz> {
    return this.req<LiveQuiz>("/quizzes/generate", {
      method: "POST",
      body: JSON.stringify({ vocabularyListId, count, allowedTypes }),
    });
  }
  submitQuiz(quizId: string, answers: { questionId: string; userAnswer: string }[]): Promise<QuizGrade> {
    return this.req<QuizGrade>(`/quizzes/${quizId}/submit`, { method: "POST", body: JSON.stringify({ answers }) });
  }
}
