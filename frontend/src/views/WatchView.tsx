import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SkipBack, SkipForward, Repeat, OctagonPause, BookmarkPlus, Check, Settings2,
  Maximize2, Minimize2, Film, Loader2, ArrowLeft, Play, Pause,
  RotateCcw, ListPlus, Search, Clock, Palette,
} from "lucide-react";
import { hskColor, HSK_LABELS, type CharToken, type Segment } from "@/lib/data";
import { HskLegend, HskBadge, EmptyState, ErrorState, Skeleton } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { VideoPlayer, type VideoHandle } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNav } from "@/app/nav";
import { useApi, useQuery } from "@/app/useApi";
import { useSettings, updateSettings } from "@/lib/settings";
import { setSessionSummary } from "@/lib/sessionSummary";
import { cn } from "@/lib/utils";
import { type SubtitleMatch, type DictionaryEntry } from "@/lib/api";
import { ReportFlagButton } from "@/components/ReportFlagButton";
import { SpeakButton } from "@/components/SpeakButton";

const PROGRESS_SAVE_MS = 20_000; // throttle progress writes

/** Shows the post-watch toast only if something actually happened, and never
 *  with a negative count (a session that produced nothing isn't worth a
 *  "Nice session!" toast, and a count can never sensibly be negative). */
function maybeShowSessionSummary(videoTitle: string | undefined, savedCount: number, trackedCount: number) {
  const saved = Math.max(0, savedCount);
  const tracked = Math.max(0, trackedCount);
  if (saved === 0 && tracked === 0) return;
  setSessionSummary({ videoTitle, saved, tracked, at: Date.now() });
}

