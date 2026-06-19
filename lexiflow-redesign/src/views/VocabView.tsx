import { useState } from "react";
import { Search, Plus, Layers, BookOpen, Trash2, ArrowUpDown, MessageSquareQuote } from "lucide-react";
import { LISTS, hskColor, type VList, type ListType } from "@/lib/data";
import { HskBadge, FamiliarityBar } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNav } from "@/app/nav";
import { cn } from "@/lib/utils";

const TYPE_STYLE: Record<ListType, string> = {
  USER_CREATED: "bg-secondary/15 text-secondary",
  SAVED: "bg-primary/12 text-primary",
  SEEN: "bg-gold/15 text-gold",
  OFFICIAL: "bg-muted text-muted-foreground",
};

export function VocabView() {
  const { go } = useNav();
  const [activeId, setActiveId] = useState(LISTS[0].id);
  const [q, setQ] = useState("");
  const [sortFam, setSortFam] = useState(false);
  const active = LISTS.find((l) => l.id === activeId)!;

  let items = active.items.filter(
    (it) =>
      it.vocab.simplified.includes(q) ||
      it.vocab.pinyin.toLowerCase().includes(q.toLowerCase()) ||
      it.vocab.meaning.toLowerCase().includes(q.toLowerCase())
  );
  if (sortFam) items = [...items].sort((a, b) => a.familiarity - b.familiarity);

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
      {/* Sidebar: lists */}
      <div className="space-y-4">
        <div className="paper p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <h2 className="font-display text-lg font-semibold">Your lists</h2>
            <InfoTip id="listTypes" side="right" />
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            The coloured tag shows where each list came from.
          </p>
          <div className="space-y-1.5">
            {LISTS.map((l) => (
              <ListChip key={l.id} list={l} active={l.id === activeId} onClick={() => setActiveId(l.id)} />
            ))}
          </div>
          <Button variant="outline" className="w-full mt-3 gap-1.5 border-dashed">
            <Plus className="h-4 w-4" /> New list
          </Button>
        </div>
      </div>

      {/* Main: words */}
      <div className="paper overflow-hidden">
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-semibold">{active.name}</h1>
                <span className={cn("pill", TYPE_STYLE[active.type])}>{active.type.replace("_", " ")}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">{active.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {active.type !== "OFFICIAL" && active.type !== "SEEN" && (
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5"
                variant={active.hasDeck ? "secondary" : "default"}
                onClick={() => go("flashcards")}
              >
                <Layers className="h-4 w-4" />
                {active.hasDeck ? "Open deck" : "Create deck"}
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
              <span className="font-mono-num font-semibold text-foreground">{active.items.length}</span> words
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="font-semibold py-2.5 px-5">Word</th>
                <th className="font-semibold py-2.5 px-2">Pinyin</th>
                <th className="font-semibold py-2.5 px-2">Meaning</th>
                <th className="font-semibold py-2.5 px-2">Level</th>
                <th className="font-semibold py-2.5 px-2">
                  <span className="inline-flex items-center gap-1">Familiarity <InfoTip id="familiarity" /></span>
                </th>
                <th className="font-semibold py-2.5 px-2 text-right pr-5">Seen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.vocab.simplified} className="border-b border-border/60 hover:bg-muted/40 align-middle">
                  <td className="py-2.5 px-5">
                    <div className="flex items-center gap-2">
                      <span className="font-hans-serif text-2xl leading-none" style={{ color: hskColor(it.vocab.hskLevel) }}>
                        {it.vocab.simplified}
                      </span>
                      {it.contextSentence && (
                        <InfoTipContext sentence={it.contextSentence} translation={it.contextTranslation} />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground">{it.vocab.pinyin}</td>
                  <td className="py-2.5 px-2">{it.vocab.meaning}</td>
                  <td className="py-2.5 px-2"><HskBadge level={it.vocab.hskLevel} /></td>
                  <td className="py-2.5 px-2"><FamiliarityBar value={it.familiarity} /></td>
                  <td className="py-2.5 px-2 text-right pr-5 font-mono-num text-muted-foreground">{it.seenCount}×</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">No words match “{q}”.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListChip({ list, active, onClick }: { list: VList; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-md border px-3 py-2.5 transition-colors",
        active ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm leading-tight">{list.name}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={cn("pill text-[10px]", TYPE_STYLE[list.type])}>{list.type.replace("_", " ")}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> {list.items.length}
        </span>
      </div>
    </button>
  );
}

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
function InfoTipContext({ sentence, translation }: { sentence: string; translation?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-secondary/70 hover:text-secondary" title="See the sentence this word was saved from">
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
