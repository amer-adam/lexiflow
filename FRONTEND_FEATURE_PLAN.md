# LexiFlow Frontend — Feature Parity Plan

**Purpose:** The frontend was rebuilt from Vue (`frontend-vue-legacy/`) into React (`frontend/`).
The rebuild dropped several features. This document is the **complete feature inventory**
of the old Vue app and a **prioritized TODO** to restore everything that's missing, so the
next session can implement it without re-reading the legacy code.

> Old code to mine for behaviour: `frontend-vue-legacy/src/views/*.vue` and
> `frontend-vue-legacy/src/components/*.vue`.
> New code to edit: `frontend/src/views/*.tsx`, `frontend/src/components/*.tsx`,
> `frontend/src/lib/api.ts`, `frontend/src/lib/data.ts`.

---

## 0. How the new frontend is wired (orientation for the implementer)

- **Data:** `frontend/src/lib/api.ts` is the typed API client. Reads go through a 60s
  cache + in-flight de-dupe (`frontend/src/lib/cache.ts`); writes call `invalidate(...)`.
  **Keep all new reads cached and cap polling at ~1/min** (existing project constraint).
- **Hooks:** `useQuery(loader, deps)` in `frontend/src/app/useApi.ts` gives `{data, loading, error, reload}`.
  `useApi()` gives `{api, session}`. No demo/fallback data anywhere — always live, with
  loading/empty/error states (`Loading`, `EmptyState`, `ErrorState`, `Skeleton` in `components/bits.tsx`).
- **Settings:** `frontend/src/lib/settings.ts` (`useSettings`, `updateSettings`) — localStorage, reactive.
- **Auth gate + nav:** `frontend/src/App.tsx` (state-based nav via `useNav().go(view, params)`).
- **Concept popups:** `<InfoTip id="..."/>` from `frontend/src/lib/concepts.ts`.
- **Theme:** "Ink & Paper" — keep using existing tokens (`paper`, `seal`, `pill`, `hsk-*`, `font-hans-serif`).

### Backend API surface (all under `/lexiflow`, JWT required unless noted)
| Method/Path | Used in new UI? | Purpose |
|---|---|---|
| `GET /dictionary?word=` | ❌ NOT USED | Dictionary lookup (definitions, pinyin) |
| `GET /search?word=` | ❌ NOT USED | Subtitle search across the user's videos (returns segments w/ timestamps) |
| `GET /library` | ✅ | Video library |
| `GET /jobs/:jobId` | ✅ | Job/result status + subtitles (segments at `result.segments`) |
| `POST /jobs` | ✅ | Submit YouTube job |
| `POST /upload` (multipart) | ✅ | Upload file job |
| `GET /videos/:id/progress` | ❌ NOT USED | Resume watch position |
| `POST /videos/:id/progress` | ❌ NOT USED | Save watch position |
| `GET /lists`, `POST /lists`, `DELETE /lists/:id` | ✅ | Vocabulary lists |
| `GET /lists/:id/words`, `POST /lists/:id/words` | ✅ (read) / ❌ (add word UI) | List words / quick-add |
| `POST /lists/from-video` | ❌ NOT USED | Build a named list from a video's words |
| `POST /lists/seen-from-video` | ✅ | (new) upsert all video words into the "Seen" list |
| `GET /flashcards/decks` | ✅ | Decks |
| `GET /flashcards/decks/:id/review` | ✅ | Review session cards |
| `POST /flashcards/cards/:id/review` | ✅ | Submit FSRS rating |
| `POST /flashcards/sync` | ✅ | Generate/refresh deck from list (accepts `frontConfig`/`backConfig`) |
| `PUT /flashcards/decks/:id/layout` | ❌ NOT USED | Update deck front/back card layout |
| `POST /flashcards/decks/:id/reset` | ❌ NOT USED | Reset deck FSRS progress |
| `DELETE /flashcards/decks/:id` | ❌ (api method exists, no UI) | Delete deck |
| `POST /quizzes/generate`, `POST /quizzes/:id/submit` | ✅ | Quiz |

