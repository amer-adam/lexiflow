import { useState } from "react";
import { PlayCircle, Lock, Globe, Search, Plus } from "lucide-react";
import { VIDEOS } from "@/lib/data";
import { PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNav } from "@/app/nav";

const FILTERS = ["All", "News", "Food", "Culture", "Technology", "Lesson", "History"];

export function LibraryView() {
  const { go } = useNav();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");

  const videos = VIDEOS.filter(
    (v) =>
      (filter === "All" || v.topic.toLowerCase().includes(filter.toLowerCase())) &&
      (v.title.toLowerCase().includes(q.toLowerCase()) ||
        v.channel.toLowerCase().includes(q.toLowerCase()))
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
        Every video you've processed is ready to watch with interactive subtitles. New words counts
        are estimated against your known vocabulary.
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search videos or channels…"
            className="pl-9 bg-card"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill border transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((v) => (
          <button
            key={v.id}
            onClick={() => go("watch", { id: v.id })}
            className="group text-left paper overflow-hidden hover:-translate-y-0.5 transition-transform"
          >
            <div
              className="relative h-32 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, hsl(${v.thumbHue} 45% 32%), hsl(${v.thumbHue} 38% 16%))`,
              }}
            >
              <PlayCircle
                className="h-12 w-12 text-white/85 group-hover:scale-110 transition-transform"
                strokeWidth={1.5}
              />
              <span className="absolute top-2 right-3 text-white/20 font-hans-serif text-5xl select-none">
                影
              </span>
              <span className="absolute bottom-2 right-2 pill bg-black/50 text-white text-[11px]">
                {v.duration}
              </span>
              <span className="absolute top-2 left-2 pill bg-black/40 text-white text-[11px]">
                {v.visibility === "private" ? (
                  <><Lock className="h-3 w-3" /> Private</>
                ) : (
                  <><Globe className="h-3 w-3" /> Public</>
                )}
              </span>
            </div>
            <div className="p-3.5">
              <div className="font-semibold leading-snug line-clamp-2 min-h-[2.6rem]">{v.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{v.channel}</div>
              <div className="flex items-center gap-2 mt-3">
                <span className="pill bg-primary/10 text-primary">{v.newWords} new</span>
                <span className="text-xs text-muted-foreground">{v.knownPct}% known</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="paper p-10 text-center text-muted-foreground">
          No videos match your search.
        </div>
      )}
    </div>
  );
}
