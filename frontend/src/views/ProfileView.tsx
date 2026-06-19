import { Globe, Subtitles, Target, RotateCcw, BookOpenCheck, Layers, Film } from "lucide-react";
import { PageHeader, Stat } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/app/session";
import { useQuery } from "@/app/useApi";
import { useSettings, updateSettings, resetSettings, LANGUAGES, type Lang } from "@/lib/settings";

export function ProfileView() {
  const session = useSession();
  const s = useSettings();
  const lists = useQuery((a) => a.getLists(), []);
  const decks = useQuery((a) => a.getDecks(), []);
  const library = useQuery((a) => a.getLibrary(), []);

  const words = (lists.data ?? []).reduce((acc, l) => acc + (l._count?.items ?? l.items.length), 0);

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Account" title="Profile & settings">
        Your details and preferences. Subtitle defaults here are applied every time you open the player.
      </PageHeader>

      {/* Account */}
      <div className="paper p-5 mb-5">
        <div className="flex items-center gap-4">
          {session.picture ? (
            <img src={session.picture} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-secondary-foreground font-display text-2xl font-semibold">
              {(session.name ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold truncate">{session.name ?? "My account"}</h2>
            <p className="text-muted-foreground text-sm truncate">{session.email}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={session.logout}>Sign out</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat value={words} label="Words saved" accent="secondary" />
          <Stat value={decks.data?.length ?? 0} label="Decks" accent="primary" />
          <Stat value={library.data?.length ?? 0} label="Videos" />
        </div>
      </div>

      {/* Translation language */}
      <div className="paper p-5 mb-5">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-1"><Globe className="h-4 w-4 text-secondary" /> Translation language</h3>
        <p className="text-sm text-muted-foreground mb-3">Subtitles and word meanings are shown in this language.</p>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => updateSettings({ translationLanguage: l.code as Lang })}
              className={`pill border px-4 py-1.5 ${s.translationLanguage === l.code ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitle defaults */}
      <div className="paper p-5 mb-5">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-3"><Subtitles className="h-4 w-4 text-secondary" /> Subtitle defaults</h3>
        <div className="space-y-1 divide-y divide-border">
          {([
            ["Show pinyin", "showPinyin", "Display the romanised pronunciation row."],
            ["Show characters", "showCharacters", "Display the Chinese character row."],
            ["Show translation", "showTranslation", "Display the line's translation."],
            ["Loop each line", "autoLoopLine", "Repeat the current subtitle line automatically."],
            ["Pause at end of line", "autoPauseAtLineEnd", "Pause after each line so you can read it fully."],
          ] as const).map(([label, key, desc]) => (
            <label key={key} className="flex items-center justify-between py-3 cursor-pointer">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Switch checked={s[key]} onCheckedChange={(v) => updateSettings({ [key]: v })} />
            </label>
          ))}
        </div>
        <div className="pt-4">
          <div className="flex items-center justify-between text-sm font-medium mb-1">
            <span>Subtitle size</span>
            <span className="font-mono-num text-muted-foreground">{Math.round(s.subtitleScale * 100)}%</span>
          </div>
          <input type="range" min={0.8} max={1.6} step={0.1} value={s.subtitleScale}
            onChange={(e) => updateSettings({ subtitleScale: +e.target.value })}
            className="w-full accent-[hsl(var(--secondary))]" />
        </div>
      </div>

      {/* Study */}
      <div className="paper p-5 mb-5">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-secondary" /> Daily review goal <InfoTip id="dueToday" />
        </h3>
        <div className="flex items-center gap-3">
          <input type="range" min={5} max={100} step={5} value={s.dailyGoal}
            onChange={(e) => updateSettings({ dailyGoal: +e.target.value })}
            className="flex-1 accent-[hsl(var(--primary))]" />
          <span className="font-mono-num font-semibold w-20 text-right">{s.dailyGoal} cards</span>
        </div>
      </div>

      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetSettings}>
        <RotateCcw className="h-4 w-4" /> Reset settings to defaults
      </Button>

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1"><BookOpenCheck className="h-3.5 w-3.5" /> Settings are saved on this device.</span>
        <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Your lists & decks are saved to your account.</span>
        <span className="inline-flex items-center gap-1"><Film className="h-3.5 w-3.5" /> Changes apply immediately.</span>
      </p>
    </div>
  );
}
