import { useEffect, useMemo, useState } from "react";
import { Layers, Play, RotateCcw, Check, Brain, Zap, Clock3, Settings2, Loader2, Trash2, Eraser } from "lucide-react";
import { hskColor, FSRS_STATE_LABEL, type Deck, type Card, type FsrsState } from "@/lib/data";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Stat, Loading, ErrorState, EmptyState } from "@/components/bits";
import { CardLayoutModal, type SideConfig } from "@/components/CardLayoutModal";
import { SpeakButton } from "@/components/SpeakButton";
import { useApi, useQuery } from "@/app/useApi";
import { useNav } from "@/app/nav";
import { cn } from "@/lib/utils";

const STATE_STYLE: Record<FsrsState, string> = {
  0: "bg-secondary/15 text-secondary",
  1: "bg-gold/15 text-gold",
  2: "bg-hsk-1/15 text-hsk-1",
  3: "bg-primary/12 text-primary",
};
const RATINGS: { label: string; rating: 1 | 2 | 3 | 4; cls: string; next: string }[] = [
  { label: "Again", rating: 1, cls: "bg-primary/90 hover:bg-primary text-primary-foreground", next: "<1m" },
  { label: "Hard", rating: 2, cls: "bg-gold/90 hover:bg-gold text-white", next: "~1d" },
  { label: "Good", rating: 3, cls: "bg-secondary/90 hover:bg-secondary text-secondary-foreground", next: "~4d" },
  { label: "Easy", rating: 4, cls: "bg-hsk-1/90 hover:bg-hsk-1 text-white", next: "~10d" },
];
const SESSION_SIZES = [5, 10, 20] as const;
const totalCards = (d: Deck) => d._count?.flashcards ?? d.cards.length;

function CardFace({ c, side }: { c: Card; side: SideConfig }) {
  return (
    <div className="text-center space-y-2">
      {side.character && (
        <div className="font-hans-serif text-6xl leading-none flex items-center justify-center gap-2" style={{ color: hskColor(c.vocab.hskLevel) }}>
          {c.vocab.simplified}
          {side.audio && <SpeakButton text={c.vocab.simplified} size="md" />}
        </div>
      )}
      {side.audio && !side.character && (
        <div className="flex items-center justify-center">
          <SpeakButton text={c.vocab.simplified} size="md" />
        </div>
      )}
      {side.pinyin && <div className="text-2xl text-muted-foreground">{c.vocab.pinyin}</div>}
      {side.meaning && <div className="text-2xl font-medium">{c.vocab.meaning}</div>}
      {!side.character && !side.pinyin && !side.meaning && !side.audio && <div className="text-muted-foreground text-sm">(nothing configured for this side)</div>}
    </div>
  );
}

