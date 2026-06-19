import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SkipBack, SkipForward, Repeat, OctagonPause, BookmarkPlus, Check, Settings2,
  Maximize2, Minimize2, Film, Loader2, ArrowLeft, Play, Pause, PartyPopper,
} from "lucide-react";
import { hskColor, HSK_LABELS, type CharToken, type Segment } from "@/lib/data";
import { HskLegend, HskBadge, EmptyState, ErrorState, Loading } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { VideoPlayer, type VideoHandle } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNav } from "@/app/nav";
import { useApi, useQuery } from "@/app/useApi";
import { useSettings, updateSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function WatchView() {
  const { params, go } = useNav();
  const { api } = useApi();
  const settings = useSettings();
  const videoId = params.id;

  const { data: job, loading, error, reload } = useQuery(
    (a) => (videoId ? a.getJob(videoId) : Promise.resolve(null)),
    [videoId]
  );
  const segments = useMemo(() => job?.segments ?? [], [job]);
  const TOTAL = segments.length ? segments[segments.length - 1].end : 1;

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
  const [summary, setSummary] = useState<{ saved: number; tracked: number } | null>(null);

  const segIndex = segments.findIndex((s) => t >= s.start && t < s.end);
  const seg = segments[segIndex] ?? segments[0];

  // Refs keep the player's time-poll closure reading current values without
  // re-creating the player on every state change.
  const segmentsRef = useRef(segments); segmentsRef.current = segments;
  const loopRef = useRef(loop); loopRef.current = loop;
  const pauseRef = useRef(pauseAtEnd); pauseRef.current = pauseAtEnd;

  // Drive loop / pause-at-end off the real player's time. Stable identity.
  const onTime = useCallback((time: number) => {
    setT(time);
    const cur = segmentsRef.current.find((s) => time >= s.start && time < s.end);
    if (!cur) return;
    if (time >= cur.end - 0.15 && lastBoundary.current !== cur.end) {
      if (pauseRef.current) { player.current?.pause(); lastBoundary.current = cur.end; }
      else if (loopRef.current) { player.current?.seekTo(cur.start); lastBoundary.current = cur.end; }
    }
    if (time < cur.end - 0.3) lastBoundary.current = -1;
  }, []);

  const jumpSeg = (dir: number) => {
    const i = Math.max(0, Math.min(segments.length - 1, (segIndex < 0 ? 0 : segIndex) + dir));
    if (segments[i]) player.current?.seekTo(segments[i].start + 0.01);
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // Fullscreen
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
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

  // Mark words seen + show the session summary, then leave.
  const finishWatching = async () => {
    if (!videoId) { go("library"); return; }
    setLeaving(true);
    let tracked = 0;
    try { tracked = (await api.markVideoSeen(videoId)).tracked; } catch { /* ignore */ }
    setLeaving(false);
    setSummary({ saved: saved.length, tracked });
  };

  // ── States ───────────────────────────────────────────────────
  if (!videoId) {
    return (
      <div className="paper">
        <EmptyState icon={<Film className="h-10 w-10" />} title="Nothing playing yet"
          action={<Button onClick={() => go("library")}>Browse your library</Button>}>
          Pick a video from your library to watch it with interactive subtitles.
        </EmptyState>
      </div>
    );
  }
  if (loading && !job) return <Loading label="Loading subtitles…" />;
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
        <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-1">Tap a word <InfoTip id="tapLookup" /></span>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* Player + subtitles */}
        <div className="space-y-4 min-w-0">
          {/* Stage (player + fullscreen overlay) */}
          <div ref={stageRef} className={cn("paper overflow-hidden", fullscreen && "rounded-none bg-black flex flex-col justify-center")}>
            <div className="relative aspect-video bg-black">
              {job?.videoUrl ? (
                <VideoPlayer ref={player} url={job.videoUrl} startTime={0}
                  onTime={onTime} onPlayingChange={setPlaying} />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">
                  No playable source for this video.
                </div>
              )}
              {/* Subtitle overlay when fullscreen */}
              {fullscreen && seg && (
                <div className="absolute inset-x-0 bottom-6 px-8">
                  <div className="mx-auto max-w-4xl rounded-xl bg-black/55 backdrop-blur px-6 py-4">
                    <SubtitleLine seg={seg} settings={settings} onSelect={setSelected} saved={saved} light />
                  </div>
                </div>
              )}
            </div>

            {/* Transport */}
            <div className={cn("px-4 py-3 border-t border-border", fullscreen ? "bg-black/80 border-white/10" : "bg-card")}>
              <div className={cn("group relative h-1.5 rounded-full bg-muted cursor-pointer mb-2", fullscreen && "bg-white/20")}
                onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); player.current?.seekTo(((e.clientX - r.left) / r.width) * TOTAL); }}>
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(t / TOTAL) * 100}%` }} />
                {segments.map((s, i) => (
                  <span key={i} className="absolute top-1/2 -translate-y-1/2 h-2 w-px bg-foreground/20" style={{ left: `${(s.start / TOTAL) * 100}%` }} />
                ))}
              </div>
              <div className={cn("flex items-center gap-1", fullscreen && "text-white")}>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => jumpSeg(-1)} title="Previous line"><SkipBack className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => (playing ? player.current?.pause() : player.current?.play())} title="Play / pause">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => jumpSeg(1)} title="Next line"><SkipForward className="h-4 w-4" /></Button>
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
                  <SubtitleSettings settings={settings} onProfile={() => go("profile")} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleFullscreen} title="Fullscreen">
                    {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Subtitle card (when not fullscreen) */}
          {!fullscreen && (
            <div className="paper p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  Line {Math.max(0, segIndex) + 1} of {segments.length} <InfoTip id="segment" />
                </span>
                <HskLegend />
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

        {/* Right rail */}
        {!fullscreen && (
          <div className="space-y-4 lg:sticky lg:top-2">
            <div className="paper p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <h3 className="font-display text-lg font-semibold">Word look-up</h3>
                <InfoTip id="tapLookup" />
              </div>
              {selected ? (
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-hans-serif text-5xl leading-none" style={{ color: hskColor(selected.hsk_level) }}>{selected.char}</span>
                    <div>
                      <div className="text-lg font-medium flex items-center gap-1">{selected.pinyin} <InfoTip id="tones" /></div>
                      <HskBadge level={selected.hsk_level} />
                    </div>
                  </div>
                  <div className="mt-3 rounded-md bg-muted/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Meaning</p>
                    {selected.translations.length ? (
                      <ul className="text-sm space-y-0.5">{selected.translations.map((tr, i) => <li key={i}>· {tr}</li>)}</ul>
                    ) : <p className="text-sm text-muted-foreground">No dictionary entry.</p>}
                  </div>
                  <Button className="w-full mt-3 gap-1.5"
                    variant={saved.some((s) => s.char === selected.char) ? "secondary" : "default"}
                    disabled={savingId === selected.char}
                    onClick={() => save(selected)}>
                    {savingId === selected.char ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                      : saved.some((s) => s.char === selected.char) ? <><Check className="h-4 w-4" /> Saved</>
                      : <><BookmarkPlus className="h-4 w-4" /> Save this word</>}
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  <BookmarkPlus className="h-7 w-7 mx-auto mb-2 opacity-40" />
                  Tap any character to see its meaning, or hover for a quick glance.
                </div>
              )}
            </div>

            <div className="paper p-4">
              <h3 className="font-display text-lg font-semibold mb-2">Saved this session <span className="ml-1 pill bg-secondary/15 text-secondary">{saved.length}</span></h3>
              {saved.length === 0 ? (
                <p className="text-sm text-muted-foreground">Saved words flow into your “Saved words” list.</p>
              ) : (
                <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                  {saved.map((s) => (
                    <li key={s.char} className="flex items-center gap-2 text-sm">
                      <span className="font-hans-serif text-lg" style={{ color: hskColor(s.hsk_level) }}>{s.char}</span>
                      <span className="text-muted-foreground">{s.pinyin}</span>
                      <span className="ml-auto text-xs text-muted-foreground truncate">{s.translations[0]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Session summary on leaving */}
      <Dialog open={!!summary} onOpenChange={(o) => { if (!o) { setSummary(null); go("library"); } }}>
        <DialogContent className="paper max-w-sm text-center">
          <DialogHeader>
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gold/15 text-gold mx-auto mb-2"><PartyPopper className="h-7 w-7" /></div>
            <DialogTitle className="font-display text-2xl text-center">Nice session!</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You saved <span className="font-semibold text-primary">{summary?.saved ?? 0}</span> new word{summary?.saved === 1 ? "" : "s"} from this video.
          </p>
          {!!summary?.tracked && (
            <p className="text-sm text-muted-foreground">
              {summary.tracked} word{summary.tracked === 1 ? "" : "s"} added to your <span className="font-medium">Seen</span> list.
            </p>
          )}
          <div className="flex gap-2 justify-center mt-2">
            {!!summary?.saved && <Button variant="outline" onClick={() => { setSummary(null); go("vocab"); }}>View saved</Button>}
            <Button onClick={() => { setSummary(null); go("library"); }}>Back to library</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Stable top-level settings popover (so it isn't remounted by the time-ticks).
function SubtitleSettings({ settings, onProfile }: { settings: ReturnType<typeof useSettings>; onProfile: () => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Subtitle settings"><Settings2 className="h-4 w-4" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 paper p-4 text-foreground">
        <h4 className="font-display font-semibold mb-2 flex items-center gap-2"><Settings2 className="h-4 w-4 text-secondary" /> Subtitle settings</h4>
        {([["Show pinyin", "showPinyin"], ["Show characters", "showCharacters"], ["Show translation", "showTranslation"]] as const).map(([label, key]) => (
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
        <p className="text-xs text-muted-foreground mt-2">Saved as your defaults in <button className="underline" onClick={onProfile}>profile</button>.</p>
      </PopoverContent>
    </Popover>
  );
}

// ── Subtitle line with hover tooltip + click-to-look-up ─────────────────────
function SubtitleLine({
  seg, settings, onSelect, saved, light = false,
}: {
  seg: Segment;
  settings: ReturnType<typeof useSettings>;
  onSelect: (t: CharToken) => void;
  saved: CharToken[];
  light?: boolean;
}) {
  const [hover, setHover] = useState<{ tok: CharToken; x: number; y: number } | null>(null);
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-3 justify-center" style={{ fontSize: `${settings.subtitleScale}rem` }}>
      {seg.tokens.map((tok, i) => {
        const isSaved = saved.some((s) => s.char === tok.char);
        return (
          <button key={i}
            onClick={() => onSelect(tok)}
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ tok, x: r.left + r.width / 2, y: r.top }); }}
            onMouseLeave={() => setHover(null)}
            className={cn("flex flex-col items-center px-1.5 pt-1 pb-1 rounded-md transition-colors relative", light ? "hover:bg-white/10" : "hover:bg-muted")}
            title="Tap to look up">
            {settings.showPinyin && <span className="text-[0.62em] leading-none mb-1" style={{ color: light ? "#fff" : hskColor(tok.hsk_level) }}>{tok.pinyin}</span>}
            {settings.showCharacters && <span className="font-hans-serif text-[1.9em] leading-none" style={{ color: light ? "#fff" : hskColor(tok.hsk_level) }}>{tok.char}</span>}
            {isSaved && <span className="absolute -top-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-secondary text-secondary-foreground"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
          </button>
        );
      })}

      {hover && (
        <div className="fixed z-[60] -translate-x-1/2 -translate-y-full pointer-events-none" style={{ left: hover.x, top: hover.y - 8 }}>
          <div className="paper px-3 py-2 shadow-lg max-w-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-hans-serif text-2xl leading-none" style={{ color: hskColor(hover.tok.hsk_level) }}>{hover.tok.char}</span>
              <span className="text-sm text-muted-foreground">{hover.tok.pinyin}</span>
              <span className="pill text-white text-[10px]" style={{ background: hskColor(hover.tok.hsk_level) }} title={HSK_LABELS[hover.tok.hsk_level]}>
                {hover.tok.hsk_level === 0 ? "—" : `HSK ${hover.tok.hsk_level}`}
              </span>
            </div>
            <p className="text-xs text-foreground leading-snug">
              {hover.tok.translations.length ? hover.tok.translations.join("; ") : "No dictionary entry"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
