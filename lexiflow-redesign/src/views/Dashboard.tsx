import { Flame, Clock, PlayCircle, ArrowRight, Sparkles } from "lucide-react";
import { LEARNER, VIDEOS, hskColor, HSK_LABELS, type HskLevel } from "@/lib/data";
import { Stat, HskLegend } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { useNav } from "@/app/nav";

export function Dashboard() {
  const { go } = useNav();
  const resume = VIDEOS[0];

  return (
    <div className="space-y-7">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">
            欢迎回来 · Welcome back
          </p>
          <h1 className="font-display text-4xl font-semibold">Hello, Wei 👋</h1>
          <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed">
            You're on a <span className="text-gold font-semibold">{LEARNER.streak}-day streak</span>.
            You have {LEARNER.dueToday} cards due and a video waiting where you left off.
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-full bg-gold/10 border border-gold/30 px-4 py-2">
          <Flame className="h-5 w-5 text-gold" />
          <span className="font-display text-2xl font-semibold font-mono-num text-gold">
            {LEARNER.streak}
          </span>
          <span className="text-sm text-muted-foreground">day streak</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat value={LEARNER.wordsKnown} label="Words known" accent="secondary" />
        <Stat value={LEARNER.wordsLearning} label="Words learning" conceptId="srs" />
        <Stat value={LEARNER.dueToday} label="Cards due today" conceptId="dueToday" accent="primary" />
        <Stat
          value={`${Math.round(LEARNER.minutesWatched / 60)}h`}
          label="Watched"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Continue learning */}
        <div className="lg:col-span-3 paper p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-secondary" /> Pick up where you left off
            </h2>
          </div>
          <button
            onClick={() => go("watch", { id: resume.id })}
            className="group w-full text-left rounded-lg overflow-hidden border border-border hover:border-secondary/50 transition-colors"
          >
            <div
              className="relative h-40 flex items-end p-4"
              style={{
                background: `linear-gradient(135deg, hsl(${resume.thumbHue} 45% 30%), hsl(${resume.thumbHue} 40% 18%))`,
              }}
            >
              <div className="absolute inset-0 grid place-items-center">
                <PlayCircle className="h-14 w-14 text-white/85 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
              </div>
              <span className="relative font-hans-serif text-white/30 text-7xl absolute top-2 right-4 select-none">
                看
              </span>
              <div className="relative">
                <span className="pill bg-black/40 text-white backdrop-blur-sm">
                  {resume.topic}
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="font-semibold leading-snug">{resume.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {resume.channel} · {resume.duration}
              </div>
              <div className="flex items-center gap-3 mt-3 text-sm">
                <span className="pill bg-primary/10 text-primary">
                  {resume.newWords} new words
                </span>
                <span className="text-muted-foreground">{resume.knownPct}% already known</span>
                <span className="ml-auto inline-flex items-center gap-1 text-secondary font-medium group-hover:gap-2 transition-all">
                  Resume <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* HSK progress */}
        <div className="lg:col-span-2 paper p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-semibold">Your HSK progress</h2>
            <InfoTip id="hsk" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Words mastered at each official level.
          </p>
          <div className="space-y-3">
            {LEARNER.hskProgress.map((p) => {
              const pct = Math.round((p.known / p.total) * 100);
              return (
                <div key={p.level}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold" style={{ color: hskColor(p.level as HskLevel) }}>
                      {HSK_LABELS[p.level as HskLevel]}
                    </span>
                    <span className="font-mono-num text-muted-foreground">
                      {p.known}/{p.total}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: hskColor(p.level as HskLevel) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <HskLegend />
          </div>
        </div>
      </div>

      {/* Today's plan */}
      <div className="paper p-5">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" /> Suggested for today
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { t: "Clear your due cards", d: `${LEARNER.dueToday} flashcards are ready for review.`, cta: "Review now", v: "flashcards" as const },
            { t: "Quiz your saved news words", d: "7 words from news videos — test recall.", cta: "Start quiz", v: "quiz" as const },
            { t: "Add a new video", d: "Bring in something you'd actually watch.", cta: "Add video", v: "request" as const },
          ].map((c) => (
            <div key={c.t} className="rounded-lg border border-border bg-background/50 p-4 flex flex-col">
              <div className="font-semibold mb-1">{c.t}</div>
              <p className="text-sm text-muted-foreground flex-1 leading-relaxed">{c.d}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 self-start px-0 text-secondary hover:text-secondary hover:bg-transparent gap-1.5"
                onClick={() => go(c.v)}
              >
                {c.cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
