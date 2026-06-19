import { type ReactNode } from "react";
import { hskColor, HSK_LABELS, type HskLevel } from "@/lib/data";
import { InfoTip } from "@/components/InfoTip";
import { cn } from "@/lib/utils";

/** A solid colour dot for an HSK level. */
export function HskDot({ level, size = 10 }: { level: HskLevel; size?: number }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: hskColor(level) }}
    />
  );
}

/** A small labelled HSK chip, e.g. "HSK 4". */
export function HskBadge({ level }: { level: HskLevel }) {
  return (
    <span
      className="pill text-white"
      style={{ background: hskColor(level) }}
      title={HSK_LABELS[level]}
    >
      {level === 0 ? "—" : `HSK ${level}`}
    </span>
  );
}

/** The legend that teaches the colour ramp. Used on Watch + Dashboard. */
export function HskLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center flex-wrap gap-x-3 gap-y-1.5", className)}>
      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
        Difficulty
        <InfoTip id="hsk" />
      </span>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>easy</span>
        {([1, 2, 3, 4, 5, 6] as HskLevel[]).map((l) => (
          <span key={l} className="flex items-center gap-1" title={HSK_LABELS[l]}>
            <HskDot level={l} />
            <span className="font-mono-num">{l}</span>
          </span>
        ))}
        <span>hard</span>
      </div>
    </div>
  );
}

/** Familiarity progress bar (0..1). */
export function FamiliarityBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const pct = Math.round(value * 100);
  const hue = 8 + value * 130; // red(weak) → green(strong)
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `hsl(${hue} 55% 45%)` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono-num text-muted-foreground w-9 text-right">{pct}%</span>
      )}
    </div>
  );
}

/** Page header with optional concept info button and right-aligned slot. */
export function PageHeader({
  eyebrow,
  title,
  conceptId,
  children,
  right,
}: {
  eyebrow?: string;
  title: string;
  conceptId?: Parameters<typeof InfoTip>[0]["id"];
  children?: ReactNode; // description
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          {conceptId && <InfoTip id={conceptId} side="bottom" />}
        </div>
        {children && (
          <p className="text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">{children}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** A compact stat tile. */
export function Stat({
  value,
  label,
  conceptId,
  accent,
}: {
  value: ReactNode;
  label: string;
  conceptId?: Parameters<typeof InfoTip>[0]["id"];
  accent?: "primary" | "secondary" | "gold";
}) {
  const color =
    accent === "primary" ? "text-primary"
    : accent === "secondary" ? "text-secondary"
    : accent === "gold" ? "text-gold"
    : "text-foreground";
  return (
    <div className="paper px-4 py-3">
      <div className={cn("font-display text-2xl font-semibold font-mono-num", color)}>{value}</div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
        {label}
        {conceptId && <InfoTip id={conceptId} />}
      </div>
    </div>
  );
}
