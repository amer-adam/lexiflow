import { PartyPopper, X } from "lucide-react";
import { useSessionSummary, clearSessionSummary } from "@/lib/sessionSummary";
import { useNav } from "@/app/nav";

/** Floating toast shown after watching a video — persists across navigation,
 *  page refreshes, and opening another video, until the user dismisses it. */
export function SessionSummaryToast() {
  const summary = useSessionSummary();
  const { go } = useNav();
  if (!summary) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] max-w-sm paper p-4 shadow-xl animate-in slide-in-from-bottom-4 fade-in">
      <button onClick={clearSessionSummary} className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold shrink-0">
          <PartyPopper className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="font-display font-semibold leading-tight">Nice session!</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {summary.videoTitle ? <span className="font-medium">{summary.videoTitle}</span> : "That video"} —{" "}
            <span className="font-semibold text-primary">{summary.saved}</span> word{summary.saved === 1 ? "" : "s"} saved,{" "}
            <span className="font-semibold text-gold">{summary.tracked}</span> added to Seen.
          </p>
          {summary.saved > 0 && (
            <button
              onClick={() => { clearSessionSummary(); go("vocab"); }}
              className="text-sm text-secondary hover:underline mt-1.5"
            >
              View saved words →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
