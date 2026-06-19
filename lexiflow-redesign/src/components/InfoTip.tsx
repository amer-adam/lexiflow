import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CONCEPTS, type ConceptId } from "@/lib/concepts";
import { cn } from "@/lib/utils";

/**
 * InfoTip — the universal "explain this concept" popup.
 * Drop <InfoTip id="hsk" /> next to any term; a small ⓘ button opens a
 * card defining the concept (what it is + why it matters) for reviewers.
 */
export function InfoTip({
  id,
  label,
  className,
  side = "top",
}: {
  id: ConceptId;
  label?: string; // optional visible text before the icon
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const c = CONCEPTS[id];
  if (!c) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${c.title}?`}
          className={cn(
            "group inline-flex items-center gap-1 align-middle text-secondary/80 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full",
            className
          )}
        >
          {label && (
            <span className="underline decoration-dotted decoration-secondary/50 underline-offset-2 text-sm">
              {label}
            </span>
          )}
          <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-80 paper border-border p-0 overflow-hidden text-foreground"
      >
        <div className="flex items-center gap-2 bg-secondary/10 px-4 py-2.5 border-b border-border">
          <span className="seal grid h-5 w-5 place-items-center text-[11px] leading-none">问</span>
          <p className="font-display font-semibold text-sm leading-tight">{c.title}</p>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <p className="text-sm leading-relaxed">{c.what}</p>
          <div className="rounded-md bg-muted/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-secondary mb-0.5">
              Why it matters
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{c.why}</p>
          </div>
          {c.more && (
            <ul className="space-y-1 pt-0.5">
              {c.more.map((m, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-muted-foreground leading-snug">
                  <span className="text-primary mt-0.5">·</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