Segment shape (from `result.segments[]`): `{ start, end, text, translated_text, characters }`
where `characters` is an object keyed by the Chinese string →
`{ pinyin, hsk_level, translations[] }`.

---

## 1. FEATURE INVENTORY (old Vue → status in new React)

Legend: ✅ done · 🟡 partial · ❌ missing

### Watch (`WatchView.vue` + `VideoBox`, `CharacterDisplay`, `DictionarySearch`)
- ✅ Real video player (YouTube IFrame API + native `<video>` for uploads)
- ✅ Synced character-level bilingual subtitles, HSK colour-coded
- ✅ Hover tooltip per character (pinyin, HSK, meanings)
- ✅ Click character → lookup panel; save word
- ✅ Show/hide pinyin · characters · translation (now in a settings popover)
- ✅ Prev/next line, loop line, pause-at-end
- ✅ Fullscreen with subtitle overlay
- ✅ "Seen" list updated on leave + saved-count summary dialog
- 🟡 **Theater mode** — old had a dedicated theater layout with a **draggable subtitle bar**
  (`theaterSubY`, `theater-drag-handle`, `onDragStart/Move/End`), **auto-hiding controls**
  (`showTheaterUI`, `startHideTimer`), and a **subtitle background-opacity slider** (`subBgOpacity`,
  "Sub BG:"). New only has browser fullscreen. → restore draggable position + BG opacity + auto-hide.
- ❌ **In-video Dictionary Search panel** (`DictionarySearch.vue`): type any word → shows
  dictionary definition (`GET /dictionary`) **and every sentence in the video containing it**
  (`GET /search`) with timestamps; click a result to **jump to that time**; filter occurrences
  "all / current video"; highlight matched term (incl. pinyin) in results.
- ❌ **Replay segment** button (jump back to current segment start) — distinct from loop.
- ❌ **Watch progress save/resume** — `POST /videos/:id/progress` on timeupdate + on unload
  (`saveWatchProgress`, `handleBeforeUnload`); `GET /videos/:id/progress` to resume at saved time.
- ❌ **Open at timestamp** — `go("watch", { id, t })` should seek the player to `t` on load
  (used by Library subtitle search → "time-jump"). Player already supports `startTime`.
- ❌ **Create vocabulary list from this video** (explicit button → `POST /lists/from-video`).
  (New app auto-tracks "Seen" on leave, but the explicit "make me a study list from this video"
  action is gone.)

### Library (`LibraryView.vue`)
- ✅ Video grid, real thumbnails, duration, public/private badges, title search
- ❌ **Subtitle search** — search box modes **Titles / Subtitles / Split**; subtitle mode calls
  `GET /search?word=`, lists matching lines with timestamps + highlight, click → open video at
  that time (the "Time-Jump Search" feature).
- ❌ **Filter modes**: All Content · My Uploads · Private (`filterMode`).
- ❌ **Sort** control (`sortBy`).
- ❌ **Per-video watch-progress bar** on cards (uses `GET /videos/:id/progress`).
- ❌ Split view: "See All Video Matches" / "See All Subtitle Matches" expanders.

### Add Video (`ReqView.vue`)
- ✅ YouTube / Upload tabs, private toggle, submit, pipeline steps, queue, open-in-player
- 🟡 **Live ETA + queue countdown + elapsed timer** (`formatETA`, `time_counter`, "Requests ahead: N").
  New shows a static queue number; old showed live ETA. (Polling is intentionally capped at 60s now —
  keep that, just surface ETA/queue from the response.)
- 🟡 Progress **percentage** display from `job.progress` (new maps progress→step only).

