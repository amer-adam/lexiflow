import { useMemo, useState } from "react";
import { Layers, Play, RotateCcw, Check, Brain, Zap, Clock3, Settings2 } from "lucide-react";
import {
  DECKS, hskColor, FSRS_STATE_LABEL, type Deck, type Card, type FsrsState,
} from "@/lib/data";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/bits";
import { cn } from "@/lib/utils";

const STATE_STYLE: Record<FsrsState, string> = {
  0: "bg-secondary/15 text-secondary",
  1: "bg-gold/15 text-gold",
  2: "bg-hsk-1/15 text-hsk-1",
  3: "bg-primary/12 text-primary",
};

const RATINGS: { label: string; sub: string; cls: string; next: string }[] = [
  { label: "Again", sub: "1", cls: "bg-primary/90 hover:bg-primary text-primary-foreground", next: "<1m" },
  { label: "Hard", sub: "2", cls: "bg-gold/90 hover:bg-gold text-white", next: "~1d" },
  { label: "Good", sub: "3", cls: "bg-secondary/90 hover:bg-secondary text-secondary-foreground", next: "~4d" },
  { label: "Easy", sub: "4", cls: "bg-hsk-1/90 hover:bg-hsk-1 text-white", next: "~10d" },
];

export function FlashcardsView() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const deck = DECKS.find((d) => d.id === deckId)!;
  const due = useMemo(() => deck.cards.filter((c) => c.dueInDays <= 0), [deck]);

  const [session, setSession] = useState<Card[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const start = () => {
    setSession(due.length ? due : deck.cards.slice(0, 5));
    setIdx(0); setFlipped(false); setDone(false);
  };
  const rate = () => {
    if (!session) return;
    if (idx + 1 >= session.length) { setDone(true); return; }
    setIdx((i) => i + 1); setFlipped(false);
  };

  // ── Study arena ──────────────────────────────────────────────
  if (session && !done) {
    const c = session[idx];
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSession(null)}>← Exit review</Button>
          <span className="text-sm text-muted-foreground font-mono-num">
            {idx + 1} / {session.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted mb-6 overflow-hidden">
          <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${(idx / session.length) * 100}%` }} />
        </div>

        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full paper aspect-[3/2] grid place-items-center relative group select-none"
        >
          <span className="absolute top-3 left-4 text-[11px] uppercase tracking-wide text-muted-foreground">
            {flipped ? "Back" : "Front"}
          </span>
          <span className={cn("absolute top-3 right-3 pill", STATE_STYLE[c.state])}>
            {FSRS_STATE_LABEL[c.state]}
          </span>
          <div className="text-center">
            {!flipped ? (
              <span className="font-hans-serif text-7xl" style={{ color: hskColor(c.vocab.hskLevel) }}>
                {c.vocab.simplified}
              </span>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl text-muted-foreground">{c.vocab.pinyin}</div>
                <div className="text-3xl font-medium">{c.vocab.meaning}</div>
              </div>
            )}
          </div>
          <span className="absolute bottom-3 text-xs text-muted-foreground opacity-60 group-hover:opacity-100">
            {flipped ? "How well did you recall it?" : "Click to flip"}
          </span>
        </button>

        {flipped ? (
          <div className="mt-5">
            <div className="flex items-center justify-center gap-1.5 mb-2 text-sm text-muted-foreground">
              Grade your recall <InfoTip id="fsrsRating" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button key={r.label} onClick={rate} className={cn("rounded-lg py-3 font-semibold transition-colors flex flex-col items-center", r.cls)}>
                  {r.label}
                  <span className="text-[11px] font-normal opacity-80 mt-0.5">next: {r.next}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Button className="w-full mt-5" size="lg" onClick={() => setFlipped(true)}>
            Show answer
          </Button>
        )}
      </div>
    );
  }

  // ── Session complete ─────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-md mx-auto text-center paper p-8 mt-8">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-hsk-1/15 text-hsk-1 mx-auto mb-4">
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <h2 className="font-display text-2xl font-semibold mb-1">Session complete 🎉</h2>
        <p className="text-muted-foreground mb-6">
          You reviewed {session?.length} cards. FSRS has rescheduled each one based on your ratings.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setSession(null)}>Back to deck</Button>
          <Button onClick={start} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Review again</Button>
        </div>
      </div>
    );
  }

  // ── Deck overview ────────────────────────────────────────────
  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-5 items-start">
      <div className="paper p-4">
        <h2 className="font-display text-lg font-semibold mb-1">Your decks</h2>
        <p className="text-xs text-muted-foreground mb-3">A deck is generated from a vocabulary list.</p>
        <div className="space-y-1.5">
          {DECKS.map((d) => (
            <DeckChip key={d.id} deck={d} active={d.id === deckId} onClick={() => setDeckId(d.id)} />
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-semibold">{deck.name}</h1>
              <InfoTip id="deck" side="bottom" />
            </div>
            <p className="text-muted-foreground mt-1">Spaced-repetition deck powered by the FSRS algorithm.</p>
          </div>
          <Button size="lg" className="gap-2" onClick={start} disabled={deck.cards.length === 0}>
            <Play className="h-4 w-4" />
            {due.length ? `Review ${due.length} due` : "Practice all"}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat value={due.length} label="Due today" conceptId="dueToday" accent="primary" />
          <Stat value={deck.cards.length} label="Total cards" />
          <Stat value={deck.cards.filter((c) => c.state === 0).length} label="New" accent="secondary" />
          <Stat value={deck.cards.filter((c) => c.state === 2).length} label="In review" />
        </div>

        <div className="paper overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Full deck</h3>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Settings2 className="h-4 w-4" /> Card layout
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2.5 px-5 font-semibold">Word</th>
                <th className="py-2.5 px-2 font-semibold">
                  <span className="inline-flex items-center gap-1">State <InfoTip id="fsrs" /></span>
                </th>
                <th className="py-2.5 px-2 font-semibold">
                  <span className="inline-flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> Stability</span>
                </th>
                <th className="py-2.5 px-2 font-semibold">
                  <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Difficulty</span>
                </th>
                <th className="py-2.5 px-2 font-semibold text-right pr-5">
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Next due</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {deck.cards.map((c) => (
                <tr key={c.vocab.simplified} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="py-2.5 px-5">
                    <div className="flex items-center gap-2">
                      <span className="font-hans-serif text-xl" style={{ color: hskColor(c.vocab.hskLevel) }}>{c.vocab.simplified}</span>
                      <span className="text-muted-foreground">{c.vocab.pinyin}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2"><span className={cn("pill", STATE_STYLE[c.state])}>{FSRS_STATE_LABEL[c.state]}</span></td>
                  <td className="py-2.5 px-2 font-mono-num text-muted-foreground">{c.stability.toFixed(1)}d</td>
                  <td className="py-2.5 px-2 font-mono-num text-muted-foreground">{c.difficulty.toFixed(1)}</td>
                  <td className="py-2.5 px-2 text-right pr-5 font-mono-num">
                    {c.dueInDays <= 0 ? (
                      <span className="text-primary font-semibold">due now</span>
                    ) : (
                      <span className="text-muted-foreground">in {c.dueInDays}d</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DeckChip({ deck, active, onClick }: { deck: Deck; active: boolean; onClick: () => void }) {
  const due = deck.cards.filter((c) => c.dueInDays <= 0).length;
  return (
    <button
      onClick={onClick}
      className={cn("w-full text-left rounded-md border px-3 py-2.5 transition-colors", active ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted")}
    >
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-secondary shrink-0" />
        <span className="font-medium text-sm">{deck.name}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 pl-6">
        <span className="text-xs text-muted-foreground">{deck.cards.length} cards</span>
        {due > 0 && <span className="pill bg-primary/12 text-primary text-[10px]">{due} due</span>}
      </div>
    </button>
  );
}