export function FlashcardsView() {
  const { api } = useApi();
  const { go } = useNav();
  const { data: decks, loading, error, reload } = useQuery((a) => a.getDecks(), []);
  const [deckId, setDeckId] = useState<string | null>(null);
  const deck = (decks ?? []).find((d) => d.id === deckId) ?? (decks ?? [])[0];
  const due = useMemo(() => (deck ? deck.cards.filter((c) => c.dueInDays <= 0) : []), [deck]);

  const [sessionCards, setSessionCards] = useState<Card[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  const startWith = async (size: number | "due" | "all") => {
    if (!deck) return;
    setChooserOpen(false);
    setLoadingReview(true);
    let cards: Card[] = [];
    try {
      cards = await api.getReview(deck.id);
    } catch { /* ignore, will show empty */ }
    finally { setLoadingReview(false); }
    if (size === "all") cards = deck.cards;
    else if (size === "due") cards = cards.length ? cards : due;
    else cards = (cards.length ? cards : due.length ? due : deck.cards).slice(0, size);
    setSessionCards(cards);
    setIdx(0); setFlipped(false); setDone(false);
  };

  const rate = (rating: 1 | 2 | 3 | 4) => {
    if (!sessionCards) return;
    const card = sessionCards[idx];
    if (card.id) api.submitReview(card.id, rating).catch(() => {});
    if (idx + 1 >= sessionCards.length) { setDone(true); return; }
    setIdx((i) => i + 1); setFlipped(false);
  };

  // Keyboard shortcuts in the study arena: space/enter flips, 1-4 rate when flipped.
  useEffect(() => {
    if (!sessionCards || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); setFlipped((f) => !f); return; }
      if (flipped && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
        const rating = (Number(e.code.slice(-1)) as 1 | 2 | 3 | 4);
        rate(rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCards, done, flipped, idx]);

  const saveLayout = async (front: SideConfig, back: SideConfig) => {
    if (!deck) return;
    setLayoutBusy(true);
    try {
      await api.updateDeckLayout(deck.id, front, back);
      setLayoutOpen(false);
      reload();
    } catch (e: any) {
      alert("Could not save layout: " + (e?.message ?? "unknown error"));
    } finally {
      setLayoutBusy(false);
    }
  };

  const resetDeck = async () => {
    if (!deck) return;
    if (!window.confirm(`Reset all progress for "${deck.name}"? Every card returns to "New".`)) return;
    setBusy(true);
    try { await api.resetDeck(deck.id); reload(); }
    catch (e: any) { alert("Could not reset deck: " + (e?.message ?? "unknown error")); }
    finally { setBusy(false); }
  };

  const deleteDeck = async () => {
    if (!deck) return;
    if (!window.confirm(`Delete the deck "${deck.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try { await api.deleteDeck(deck.id); setDeckId(null); reload(); }
    catch (e: any) { alert("Could not delete deck: " + (e?.message ?? "unknown error")); }
    finally { setBusy(false); }
  };

  // ── States ───────────────────────────────────────────────────
  if (loading && !decks) return <Loading label="Loading your decks…" />;
  if (error) return <div className="paper"><ErrorState message={error} onRetry={reload} /></div>;
  if (!deck) {
    return (
      <div className="paper">
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title="No flashcard decks yet"
          action={<Button onClick={() => go("vocab")}>Go to Vocabulary</Button>}
        >
          Open a vocabulary list and choose “Create deck” to turn it into spaced-repetition flashcards.
        </EmptyState>
      </div>
    );
  }

  // ── Study arena ──────────────────────────────────────────────
  if (sessionCards && !done) {
    const c = sessionCards[idx];
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => setSessionCards(null)}>← Exit review</Button>
          <span className="text-sm text-muted-foreground font-mono-num">{idx + 1} / {sessionCards.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted mb-6 overflow-hidden">
          <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${(idx / sessionCards.length) * 100}%` }} />
        </div>

        <button onClick={() => setFlipped((f) => !f)} className="w-full paper aspect-[3/2] grid place-items-center relative group select-none">
          <span className="absolute top-3 left-4 text-[11px] uppercase tracking-wide text-muted-foreground">{flipped ? "Back" : "Front"}</span>
          <span className={cn("absolute top-3 right-3 pill", STATE_STYLE[c.state])}>{FSRS_STATE_LABEL[c.state]}</span>
          <CardFace c={c} side={flipped ? c.back : c.front} />
          <span className="absolute bottom-3 text-xs text-muted-foreground opacity-60 group-hover:opacity-100">
            {flipped ? "How well did you recall it? (1-4)" : "Click to flip (space)"}
          </span>
        </button>

        {flipped ? (
          <div className="mt-5">
            <div className="flex items-center justify-center gap-1.5 mb-2 text-sm text-muted-foreground">
              Grade your recall <InfoTip id="fsrsRating" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button key={r.label} onClick={() => rate(r.rating)} className={cn("rounded-lg py-3 font-semibold transition-colors flex flex-col items-center", r.cls)}>
                  {r.label}
                  <span className="text-[11px] font-normal opacity-80 mt-0.5">next: {r.next}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Button className="w-full mt-5" size="lg" onClick={() => setFlipped(true)}>Show answer</Button>
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
          You reviewed {sessionCards?.length} cards. FSRS has rescheduled each one based on your ratings.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => { setSessionCards(null); setDone(false); reload(); }}>Back to deck</Button>
          <Button onClick={() => setChooserOpen(true)} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Review again</Button>
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
          {(decks ?? []).map((d) => (
            <DeckChip key={d.id} deck={d} active={d.id === deck.id} onClick={() => setDeckId(d.id)} />
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetDeck} disabled={busy} title="Reset all FSRS progress for this deck">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />} Reset
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={deleteDeck} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button size="lg" className="gap-2" onClick={() => setChooserOpen(true)} disabled={loadingReview || totalCards(deck) === 0}>
              {loadingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {due.length ? `Review ${due.length} due` : "Practice"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat value={due.length} label="Due today" conceptId="dueToday" accent="primary" />
          <Stat value={totalCards(deck)} label="Total cards" />
          <Stat value={deck.cards.filter((c) => c.state === 0).length} label="New" accent="secondary" />
          <Stat value={deck.cards.filter((c) => c.state === 2).length} label="In review" />
        </div>

        <div className="paper overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="font-display text-lg font-semibold">Full deck</h3>
            <span className="inline-flex items-center gap-1">
              <button onClick={() => setLayoutOpen(true)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <Settings2 className="h-4 w-4" /> Card layout
              </button>
              <InfoTip id="cardLayout" />
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2.5 px-5 font-semibold">Word</th>
                <th className="py-2.5 px-2 font-semibold"><span className="inline-flex items-center gap-1">State <InfoTip id="fsrsStates" /></span></th>
                <th className="py-2.5 px-2 font-semibold"><span className="inline-flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> Stability <InfoTip id="stability" /></span></th>
                <th className="py-2.5 px-2 font-semibold"><span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" /> Difficulty <InfoTip id="difficulty" /></span></th>
                <th className="py-2.5 px-2 font-semibold text-right pr-5"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Next due <InfoTip id="scheduledDays" /></span></th>
              </tr>
            </thead>
            <tbody>
              {deck.cards.map((c) => (
                <tr key={c.id ?? c.vocab.simplified} className="border-b border-border/60 hover:bg-muted/40">
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
                    {c.dueInDays <= 0 ? <span className="text-primary font-semibold">due now</span> : <span className="text-muted-foreground">in {c.dueInDays}d</span>}
                  </td>
                </tr>
              ))}
              {deck.cards.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Card details load when you start a review.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session size chooser */}
      {chooserOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center px-4" onClick={() => setChooserOpen(false)}>
          <div className="paper p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-1">How many cards?</h3>
            <p className="text-sm text-muted-foreground mb-4">{due.length ? `${due.length} due today` : "Nothing due — pick a practice size."}</p>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_SIZES.map((n) => (
                <Button key={n} variant="outline" onClick={() => startWith(n)}>{n} cards</Button>
              ))}
              <Button variant="outline" onClick={() => startWith("due")}>Due today</Button>
              <Button onClick={() => startWith("all")}>All cards</Button>
            </div>
          </div>
        </div>
      )}

      <CardLayoutModal
        open={layoutOpen}
        onOpenChange={setLayoutOpen}
        initialFront={deck.cards[0]?.front}
        initialBack={deck.cards[0]?.back}
        onSave={saveLayout}
        busy={layoutBusy}
      />
    </div>
  );
}

function DeckChip({ deck, active, onClick }: { deck: Deck; active: boolean; onClick: () => void }) {
  const dueCount = deck.cards.filter((c) => c.dueInDays <= 0).length;
  return (
    <button onClick={onClick} className={cn("w-full text-left rounded-md border px-3 py-2.5 transition-colors", active ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted")}>
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-secondary shrink-0" />
        <span className="font-medium text-sm truncate">{deck.name}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 pl-6">
        <span className="text-xs text-muted-foreground">{totalCards(deck)} cards</span>
        {dueCount > 0 && <span className="pill bg-primary/12 text-primary text-[10px]">{dueCount} due</span>}
      </div>
    </button>
  );
}