### Vocabulary / Lists (`ListView.vue`)
- ✅ Lists sidebar w/ type badges + counts, create list, delete list, search words, virtualized table
- ✅ Create deck / Open deck (deck generation fixed)
- ❌ **Quick Add Word** form (simplified + pinyin + meaning) for non-official lists → `POST /lists/:id/words`.
- ❌ **Deck front/back config modal** before creating a deck — choose what shows on
  card front/back (character / pinyin / meaning checkboxes), pass as `frontConfig`/`backConfig`
  to `POST /flashcards/sync`. (New creates with backend defaults only.)
- 🟡 **List sort order** (official/saved/seen/user weighting — `getOrderWeight`) and
  **"Official list locked"** messaging for read-only OFFICIAL lists.

### Flashcards (`FlashcardView.vue`)
- ✅ Deck sidebar, due-today, flip card, FSRS rating, full-deck table (state/stability/difficulty/next-due)
- ❌ **Session size selector** — choose 5 / 10 / 20 / "Due Today" before studying
  (`promptSessionSetup`, `startStudySession(n)`); slice the review set to N.
- ❌ **Keyboard shortcuts** in study (space/enter = flip; 1–4 = Again/Hard/Good/Easy)
  (`handleKeyboardReviewNavigation`).
- ❌ **Deck layout settings modal** — edit front/back card config (character/pinyin/meaning),
  Save → `PUT /flashcards/decks/:id/layout`. Card front/back should then render per config.
- ❌ **Reset deck progress** → `POST /flashcards/decks/:id/reset`.
- ❌ **Delete deck** button → `DELETE /flashcards/decks/:id` (api method `deleteDeck` already exists).
- 🟡 Render card front/back **according to each card's `front`/`back` config** (character/pinyin/meaning),
  not a fixed character→pinyin+meaning layout.

### Quizzes (`QuizView.vue`)
- ✅ Config (list, count, types), generate, 4 formats, per-question answer, score, retry, breakdown
- 🟡 Old used 4 dedicated variant components; new renders inline — acceptable, no action needed
  unless you want the exact styling.

### Profile (`ProfileView.vue`)
- ✅ Nickname/account, translation language, autoplay/subtitle defaults, daily goal (new expands old)
- (No gaps.)

### Home / Landing (`HomeView.vue`)
- ❌ (Optional) Public marketing landing: hero + 6 feature cards (Any Video Instantly,
  Live Subtitle Overlay, Tap-to-Lookup, Personal Library, Privacy Control, Time-Jump Search),
  CTA. New app goes straight to a sign-in gate → Dashboard. Only build if a public landing is wanted.

### Components
- ✅ `VideoBox` → `VideoPlayer.tsx`; `CharacterDisplay` → `SubtitleLine` (in WatchView)
- ❌ `DictionarySearch.vue` → needs a React equivalent (see Watch section)
- ⏭️ `SubBox.vue` (word-index hover count) — legacy/minor, skip.

---

## 2. PRIORITIZED TODO (what the next chat should build)

### P0 — Core learning loop gaps (do first)
1. **Watch progress save & resume.**
   - `api.saveProgress(videoId, seconds)` → `POST /videos/:id/progress`;
     `api.getProgress(videoId)` → `GET /videos/:id/progress`.
   - In `WatchView`: load saved position → pass as `VideoPlayer startTime`; throttle-save current
     time (e.g. every ~15–30s while playing, not faster) and once on leave/unmount.
   - Support `params.t` (open at timestamp) — seek on player ready.
2. **Deck front/back layout config + render by config.**
   - Add a "Card layout" modal in `FlashcardsView` (checkboxes character/pinyin/meaning for front & back);
     Save → new `api.updateDeckLayout(deckId, frontConfig, backConfig)` (`PUT /flashcards/decks/:id/layout`).
   - Render the flip card's front/back from `card.front`/`card.back` (fields already mapped in `api.ts`).
   - Add the same front/back config to the **Create Deck** flow in `VocabView` (pass to `syncDeck`).
