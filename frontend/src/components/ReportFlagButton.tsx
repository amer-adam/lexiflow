import { useState } from "react";
import { Flag, Check, Loader2, Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { useApi, useQuery } from "@/app/useApi";
import type { ReportReason, RawSegment } from "@/lib/api";
import { cn } from "@/lib/utils";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "translation", label: "Translation is wrong" },
  { value: "pinyin", label: "Pinyin is wrong" },
  { value: "text", label: "Chinese text is wrong" },
  { value: "other", label: "Something else" },
];

type Stage = "menu" | "loading" | "result" | "thanks";

/**
 * Flag icon for crowd-reporting a translation/subtitle error on one segment.
 * Filing a report instantly triggers an LLM review (see backend reports/
 * aiReview.service.js) that corrects the segment right away; this walks the
 * reporter through progress → before/after → a satisfaction + rating prompt,
 * which is the dataset used to judge correction quality over time.
 */
export function ReportFlagButton({
  jobId, segmentIndex, dark, container, onCorrected,
}: { jobId: string; segmentIndex: number; dark?: boolean; container?: HTMLElement | null; onCorrected?: () => void }) {
  const { api } = useApi();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("menu");
  const [review, setReview] = useState<{ reviewId: string; before: RawSegment; after: RawSegment } | null>(null);
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { data } = useQuery((a) => a.getSegmentReports(jobId), [jobId]);
  const info = data?.segments.find((s) => s.segmentIndex === segmentIndex);

  const reset = () => {
    setStage("menu");
    setReview(null);
    setSatisfied(null);
    setRating(0);
  };

  async function send(reason: ReportReason) {
    setStage("loading");
    try {
      const r = await api.reviewSegmentReport(jobId, segmentIndex, reason);
      if (r.ai) {
        setReview(r.ai);
        setStage("result");
        onCorrected?.();
      } else {
        setStage("thanks");
        setTimeout(() => { setOpen(false); reset(); }, 1400);
      }
    } catch {
      setStage("thanks");
      setTimeout(() => { setOpen(false); reset(); }, 1400);
    }
  }

  async function submitFeedback() {
    if (!review || satisfied === null || rating === 0) return;
    setSubmitting(true);
    try {
      await api.rateSegmentReview(review.reviewId, satisfied, rating);
    } catch {
      /* ignore — the correction is already applied either way */
    } finally {
      setSubmitting(false);
      setStage("thanks");
      setTimeout(() => { setOpen(false); reset(); }, 1200);
    }
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Report a translation error on this line"
          className={cn(
            "inline-flex items-center gap-1 text-[11px] rounded-full px-1.5 py-0.5 transition-colors",
            dark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-destructive",
            info?.flagged && (dark ? "text-amber-300" : "text-amber-600")
          )}
        >
          <Flag className="h-3 w-3" />
          {info && info.count > 0 && <span className="font-mono-num">{info.count}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent container={container} align="start" className="w-80 paper p-3 text-foreground z-[200]">
        {stage === "menu" && (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What's wrong with this line?</p>
              <InfoTip id="translationReport" />
            </div>
            <div className="space-y-1">
              {REASONS.map((r) => (
                <Button key={r.value} variant="ghost" size="sm" className="w-full justify-start text-sm h-8" onClick={() => send(r.value)}>
                  {r.label}
                </Button>
              ))}
            </div>
            {info && info.count > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2">{info.count} viewer{info.count === 1 ? "" : "s"} flagged this line{info.flagged ? " — queued for review." : "."}</p>
            )}
          </>
        )}

        {stage === "loading" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-secondary" />
            <p className="text-sm text-muted-foreground">Reviewing with AI…</p>
          </div>
        )}

        {stage === "result" && review && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Correction applied</p>
            <div className="space-y-2">
              <SegmentDiffRow label="Text" before={review.before.text} after={review.after.text} />
              <SegmentDiffRow label="Translation" before={review.before.translated_text} after={review.after.translated_text} />
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium mb-1.5">Are you satisfied with this correction?</p>
              <div className="flex gap-2 mb-3">
                <Button
                  size="sm" variant={satisfied === true ? "secondary" : "outline"} className="gap-1.5 flex-1"
                  onClick={() => setSatisfied(true)}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> Yes
                </Button>
                <Button
                  size="sm" variant={satisfied === false ? "secondary" : "outline"} className="gap-1.5 flex-1"
                  onClick={() => setSatisfied(false)}
                >
                  <ThumbsDown className="h-3.5 w-3.5" /> No
                </Button>
              </div>
              <p className="text-sm font-medium mb-1.5">How would you rate it?</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}>
                    <Star className={cn("h-5 w-5 transition-colors", n <= rating ? "fill-gold text-gold" : "text-muted-foreground")} />
                  </button>
                ))}
              </div>
              <Button
                size="sm" className="w-full gap-1.5"
                disabled={satisfied === null || rating === 0 || submitting}
                onClick={submitFeedback}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Submit feedback
              </Button>
            </div>
          </div>
        )}

        {stage === "thanks" && (
          <p className="text-sm flex items-center gap-1.5 text-secondary py-2"><Check className="h-4 w-4" /> Thanks for flagging this.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SegmentDiffRow({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = before !== after;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-0.5">{label}</p>
      {changed ? (
        <>
          <p className="text-sm line-through text-muted-foreground/70 font-hans">{before}</p>
          <p className="text-sm font-medium text-foreground font-hans">{after}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground font-hans">{after} <span className="text-[11px]">(unchanged)</span></p>
      )}
    </div>
  );
}
