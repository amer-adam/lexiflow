import { useState } from "react";
import { Sparkles, Check, X, ArrowLeft, ArrowRight, RotateCcw, Trophy, Wand2, Loader2 } from "lucide-react";
import { QUESTION_TYPE_LABEL, hskColor, type QuestionType } from "@/lib/data";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi, useQuery } from "@/app/useApi";
import { useNav } from "@/app/nav";
import { SpeakButton } from "@/components/SpeakButton";
import type { LiveQuizQuestion, QuizGrade } from "@/lib/api";
import { cn } from "@/lib/utils";

const ALL_TYPES: QuestionType[] = ["MULTIPLE_CHOICE", "FILL_BLANK", "TRUE_FALSE", "SHORT_ANSWER"];

export function QuizView() {
  const { api } = useApi();
  const { go } = useNav();
  const { data: lists, loading: listsLoading, error: listsError, reload } = useQuery((a) => a.getLists(), []);

  const [stage, setStage] = useState<"config" | "quiz" | "result">("config");
  const [listId, setListId] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<QuestionType[]>(ALL_TYPES);
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<LiveQuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [recorded, setRecorded] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [grade, setGrade] = useState<QuizGrade | null>(null);

  const activeList = (lists ?? []).find((l) => l.id === listId) ?? (lists ?? [])[0];
  const q = questions[idx];

  const generate = async () => {
    if (!activeList) return;
    setGenError(null);
    setGenerating(true);
    try {
      const quiz = await api.generateQuiz(activeList.id, count, types);
      if (!quiz.questions?.length) throw new Error("No questions could be generated from this list.");
      setQuizId(quiz.id);
      setQuestions(quiz.questions);
      setIdx(0); setAnswer(""); setRecorded({}); setGrade(null);
      setStage("quiz");
    } catch (e: any) {
      setGenError(e?.message ?? "Quiz generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  // Jump to another question, restoring whatever answer (if any) was already
  // recorded for it — lets you go back and forth to change answers freely.
  const goToQuestion = (newIdx: number, rec: Record<string, string>) => {
    setIdx(newIdx);
    setAnswer(rec[questions[newIdx].id] ?? "");
  };

  const next = async () => {
    const rec = { ...recorded, [q.id]: answer };
    setRecorded(rec);
    if (idx + 1 < questions.length) {
      goToQuestion(idx + 1, rec);
      return;
    }
    setSubmitting(true);
    try {
      const g = await api.submitQuiz(quizId!, Object.entries(rec).map(([questionId, userAnswer]) => ({ questionId, userAnswer })));
      setGrade(g);
    } catch (e: any) {
      setGenError(e?.message ?? "Could not submit the quiz.");
    } finally {
      setSubmitting(false);
      setStage("result");
    }
  };

  const prev = () => {
    if (idx === 0) return;
    const rec = { ...recorded, [q.id]: answer };
    setRecorded(rec);
    goToQuestion(idx - 1, rec);
  };

  // ── Config ───────────────────────────────────────────────────
  if (stage === "config") {
    return (
      <div className="max-w-2xl">
        <PageHeader eyebrow="Test yourself" title="Build a quiz" conceptId="quizGen">
          LexiFlow generates a fresh quiz from any vocabulary list, mixing question formats.
        </PageHeader>

        {listsLoading && !lists ? (
          <Loading label="Loading your lists…" />
        ) : listsError ? (
          <div className="paper"><ErrorState message={listsError} onRetry={reload} /></div>
        ) : (lists?.length ?? 0) === 0 ? (
          <div className="paper">
            <EmptyState title="You need a vocabulary list first" action={<Button onClick={() => go("vocab")}>Go to Vocabulary</Button>}>
              Save some words or create a list, then come back to quiz yourself on them.
            </EmptyState>
          </div>
        ) : (
          <div className="paper p-5 space-y-6">
            <div>
              <label className="text-sm font-semibold mb-2 block">Vocabulary list</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {(lists ?? []).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setListId(l.id)}
                    className={cn("text-left rounded-md border px-3 py-2.5 transition-colors", l.id === activeList?.id ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted")}
                  >
                    <div className="font-medium text-sm truncate">{l.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{l._count?.items ?? l.items.length} words</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Number of questions: <span className="font-mono-num text-primary">{count}</span></label>
              <input type="range" min={3} max={15} value={count} onChange={(e) => setCount(+e.target.value)} className="w-full accent-[hsl(var(--primary))]" />
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
                      onClick={() => setTypes((t) => (on ? t.filter((x) => x !== tp) : [...t, tp]))}
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

            {genError && <p className="text-sm text-primary">{genError}</p>}

            <Button size="lg" className="w-full gap-2" onClick={generate} disabled={types.length === 0 || generating || !activeList}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate quiz"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────
  if (stage === "result") {
    const correct = grade?.correctCount ?? 0;
    const total = grade?.totalQuestions ?? questions.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="paper p-8 text-center mb-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gold/15 text-gold mx-auto mb-4"><Trophy className="h-8 w-8" /></div>
          <h2 className="font-display text-2xl font-semibold mb-1">Quiz complete</h2>
          <div className="font-display text-5xl font-semibold font-mono-num my-3" style={{ color: hskColor(pct >= 60 ? 1 : 6) }}>{correct}/{total}</div>
          <p className="text-muted-foreground">You scored {pct}%.</p>
          <div className="flex gap-2 justify-center mt-5">
            <Button variant="outline" onClick={() => { setStage("config"); setGrade(null); }}>New quiz</Button>
            <Button onClick={generate} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Retry</Button>
          </div>
        </div>
        {grade?.breakdown && (
          <div className="paper divide-y divide-border">
            {grade.breakdown.map((b, i) => (
              <div key={b.questionId} className="p-4">
                <div className="flex items-start gap-2">
                  {b.isCorrect ? <Check className="h-4 w-4 text-hsk-1 mt-0.5 shrink-0" /> : <X className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{i + 1}. {b.questionText}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your answer: <span className={b.isCorrect ? "text-hsk-1" : "text-primary"}>{b.userAnswer || "—"}</span>
                      {!b.isCorrect && <> · Correct: <span className="text-foreground">{b.correctAnswer}</span></>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Quiz in progress ─────────────────────────────────────────
  if (!q) return <Loading />;
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
        </div>
        <p className="text-xl font-medium leading-relaxed mb-5 flex items-start gap-2">
          {q.questionText}
          <SpeakButton text={q.questionText} size="md" className="mt-1 shrink-0" />
        </p>

        {q.options?.length ? (
          <div className={cn("grid gap-2", q.type === "TRUE_FALSE" ? "grid-cols-2" : "sm:grid-cols-2")}>
            {q.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(opt)}
                className={cn("rounded-md border px-4 py-3 text-left transition-colors", answer === opt ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted")}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={q.type === "FILL_BLANK" ? "Type the missing word…" : "Type your answer…"}
            className="text-lg h-12 bg-background"
            onKeyDown={(e) => e.key === "Enter" && answer.trim() && next()}
          />
        )}

        <div className="mt-5 flex justify-between">
          <Button variant="outline" onClick={prev} disabled={idx === 0 || submitting} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={next} disabled={!answer.trim() || submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {idx + 1 >= questions.length ? "Finish & see score" : "Next"}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
