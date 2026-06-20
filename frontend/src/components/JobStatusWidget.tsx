import { useState } from "react";
import { Film, CheckCircle2, AlertTriangle, ChevronRight, X } from "lucide-react";
import { useActiveJob, clearTrackedJob } from "@/lib/jobTracker";
import { useNav } from "@/app/nav";
import { cn } from "@/lib/utils";

const fmtEta = (s: number) => (s >= 60 ? `${Math.round(s / 60)}m` : `${Math.round(s)}s`);

/**
 * Floating bottom-right indicator for the in-flight "add a video" job, so
 * leaving the request page to browse elsewhere doesn't lose visibility into
 * it. Collapsed to a small icon; hovering expands it to show status, and
 * "More" jumps back to the waiting screen for that job. Sits above
 * SessionSummaryToast's corner so the two never overlap.
 *
 * Uses a pulsing Film icon rather than a spinner — a generic spinner reads
 * as "the page is loading", which this isn't; it's a status badge for a
 * background job that keeps running no matter what page you're on.
 */
export function JobStatusWidget() {
  const job = useActiveJob();
  const { go } = useNav();
  const [expanded, setExpanded] = useState(false);
  if (!job) return null;

  const Icon = job.status === "completed" ? CheckCircle2 : job.status === "failed" ? AlertTriangle : Film;
  const animate = job.status !== "completed" && job.status !== "failed";
  const tone = job.status === "completed" ? "text-hsk-1" : job.status === "failed" ? "text-primary" : "text-secondary";
  const label =
    job.status === "completed" ? "Video ready!" :
    job.status === "failed" ? "Processing failed" :
    job.queue > 0 ? `In queue · ${job.queue} ahead` :
    `Processing… ${job.progress}%`;

  return (
    <div
      className="fixed bottom-24 right-5 z-[100]"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {expanded ? (
        <div className="relative paper p-3.5 w-64 shadow-xl animate-in slide-in-from-bottom-2 fade-in">
          <button
            onClick={clearTrackedJob}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5 pr-4">
            <Icon className={cn("h-4 w-4 shrink-0", tone, animate && "animate-pulse")} />
            <span className="text-sm font-semibold truncate">{label}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mb-2">{job.title || "Your video"}</p>
          {job.status === "processing" && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
              <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${job.progress}%` }} />
            </div>
          )}
          {job.status === "processing" && job.eta != null && job.eta > 0 && (
            <p className="text-xs text-muted-foreground mb-2">ETA ~{fmtEta(job.eta)}</p>
          )}
          <button
            onClick={() => go("request")}
            className="w-full flex items-center justify-center gap-1 text-sm font-medium text-secondary hover:text-primary transition-colors"
          >
            More <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => go("request")}
          className="grid h-11 w-11 place-items-center rounded-full paper shadow-lg hover:scale-105 transition-transform"
          title={label}
          aria-label={label}
        >
          <Icon className={cn("h-5 w-5", tone, animate && "animate-pulse")} />
        </button>
      )}
    </div>
  );
}
