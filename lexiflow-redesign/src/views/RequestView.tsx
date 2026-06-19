import { useEffect, useRef, useState } from "react";
import {
  MonitorPlay, Upload, Lock, Globe, Check, Loader2, Download, FileAudio,
  ScissorsLineDashed, Languages, Palette, ArrowRight, Link2,
} from "lucide-react";
import { PageHeader } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNav } from "@/app/nav";
import { cn } from "@/lib/utils";

const STEPS: { icon: typeof Download; label: string; detail: string }[] = [
  { icon: Download, label: "Download", detail: "Fetching the video & audio track" },
  { icon: FileAudio, label: "Transcribe", detail: "Whisper speech-to-text on the Chinese audio" },
  { icon: ScissorsLineDashed, label: "Segment", detail: "Splitting the transcript into subtitle lines" },
  { icon: Languages, label: "Translate", detail: "Generating an English translation per line" },
  { icon: Palette, label: "Grade", detail: "Tagging every character with pinyin & HSK level" },
];

export function RequestView() {
  const { go } = useNav();
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [queue, setQueue] = useState(0);
  const timer = useRef<number>();

  const start = () => {
    setRunning(true);
    setQueue(2);
    setStep(-1);
  };

  useEffect(() => {
    if (!running) return;
    // brief queue, then advance through steps
    let s = -1;
    const advance = () => {
      if (s === -1 && queue > 0) { setQueue((q) => q - 1); }
      else { s += 1; setStep(s); }
      if (s < STEPS.length) timer.current = window.setTimeout(advance, 1100);
    };
    timer.current = window.setTimeout(advance, 700);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const finished = step >= STEPS.length;

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Bring in content" title="Add a video" conceptId="requestMode">
        Paste a YouTube link or upload a file. LexiFlow processes it into interactive, graded
        subtitles automatically — then it shows up in your Library.
      </PageHeader>

      {!running ? (
        <div className="paper p-5">
          {/* tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted mb-5 w-fit">
            {([["youtube", MonitorPlay, "YouTube link"], ["upload", Upload, "Upload a file"]] as const).map(
              ([id, Icon, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              )
            )}
          </div>

          {tab === "youtube" ? (
            <div>
              <label className="text-sm font-semibold mb-1.5 block">YouTube URL</label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="pl-9 bg-background" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Tip: choose something with clear speech and existing Chinese audio.</p>
            </div>
          ) : (
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your upload a name…" className="bg-background mb-3" />
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-muted-foreground hover:border-secondary/50 transition-colors cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Drop a video or audio file here, or click to browse</p>
                <p className="text-xs mt-1">MP4, MKV, MP3, WAV · up to 500 MB</p>
              </div>
            </div>
          )}

          {/* visibility */}
          <div className="flex items-center justify-between mt-5 rounded-md bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-2">
              {isPrivate ? <Lock className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-secondary" />}
              <div>
                <div className="text-sm font-medium">{isPrivate ? "Private" : "Public"}</div>
                <div className="text-xs text-muted-foreground">
                  {isPrivate ? "Only you can see this video" : "Shared into the public library for other learners"}
                </div>
              </div>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <InfoTip id="pipeline" label="What happens after I submit?" />
          </div>

          <Button size="lg" className="w-full mt-4 gap-2" onClick={start} disabled={tab === "youtube" ? !url : !title}>
            Process video <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // ── Pipeline progress ───────────────────────────────────
        <div className="paper p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-semibold">
              {finished ? "Ready to watch!" : "Processing your video"}
            </h2>
            <InfoTip id="pipeline" />
          </div>
          {!finished && step === -1 && (
            <p className="text-sm text-muted-foreground mb-5">
              {queue > 0 ? `In queue · ${queue} job${queue > 1 ? "s" : ""} ahead of you…` : "Starting…"}
            </p>
          )}
          {!finished && step >= 0 && (
            <p className="text-sm text-muted-foreground mb-5">This usually takes a couple of minutes for a full video.</p>
          )}

          <div className="space-y-2 mb-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const state = finished || i < step ? "done" : i === step ? "active" : "todo";
              return (
                <div
                  key={s.label}
                  className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 border transition-colors",
                    state === "done" && "border-hsk-1/30 bg-hsk-1/5",
                    state === "active" && "border-secondary/40 bg-secondary/5",
                    state === "todo" && "border-border opacity-55")}
                >
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full shrink-0",
                    state === "done" && "bg-hsk-1 text-white",
                    state === "active" && "bg-secondary text-secondary-foreground",
                    state === "todo" && "bg-muted text-muted-foreground")}>
                    {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} />
                      : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Icon className="h-4 w-4" />}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {finished ? (
            <Button size="lg" className="w-full gap-2" onClick={() => go("watch", { id: "nurse-ratio" })}>
              Open in player <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => { clearTimeout(timer.current); setRunning(false); }}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