export function WatchView() {
  const { params, go } = useNav();
  const { api } = useApi();
  const settings = useSettings();
  const videoId = params.id;
  const openAtT = params.t ? Number(params.t) : undefined;

  const { data: job, loading, error, reload } = useQuery(
    (a) => (videoId ? a.getJob(videoId) : Promise.resolve(null)),
    [videoId]
  );
  const { data: progress } = useQuery(
    (a) => (videoId ? a.getProgress(videoId) : Promise.resolve(null)),
    [videoId]
  );

  // No video open (e.g. just clicked the "Watch" nav item): resume whatever
  // was most recently played, or — for an account that hasn't watched
  // anything yet — open the most recently added library video.
  const { data: fallbackId, loading: fallbackLoading } = useQuery(async (a) => {
    if (videoId) return null;
    const library = await a.getLibrary();
    if (!library.length) return null;
    const withProgress = await Promise.all(
      library.map(async (v) => [v, await a.getProgress(v.id).catch(() => null)] as const)
    );
    const played = withProgress
      .filter(([, p]) => p && p.currentTime > 0)
      .sort(([, a], [, b]) => (b?.updatedAt ?? "").localeCompare(a?.updatedAt ?? ""));
    if (played.length) return played[0][0].id;
    const newest = [...library].sort((a, b) => (b.dateAdded ?? "").localeCompare(a.dateAdded ?? ""));
    return newest[0]?.id ?? null;
  }, [videoId]);

  useEffect(() => {
    if (!videoId && fallbackId) go("watch", { id: fallbackId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, fallbackId]);

  const segments = useMemo(() => job?.segments ?? [], [job]);
  const TOTAL = segments.length ? segments[segments.length - 1].end : 1;

  // Resume position: explicit ?t= wins over saved progress.
  const startTime = openAtT ?? progress?.currentTime ?? 0;
  const [playerReady, setPlayerReady] = useState(false);
  useEffect(() => { setPlayerReady(progress !== undefined); }, [progress]);

  const player = useRef<VideoHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastBoundary = useRef<number>(-1);

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(settings.autoLoopLine);
  const [pauseAtEnd, setPauseAtEnd] = useState(settings.autoPauseAtLineEnd);
  const [selected, setSelected] = useState<CharToken | null>(null);
  const [saved, setSaved] = useState<CharToken[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [listResult, setListResult] = useState<{ name: string; words: number } | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  // Only advances when the player's time actually lands inside a segment
  // (driven from onTime below). Keeping the previous index during the small
  // gap between two segments' end/start avoids flashing back to line 1 —
  // findIndex() would return -1 there and fall back to segments[0].
  const [segIndex, setSegIndex] = useState(0);
  const seg = segments[segIndex] ?? segments[0];

  // Refs keep the player's time-poll closure reading current values without
  // re-creating the player on every state change.
  const segmentsRef = useRef(segments); segmentsRef.current = segments;
  const loopRef = useRef(loop); loopRef.current = loop;
  const pauseRef = useRef(pauseAtEnd); pauseRef.current = pauseAtEnd;
  const lastSaveRef = useRef(0);
  const tRef = useRef(0);

  // The backend syncs newly-watched words to the "Seen" list on *every*
  // progress save, not just when leaving — so by the time you leave, the
  // periodic saves during playback have usually already tracked
  // everything and the final call reports 0 new words. Accumulate each
  // call's count here so the post-watch toast reflects the whole session,
  // not just whatever's left over since the last periodic save.
  const sessionTrackedRef = useRef(0);

  const flushProgress = useCallback(() => {
    if (!videoId || !tRef.current) return Promise.resolve();
    return api.saveProgress(videoId, tRef.current, TOTAL)
      .then((r) => { sessionTrackedRef.current += r.tracked; })
      .catch(() => { /* ignore */ });
  }, [api, videoId, TOTAL]);

  // Drive loop / pause-at-end off the real player's time. Stable identity.
  const onTime = useCallback((time: number) => {
    setT(time);
    tRef.current = time;
    const now = Date.now();
    if (now - lastSaveRef.current > PROGRESS_SAVE_MS) {
      lastSaveRef.current = now;
      flushProgress();
    }
    const curIndex = segmentsRef.current.findIndex((s) => time >= s.start && time < s.end);
    if (curIndex < 0) return;
    setSegIndex(curIndex);
    const cur = segmentsRef.current[curIndex];
    if (time >= cur.end - 0.15 && lastBoundary.current !== cur.end) {
      if (pauseRef.current) { player.current?.pause(); lastBoundary.current = cur.end; }
      else if (loopRef.current) { player.current?.seekTo(cur.start); lastBoundary.current = cur.end; }
    }
    if (time < cur.end - 0.3) lastBoundary.current = -1;
  }, [flushProgress]);

  const jumpSeg = (dir: number) => {
    const i = Math.max(0, Math.min(segments.length - 1, (segIndex < 0 ? 0 : segIndex) + dir));
    if (segments[i]) player.current?.seekTo(segments[i].start + 0.01);
  };
  const replaySegment = () => { if (seg) player.current?.seekTo(seg.start + 0.01); };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // Fullscreen. The portal node lets popovers/dialogs render *inside* the
  // fullscreened element — content appended to document.body is invisible
  // while the Fullscreen API is active, since only the fullscreened
  // subtree is composited to the screen.
  useEffect(() => {
    const onFs = () => {
      const isFs = !!document.fullscreenElement;
      setFullscreen(isFs);
      setPortalNode(isFs ? stageRef.current : null);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  };

  const save = async (tok: CharToken) => {
    if (saved.some((s) => s.char === tok.char)) return;
    setSaved((s) => [tok, ...s]);
    setSavingId(tok.char);
    try {
      const lists = await api.getLists();
      let target = lists.find((l) => l.type === "SAVED");
      if (!target) target = await api.createList("Saved words", "SAVED");
      await api.addWord(target.id, {
        simplified: tok.char, pinyin: tok.pinyin, meaning: tok.translations[0] ?? "",
        hskLevel: tok.hsk_level, sourceVideoId: videoId,
        contextSentence: seg?.tokens.map((x) => x.char).join("") ?? "",
        contextTranslation: seg?.translated_text ?? "",
      });
    } catch {
      setSaved((s) => s.filter((x) => x.char !== tok.char));
      alert("Could not save the word. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const makeListFromVideo = async () => {
    if (!videoId) return;
    setListBusy(true);
    try {
      const r = await api.listFromVideo(videoId);
      setListResult({ name: r.listName, words: r.wordsAdded });
    } catch (e: any) {
      alert("Could not create a list from this video: " + (e?.message ?? "unknown error"));
    } finally {
      setListBusy(false);
    }
  };

  // Mark words seen, persist a session summary (survives navigation, refresh,
  // and opening another video), then leave. Progress is saved *first* and
  // awaited — the backend only tracks words from segments up to that saved
  // position, so marking seen before the save lands would (and used to) mark
  // every word in the whole video as seen regardless of how far we got.
  const finishWatching = async () => {
    finishedRef.current = true;
    await flushProgress(); // accumulates into sessionTrackedRef
    if (!videoId) { go("library"); return; }
    setLeaving(true);
    try { sessionTrackedRef.current += (await api.markVideoSeen(videoId)).tracked; } catch { /* ignore */ }
    setLeaving(false);
    maybeShowSessionSummary(job?.title, saved.length, sessionTrackedRef.current);
    go("library");
  };

  // The summary above only fired when the user clicked the in-page "Library"
  // button — leaving via the main sidebar nav, closing the tab's view, or any
  // other route change skipped it entirely, so the toast just never showed.
  // Catch every other exit path here instead, reading refs so this always
  // sees the latest values without re-running the effect on every render.
  // Same ordering requirement as above: save progress, then mark seen.
  const finishedRef = useRef(false);
  const jobRef = useRef(job); jobRef.current = job;
  const savedRef = useRef(saved); savedRef.current = saved;
  const apiRef = useRef(api); apiRef.current = api;
  const videoIdRef = useRef(videoId); videoIdRef.current = videoId;
  const totalRef = useRef(TOTAL); totalRef.current = TOTAL;
  useEffect(() => {
    return () => {
      if (finishedRef.current) return;
      const vid = videoIdRef.current;
      const time = tRef.current;
      if (!vid || !time) return; // never actually watched anything
      finishedRef.current = true;
      apiRef.current.saveProgress(vid, time, totalRef.current)
        .then((r) => { sessionTrackedRef.current += r.tracked; })
        .catch(() => { /* ignore */ })
        .then(() =>
          apiRef.current.markVideoSeen(vid).then(
            (r) => { sessionTrackedRef.current += r.tracked; },
            () => { /* ignore */ }
          )
        )
        .then(() => maybeShowSessionSummary(jobRef.current?.title, savedRef.current.length, sessionTrackedRef.current));
    };
  }, []);

  // ── States ───────────────────────────────────────────────────
  if (!videoId) {
    if (fallbackLoading || fallbackId) return <WatchSkeleton />;
    return (
      <div className="paper">
        <EmptyState icon={<Film className="h-10 w-10" />} title="Nothing playing yet"
          action={<Button onClick={() => go("request")}>Add your first video</Button>}>
          Add a video to your library to start watching with interactive subtitles.
        </EmptyState>
      </div>
    );
  }
  if ((loading && !job) || !playerReady) return <WatchSkeleton />;
  if (error) return <div className="paper"><ErrorState message={error} onRetry={reload} /></div>;
  if (!segments.length) {
    return (
      <div className="paper">
        <EmptyState icon={<Loader2 className="h-10 w-10 animate-spin" />} title="This video is still being prepared"
          action={<Button variant="outline" onClick={reload}>Check again</Button>}>
          {job?.status ? `Status: ${job.status}${job.progress != null ? ` · ${job.progress}%` : ""}. ` : ""}
          Subtitles appear here once processing finishes.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={finishWatching} disabled={leaving}>
          {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />} Library
        </Button>
        <h1 className="font-display text-lg md:text-xl font-semibold truncate text-center flex-1">{job?.title ?? "Now playing"}</h1>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hidden sm:flex" onClick={makeListFromVideo} disabled={listBusy} title="Build a study list from every word in this video">
          {listBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />} Make a study list
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* Player + subtitles */}
        <div className="space-y-4 min-w-0">
          {/* Stage (player + fullscreen overlay) */}
          <div ref={stageRef} className={cn("paper overflow-hidden", fullscreen && "rounded-none bg-black flex flex-col justify-center")}>
            <div className="relative aspect-video bg-black">
              {job?.videoUrl ? (
                <VideoPlayer ref={player} url={job.videoUrl} startTime={startTime}
                  onTime={onTime} onPlayingChange={setPlaying} />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">
                  No playable source for this video.
                </div>
              )}
              {/* Theater overlay when fullscreen */}
              {fullscreen && seg && (
                <TheaterOverlay seg={seg} settings={settings}
                  onSelect={setSelected} saved={saved}
                  loop={loop} pauseAtEnd={pauseAtEnd}
                  onPrev={() => jumpSeg(-1)} onNext={() => jumpSeg(1)} onReplay={replaySegment}
                  onToggleLoop={() => { setLoop((l) => !l); setPauseAtEnd(false); }}
                  onTogglePause={() => { setPauseAtEnd((p) => !p); setLoop(false); }}
                  playing={playing}
                  onPlayPause={() => (playing ? player.current?.pause() : player.current?.play())}
                  onExit={() => document.exitFullscreen()}
                  portalNode={portalNode}
                  onProfile={() => go("profile")} />
              )}
            </div>

            {/* Transport */}
            {!fullscreen && (
              <div className="px-4 py-3 border-t border-border bg-card">
                <div className="group relative h-1.5 rounded-full bg-muted cursor-pointer mb-2"
                  onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); player.current?.seekTo(((e.clientX - r.left) / r.width) * TOTAL); }}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(t / TOTAL) * 100}%` }} />
                  {segments.map((s, i) => (
                    <span key={i} className="absolute top-1/2 -translate-y-1/2 h-2 w-px bg-foreground/20" style={{ left: `${(s.start / TOTAL) * 100}%` }} />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => jumpSeg(-1)} title="Previous line"><SkipBack className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => (playing ? player.current?.pause() : player.current?.play())} title="Play / pause">
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => jumpSeg(1)} title="Next line"><SkipForward className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={replaySegment} title="Replay this line from the start"><RotateCcw className="h-4 w-4" /></Button>
                  <span className="text-xs font-mono-num text-muted-foreground ml-1">{fmt(t)} / {fmt(TOTAL)}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => { setLoop((l) => !l); setPauseAtEnd(false); }}
                      className={cn("pill border gap-1", loop ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:bg-muted")} title="Repeat the current line">
                      <Repeat className="h-3 w-3" /> <span className="hidden sm:inline">Loop</span>
                    </button>
                    <button onClick={() => { setPauseAtEnd((p) => !p); setLoop(false); }}
                      className={cn("pill border gap-1", pauseAtEnd ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:bg-muted")} title="Pause at the end of each line">
                      <OctagonPause className="h-3 w-3" /> <span className="hidden sm:inline">Pause</span>
                    </button>
                    <SubtitleSettings settings={settings} onProfile={() => go("profile")} theater={false} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleFullscreen} title="Fullscreen">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subtitle card (when not fullscreen) */}
          {!fullscreen && (
            <div className="paper p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  Line {Math.max(0, segIndex) + 1} of {segments.length} <InfoTip id="segment" />
                  {videoId && segIndex >= 0 && <ReportFlagButton jobId={videoId} segmentIndex={segIndex} onCorrected={reload} />}
                </span>
                {settings.showHskColors && <HskLegend />}
              </div>
              {seg ? <SubtitleLine seg={seg} settings={settings} onSelect={setSelected} saved={saved} /> : (
                <p className="text-muted-foreground text-sm">Press play to follow along.</p>
              )}
              {settings.showTranslation && seg?.translated_text && (
                <p className="text-muted-foreground border-l-2 border-primary/40 pl-3 italic mt-4">{seg.translated_text}</p>
              )}
            </div>
          )}
        </div>

        {/* Right rail: merged word look-up + dictionary search */}
        {!fullscreen && (
          <div className="space-y-4 lg:sticky lg:top-2">
            <WordPanel videoId={videoId} selected={selected} saved={saved} savingId={savingId} onSave={save} />
          </div>
        )}
      </div>

      {/* Create-list-from-video result */}
      <Dialog open={!!listResult} onOpenChange={(o) => { if (!o) setListResult(null); }}>
        <DialogContent className="paper max-w-sm text-center">
          <DialogHeader>
            <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary/15 text-secondary mx-auto mb-2"><ListPlus className="h-7 w-7" /></div>
            <DialogTitle className="font-display text-2xl text-center">Study list created</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            <span className="font-semibold text-primary">{listResult?.words ?? 0}</span> word{listResult?.words === 1 ? "" : "s"} added to “{listResult?.name}”.
          </p>
          <div className="flex gap-2 justify-center mt-2">
            <Button variant="outline" onClick={() => setListResult(null)}>Keep watching</Button>
            <Button onClick={() => { setListResult(null); go("vocab"); }}>Open list</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared settings popover: identical controls in normal + theater mode.
// Accepts a portal `container` so it stays visible while the stage is in
// native Fullscreen (content portaled to document.body is hidden then).
function SubtitleSettings({
  settings, onProfile, theater, container,
}: { settings: ReturnType<typeof useSettings>; onProfile: () => void; theater: boolean; container?: HTMLElement | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant={theater ? "ghost" : "ghost"} className={cn("h-8 w-8", theater && "text-white hover:bg-white/10")} title="Subtitle settings"><Settings2 className="h-4 w-4" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" container={container} className="w-72 paper p-4 text-foreground z-[200]">
        <h4 className="font-display font-semibold mb-2 flex items-center gap-2"><Settings2 className="h-4 w-4 text-secondary" /> Subtitle settings</h4>
        {([["Show pinyin", "showPinyin"], ["Show characters", "showCharacters"], ["Show translation", "showTranslation"], ["Colour by HSK level", "showHskColors"]] as const).map(([label, key]) => (
          <label key={key} className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
            {label}
            <Switch checked={settings[key]} onCheckedChange={(v) => updateSettings({ [key]: v })} />
          </label>
        ))}
        <div className="pt-2">
          <div className="flex items-center justify-between text-sm mb-1"><span>Subtitle size</span><span className="font-mono-num text-muted-foreground">{Math.round(settings.subtitleScale * 100)}%</span></div>
          <input type="range" min={0.8} max={1.6} step={0.1} value={settings.subtitleScale}
            onChange={(e) => updateSettings({ subtitleScale: +e.target.value })} className="w-full accent-[hsl(var(--secondary))]" />
        </div>
        <div className="pt-2">
          <div className="flex items-center justify-between text-sm mb-1"><span className="flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Theater background</span><span className="font-mono-num text-muted-foreground">{settings.subtitleBgOpacity}%</span></div>
          <input type="range" min={0} max={100} step={5} value={settings.subtitleBgOpacity}
            onChange={(e) => updateSettings({ subtitleBgOpacity: +e.target.value })} className="w-full accent-[hsl(var(--secondary))]" />
          <p className="text-xs text-muted-foreground mt-1">Used behind subtitles in fullscreen — drag the subtitle bar there to reposition it.</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Saved as your defaults in <button className="underline" onClick={onProfile}>profile</button>.</p>
      </PopoverContent>
    </Popover>
  );
}

// ── Theater mode overlay: draggable subtitle bar + auto-hide UI. Position
// and background opacity are read from the shared settings store, so they
// match whatever was configured in normal mode (and persist across toggles).
function TheaterOverlay({
  seg, settings, onSelect, saved, loop, pauseAtEnd, onPrev, onNext, onReplay,
  onToggleLoop, onTogglePause, playing, onPlayPause, onExit, portalNode, onProfile,
}: {
  seg: Segment; settings: ReturnType<typeof useSettings>; onSelect: (t: CharToken) => void; saved: CharToken[];
  loop: boolean; pauseAtEnd: boolean; onPrev: () => void; onNext: () => void; onReplay: () => void;
  onToggleLoop: () => void; onTogglePause: () => void; playing: boolean; onPlayPause: () => void; onExit: () => void;
  portalNode: HTMLElement | null; onProfile: () => void;
}) {
  const [showUI, setShowUI] = useState(true);
  const dragging = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const subY = settings.subtitlePositionY;

  const startHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowUI(false), 2500);
  }, []);
  useEffect(() => { startHideTimer(); return () => clearTimeout(hideTimer.current); }, [startHideTimer]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientY - r.top) / r.height) * 100;
    updateSettings({ subtitlePositionY: Math.max(5, Math.min(95, pct)) });
  };

  // Track mouse movement on the document (not this overlay) so showing the
  // auto-hide controls doesn't require this container to capture pointer
  // events itself — it stays click-through everywhere except its actual UI.
  useEffect(() => {
    const onMove = () => { setShowUI(true); startHideTimer(); };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [startHideTimer]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" onPointerMove={onPointerMove}>
      {/* Draggable subtitle bar */}
      <div className="absolute inset-x-0 px-8 pointer-events-auto" style={{ top: `${subY}%`, transform: "translateY(-50%)" }}>
        <div className="mx-auto max-w-4xl rounded-xl backdrop-blur px-6 py-4 relative" style={{ background: `rgba(0,0,0,${settings.subtitleBgOpacity / 100})` }}>
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 h-3 w-10 rounded-full bg-white/30 cursor-grab active:cursor-grabbing flex items-center justify-center gap-0.5"
            onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerUp={() => { dragging.current = false; }}
            title="Drag to reposition subtitles"
          >
            {[0, 1, 2].map((i) => <span key={i} className="h-0.5 w-1.5 rounded-full bg-white/70" />)}
          </div>
          <SubtitleLine seg={seg} settings={settings} onSelect={onSelect} saved={saved} dark portalNode={portalNode} />
          {settings.showTranslation && seg.translated_text && (
            <p className="text-white/80 border-l-2 border-primary/60 pl-3 italic mt-3 text-center">{seg.translated_text}</p>
          )}
        </div>
      </div>

      {/* Auto-hiding controls */}
      <div className={cn("absolute inset-x-0 bottom-3 px-6 flex items-center justify-center gap-1 transition-opacity pointer-events-auto", showUI ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div className="flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-1.5">
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={onPrev} title="Previous line"><SkipBack className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={onPlayPause} title="Play / pause">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={onNext} title="Next line"><SkipForward className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={onReplay} title="Replay this line"><RotateCcw className="h-4 w-4" /></Button>
          <button onClick={onToggleLoop} className={cn("pill border-0 gap-1 text-white", loop ? "bg-secondary" : "bg-white/10 hover:bg-white/20")}><Repeat className="h-3 w-3" /></button>
          <button onClick={onTogglePause} className={cn("pill border-0 gap-1 text-white", pauseAtEnd ? "bg-secondary" : "bg-white/10 hover:bg-white/20")}><OctagonPause className="h-3 w-3" /></button>
          <SubtitleSettings settings={settings} onProfile={onProfile} theater container={portalNode} />
          <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/10" onClick={onExit} title="Exit fullscreen"><Minimize2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

// ── Merged word look-up + dictionary search: tapping a word in the
// subtitles immediately looks it up (meaning + every occurrence across the
// user's videos); checkboxes let you hide either section. A manual search
// box covers arbitrary words too.
function WordPanel({
  videoId, selected, saved, savingId, onSave,
}: {
  videoId: string; selected: CharToken | null; saved: CharToken[]; savingId: string | null; onSave: (t: CharToken) => void;
}) {
  const { api } = useApi();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [matches, setMatches] = useState<SubtitleMatch[]>([]);
  const [filter, setFilter] = useState<"all" | "current">("current");
  const [showDict, setShowDict] = useState(true);
  const [showOccurrences, setShowOccurrences] = useState(true);
  const [searchedWord, setSearchedWord] = useState<string | null>(null);

  const lookup = useCallback(async (word: string) => {
    if (!word) return;
    setBusy(true);
    setSearchedWord(word);
    try {
      const [d, s] = await Promise.all([
        api.dictionary(word).catch(() => null),
        api.searchSubtitles(word).catch(() => []),
      ]);
      setEntry(d);
      setMatches(s);
    } finally {
      setBusy(false);
    }
  }, [api]);

  // Auto-lookup whenever a subtitle word is tapped.
  useEffect(() => { if (selected) { setQ(selected.char); lookup(selected.char); } }, [selected, lookup]);

  const shown = filter === "current" ? matches.filter((m) => m.jobId === videoId) : matches;
  const highlight = (text: string) => {
    if (!searchedWord) return text;
    const parts = text.split(new RegExp(`(${searchedWord})`, "gi"));
    return parts.map((p, i) => p.toLowerCase() === searchedWord.toLowerCase()
      ? <mark key={i} className="bg-gold/40 text-foreground rounded-sm px-0.5">{p}</mark>
      : <span key={i}>{p}</span>);
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const { go } = useNav();

  return (
    <div className="paper p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="font-display text-lg font-semibold">Word look-up</h3>
        <InfoTip id="tapLookup" />
      </div>

      <div className="flex gap-1.5 mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup(q.trim())}
          placeholder="Tap a word, or search…" className="bg-background h-9" />
        <Button size="sm" onClick={() => lookup(q.trim())} disabled={busy || !q.trim()} className="gap-1">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={showDict} onCheckedChange={(c) => setShowDict(!!c)} /> Meaning</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={showOccurrences} onCheckedChange={(c) => setShowOccurrences(!!c)} /> Occurrences</label>
      </div>

      {!searchedWord ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          <BookmarkPlus className="h-7 w-7 mx-auto mb-2 opacity-40" />
          Tap any character in the subtitles to look it up, or search above.
        </div>
      ) : (
        <>
          {showDict && (
            <div className="mb-3">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-hans-serif text-4xl leading-none" style={{ color: selected ? hskColor(selected.hsk_level) : undefined }}>{searchedWord}</span>
                <SpeakButton text={searchedWord} size="md" />
                <div>
                  <div className="text-base font-medium flex items-center gap-1">{entry?.pinyin || selected?.pinyin} <InfoTip id="tones" /></div>
                  {selected && <HskBadge level={selected.hsk_level} />}
                </div>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Meaning</p>
                {(entry?.definitions?.length || selected?.translations.length) ? (
                  <ul className="text-sm space-y-0.5">
                    {(entry?.definitions?.length ? entry.definitions : selected?.translations ?? []).map((tr, i) => <li key={i}>· {tr}</li>)}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No dictionary entry.</p>}
              </div>
              {selected && (
                <Button className="w-full mt-3 gap-1.5"
                  variant={saved.some((s) => s.char === selected.char) ? "secondary" : "default"}
                  disabled={savingId === selected.char}
                  onClick={() => onSave(selected)}>
                  {savingId === selected.char ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    : saved.some((s) => s.char === selected.char) ? <><Check className="h-4 w-4" /> Saved</>
                    : <><BookmarkPlus className="h-4 w-4" /> Save this word</>}
                </Button>
              )}
            </div>
          )}

          {showOccurrences && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Occurrences</p>
                <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
                  {([["current", "This video"], ["all", "All videos"]] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setFilter(id)}
                      className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors", filter === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {busy ? (
                <p className="text-sm text-muted-foreground py-3 text-center">Searching…</p>
              ) : shown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No occurrences found.</p>
              ) : (
                <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                  {shown.map((m, i) => (
                    <li key={i}>
                      <button onClick={() => go("watch", { id: m.jobId, t: String(m.start) })} className="w-full text-left rounded-md border border-border hover:bg-muted/50 px-3 py-2 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-medium text-muted-foreground truncate">{m.videoTitle}</span>
                          <span className="pill bg-secondary/15 text-secondary text-[10px] shrink-0 gap-1"><Clock className="h-2.5 w-2.5" />{fmt(m.start)}</span>
                        </div>
                        <p className="font-hans text-sm leading-snug">{highlight(m.text)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Subtitle line with hover tooltip + click-to-look-up ─────────────────────
function SubtitleLine({
  seg, settings, onSelect, saved, dark = false, portalNode,
}: {
  seg: Segment;
  settings: ReturnType<typeof useSettings>;
  onSelect: (t: CharToken) => void;
  saved: CharToken[];
  dark?: boolean;
  /** In theater mode, the fullscreen element to portal the hover tooltip into —
   *  document.body sits outside the fullscreen subtree and is never visible
   *  while fullscreen is active (see portalNode in WatchView). */
  portalNode?: HTMLElement | null;
}) {
  const [hover, setHover] = useState<{ tok: CharToken; x: number; y: number } | null>(null);
  const colorOf = (lvl: CharToken["hsk_level"]) =>
    settings.showHskColors ? hskColor(lvl) : (dark ? "#fff" : "hsl(var(--foreground))");
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-3 justify-center" style={{ fontSize: `${settings.subtitleScale}rem` }}>
      {seg.tokens.map((tok, i) => {
        const isSaved = saved.some((s) => s.char === tok.char);
        return (
          <button key={i}
            onClick={() => onSelect(tok)}
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ tok, x: r.left + r.width / 2, y: r.top }); }}
            onMouseLeave={() => setHover(null)}
            className={cn("flex flex-col items-center px-1.5 pt-1 pb-1 rounded-md transition-colors relative", dark ? "hover:bg-white/10" : "hover:bg-muted")}
            title="Tap to look up">
            {settings.showPinyin && <span className="text-[0.62em] leading-none mb-1" style={{ color: colorOf(tok.hsk_level) }}>{tok.pinyin}</span>}
            {settings.showCharacters && <span className="font-hans-serif text-[1.9em] leading-none" style={{ color: colorOf(tok.hsk_level) }}>{tok.char}</span>}
            {isSaved && <span className="absolute -top-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-secondary text-secondary-foreground"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
          </button>
        );
      })}

      {hover && createPortal(
        <div className="fixed z-[60] -translate-x-1/2 -translate-y-full pointer-events-none" style={{ left: hover.x, top: hover.y - 8 }}>
          <div className="paper px-3 py-2 shadow-lg max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-hans-serif text-2xl leading-none" style={{ color: colorOf(hover.tok.hsk_level) }}>{hover.tok.char}</span>
              <span className="text-sm text-muted-foreground">{hover.tok.pinyin}</span>
              {settings.showHskColors && (
                <span className="pill text-white text-[10px]" style={{ background: hskColor(hover.tok.hsk_level) }} title={HSK_LABELS[hover.tok.hsk_level]}>
                  {hover.tok.hsk_level === 0 ? "—" : `HSK ${hover.tok.hsk_level}`}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground leading-snug">
              {hover.tok.translations.length ? hover.tok.translations.join("; ") : "No dictionary entry"}
            </p>
          </div>
        </div>,
        portalNode ?? document.body
      )}
    </div>
  );
}

// ── Ghost loading — mirrors the real layout (player + subtitle card + word
// panel) instead of a bare spinner, matching the Library page's pattern.
function WatchSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-8 w-36 hidden sm:block" />
      </div>
      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <div className="paper overflow-hidden">
            <Skeleton className="aspect-video rounded-none" />
            <div className="px-4 py-3 border-t border-border bg-card space-y-3">
              <Skeleton className="h-1.5 w-full rounded-full" />
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-8 rounded-md" />)}
                <Skeleton className="h-4 w-16 ml-1" />
              </div>
            </div>
          </div>
          <div className="paper p-5 space-y-4">
            <Skeleton className="h-4 w-28" />
            <div className="flex justify-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-10" />)}
            </div>
            <Skeleton className="h-4 w-2/3 mx-auto" />
          </div>
        </div>
        <div className="paper p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
