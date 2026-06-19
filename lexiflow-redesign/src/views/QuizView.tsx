import { useState } from "react";
import { Sparkles, Check, X, ArrowRight, RotateCcw, Trophy, Wand2 } from "lucide-react";
import {
  LISTS, QUIZ_QUESTIONS, QUESTION_TYPE_LABEL, hskColor,
  type QuestionType, type QuizQuestion,
} from "@/lib/data";
import { PageHeader, HskBadge } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ALL_TYPES: QuestionType[] = ["MULTIPLE_CHOICE", "FILL_BLANK", "TRUE_FALSE", "SHORT_ANSWER"];

export function QuizView() {
  const [stage, setStage] = useState<"config" | "quiz" | "result">("config");
  const [listId, setListId] = useState(LISTS[0].id);
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<QuestionType[]>(ALL_TYPES);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const generate = () => {
    const qs = QUIZ_QUESTIONS.filter((q) => types.includes(q.type)).slice(0, count);
    setQuestions(qs.length ? qs : QUIZ_QUESTIONS.slice(0, count));
    setIdx(0); setAnswer(""); setChecked(false); setScore(0);
    setStage("quiz");
  };

  const q = questions[idx];
  const correct = q && answer.trim().toLowerCase().replace(/\s/g, "")
    .includes(q.answer.split("—")[0].trim().toLowerCase().replace(/\s/g, ""))
    && answer.trim() !== "";

  const check = () => {
    if (correct) setScore((s) => s + 1);
    setChecked(true);
  };
  const next = () => {
    if (idx + 1 >= questions.length) { setStage("result"); return; }
    setIdx((i) => i + 1); setAnswer(""); setChecked(false);
  };

  // ── Config ───────────────────────────────────────────────────
  if (stage === "config") {
    return (
      <div className="max-w-2xl">
        <PageHeader eyebrow="Test yourself" title="Build a quiz" conceptId="quizGen">
          LexiFlow generates a fresh quiz from any vocabulary list, mixing question formats. Pick your
          settings and go.
        </PageHeader>

        <div className="paper p-5 space-y-6">
          <div>
            <label className="text-sm font-semibold mb-2 block">Vocabulary list</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {LISTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setListId(l.id)}
                  className={cn("text-left rounded-md border px-3 py-2.5 transition-colors", l.id === listId ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted")}
                >
                  <div className="font-medium text-sm">{l.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{l.items.length} words</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Number of questions: <span className="font-mono-num text-primary">{count}</span></label>
            <input type="range" min={3} max={5} value={count} onChange={(e) => setCount(+e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className="text-sm font-semibold">Question formats</label>
              <InfoTip id="questionTypes" />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ALL_TYPES.map((tp) => {
                const on = types.includes(tp);
                return (
                  <button
                    key={tp}
                    onClick={() => setTypes((t) => on ? t.filter((x) => x !== tp) : [...t, tp])}
                    className={cn("flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors", on ? "border-secondary/50 bg-secondary/10" : "border-border hover:bg-muted")}
                  >
                    <span className={cn("grid h-4 w-4 place-items-center rounded border", on ? "bg-secondary border-secondary text-secondary-foreground" : "border-border")}>
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    {QUESTION_TYPE_LABEL[tp]}
                    {tp === "MULTIPLE_CHOICE" && <InfoTip id="distractors" className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Button size="lg" className="w-full gap-2" onClick={generate} disabled={types.length === 0}>
            <Wand2 className="h-4 w-4" /> Generate quiz
          </Button>
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────
  if (stage === "result") {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-md mx-auto text-center paper p-8 mt-8">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold mx-auto mb-4">
          <Trophy className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-semibold mb-1">Quiz complete</h2>
        <div className="font-display text-5xl font-semibold font-mono-num my-3" style={{ color: hskColor(pct >= 60 ? 1 : 6) }}>
          {score}/{questions.length}
        </div>
        <p className="text-muted-foreground mb-6">You scored {pct}%. Missed words will surface in your next review.</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => setStage("config")}>New quiz</Button>
          <Button onClick={generate} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Retry</Button>
        </div>
      </div>
    );
  }

  // ── Quiz in progress ─────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={() => setStage("config")}>← Quit</Button>
        <span className="pill bg-muted text-muted-foreground">{QUESTION_TYPE_LABEL[q.type]}</span>
        <span className="text-sm text-muted-foreground font-mono-num">{idx + 1} / {questions.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted mb-6 overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>

      <div className="paper p-6">
        <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-secondary" /> Question {idx + 1}
          <HskBadge level={q.vocab.hskLevel} />
        </div>
        <p className="text-xl font-medium leading-relaxed mb-5">{q.prompt}</p>

        {/* Answer inputs */}
        {(q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") && (
          <div className={cn("grid gap-2", q.type === "TRUE_FALSE" ? "grid-cols-2" : "sm:grid-cols-2")}>
            {q.options!.map((opt) => {
              const chosen = answer === opt;
              const isAns = opt === q.answer;
              return (
                <button
                  key={opt}
                  disabled={checked}
                  onClick={() => setAnswer(opt)}
                  className={cn(
                    "rounded-md border px-4 py-3 text-left transition-colors",
                    !checked && chosen && "border-primary bg-primary/5",
                    !checked && !chosen && "border-border hover:bg-muted",
                    checked && isAns && "border-hsk-1 bg-hsk-1/10 text-hsk-1",
                    checked && chosen && !isAns && "border-primary bg-primary/10 text-primary",
                    checked && !isAns && !chosen && "border-border opacity-60"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    {checked && isAns && <Check className="h-4 w-4" />}
                    {checked && chosen && !isAns && <X className="h-4 w-4" />}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {(q.type === "FILL_BLANK" || q.type === "SHORT_ANSWER") && (
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={checked}
            placeholder={q.type === "FILL_BLANK" ? "Type the missing word (characters or pinyin)…" : "Type pinyin and meaning…"}
            className="text-lg h-12 bg-background"
            onKeyDown={(e) => e.key === "Enter" && !checked && answer && check()}
          />
        )}

        {/* Feedback */}
        {checked && (
          <div className={cn("mt-4 rounded-md p-3 border", correct ? "bg-hsk-1/10 border-hsk-1/30" : "bg-primary/5 border-primary/30")}>
            <div className="flex items-center gap-2 font-semibold mb-1">
              {correct ? <><Check className="h-4 w-4 text-hsk-1" /> Correct!</> : <><X className="h-4 w-4 text-primary" /> Answer: {q.answer}</>}
            </div>
            <p className="text-sm text-muted-foreground">{q.explanation}</p>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          {!checked ? (
            <Button onClick={check} disabled={!answer.trim()}>Check answer</Button>
          ) : (
            <Button onClick={next} className="gap-1.5">
              {idx + 1 >= questions.length ? "See results" : "Next"} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
