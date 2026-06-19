import { useState } from "react";
import { Flame, BookOpenCheck, Clock, Save, Globe } from "lucide-react";
import { LEARNER } from "@/lib/data";
import { PageHeader, Stat } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const LANGS = [
  ["en", "English"], ["es", "Español"], ["fr", "Français"], ["ar", "العربية"],
] as const;

export function ProfileView() {
  const [nickname, setNickname] = useState("Wei");
  const [lang, setLang] = useState("en");
  const [autoplay, setAutoplay] = useState(true);
  const [autoPause, setAutoPause] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);

  const save = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Account" title="Profile & preferences">
        Manage how LexiFlow looks and behaves for you. Translation language drives every subtitle and
        word meaning across the app.
      </PageHeader>

      {/* Identity + stats */}
      <div className="paper p-5 mb-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-secondary text-secondary-foreground font-display text-2xl font-semibold">
            W
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold">{nickname || "Learner"}</h2>
            <p className="text-muted-foreground text-sm">{LEARNER.email}</p>
          </div>
          <span className="ml-auto flex items-center gap-2 rounded-full bg-gold/10 border border-gold/30 px-3 py-1.5">
            <Flame className="h-4 w-4 text-gold" />
            <span className="font-mono-num font-semibold text-gold">{LEARNER.streak}</span>
            <span className="text-xs text-muted-foreground">day streak</span>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Stat value={LEARNER.wordsKnown} label="Words known" accent="secondary" />
          <Stat value={`HSK ${LEARNER.hskReached}`} label="Level reached" conceptId="hsk" accent="primary" />
          <Stat value={LEARNER.dueToday} label="Cards due" conceptId="dueToday" />
          <Stat value={`${Math.round(LEARNER.minutesWatched / 60)}h`} label="Watched" />
        </div>
      </div>

      {/* Preferences */}
      <div className="paper p-5 space-y-6">
        <div>
          <label className="text-sm font-semibold mb-1.5 block">Nickname</label>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="bg-background max-w-sm" />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-secondary" /> Translation language
          </label>
          <div className="flex gap-2 flex-wrap">
            {LANGS.map(([code, name]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`pill border px-4 py-1.5 ${lang === code ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Subtitles and word meanings are shown in this language.</p>
        </div>

        <div className="space-y-1 border-t border-border pt-5">
          {[
            ["Autoplay next segment", "Continue to the next subtitle line automatically.", autoplay, setAutoplay],
            ["Auto-pause at end of line", "Pause after each subtitle so you can read it fully.", autoPause, setAutoPause],
          ].map(([label, desc, val, set]) => (
            <label key={label as string} className="flex items-center justify-between py-2.5 cursor-pointer">
              <div>
                <div className="text-sm font-medium">{label as string}</div>
                <div className="text-xs text-muted-foreground">{desc as string}</div>
              </div>
              <Switch checked={val as boolean} onCheckedChange={set as (v: boolean) => void} />
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-5">
          <Button onClick={save} className="gap-1.5"><Save className="h-4 w-4" /> Save preferences</Button>
          {savedFlash && (
            <span className="text-sm text-hsk-1 flex items-center gap-1.5">
              <BookOpenCheck className="h-4 w-4" /> Saved!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
