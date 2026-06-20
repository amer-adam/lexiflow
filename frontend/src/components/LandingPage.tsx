import {
  LogIn,
  Play,
  Film,
  Library,
  BookOpenCheck,
  Layers,
  CheckSquare,
  Subtitles,
  Sparkles,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HskDot, HskLegend } from "@/components/bits";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Library,
    title: "Library",
    body: "Curate the videos you actually want to learn from — YouTube links or your own files, organised and ready to study.",
  },
  {
    icon: Subtitles,
    title: "Tap-to-translate subtitles",
    body: "Every line is interactive. Tap a character mid-video for pinyin and meaning, no pausing to switch apps.",
  },
  {
    icon: BookOpenCheck,
    title: "Vocabulary lists",
    body: "Words you save are organised automatically by video and HSK level, so nothing gets lost in a notes app.",
  },
  {
    icon: Layers,
    title: "Spaced-repetition flashcards",
    body: "Saved words become flashcards on a schedule tuned to when you're about to forget them — not before, not after.",
  },
  {
    icon: CheckSquare,
    title: "Adaptive quizzes",
    body: "Quizzes are generated from your own vocabulary, so practice always matches what you're actually learning.",
  },
  {
    icon: Sparkles,
    title: "HSK-aware everywhere",
    body: "Every word and video is colour-coded by HSK difficulty — see at a glance what's within reach and what's a stretch.",
  },
] as const;

const STEPS = [
  { t: "Add a video", d: "Paste a YouTube link or upload a file.", icon: Film },
  { t: "Watch & save words", d: "Tap any character to look it up and save it.", icon: Play },
  { t: "Drill & quiz", d: "Turn saved words into flashcards and quizzes.", icon: Layers },
] as const;

const DEMO_LINE = [
  { hanzi: "我们", pinyin: "wǒmen", level: 1 as const },
  { hanzi: "可以", pinyin: "kěyǐ", level: 2 as const },
  { hanzi: "一起", pinyin: "yīqǐ", level: 2 as const },
  { hanzi: "学习", pinyin: "xuéxí", level: 1 as const },
];

export function LandingPage({
  onSignIn,
  configured,
}: {
  onSignIn: () => void;
  configured: boolean;
}) {
  return (
    <div className="min-h-screen overflow-y-auto">
      {/* ── Topbar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 h-16 px-5 md:px-8 border-b border-border bg-card/70 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="seal grid h-9 w-9 place-items-center text-lg font-bold">流</span>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight">LexiFlow</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Learn Chinese
            </div>
          </div>
        </div>
        <Button className="gap-2" onClick={onSignIn} disabled={!configured}>
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
      </header>

      <main className="relative z-[1]">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-16 font-hans-serif text-[18rem] leading-none text-secondary/[0.05] select-none hidden lg:block"
          >
            学
          </div>
          <div className="mx-auto max-w-6xl px-5 md:px-8 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-3">
                为爱学习 · Learn Mandarin from real video
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] tracking-tight">
                Stop translating.
                <br />
                Start understanding <span className="font-hans-serif">中文</span>.
              </h1>
              <p className="text-muted-foreground mt-5 max-w-lg leading-relaxed">
                LexiFlow turns any Chinese video into an interactive lesson — tap a word for its
                pinyin and meaning, save it, then drill it into memory with spaced-repetition
                flashcards and quizzes built from your own vocabulary.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-7">
                <Button size="lg" className="gap-2" onClick={onSignIn} disabled={!configured}>
                  <LogIn className="h-4 w-4" /> Sign in to continue
                </Button>
                <a
                  href="#features"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
                >
                  See how it works <ArrowDown className="h-3.5 w-3.5" />
                </a>
              </div>
              {!configured && (
                <p className="text-xs text-muted-foreground mt-4">
                  Sign-in isn't configured in this build. Set the Auth0 variables in{" "}
                  <code>.env.local</code>.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Free to start · Your lists, decks and progress are saved to your account.
              </p>
            </div>

            {/* ── Live mock of the Watch experience ────────────────── */}
            <div className="relative mx-auto w-full max-w-sm">
              <div className="paper p-5 -rotate-1">
                <div className="relative aspect-video rounded-md overflow-hidden mb-4 bg-gradient-to-br from-secondary/30 to-primary/20 grid place-items-center">
                  <Play className="h-12 w-12 text-white/90" strokeWidth={1.5} />
                  <div className="absolute bottom-2 left-2 right-2 rounded bg-black/55 px-2.5 py-1.5">
                    <p className="font-hans-serif text-base text-white leading-snug flex gap-1 flex-wrap">
                      {DEMO_LINE.map((w) => (
                        <span
                          key={w.hanzi}
                          className="cursor-pointer hover:text-primary transition-colors underline decoration-dotted decoration-white/30 underline-offset-2"
                        >
                          {w.hanzi}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {DEMO_LINE.map((w) => w.pinyin).join(" ")}
                </p>
                <p className="text-sm font-medium mb-3">"We can learn together."</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {DEMO_LINE.map((w) => (
                    <span key={w.hanzi} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <HskDot level={w.level} />
                      {w.hanzi}
                    </span>
                  ))}
                </div>
              </div>
              <div className="seal absolute -bottom-4 -right-4 grid h-14 w-14 place-items-center text-xl font-bold rotate-3 shadow-lg">
                流
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature grid ──────────────────────────────────────── */}
        <section id="features" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-5 md:px-8 py-16">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">
                Everything in one place
              </p>
              <h2 className="font-display text-3xl font-semibold">
                From watching to remembering, in one flow
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="paper p-5">
                    <span className="seal grid h-9 w-9 place-items-center mb-3">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <h3 className="font-display text-lg font-semibold mb-1.5">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 md:px-8 py-16">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">
                Get started in three steps
              </p>
              <h2 className="font-display text-3xl font-semibold">It only takes a minute</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.t} className="paper p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary/15 text-secondary text-sm font-semibold">
                        {i + 1}
                      </span>
                      <Icon className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="font-semibold">{s.t}</div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.d}</p>
                  </div>
                );
              })}
            </div>

            <div className="paper p-5 mt-6">
              <HskLegend />
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                Every word, video and quiz question is graded against the HSK scale, so you always
                know whether something is within reach or a stretch.
              </p>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────── */}
        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-3xl px-5 md:px-8 py-16 text-center">
            <span className="seal grid h-12 w-12 place-items-center text-xl font-bold mx-auto mb-5">
              流
            </span>
            <h2 className="font-display text-3xl font-semibold">
              Ready to learn Chinese the way you actually enjoy media?
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
              Sign in once — your lists, decks and progress follow you everywhere.
            </p>
            <Button
              size="lg"
              className={cn("gap-2 mt-6")}
              onClick={onSignIn}
              disabled={!configured}
            >
              Sign in to continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 md:px-8 py-6 text-xs text-muted-foreground flex items-center justify-between">
            <span>© {new Date().getFullYear()} LexiFlow</span>
            <span>Learn Mandarin from real video</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
