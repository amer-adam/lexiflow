import { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Play,
  Library as LibraryIcon,
  Layers,
  CheckSquare,
  User,
  GraduationCap,
  BookOpenCheck,
} from "lucide-react";
import { NavContext, type ViewId } from "@/app/nav";
import { cn } from "@/lib/utils";
import { ReviewerGuide } from "@/components/ReviewerGuide";

import { Dashboard } from "@/views/Dashboard";
import { RequestView } from "@/views/RequestView";
import { LibraryView } from "@/views/LibraryView";
import { WatchView } from "@/views/WatchView";
import { VocabView } from "@/views/VocabView";
import { FlashcardsView } from "@/views/FlashcardsView";
import { QuizView } from "@/views/QuizView";
import { ProfileView } from "@/views/ProfileView";

const NAV: { id: ViewId; label: string; icon: typeof Play; group: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Learn" },
  { id: "library", label: "Library", icon: LibraryIcon, group: "Learn" },
  { id: "watch", label: "Watch", icon: Play, group: "Learn" },
  { id: "request", label: "Add a video", icon: PlusCircle, group: "Learn" },
  { id: "vocab", label: "Vocabulary", icon: BookOpenCheck, group: "Study" },
  { id: "flashcards", label: "Flashcards", icon: Layers, group: "Study" },
  { id: "quiz", label: "Quizzes", icon: CheckSquare, group: "Study" },
];

export default function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [params, setParams] = useState<Record<string, string>>({});

  const go = (v: ViewId, p: Record<string, string> = {}) => {
    setParams(p);
    setView(v);
    document.getElementById("scroll-main")?.scrollTo({ top: 0 });
  };

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <NavContext.Provider value={{ view, params, go }}>
      <div className="flex h-screen overflow-hidden text-foreground">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="relative z-10 hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/70">
          <button
            onClick={() => go("dashboard")}
            className="flex items-center gap-2.5 px-5 h-16 border-b border-border text-left"
          >
            <span className="seal grid h-9 w-9 place-items-center text-lg font-bold">流</span>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold tracking-tight">LexiFlow</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Learn Chinese
              </div>
            </div>
          </button>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {groups.map((g) => (
              <div key={g}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {g}
                </p>
                <div className="space-y-0.5">
                  {NAV.filter((n) => n.group === g).map((n) => {
                    const active = view === n.id;
                    const Icon = n.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => go(n.id)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                        {n.label}
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <button
            onClick={() => go("profile")}
            className={cn(
              "flex items-center gap-3 m-3 rounded-md px-3 py-2.5 text-sm transition-colors text-left",
              view === "profile" ? "bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground font-semibold">
              W
            </span>
            <div className="leading-tight">
              <div className="font-semibold">Wei Chen</div>
              <div className="text-[11px] text-muted-foreground">View profile</div>
            </div>
            <User className="h-4 w-4 ml-auto text-muted-foreground" />
          </button>
        </aside>

        {/* ── Main column ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="relative z-10 flex items-center justify-between gap-4 h-16 px-5 md:px-8 border-b border-border bg-card/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4 text-secondary" />
              <span className="font-display font-medium text-foreground">
                {NAV.find((n) => n.id === view)?.label ??
                  (view === "profile" ? "Profile" : "Watch")}
              </span>
            </div>
            <ReviewerGuide />
          </header>

          <main id="scroll-main" className="relative z-[1] flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-5 md:px-8 py-7">
              {view === "dashboard" && <Dashboard />}
              {view === "request" && <RequestView />}
              {view === "library" && <LibraryView />}
              {view === "watch" && <WatchView />}
              {view === "vocab" && <VocabView />}
              {view === "flashcards" && <FlashcardsView />}
              {view === "quiz" && <QuizView />}
              {view === "profile" && <ProfileView />}
            </div>
          </main>
        </div>
      </div>
    </NavContext.Provider>
  );
}
