import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ENV } from "@/app/session";

export interface VideoHandle {
  play: () => void;
  pause: () => void;
  seekTo: (t: number) => void;
  getTime: () => number;
}

interface Props {
  url: string;
  startTime?: number;
  onTime: (t: number) => void;
  onDuration?: (d: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

const isYouTube = (url: string) => /(?:youtube\.com|youtu\.be)/.test(url || "");
const youTubeId = (url: string) => {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return m ? m[1] : null;
};

const isBilibili = (url: string) => /bilibili\.com\/video\//.test(url || "");
const bilibiliId = (url: string) => {
  const m = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/);
  return m ? m[1] : null;
};
const mediaSrc = (url: string) => {
  if (/^https?:\/\//.test(url) && !url.includes("/media/")) return url;
  const file = url.split("/").pop()?.split("\\").pop() ?? "";
  return `${ENV.apiBase}/media/${file}`;
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

export const VideoPlayer = forwardRef<VideoHandle, Props>(function VideoPlayer(
  { url, startTime = 0, onTime, onDuration, onPlayingChange }, ref
) {
  const yt = isYouTube(url);
  const ytId = yt ? youTubeId(url) : null;
  const bili = isBilibili(url);
  const biliId = bili ? bilibiliId(url) : null;
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | undefined>(undefined);

  // Bilibili's embed has no public, stable JS/postMessage API for play/pause/
  // seek/getCurrentTime (unlike YouTube's IFrame API), so playback control and
  // time-synced subtitles aren't available for it - play/pause/seek/getTime
  // are no-ops and the subtitle overlay won't track its position.
  useImperativeHandle(ref, () => ({
    play: () => { if (yt) playerRef.current?.playVideo?.(); else if (!bili) videoRef.current?.play(); },
    pause: () => { if (yt) playerRef.current?.pauseVideo?.(); else if (!bili) videoRef.current?.pause(); },
    seekTo: (t: number) => {
      if (yt) playerRef.current?.seekTo?.(t, true);
      else if (!bili && videoRef.current) videoRef.current.currentTime = t;
    },
    getTime: () => (yt ? playerRef.current?.getCurrentTime?.() ?? 0 : bili ? 0 : videoRef.current?.currentTime ?? 0),
  }), [yt, bili]);

  // YouTube setup
  useEffect(() => {
    if (!yt || !ytId) return;
    let destroyed = false;
    loadYTApi().then(() => {
      if (destroyed || !mountRef.current) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        height: "100%", width: "100%", videoId: ytId,
        playerVars: { autoplay: 0, modestbranding: 1, rel: 0, start: Math.floor(startTime) },
        events: {
          onReady: () => {
            onDuration?.(playerRef.current?.getDuration?.() ?? 0);
            pollRef.current = window.setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === "number") onTime(t);
            }, 200);
          },
          onStateChange: (e: any) => {
            const YT = window.YT;
            onPlayingChange?.(e.data === YT.PlayerState.PLAYING);
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
  }, [yt, ytId]);

  if (yt) {
    return (
      <div className="absolute inset-0 bg-black">
        <div ref={mountRef} className="h-full w-full" />
      </div>
    );
  }

  if (bili && biliId) {
    return (
      <div className="absolute inset-0 bg-black">
        <iframe
          className="h-full w-full"
          src={`https://player.bilibili.com/player.html?bvid=${biliId}&autoplay=0&high_quality=1&danmaku=0`}
          allowFullScreen
          frameBorder="0"
          scrolling="no"
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full bg-black"
      src={mediaSrc(url)}
      controls
      onLoadedMetadata={(e) => { const v = e.currentTarget; if (startTime) v.currentTime = startTime; onDuration?.(v.duration); }}
      onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
      onPlay={() => onPlayingChange?.(true)}
      onPause={() => onPlayingChange?.(false)}
    />
  );
});
