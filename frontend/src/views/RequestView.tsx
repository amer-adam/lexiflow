import { useEffect, useRef, useState } from "react";
import {
  MonitorPlay, Upload, Lock, Globe, Check, Loader2, Download, FileAudio,
  ScissorsLineDashed, Languages, Palette, ArrowRight, Link2, AlertTriangle, FileVideo,
} from "lucide-react";
import { PageHeader } from "@/components/bits";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useNav } from "@/app/nav";
import { useApi } from "@/app/useApi";
import { useActiveJob, startTrackingJob, clearTrackedJob, setOnWaitingScreen } from "@/lib/jobTracker";
import { cn } from "@/lib/utils";

const STEPS: { icon: typeof Download; label: string; detail: string; info?: Parameters<typeof InfoTip>[0]["id"] }[] = [
  { icon: Download, label: "Download", detail: "Fetching the video & audio track", info: "caching" },
  { icon: ScissorsLineDashed, label: "Segment", detail: "Splitting the audio into subtitle-length chunks", info: "segment" },
  { icon: FileAudio, label: "Transcribe", detail: "Whisper speech-to-text on each Chinese audio chunk", info: "whisper" },
  { icon: Languages, label: "Translate", detail: "Generating an English translation per line" },
  { icon: Palette, label: "Grade", detail: "Tagging every character with pinyin & HSK level", info: "hsk" },
];
const fmtEta = (s: number) => (s >= 60 ? `${Math.round(s / 60)}m` : `${Math.round(s)}s`);

