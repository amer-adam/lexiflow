import { PlayCircle, ArrowRight, Sparkles, BookOpenCheck, Layers, Film, Plus } from "lucide-react";
import { Stat, HskLegend, Loading, Skeleton } from "@/components/bits";
import { ActivityPanel } from "@/components/ActivityPanel";
import { Button } from "@/components/ui/button";
import { useNav } from "@/app/nav";
import { useQuery } from "@/app/useApi";
import { useSession } from "@/app/session";

export function Dashboard() {
  const { go } = useNav();
  const session = useSession();
  const lists = useQuery((a) => a.getLists(), []);
  const decks = useQuery((a) => a.getDecks(), []);
  const library = useQuery((a) => a.getLibrary(), []);
  const activity = useQuery((a) => a.getActivitySummary(), []);

  const firstName = (session.name ?? "there").split(" ")[0];
  const loading = lists.loading && !lists.data;

  // The official HSK reference lists ship with every account — exclude them
  // from "your" counts so they reflect what the user actually built.
  const ownLists = (lists.data ?? []).filter((l) => l.type !== "OFFICIAL");
  const words = ownLists.reduce((s, l) => s + (l._count?.items ?? l.items.length), 0);
  const cards = (decks.data ?? []).reduce((s, d) => s + (d._count?.flashcards ?? d.cards.length), 0);
  const resume = (library.data ?? [])[0];
  const isNew = !loading && ownLists.length === 0 && (library.data?.length ?? 0) === 0;

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">欢迎回来 · Welcome back</p>
        <h1 className="font-display text-4xl font-semibold">Hello, {firstName} 👋</h1>
        <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed">
          Pick up your studies, or add a new video to learn from.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
        </div>
      ) : isNew ? (
        <OnboardingCard go={go} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat value={words} label="Words in your lists" accent="secondary" />
            <Stat value={ownLists.length} label="Vocabulary lists" />
            <Stat value={cards} label="Flashcards" conceptId="srs" accent="primary" />
            <Stat value={library.data?.length ?? 0} label="Videos" />
          </div>

          <ActivityPanel loading={activity.loading && !activity.data} data={activity.data} />

          <div className="grid lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 paper p-5">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2 mb-3">
                <PlayCircle className="h-5 w-5 text-secondary" /> Continue learning
              </h2>
              {library.loading && !library.data ? (
                <Loading label="Loading library…" className="py-10" />
              ) : resume ? (
                <button onClick={() => go("watch", { id: resume.id })} className="group w-full text-left rounded-lg overflow-hidden border border-border hover:border-secondary/50 transition-colors">
                  <div className="relative h-40 flex items-end overflow-hidden"
                    style={{ background: `linear-gradient(135deg, hsl(${resume.thumbHue} 45% 30%), hsl(${resume.thumbHue} 40% 18%))` }}>
                    {resume.thumbnail && <img src={resume.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="absolute inset-0 bg-black/25 grid place-items-center">
                      <PlayCircle className="h-14 w-14 text-white/90 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-semibold leading-snug line-clamp-1">{resume.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{resume.channel || resume.duration}</div>
                  </div>
                </button>
              ) : (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No videos yet. <button className="text-secondary underline" onClick={() => go("request")}>Add one</button>.
                </div>
              )}
            </div>

            <div className="lg:col-span-2 paper p-5">
              <h2 className="font-display text-xl font-semibold mb-4">Quick actions</h2>
              <div className="space-y-2.5">
                {[
                  { t: "Review flashcards", d: `${cards} cards across ${decks.data?.length ?? 0} decks`, v: "flashcards" as const, icon: Layers },
                  { t: "Open a vocabulary list", d: `${words} words saved`, v: "vocab" as const, icon: BookOpenCheck },
                  { t: "Add a new video", d: "Learn from something you enjoy", v: "request" as const, icon: Plus },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <button key={c.t} onClick={() => go(c.v)} className="w-full flex items-center gap-3 rounded-lg border border-border bg-background/50 hover:bg-muted hover:border-secondary/40 transition-colors p-3 text-left group">
                      <Icon className="h-5 w-5 text-secondary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{c.t}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.d}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-border"><HskLegend /></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OnboardingCard({ go }: { go: (v: any) => void }) {
  const steps = [
    { icon: Film, t: "Add a video", d: "Paste a YouTube link or upload a file.", v: "request" },
    { icon: PlayCircle, t: "Watch & save words", d: "Tap any character to look it up and save it.", v: "library" },
    { icon: Layers, t: "Drill & quiz", d: "Turn saved words into flashcards and quizzes.", v: "flashcards" },
  ];
  return (
    <div className="paper p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-semibold">Get started in three steps</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Your dashboard fills up as you learn.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={s.t} onClick={() => go(s.v)} className="text-left rounded-lg border border-border bg-background/50 hover:bg-muted hover:border-secondary/40 transition-colors p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary/15 text-secondary text-sm font-semibold">{i + 1}</span>
                <Icon className="h-4 w-4 text-secondary" />
              </div>
              <div className="font-semibold text-sm">{s.t}</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.d}</p>
            </button>
          );
        })}
      </div>
      <Button className="mt-5 gap-1.5" onClick={() => go("request")}><Plus className="h-4 w-4" /> Add your first video</Button>
    </div>
  );
}
