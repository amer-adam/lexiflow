import { useState } from "react";
import { PlayCircle, Lock, Globe, Search, Plus, Film } from "lucide-react";
import { type VideoMeta } from "@/lib/data";
import { PageHeader, EmptyState, ErrorState, Skeleton } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNav } from "@/app/nav";
import { useQuery } from "@/app/useApi";

export function LibraryView() {
  const { go } = useNav();
  const [q, setQ] = useState("");
  const { data, loading, error, reload } = useQuery((api) => api.getLibrary(), []);

  const videos = (data ?? []).filter(
    (v) =>
      v.title.toLowerCase().includes(q.toLowerCase()) ||
      (v.channel ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        eyebrow="Your collection"
        title="Library"
        right={
          <Button className="gap-1.5" onClick={() => go("request")}>
            <Plus className="h-4 w-4" /> Add a video
          </Button>
        }
      >
        Every video you've added is ready to watch with interactive, colour-graded subtitles.
      </PageHeader>

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos…" className="pl-9 bg-card" />
        </div>
      )}

      {loading && !data ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="paper overflow-hidden">
              <Skeleton className="h-32 rounded-none" />
              <div className="p-3.5 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="paper"><ErrorState message={error} onRetry={reload} /></div>
      ) : videos.length === 0 ? (
        <div className="paper">
          <EmptyState
            icon={<Film className="h-10 w-10" />}
            title={q ? "No videos match your search" : "Your library is empty"}
            action={!q && <Button className="gap-1.5" onClick={() => go("request")}><Plus className="h-4 w-4" /> Add your first video</Button>}
          >
            {!q && "Add a YouTube link or upload a file and it'll be turned into an interactive lesson."}
          </EmptyState>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => <VideoCard key={v.id} v={v} onOpen={() => go("watch", { id: v.id })} />)}
        </div>
      )}
    </div>
  );
}

function VideoCard({ v, onOpen }: { v: VideoMeta; onOpen: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button onClick={onOpen} className="group text-left paper overflow-hidden hover:-translate-y-0.5 transition-transform">
      <div
        className="relative h-32 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, hsl(${v.thumbHue} 45% 32%), hsl(${v.thumbHue} 38% 16%))` }}
      >
        {v.thumbnail && imgOk && (
          <img
            src={v.thumbnail}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/15 group-hover:bg-black/30 transition-colors" />
        <PlayCircle className="relative h-12 w-12 text-white/90 group-hover:scale-110 transition-transform drop-shadow" strokeWidth={1.5} />
        {v.duration && v.duration !== "—" && (
          <span className="absolute bottom-2 right-2 pill bg-black/60 text-white text-[11px]">{v.duration}</span>
        )}
        <span className="absolute top-2 left-2 pill bg-black/50 text-white text-[11px]">
          {v.visibility === "private" ? <><Lock className="h-3 w-3" /> Private</> : <><Globe className="h-3 w-3" /> Public</>}
        </span>
      </div>
      <div className="p-3.5">
        <div className="font-semibold leading-snug line-clamp-2 min-h-[2.6rem]">{v.title}</div>
        <div className="text-sm text-muted-foreground mt-1 truncate">
          {v.channel || v.description || "Video"}
        </div>
        {v.dateAdded && <div className="text-xs text-muted-foreground mt-1.5">Added {v.dateAdded}</div>}
      </div>
    </button>
  );
}
