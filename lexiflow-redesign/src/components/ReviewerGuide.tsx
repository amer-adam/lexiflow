import { useState } from "react";
import {
  BookMarked,
  Info,
  PlayCircle,
  Save,
  ListChecks,
  Layers,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNav, type ViewId } from "@/app/nav";

const LOOP: { icon: typeof Save; title: string; view: ViewId; text: string }[] = [
  { icon: PlayCircle, title: "1 · Watch", view: "watch", text: "Play any video with interactive, colour-graded bilingual subtitles. Tap any character to look it up." },
  { icon: Save, title: "2 · Save", view: "watch", text: "Tap a word to save it — LexiFlow keeps the exact sentence it appeared in." },
  { icon: ListChecks, title: "3 · Organise", view: "vocab", text: "Saved words land in vocabulary lists you can search, sort and curate." },
  { icon: Layers, title: "4 · Drill", view: "flashcards", text: "Turn a list into FSRS spaced-repetition flashcards and review what's due." },
  { icon: CheckSquare, title: "5 · Test", view: "quiz", text: "Generate a mixed-format quiz from any list to check real recall." },
];

export function ReviewerGuide() {
  const [open, setOpen] = useState(false);
  const { go } = useNav();

  const jump = (v: ViewId) => {
    setOpen(false);
    go(v);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-secondary/40 text-secondary hover:bg-secondary/10 hover:text-secondary"
        >
          <BookMarked className="h-4 w-4" />
          For reviewers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl paper p-0 gap-0 overflow-hidden max-h-[88vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border text-left">
          <div className="flex items-center gap-3">
            <span className="seal grid h-10 w-10 place-items-center text-xl font-bold">流</span>
            <div>
              <DialogTitle className="font-display text-2xl">Welcome — a guide for reviewers</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Everything you need to evaluate this project, in two minutes.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          <section>
            <h3 className="font-display text-lg font-semibold mb-1.5">What is LexiFlow?</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              LexiFlow helps people learn Mandarin Chinese from real video they enjoy. Paste a
              YouTube link and it transcribes, translates, and grades every line — then turns the
              words you meet into spaced-repetition flashcards and quizzes. The five steps below are
              the whole learning loop; click any card to jump straight there.
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold mb-3">The learning loop</h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {LOOP.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.title}
                    onClick={() => jump(s.view)}
                    className="text-left rounded-lg border border-border bg-background/60 hover:bg-muted hover:border-secondary/40 transition-colors p-3 group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">{s.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg bg-secondary/10 border border-secondary/20 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Info className="h-4 w-4 text-secondary" />
              <h3 className="font-semibold text-sm">See an ⓘ anywhere? Click it.</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every specialist term — HSK levels, FSRS spaced repetition, familiarity scores,
              distractors, list types — has a small info button beside it that explains the concept
              in plain language. You never need outside knowledge to mark this project.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">
            This is an interactive demo populated with sample data, so every screen can be explored
            without a server. The underlying app is a Vue + FastAPI/Node + PostgreSQL system.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/40 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => jump("watch")}>
            Start at “Watch” <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
