import { useMemo, useState } from "react";
import {
  Search, Plus, Layers, BookOpen, Trash2, ArrowUpDown, MessageSquareQuote, Loader2,
} from "lucide-react";
import { hskColor, type VList, type ListType, type ListItem } from "@/lib/data";
import { HskBadge, FamiliarityBar, Loading, ErrorState, EmptyState } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { VirtualList } from "@/components/VirtualList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNav } from "@/app/nav";
import { useApi, useQuery } from "@/app/useApi";
import { cn } from "@/lib/utils";

const TYPE_STYLE: Record<ListType, string> = {
  USER_CREATED: "bg-secondary/15 text-secondary",
  SAVED: "bg-primary/12 text-primary",
  SEEN: "bg-gold/15 text-gold",
  OFFICIAL: "bg-muted text-muted-foreground",
};
const countOf = (l: VList) => l._count?.items ?? l.items.length;

const GRID = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.8fr)_84px_132px_52px] items-center gap-2 px-5";
const ROW_H = 52;

export function VocabView() {
  const { go } = useNav();
  const { api } = useApi();
  const { data: lists, loading: listsLoading, error: listsError, reload: reloadLists } =
    useQuery((a) => a.getLists(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortFam, setSortFam] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = (lists ?? []).find((l) => l.id === activeId) ?? (lists ?? [])[0];

  const { data: words, loading: wordsLoading, error: wordsError, reload: reloadWords } =
    useQuery((a) => (active ? a.getListWords(active.id) : Promise.resolve([])), [active?.id]);

  const items = useMemo(() => {
    let list = words ?? [];
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter(
        (it) =>
          it.vocab.simplified.includes(q) ||
          it.vocab.pinyin.toLowerCase().includes(needle) ||
          it.vocab.meaning.toLowerCase().includes(needle)
      );
    }
    if (sortFam) list = [...list].sort((a, b) => a.familiarity - b.familiarity);
    return list;
  }, [words, q, sortFam]);

  async function createList() {
    const name = window.prompt("Name your new vocabulary list:");
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const created = await api.createList(name.trim());
      reloadLists();
      setActiveId(created.id);
    } catch (e: any) {
      alert("Could not create list: " + (e?.message ?? "unknown error"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteActive() {
    if (!active) return;
    if (!window.confirm(`Delete the list "${active.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteList(active.id);
      setActiveId(null);
      reloadLists();
    } catch (e: any) {
      alert("Could not delete list: " + (e?.message ?? "unknown error"));
    } finally {
      setBusy(false);
    }
  }

  async function createOrOpenDeck() {
    if (!active) return;
    if (active.hasDeck) { go("flashcards"); return; }
    setBusy(true);
    try {
      await api.syncDeck(active.id, active.name); // generate the deck from this list
      reloadLists();
      go("flashcards");
    } catch (e: any) {
      alert("Could not create deck: " + (e?.message ?? "unknown error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
      {/* Sidebar: lists */}
      <div className="paper p-4">
        <div className="flex items-center gap-1.5 mb-1">
          <h2 className="font-display text-lg font-semibold">Your lists</h2>
          <InfoTip id="listTypes" side="right" />
        </div>
        <p className="text-xs text-muted-foreground mb-3">The coloured tag shows where each list came from.</p>

        {listsLoading && !lists ? (
          <Loading label="Loading lists…" className="py-8" />
        ) : listsError ? (
          <ErrorState message={listsError} onRetry={reloadLists} />
        ) : (
          <>
            <div className="space-y-1.5">
              {(lists ?? []).map((l) => (
                <ListChip key={l.id} list={l} active={l.id === active?.id} onClick={() => setActiveId(l.id)} />
              ))}
              {(lists?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No lists yet.</p>
              )}
            </div>
            <Button variant="outline" className="w-full mt-3 gap-1.5 border-dashed" onClick={createList} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New list
            </Button>
          </>
        )}
      </div>

      {/* Main: words */}
      <div className="paper overflow-hidden">
        {!active ? (
          <EmptyState
            icon={<BookOpen className="h-10 w-10" />}
            title="No list selected"
            action={<Button className="gap-1.5" onClick={createList}><Plus className="h-4 w-4" /> Create a list</Button>}
          >
            Create a list, or save words while watching a video — they'll appear here.
          </EmptyState>
        ) : (
          <>
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display text-2xl font-semibold">{active.name}</h1>
                    <span className={cn("pill", TYPE_STYLE[active.type])}>{active.type.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    {active.description || "Custom vocabulary list."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {active.type !== "OFFICIAL" && active.type !== "SEEN" && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={deleteActive} disabled={busy}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  )}
                  <Button size="sm" className="gap-1.5" variant={active.hasDeck ? "secondary" : "default"} onClick={createOrOpenDeck} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    {active.hasDeck ? "Open deck" : "Create deck"}
                    {!active.hasDeck && <InfoTip id="syncDeck" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this list…" className="pl-9 h-9 bg-background" />
                </div>
                <button
                  onClick={() => setSortFam((s) => !s)}
                  className={cn("pill border gap-1", sortFam ? "border-secondary text-secondary bg-secondary/10" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  <ArrowUpDown className="h-3 w-3" /> Weakest first
                </button>
                <span className="ml-auto text-sm text-muted-foreground">
                  <span className="font-mono-num font-semibold text-foreground">{countOf(active)}</span> words
                </span>
              </div>
            </div>

            {/* Header row */}
            <div className={cn(GRID, "py-2.5 border-b border-border text-xs uppercase tracking-wide text-muted-foreground font-semibold")}>
              <span className="inline-flex items-center gap-1">Word <InfoTip id="simplifiedTraditional" /></span>
              <span className="inline-flex items-center gap-1">Pinyin <InfoTip id="tones" /></span>
              <span>Meaning</span>
              <span className="inline-flex items-center gap-1">Level <InfoTip id="hsk" /></span>
              <span className="inline-flex items-center gap-1">Familiarity <InfoTip id="familiarity" /></span>
              <span className="text-right">Seen</span>
            </div>

            {/* Rows (virtualized) */}
            {wordsLoading && !words ? (
              <Loading label="Loading words…" />
            ) : wordsError ? (
              <ErrorState message={wordsError} onRetry={reloadWords} />
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No words {q ? `match “${q}”` : "in this list yet"}.
              </div>
            ) : (
              <VirtualList
                items={items}
                rowHeight={ROW_H}
                height={Math.min(560, Math.max(ROW_H * 3, items.length * ROW_H))}
                renderRow={(it) => <WordRow it={it} />}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WordRow({ it }: { it: ListItem }) {
  return (
    <div className={cn(GRID, "h-full border-b border-border/60 hover:bg-muted/40 text-sm")}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-hans-serif text-2xl leading-none shrink-0" style={{ color: hskColor(it.vocab.hskLevel) }}>
          {it.vocab.simplified}
        </span>
        {it.contextSentence && <ContextPopover sentence={it.contextSentence} translation={it.contextTranslation} />}
      </div>
      <span className="text-muted-foreground truncate">{it.vocab.pinyin}</span>
      <span className="truncate">{it.vocab.meaning}</span>
      <span><HskBadge level={it.vocab.hskLevel} /></span>
      <FamiliarityBar value={it.familiarity} />
      <span className="text-right font-mono-num text-muted-foreground">{it.seenCount}×</span>
    </div>
  );
}

function ListChip({ list, active, onClick }: { list: VList; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("w-full text-left rounded-md border px-3 py-2.5 transition-colors", active ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted")}
    >
      <span className="font-medium text-sm leading-tight block truncate">{list.name}</span>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={cn("pill text-[10px]", TYPE_STYLE[list.type])}>{list.type.replace("_", " ")}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> {countOf(list)}
        </span>
      </div>
    </button>
  );
}

function ContextPopover({ sentence, translation }: { sentence: string; translation?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-secondary/70 hover:text-secondary shrink-0" title="See the sentence this word was saved from">
          <MessageSquareQuote className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 paper p-3 text-foreground">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1 flex items-center gap-1">
          Context sentence <InfoTip id="contextSentence" />
        </p>
        <p className="font-hans text-base">{sentence}</p>
        {translation && <p className="text-sm text-muted-foreground mt-1 italic">{translation}</p>}
      </PopoverContent>
    </Popover>
  );
}
