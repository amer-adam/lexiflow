import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Layers, BookOpen, Trash2, ArrowUpDown, MessageSquareQuote, Loader2, Lock, UserPlus, Clock, Download, Upload,
} from "lucide-react";
import { hskColor, type VList, type ListType, type ListItem, type HskLevel } from "@/lib/data";
import { HskBadge, FamiliarityBar, Loading, ErrorState, EmptyState } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { VirtualList } from "@/components/VirtualList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardLayoutModal, type SideConfig } from "@/components/CardLayoutModal";
import { SpeakButton } from "@/components/SpeakButton";
import { useNav } from "@/app/nav";
import { useApi, useQuery } from "@/app/useApi";
import { type SubtitleMatch } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_STYLE: Record<ListType, string> = {
  USER_CREATED: "bg-secondary/15 text-secondary",
  SAVED: "bg-primary/12 text-primary",
  SEEN: "bg-gold/15 text-gold",
  OFFICIAL: "bg-muted text-muted-foreground",
};
// Display order weight: user lists first, then saved, seen, official last (read-only).
const ORDER_WEIGHT: Record<ListType, number> = { USER_CREATED: 0, SAVED: 1, SEEN: 2, OFFICIAL: 3 };
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
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [qaSimplified, setQaSimplified] = useState("");
  const [qaPinyin, setQaPinyin] = useState("");
  const [qaMeaning, setQaMeaning] = useState("");
  const [qaBusy, setQaBusy] = useState(false);
  const [occurrenceWord, setOccurrenceWord] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const sortedLists = useMemo(
    () => [...(lists ?? [])].sort((a, b) => ORDER_WEIGHT[a.type] - ORDER_WEIGHT[b.type]),
    [lists]
  );
  const active = sortedLists.find((l) => l.id === activeId) ?? sortedLists[0];

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

  async function importList(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "txt") {
      alert("Only .csv and .txt files are supported — export a list from LexiFlow (CSV or Anki/.txt) to get a file in the right format.");
      return;
    }
    setImportBusy(true);
    try {
      const result = await api.importList(file);
      reloadLists();
      setActiveId(result.listId);
      alert(`Imported ${result.wordsAdded} of ${result.wordsFound} word${result.wordsFound === 1 ? "" : "s"} into "${result.listName}".`);
    } catch (e: any) {
      alert("Could not import list: " + (e?.message ?? "unknown error"));
    } finally {
      setImportBusy(false);
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

  async function exportActive(format: "csv" | "anki" | "pdf") {
    if (!active) return;
    setExportBusy(format);
    try {
      const blob = await api.exportList(active.id, format);
      const ext = format === "anki" ? "txt" : format;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${active.name.replace(/[^a-z0-9_\- ]/gi, "").trim() || "vocabulary"}${format === "anki" ? "_anki" : ""}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (e: any) {
      alert("Could not export list: " + (e?.message ?? "unknown error"));
    } finally {
      setExportBusy(null);
    }
  }

  function createOrOpenDeck() {
    if (!active) return;
    if (active.hasDeck) { go("flashcards"); return; }
    setLayoutOpen(true);
  }

  async function confirmCreateDeck(front: SideConfig, back: SideConfig) {
    if (!active) return;
    setBusy(true);
    try {
      await api.syncDeck(active.id, active.name, front, back); // generate the deck from this list
      setLayoutOpen(false);
      reloadLists();
      go("flashcards");
    } catch (e: any) {
      alert("Could not create deck: " + (e?.message ?? "unknown error"));
    } finally {
      setBusy(false);
    }
  }

  async function addWord() {
    if (!active || !qaSimplified.trim()) return;
    setQaBusy(true);
    try {
      await api.addWord(active.id, {
        simplified: qaSimplified.trim(), pinyin: qaPinyin.trim(), meaning: qaMeaning.trim(),
        hskLevel: 0 as HskLevel,
      });
      setQaSimplified(""); setQaPinyin(""); setQaMeaning(""); setQuickAdd(false);
      reloadWords();
    } catch (e: any) {
      alert("Could not add word: " + (e?.message ?? "unknown error"));
    } finally {
      setQaBusy(false);
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
              {sortedLists.map((l) => (
                <ListChip key={l.id} list={l} active={l.id === active?.id} onClick={() => setActiveId(l.id)} />
              ))}
              {(lists?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No lists yet.</p>
              )}
            </div>
            <Button variant="outline" className="w-full mt-3 gap-1.5 border-dashed" onClick={createList} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New list
            </Button>
            <div className="relative mt-1.5">
              <label className={cn("w-full gap-1.5 inline-flex items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium cursor-pointer hover:bg-muted transition-colors", importBusy && "opacity-60 pointer-events-none")}>
                {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import list
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importList(f); e.target.value = ""; }}
                  disabled={importBusy}
                />
              </label>
              <InfoTip id="importList" className="absolute right-2 top-1/2 -translate-y-1/2" />
            </div>
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
                  <Popover open={exportOpen} onOpenChange={setExportOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="h-4 w-4" /> Export
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-48 p-1.5">
                      {([
                        ["csv", "CSV (spreadsheet)"],
                        ["anki", "Anki import (.txt)"],
                        ["pdf", "PDF (printable)"],
                      ] as const).map(([fmt, label]) => (
                        <button
                          key={fmt}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md hover:bg-muted text-left disabled:opacity-50"
                          onClick={() => exportActive(fmt)}
                          disabled={exportBusy !== null}
                        >
                          {exportBusy === fmt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
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

              {active.type === "OFFICIAL" ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 rounded-md bg-muted/50 px-3 py-2">
                  <Lock className="h-3.5 w-3.5 shrink-0" /> Official list locked — you can't add or remove words here.
                </div>
              ) : !quickAdd ? (
                <button onClick={() => setQuickAdd(true)} className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline mt-3">
                  <UserPlus className="h-3.5 w-3.5" /> Quick-add a word
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Input value={qaSimplified} onChange={(e) => setQaSimplified(e.target.value)} placeholder="汉字" className="w-24 h-9 bg-background font-hans-serif" />
                  <Input value={qaPinyin} onChange={(e) => setQaPinyin(e.target.value)} placeholder="pinyin" className="w-28 h-9 bg-background" />
                  <Input value={qaMeaning} onChange={(e) => setQaMeaning(e.target.value)} placeholder="meaning" className="flex-1 min-w-[8rem] h-9 bg-background" />
                  <Button size="sm" onClick={addWord} disabled={qaBusy || !qaSimplified.trim()} className="gap-1.5">
                    {qaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuickAdd(false)}>Cancel</Button>
                </div>
              )}
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
                renderRow={(it) => <WordRow it={it} onSeenClick={() => setOccurrenceWord(it.vocab.simplified)} />}
              />
            )}
          </>
        )}
      </div>

      {active && (
        <CardLayoutModal
          open={layoutOpen}
          onOpenChange={setLayoutOpen}
          onSave={confirmCreateDeck}
          busy={busy}
        />
      )}

      <OccurrencesModal word={occurrenceWord} onOpenChange={(o) => !o && setOccurrenceWord(null)} />
    </div>
  );
}

function WordRow({ it, onSeenClick }: { it: ListItem; onSeenClick: () => void }) {
  return (
    <div className={cn(GRID, "h-full border-b border-border/60 hover:bg-muted/40 text-sm")}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-hans-serif text-2xl leading-none shrink-0" style={{ color: hskColor(it.vocab.hskLevel) }}>
          {it.vocab.simplified}
        </span>
        <SpeakButton text={it.vocab.simplified} />
        {it.contextSentence && <ContextPopover sentence={it.contextSentence} translation={it.contextTranslation} />}
      </div>
      <span className="text-muted-foreground truncate">{it.vocab.pinyin}</span>
      <span className="truncate">{it.vocab.meaning}</span>
      <span><HskBadge level={it.vocab.hskLevel} /></span>
      <FamiliarityBar value={it.familiarity} />
      <button onClick={onSeenClick} className="text-right font-mono-num text-muted-foreground hover:text-secondary hover:underline justify-self-end" title="See every video segment where this word appeared">
        {it.seenCount}×
      </button>
    </div>
  );
}

function OccurrencesModal({ word, onOpenChange }: { word: string | null; onOpenChange: (o: boolean) => void }) {
  const { api } = useApi();
  const { go } = useNav();
  const [matches, setMatches] = useState<SubtitleMatch[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!word) return;
    setBusy(true);
    api.searchSubtitles(word).then(setMatches).catch(() => setMatches([])).finally(() => setBusy(false));
  }, [word, api]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <Dialog open={!!word} onOpenChange={onOpenChange}>
      <DialogContent className="paper max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <span className="font-hans-serif text-2xl">{word}</span> seen in
          </DialogTitle>
        </DialogHeader>
        {busy ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Searching…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No video segments found for this word.</p>
        ) : (
          <ul className="space-y-1.5 max-h-80 overflow-y-auto">
            {matches.map((m, i) => (
              <li key={i}>
                <button
                  onClick={() => { onOpenChange(false); go("watch", { id: m.jobId, t: String(m.start) }); }}
                  className="w-full text-left rounded-md border border-border hover:bg-muted/50 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium text-muted-foreground truncate">{m.videoTitle}</span>
                    <span className="pill bg-secondary/15 text-secondary text-[10px] shrink-0 gap-1"><Clock className="h-2.5 w-2.5" />{fmt(m.start)}</span>
                  </div>
                  <p className="font-hans text-sm leading-snug">{m.text}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
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