export function RequestView() {
  const { go } = useNav();
  const { api } = useApi();
  const job = useActiveJob();
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // While this page is open, the job tracker skips the "job done" browser
  // notification — the user can already see the status right here.
  useEffect(() => {
    setOnWaitingScreen(true);
    return () => setOnWaitingScreen(false);
  }, []);

  // Live elapsed-time counter while a job is in flight (purely cosmetic —
  // job.startedAt itself comes from the shared tracker).
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const tick = () => setElapsed(Math.floor((Date.now() - job.startedAt) / 1000));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [job]);

  const start = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const label = tab === "youtube" ? url.trim() : (title.trim() || file?.name || "Upload");
      const res = tab === "youtube"
        ? await api.createJob(url.trim(), isPrivate)
        : await api.uploadJob(file!, title.trim(), isPrivate);
      const id = res?.job_id;
      if (!id) throw new Error("The server didn't return a job id.");
      startTrackingJob(api, id, label);
    } catch (e: any) {
      setError(e?.message ?? "Could not start processing.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Waiting / result screen for the active job ──────────────────────
  if (job) {
    const finished = job.status === "completed";
    const failed = job.status === "failed";
    const step = finished ? STEPS.length : Math.min(STEPS.length - 1, Math.floor((job.progress / 100) * STEPS.length));

    return (
      <div className="max-w-2xl">
        <PageHeader eyebrow="Bring in content" title="Add a video" conceptId="requestMode">
          Paste a YouTube link or upload a file. It's processed into interactive, graded subtitles and
          added to your Library.
        </PageHeader>

        <div className="paper p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-semibold">
              {finished ? "Ready to watch!" : failed ? "Processing failed" : "Processing your video"}
            </h2>
            {!failed && <InfoTip id="pipeline" />}
          </div>
          {job.title && <p className="text-sm text-muted-foreground truncate mb-1">{job.title}</p>}

          {!finished && !failed && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-1 flex-wrap">
              <span className="flex items-center gap-1.5">
                {job.queue > 0 ? `In queue · ${job.queue} job${job.queue > 1 ? "s" : ""} ahead of you…` : `Processing… ${job.progress}%`}
                <InfoTip id="queueEta" />
              </span>
              {job.eta != null && job.eta > 0 && <span className="font-mono-num">ETA ~{fmtEta(job.eta)}</span>}
              <span className="font-mono-num">Elapsed {fmtEta(elapsed)}</span>
            </div>
          )}
          {!finished && !failed && (
            <p className="text-sm text-muted-foreground mb-5">This can take a few minutes; status refreshes once a minute.</p>
          )}
          {failed && (
            <p className="text-sm text-primary flex items-center gap-1.5 mb-5">
              <AlertTriangle className="h-4 w-4" /> Processing failed for this video. You can try again below.
            </p>
          )}

          {!failed && (
            <div className="space-y-2 mb-6">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const state = finished || i < step ? "done" : i === step ? "active" : "todo";
                return (
                  <div key={s.label} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 border transition-colors",
                    state === "done" && "border-hsk-1/30 bg-hsk-1/5", state === "active" && "border-secondary/40 bg-secondary/5", state === "todo" && "border-border opacity-55")}>
                    <span className={cn("grid h-8 w-8 place-items-center rounded-full shrink-0",
                      state === "done" && "bg-hsk-1 text-white", state === "active" && "bg-secondary text-secondary-foreground", state === "todo" && "bg-muted text-muted-foreground")}>
                      {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div><div className="text-sm font-medium">{s.label}</div><div className="text-xs text-muted-foreground">{s.detail}</div></div>
                      {s.info && <InfoTip id={s.info} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {finished ? (
            <Button size="lg" className="w-full gap-2" onClick={() => { clearTrackedJob(); go("watch", { id: job.jobId }); }}>
              Open in player <ArrowRight className="h-4 w-4" />
            </Button>
          ) : failed ? (
            <Button size="lg" className="w-full gap-2" onClick={clearTrackedJob}>Try another video</Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => go("library")}>
              Browse the library while this finishes
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Compose form ─────────────────────────────────────────────────────
  const canSubmit = tab === "youtube" ? !!url.trim() : !!(file && title.trim());

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Bring in content" title="Add a video" conceptId="requestMode">
        Paste a YouTube link or upload a file. It's processed into interactive, graded subtitles and
        added to your Library.
      </PageHeader>

      <div className="paper p-5">
        <div className="flex gap-1 p-1 rounded-lg bg-muted mb-5 w-fit">
          {([["youtube", MonitorPlay, "YouTube link"], ["upload", Upload, "Upload a file"]] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", tab === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "youtube" ? (
          <div>
            <label className="text-sm font-semibold mb-1.5 block">YouTube URL</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="pl-9 bg-background" />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Tip: choose something with clear Chinese speech.</p>
          </div>
        ) : (
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your upload a name…" className="bg-background mb-3" />
            <input ref={fileInput} type="file" accept="video/*,audio/*" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => fileInput.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-border p-8 text-center text-muted-foreground hover:border-secondary/50 transition-colors">
              {file ? (
                <><FileVideo className="h-8 w-8 mx-auto mb-2 text-secondary" /><p className="text-sm font-medium text-foreground">{file.name}</p><p className="text-xs mt-1">{(file.size / 1e6).toFixed(1)} MB · click to change</p></>
              ) : (
                <><Upload className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Click to choose a video or audio file</p><p className="text-xs mt-1">MP4, MKV, MP3, WAV</p></>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-5 rounded-md bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2">
            {isPrivate ? <Lock className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-secondary" />}
            <div>
              <div className="text-sm font-medium">{isPrivate ? "Private" : "Public"}</div>
              <div className="text-xs text-muted-foreground">{isPrivate ? "Only you can see this video" : "Shared into the public library"}</div>
            </div>
          </div>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <InfoTip id="pipeline" label="What happens after I submit?" />
          <span className="mx-1">·</span>
          <InfoTip id="queueEta" label="Why is there a queue?" />
        </div>

        {error && <p className="text-sm text-primary mt-3 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> {error}</p>}

        <Button size="lg" className="w-full mt-4 gap-2" onClick={start} disabled={!canSubmit || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Process video {!submitting && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
