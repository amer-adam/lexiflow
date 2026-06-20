import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/app/useApi";
import type { PreviewClip, PreviewClipSegment } from "@/lib/api";
import { hskColor, type HskLevel } from "@/lib/data";

const clampHsk = (n: unknown): HskLevel => {
  const v = Number(n);
  return v >= 1 && v <= 6 ? (v as HskLevel) : 0;
};

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; }
}

let ytApiPromise: Promise<void> | null = null;
function loadYTApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function activeSegment(segments: PreviewClipSegment[], t: number): PreviewClipSegment | null {
  for (const s of segments) if (t >= s.start && t < s.end) return s;
  return null;
}

/**
 * A real, time-locked clip from the app's own library — not a mockup.
 * Hardcoded clip metadata is fetched from a small server-cached endpoint
 * (see backend src/data/landingPreviewClip.json) so it keeps working even if
 * the source video is later removed from the main library. Playback is
 * clamped to [clip.lockStart, clip.lockEnd) both via the YouTube embed's own
 * start/end params and a time poll as a backstop — going past either edge
 * shows a sign-up gate instead of more of the video.
 */
export function LandingPreviewPlayer({ onSignUp }: { onSignUp: () => void }) {
  const { api } = useApi();
  const [clip, setClip] = useState<PreviewClip | null>(null);
  const [gated, setGated] = useState(false);
  const [started, setStarted] = useState(false);
  const [seg, setSeg] = useState<PreviewClipSegment | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    api.getPreviewClip().then(setClip).catch(() => setClip(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segments = useMemo(() => clip?.segments ?? [], [clip]);

  useEffect(() => {
    if (!clip || !started) return;
    let destroyed = false;
    loadYTApi().then(() => {
      if (destroyed || !mountRef.current) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        height: "100%", width: "100%", videoId: clip.youtubeId,
        playerVars: {
          autoplay: 1, modestbranding: 1, rel: 0, controls: 1,
          start: Math.floor(clip.lockStart), end: Math.floor(clip.lockEnd),
        },
        events: {
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) setGated(true);
          },
          onReady: () => {
            pollRef.current = window.setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t !== "number") return;
              if (t < clip.lockStart - 1 || t >= clip.lockEnd) {
                playerRef.current?.pauseVideo?.();
                setGated(true);
                return;
              }
              setSeg(activeSegment(segments, t));
            }, 250);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      clearInterval(pollRef.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, started]);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="paper p-5 -rotate-1">
        <div className="relative aspect-video rounded-md overflow-hidden mb-4 bg-gradient-to-br from-secondary/30 to-primary/20">
          {!started && (
            <button
              type="button"
              onClick={() => setStarted(true)}
              disabled={!clip}
              className="absolute inset-0 grid place-items-center group disabled:cursor-wait"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-black/40 group-hover:bg-black/55 transition-colors">
                <Play className="h-7 w-7 text-white" strokeWidth={1.5} />
              </span>
            </button>
          )}
          {started && <div ref={mountRef} className="absolute inset-0" />}
          {gated && (
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 p-5 text-center z-10">
              <Lock className="h-7 w-7 text-secondary" />
              <p className="font-display font-semibold">That's the free preview</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[14rem]">
                Sign up free to watch the rest with synced pinyin, translations and tap-to-learn vocabulary.
              </p>
              <Button size="sm" onClick={onSignUp} className="gap-1.5 mt-1">
                <Sparkles className="h-3.5 w-3.5" /> Sign up to keep watching
              </Button>
            </div>
          )}
        </div>
        {seg && !gated ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">{seg.pinyin}</p>
            <p className="font-hans-serif text-base leading-snug mb-1.5 flex gap-0.5 flex-wrap">
              {Object.keys(seg.characters).length > 0
                ? Object.entries(seg.characters).map(([char, info], i) => (
                  <span key={i} style={{ color: hskColor(clampHsk(info?.hsk_level)) }}>
                    {char.replace(/[[\]]/g, "")}
                  </span>
                ))
                : seg.text}
            </p>
            <p className="text-sm text-secondary">{seg.translated_text}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {started ? "A real clip from the library — tap play and watch subtitles sync live." : "A real clip from LexiFlow's library — press play to see subtitles sync live."}
          </p>
        )}
      </div>
      <div className="seal absolute -bottom-4 -right-4 grid h-14 w-14 place-items-center text-xl font-bold rotate-3 shadow-lg">
        流
      </div>
    </div>
  );
}
