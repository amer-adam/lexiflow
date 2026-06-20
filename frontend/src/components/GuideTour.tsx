import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GUIDE_STEPS } from "@/lib/guide";
import { useNav } from "@/app/nav";
import { cn } from "@/lib/utils";

/**
 * Step-by-step product tour. Shown automatically after a user's first
 * sign-in, and reopenable any time from the topbar "Guide" button — both
 * cases render the same steps from src/lib/guide.ts.
 *
 * Each step that names a `view` switches the app to that page live behind
 * the dialog, so closing the tour drops the user somewhere relevant instead
 * of always back on the dashboard.
 */
export function GuideTour({
  open,
  onOpenChange,
  onFinish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish?: () => void;
}) {
  const { go } = useNav();
  const [i, setI] = useState(0);

  // Reset to the first step whenever the dialog transitions from closed to
  // open. Adjusting state during render (rather than in an effect) avoids an
  // extra commit — see https://react.dev/learn/you-might-not-need-an-effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setI(0);
  }

  useEffect(() => {
    if (!open) return;
    const view = GUIDE_STEPS[i].view;
    if (view) go(view);
    // Only re-run when the step (or open state) changes — `go` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  const step = GUIDE_STEPS[i];
  const isLast = i === GUIDE_STEPS.length - 1;
  const Icon = step.icon;

  const close = () => {
    onFinish?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md w-full gap-0 p-0 overflow-hidden paper border-border">
        <DialogTitle className="sr-only">{step.title}</DialogTitle>

        <div className="bg-secondary/10 px-6 pt-6 pb-5 border-b border-border">
          <div className="flex items-center gap-1.5 mb-4">
            {GUIDE_STEPS.map((s, idx) => (
              <button
                key={s.id}
                aria-label={`Go to step ${idx + 1}: ${s.title}`}
                onClick={() => setI(idx)}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  idx <= i ? "bg-primary" : "bg-muted hover:bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <span className="seal grid h-11 w-11 place-items-center mb-3">
            <Icon className="h-5 w-5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-1">
            Step {i + 1} of {GUIDE_STEPS.length}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-tight">{step.title}</h2>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          {step.bullets && (
            <ul className="space-y-1.5">
              {step.bullets.map((b, idx) => (
                <li key={idx} className="flex gap-2 text-sm leading-snug">
                  <span className="text-primary mt-0.5">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 pb-6">
          <Button variant="ghost" size="sm" onClick={close}>
            Skip
          </Button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setI(i - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="gap-1.5" onClick={close}>
                <Check className="h-4 w-4" /> Let's go
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => setI(i + 1)}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
