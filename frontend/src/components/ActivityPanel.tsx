import { CalendarCheck, Eye, RotateCw, CheckSquare } from "lucide-react";
import { Skeleton } from "@/components/bits";
import type { ActivityCounts } from "@/lib/api";

const ACTIVITY_ROWS = [
  { key: "wordsSeen" as const, label: "New words seen", icon: Eye },
  { key: "wordsReviewed" as const, label: "Flashcards reviewed", icon: RotateCw },
  { key: "quizzesTaken" as const, label: "Quizzes taken", icon: CheckSquare },
];

/** Today vs. all-time activity counts — shown on both the Dashboard and Profile. */
export function ActivityPanel({
  loading, data, title = "Your activity",
}: { loading: boolean; data?: { today: ActivityCounts; allTime: ActivityCounts }; title?: string }) {
  return (
    <div className="paper p-5">
      <h2 className="font-display text-xl font-semibold flex items-center gap-2 mb-4">
        <CalendarCheck className="h-5 w-5 text-secondary" /> {title}
      </h2>
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {([["Today", data?.today], ["All time", data?.allTime]] as const).map(([col, counts]) => (
            <div key={col} className="rounded-lg border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{col}</p>
              <div className="space-y-2.5">
                {ACTIVITY_ROWS.map((r) => {
                  const Icon = r.icon;
                  return (
                    <div key={r.key} className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-secondary shrink-0" />
                      <span className="text-sm text-muted-foreground flex-1">{r.label}</span>
                      <span className="font-display font-semibold font-mono-num">{counts?.[r.key] ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
