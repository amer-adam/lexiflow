import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { useApi, useQuery } from "@/app/useApi";
import { cn } from "@/lib/utils";

const REASONS: { value: "translation" | "pinyin" | "text" | "other"; label: string }[] = [
  { value: "translation", label: "Translation is wrong" },
  { value: "pinyin", label: "Pinyin is wrong" },
  { value: "text", label: "Chinese text is wrong" },
  { value: "other", label: "Something else" },
];

/** Flag icon for crowd-reporting a translation/subtitle error on one segment. */
export function ReportFlagButton({
  jobId, segmentIndex, dark, container,
}: { jobId: string; segmentIndex: number; dark?: boolean; container?: HTMLElement | null }) {
  const { api } = useApi();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const { data } = useQuery((a) => a.getSegmentReports(jobId), [jobId]);
  const info = data?.segments.find((s) => s.segmentIndex === segmentIndex);

  async function send(reason: typeof REASONS[number]["value"]) {
    try {
      await api.reportSegment(jobId, segmentIndex, reason);
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); }, 900);
    } catch {
      /* ignore */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent container={container} align="start" className="w-60 paper p-3 text-foreground z-[200]">
        {sent ? (
          <p className="text-sm flex items-center gap-1.5 text-secondary"><Check className="h-4 w-4" /> Thanks for flagging this.</p>
        ) : (
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
      </PopoverContent>
    </Popover>
  );
}