3. **Flashcards: session size selector + keyboard shortcuts + reset/delete deck.**
   - Pre-study chooser: 5 / 10 / 20 / Due Today → slice review list.
   - Keydown handler in study arena: Space/Enter flip; 1–4 rate.
   - Wire `api.deleteDeck` (button + confirm) and add `api.resetDeck(deckId)` (`POST .../reset`).

### P1 — Discovery & lookup
4. **In-video Dictionary Search panel** (the big one).
   - `api.dictionary(word)` → `GET /dictionary?word=`; `api.searchSubtitles(word)` → `GET /search?word=`.
   - New `DictionaryPanel` in `WatchView` right rail (tab alongside Look-up): input → show definition +
     list of in-video occurrences with timestamps; click → `player.seekTo(start)`; highlight term;
     occurrence filter all/current video. Port highlight logic from `DictionarySearch.vue`.
5. **Library subtitle search + filters + sort + progress bars.**
   - Search modes Titles/Subtitles/Split using `GET /search`; subtitle results clickable →
     `go("watch", { id, t: start })` (needs P0 #1 timestamp support).
   - Filter All / My Uploads / Private; sort control; per-card watch-progress bar via `getProgress`
     (batch, but respect the 1/min cache — consider one combined call or accept cached values).
6. **Vocabulary Quick-Add Word** form (non-official lists) → `api.addWord` (already exists), plus
   list **sort order** and **OFFICIAL-locked** read-only messaging.

### P2 — Polish / theater / optional
7. **Theater mode upgrade:** draggable subtitle bar (`theaterSubY` drag), subtitle **BG-opacity**
   slider, auto-hide controls on idle. (Browser fullscreen already works; this is the richer overlay UX.)
8. **Replay-segment** button; **Create list from video** explicit button (`POST /lists/from-video`).
9. **Req view:** surface live ETA / "requests ahead" / progress % from the job response.
10. **(Optional) Public landing page** mirroring `HomeView` if a pre-login marketing page is desired.

---

## 3. Implementation notes / gotchas
- **No demo data, ever.** Every new view path needs `loading` / `empty` / `error` states.
- **Respect the request cap.** New GETs → `cachedFetch(key, fn)` in `api.ts`; mutations → `invalidate(prefix)`.
  Don't add tight polling; watch-progress save should be throttled, not per-frame.
- **Stable callbacks.** Anything feeding `VideoPlayer`/intervals must be a stable identity
  (see the `onTime` ref pattern already in `WatchView.tsx`) or it will loop.
- **Card config types** already exist: `Card.front`/`Card.back = {character,pinyin,meaning}` in `lib/data.ts`.
- **Player already supports `startTime`** (`VideoPlayer` prop) for resume/time-jump.
- Build check after each chunk: `cd frontend && npm run build` (must stay green; tsc is strict —
  `noUnusedLocals` on).
- Backend already supports everything above except nothing new is needed for P0–P2 **except**
  confirm `PUT /flashcards/decks/:id/layout` and `POST /flashcards/decks/:id/reset` behave as expected
  (controllers exist: `updateDeckLayout`, `resetDeckProgress`).

---

## 4. Quick file map
| Area | New file to edit | Old reference |
|---|---|---|
| API client | `frontend/src/lib/api.ts` | — |
| Watch | `frontend/src/views/WatchView.tsx`, `components/VideoPlayer.tsx` | `views/WatchView.vue`, `components/{VideoBox,CharacterDisplay,DictionarySearch}.vue` |
| Library | `frontend/src/views/LibraryView.tsx` | `views/LibraryView.vue` |
| Add video | `frontend/src/views/RequestView.tsx` | `views/ReqView.vue` |
| Vocabulary | `frontend/src/views/VocabView.tsx` | `views/ListView.vue` |
| Flashcards | `frontend/src/views/FlashcardsView.tsx` | `views/FlashcardView.vue` |
| Quiz | `frontend/src/views/QuizView.tsx` | `views/QuizView.vue` + `components/quiz/*` |
| Profile | `frontend/src/views/ProfileView.tsx` | `views/ProfileView.vue` |
