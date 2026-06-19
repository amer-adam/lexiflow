import { useMemo, useState } from "react";
import { PlayCircle, Lock, Globe, Search, Plus, Film, Clock, ArrowUpDown } from "lucide-react";
import { type VideoMeta } from "@/lib/data";
import { PageHeader, EmptyState, ErrorState, Skeleton } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNav } from "@/app/nav";
import { useQuery } from "@/app/useApi";
import { type SubtitleMatch, type VideoProgress } from "@/lib/api";
import { cn } from "@/lib/utils";

type SearchMode = "titles" | "subtitles" | "split";
type FilterMode = "all" | "mine" | "private";
type SortMode = "newest" | "oldest" | "az";

export function LibraryView() {
  const { go } = useNav();
  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("titles");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const { data, loading, error, reload } = useQuery((a) => a.getLibrary(), []);

  const { data: progressById } = useQuery(async (a) => {
    const vids = data ?? [];
    const entries = await Promise.all(
      vids.map(async (v) => [v.id, await a.getProgress(v.id).catch(() => null)] as const)
    );
    return new Map(entries.filter(([, p]) => p) as [string, VideoProgress][]);
  }, [data]);

  const { data: subtitleResults, loading: subLoading } = useQuery(
    (a) => (q.trim() && searchMode !== "titles" ? a.searchSubtitles(q.trim()) : Promise.resolve([] as SubtitleMatch[])),
    [q, searchMode]
  );

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (filterMode === "mine") list = list.filter((v) => v.ownedByMe);
    if (filterMode === "private") list = list.filter((v) => v.visibility === "private");
    if (q.trim() && searchMode !== "subtitles") {
      const needle = q.toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(needle) || (v.channel ?? "").toLowerCase().includes(needle));
    }
    list = [...list].sort((a, b) => {
      if (sortMode === "az") return a.title.localeCompare(b.title);
      const da = a.dateAdded ?? "", db = b.dateAdded ?? "";
      return sortMode === "newest" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return list;
  }, [data, filterMode, q, searchMode, sortMode]);

  const titleMatches = searchMode === "subtitles" ? [] : filtered;
  const subMatches = searchMode === "titles" || !q.trim() ? [] : subtitleResults ?? [];
  const isSplit = searchMode === "split" && q.trim();
  const displayedVideos = isSplit ? titleMatches.slice(0, 4) : titleMatches;
  const displayedSubs = isSplit ? subMatches.slice(0, 4) : subMatches;

  const videoById = useMemo(() => new Map((data ?? []).map((v) => [v.id, v])), [data]);

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
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos or subtitles…" className="pl-9 bg-card" />
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              {([["titles", "Titles"], ["subtitles", "Subtitles"], ["split", "Split"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setSearchMode(id)}
                  className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", searchMode === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              {([["all", "All content"], ["mine", "My uploads"], ["private", "Private"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setFilterMode(id)}
                  className={cn("rounded-md px-3 py-1 font-medium transition-colors", filterMode === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setSortMode((m) => (m === "newest" ? "oldest" : m === "oldest" ? "az" : "newest"))}
              className="pill border border-border text-muted-foreground hover:bg-muted gap-1">
              <ArrowUpDown className="h-3 w-3" /> {sortMode === "newest" ? "Newest first" : sortMode === "oldest" ? "Oldest first" : "Name A–Z"}
            </button>
          </div>
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
      ) : displayedVideos.length === 0 && displayedSubs.length === 0 ? (
        <div className="paper">
          <EmptyState
            icon={<Film className="h-10 w-10" />}
            title={q ? "No matches" : "Your library is empty"}
            action={!q && <Button className="gap-1.5" onClick={() => go("request")}><Plus className="h-4 w-4" /> Add your first video</Button>}
          >
            {!q && "Add a YouTube link or upload a file and it'll be turned into an interactive lesson."}
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-6">
          {searchMode !== "subtitles" && displayedVideos.length > 0 && (
            <div>
              {isSplit && <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Video matches</h3>}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedVideos.map((v) => (
                  <VideoCard key={v.id} v={v} progress={progressById?.get(v.id)} onOpen={() => go("watch", { id: v.id })} />
                ))}
              </div>
              {isSplit && titleMatches.length > 4 && (
                <button onClick={() => setSearchMode("titles")} className="text-sm text-secondary hover:underline mt-2">See all {titleMatches.length} video matches →</button>
              )}
            </div>
          )}

          {searchMode !== "titles" && q.trim() && (
            <div>
              {isSplit && <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Subtitle matches</h3>}
              {subLoading && !subtitleResults ? (
                <Skeleton className="h-20" />
              ) : displayedSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subtitle lines match “{q}”.</p>
              ) : (
                <div className="space-y-2">
                  {displayedSubs.map((m, i) => (
                    <SubtitleResultCard key={i} m={m} title={videoById.get(m.jobId)?.title} onOpen={() => go("watch", { id: m.jobId, t: String(m.start) })} />
                  ))}
                </div>
              )}
              {isSplit && subMatches.length > 4 && (
                <button onClick={() => setSearchMode("subtitles")} className="text-sm text-secondary hover:underline mt-2">See all {subMatches.length} subtitle matches →</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoCard({ v, progress, onOpen }: { v: VideoMeta; progress?: VideoProgress; onOpen: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  const pct = progress && progress.duration > 0 ? Math.min(100, Math.round((progress.currentTime / progress.duration) * 100)) : 0;
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
        {pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="p-3.5">
        <div className="font-semibold leading-snug line-clamp-2 min-h-[2.6rem]">{v.title}</div>
        <div className="text-sm text-muted-foreground mt-1 truncate">
          {v.channel || v.description || "Video"}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          {v.dateAdded && <span>Added {v.dateAdded}</span>}
          {pct > 0 && <span className="text-primary font-medium">· {pct}% watched</span>}
        </div>
      </div>
    </button>
  );
}

function SubtitleResultCard({ m, title, onOpen }: { m: SubtitleMatch; title?: string; onOpen: () => void }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <button onClick={onOpen} className="w-full text-left paper p-3.5 hover:bg-muted/40 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-semibold truncate">{title ?? m.videoTitle}</span>
        <span className="pill bg-secondary/15 text-secondary text-[10px] shrink-0 gap-1"><Clock className="h-2.5 w-2.5" />{fmt(m.start)}</span>
      </div>
      <p className="font-hans text-sm leading-snug">{m.text}</p>
      {m.translatedText && <p className="text-xs text-muted-foreground italic mt-0.5">{m.translatedText}</p>}
    </button>
  );
}
