import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, PauseOctagon,
  BookmarkPlus, Check, Eye, Settings2, Volume2, Maximize2,
} from "lucide-react";
import {
  VIDEOS, DEMO_SEGMENTS, hskColor, HSK_LABELS, type CharToken, type HskLevel,
} from "@/lib/data";
import { HskLegend, HskBadge } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNav } from "@/app/nav";
import { cn } from "@/lib/utils";

const TOTAL = DEMO_SEGMENTS[DEMO_SEGMENTS.length - 1].end;

export function WatchView() {
  const { params } = useNav();
  const video = VIDEOS.find((v) => v.id === params.id) ?? VIDEOS[0];

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [showChars, setShowChars] = useState(true);
  const [showTrans, setShowTrans] = useState(true);
  const [loop, setLoop] = useState(false);
  const [pauseAtEnd, setPauseAtEnd] = useState(false);
  const [selected, setSelected] = useState<CharToken | null>(null);
  const [saved, setSaved] = useState<CharToken[]>([]);
  const raf = useRef<number>();
  const last = useRef<number>(0);

  const segIndex = DEMO_SEGMENTS.findIndex((s) => t >= s.start && t < s.end);
  const seg = DEMO_SEGMENTS[segIndex] ?? DEMO_SEGMENTS[0];

  // simulated playback clock
  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT((prev) => {
        let next = prev + dt;
        const cur = DEMO_SEGMENTS.find((s) => prev >= s.start && prev < s.end);
        if (cur && next >= cur.end - 0.02) {
          if (pauseAtEnd) { setPlaying(false); return cur.end - 0.03; }
          if (loop) return cur.start;
        }
        if (next >= TOTAL) return 0;
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current!);
  }, [playing, loop, pauseAtEnd]);

  const seek = (time: number) => setT(Math.max(0, Math.min(TOTAL, time)));
  const jumpSeg = (dir: number) => {
    const i = Math.max(0, Math.min(DEMO_SEGMENTS.length - 1, segIndex + dir));
    seek(DEMO_SEGMENTS[i].start + 0.01);
  };
  const save = (tok: CharToken) => {
    if (!saved.some((s) => s.char === tok.char)) setSaved((s) => [tok, ...s]);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      {/* ── Player + subtitles ─────────────────────────── */}
      <div className="space-y-4 min-w-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-semibold">{video.title}</h1>
            <InfoTip id="tapLookup" side="bottom" />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {video.channel} · {video.topic}
          </p>
        </div>

        {/* Stage */}
        <div className="paper overflow-hidden">
          <div
            className="relative aspect-video flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 50% 40%, hsl(${video.thumbHue} 40% 26%), hsl(${video.thumbHue} 45% 12%))`,
            }}
          >
            <span className="font-hans-serif text-white/10 text-[10rem] leading-none select-none">
              听
            </span>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="absolute inset-0 grid place-items-center group"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-black/40 backdrop-blur-sm text-white group-hover:scale-110 group-hover:bg-primary/80 transition-all">
                {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-1" />}
              </span>
            </button>
            <span className="absolute top-3 left-3 pill bg-black/50 text-white">
              <Eye className="h-3 w-3" /> Live subtitle overlay
            </span>
            <button className="absolute top-3 right-3 text-white/70 hover:text-white" title="Theater mode">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Transport */}
          <div className="px-4 py-3 border-t border-border bg-card">
            <div
              className="group relative h-1.5 rounded-full bg-muted cursor-pointer mb-2"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                seek(((e.clientX - r.left) / r.width) * TOTAL);
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${(t / TOTAL) * 100}%` }}
              />
              {/* segment ticks */}
              {DEMO_SEGMENTS.map((s, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 h-2 w-px bg-foreground/20"
                  style={{ left: `${(s.start / TOTAL) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => jumpSeg(-1)} title="Previous line">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => jumpSeg(1)} title="Next line">
                <SkipForward className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono-num text-muted-foreground ml-1">
                {fmt(t)} / {fmt(TOTAL)}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => { setLoop((l) => !l); setPauseAtEnd(false); }}
                  className={cn("pill border gap-1", loop ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:bg-muted")}
                  title="Repeat the current line"
                >
                  <Repeat className="h-3 w-3" /> Loop line
                </button>
                <button
                  onClick={() => { setPauseAtEnd((p) => !p); setLoop(false); }}
                  className={cn("pill border gap-1", pauseAtEnd ? "bg-secondary text-secondary-foreground border-secondary" : "border-border text-muted-foreground hover:bg-muted")}
                  title="Pause at the end of each line"
                >
                  <PauseOctagon className="h-3 w-3" /> Pause at end
                </button>
                <InfoTip id="segmentLoop" />
                <Volume2 className="h-4 w-4 text-muted-foreground ml-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle card */}
        <div className="paper p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Line {segIndex + 1} of {DEMO_SEGMENTS.length}
              <InfoTip id="pinyin" />
            </span>
            <HskLegend />
          </div>

          {/* character row */}
          <div className="flex flex-wrap gap-x-1 gap-y-3 mb-4">
            {seg.tokens.map((tok, i) => {
              const isSaved = saved.some((s) => s.char === tok.char);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(tok)}
                  className={cn(
                    "flex flex-col items-center px-1.5 pt-1 pb-1 rounded-md transition-colors hover:bg-muted relative",
                    selected?.char === tok.char && "bg-muted ring-1 ring-primary/40"
                  )}
                  title="Tap to look up"
                >
                  {showPinyin && (
                    <span className="text-[11px] leading-none mb-1" style={{ color: hskColor(tok.hsk_level) }}>
                      {tok.pinyin}
                    </span>
                  )}
                  {showChars && (
                    <span className="font-hans-serif text-3xl leading-none" style={{ color: hskColor(tok.hsk_level) }}>
                      {tok.char}
                    </span>
                  )}
                  {isSaved && (
                    <span className="absolute -top-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-secondary text-secondary-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {showTrans && (
            <p className="text-muted-foreground border-l-2 border-primary/40 pl-3 italic">
              {seg.translated_text}
            </p>
          )}
        </div>
      </div>

      {/* ── Right rail ───────────────────────────────────── */}
      <div className="space-y-4 lg:sticky lg:top-2">
        {/* Lookup */}
        <div className="paper p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <h3 className="font-display text-lg font-semibold">Word look-up</h3>
            <InfoTip id="tapLookup" />
          </div>
          {selected ? (
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-hans-serif text-5xl leading-none" style={{ color: hskColor(selected.hsk_level) }}>
                  {selected.char}
                </span>
                <div>
                  <div className="text-lg font-medium">{selected.pinyin}</div>
                  <HskBadge level={selected.hsk_level} />
                </div>
              </div>
              <div className="mt-3 rounded-md bg-muted/60 p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                  Meaning
                </p>
                <ul className="text-sm space-y-0.5">
                  {selected.translations.map((tr, i) => (
                    <li key={i}>· {tr}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 rounded-md border border-dashed border-border p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  Saved with context <InfoTip id="contextSentence" />
                </p>
                <p className="font-hans text-sm">{seg.tokens.map((x) => x.char).join("")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{seg.translated_text}</p>
              </div>
              <Button
                className="w-full mt-3 gap-1.5"
                variant={saved.some((s) => s.char === selected.char) ? "secondary" : "default"}
                onClick={() => save(selected)}
              >
                {saved.some((s) => s.char === selected.char) ? (
                  <><Check className="h-4 w-4" /> Saved to list</>
                ) : (
                  <><BookmarkPlus className="h-4 w-4" /> Save this word</>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">
              <BookmarkPlus className="h-7 w-7 mx-auto mb-2 opacity-40" />
              Tap any character in the subtitle to see its meaning, pinyin and HSK level — then save it
              with one click.
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="paper p-4">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-3">
            <Settings2 className="h-4 w-4 text-secondary" /> Subtitle display
          </h3>
          {[
            ["Show pinyin", showPinyin, setShowPinyin],
            ["Show characters", showChars, setShowChars],
            ["Show translation", showTrans, setShowTrans],
          ].map(([label, val, set]) => (
            <label key={label as string} className="flex items-center justify-between py-1.5 text-sm cursor-pointer">
              {label as string}
              <Switch checked={val as boolean} onCheckedChange={set as (v: boolean) => void} />
            </label>
          ))}
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Hide a row to quiz yourself — e.g. hide pinyin and see if you can still read the characters.
          </p>
        </div>

        {/* Saved this session */}
        <div className="paper p-4">
          <h3 className="font-display text-lg font-semibold mb-2">
            Saved this session
            <span className="ml-2 pill bg-secondary/15 text-secondary">{saved.length}</span>
          </h3>
          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet — your saved words will appear here and flow into your vocabulary lists.</p>
          ) : (
            <ul className="space-y-1.5">
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
    </div>
  );
}
