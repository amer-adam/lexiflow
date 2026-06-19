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
import { cn } from "@/lib/utils";

const STEPS: { icon: typeof Download; label: string; detail: string; info?: Parameters<typeof InfoTip>[0]["id"] }[] = [
  { icon: Download, label: "Download", detail: "Fetching the video & audio track", info: "caching" },
  { icon: FileAudio, label: "Transcribe", detail: "Whisper speech-to-text on the Chinese audio", info: "whisper" },
  { icon: ScissorsLineDashed, label: "Segment", detail: "Splitting the transcript into subtitle lines", info: "segment" },
  { icon: Languages, label: "Translate", detail: "Generating an English translation per line" },
  { icon: Palette, label: "Grade", detail: "Tagging every character with pinyin & HSK level", info: "hsk" },
];
const POLL_MS = 60_000; // cap job-status polling to once a minute
const fmtEta = (s: number) => (s >= 60 ? `${Math.round(s / 60)}m` : `${Math.round(s)}s`);

export function RequestView() {
  const { go } = useNav();
  const { api } = useApi();
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [queue, setQueue] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const elapsedTimer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const start = async () => {
    setError(null);
    setRunning(true);
    setStep(-1);
    setQueue(0);
    setEta(null);
    setProgressPct(0);
    setElapsed(0);
    setJobId(null);
    try {
      const res = tab === "youtube"
        ? await api.createJob(url.trim(), isPrivate)
        : await api.uploadJob(file!, title.trim(), isPrivate);
      if (res?.from_cache || res?.status === "completed") {
        setJobId(res.job_id ?? null);
        setStep(STEPS.length);
        return;
      }
      if (res?.job_id) {
        setJobId(res.job_id);
        setQueue(res.queue_position ?? res.queue_number ?? 0);
        setEta(typeof res.eta === "number" ? res.eta : null);
      } else {
        throw new Error("The server didn't return a job id.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not start processing.");
      setRunning(false);
    }
  };

  // Live elapsed-time counter while a job is in flight.
  useEffect(() => {
    if (!jobId || step >= STEPS.length) { clearInterval(elapsedTimer.current); return; }
    elapsedTimer.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(elapsedTimer.current);
  }, [jobId, step]);

  // Poll the real job (≤ once per minute).
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const poll = async () => {
      try {
        const job = await api.getJobFresh(jobId);
        if (!active) return;
        if (job.status === "completed" || (job.segments?.length ?? 0) > 0) { setStep(STEPS.length); return; }
        if (job.status === "failed") { setError("Processing failed for this video."); setRunning(false); return; }
        setQueue(job.queueNumber ?? 0);
        setEta(typeof job.eta === "number" ? job.eta : null);
        setProgressPct(job.progress ?? 0);
        setStep(Math.min(STEPS.length - 1, Math.floor(((job.progress ?? 0) / 100) * STEPS.length)));
        timer.current = window.setTimeout(poll, POLL_MS);
      } catch {
        if (active) timer.current = window.setTimeout(poll, POLL_MS);
      }
    };
    timer.current = window.setTimeout(poll, POLL_MS);
    return () => { active = false; clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const finished = step >= STEPS.length;
  const canSubmit = tab === "youtube" ? !!url.trim() : !!(file && title.trim());

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Bring in content" title="Add a video" conceptId="requestMode">
        Paste a YouTube link or upload a file. It's processed into interactive, graded subtitles and
        added to your Library.
      </PageHeader>

      {!running ? (
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

          <Button size="lg" className="w-full mt-4 gap-2" onClick={start} disabled={!canSubmit}>
            Process video <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="paper p-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-semibold">{finished ? "Ready to watch!" : "Processing your video"}</h2>
            <InfoTip id="pipeline" />
          </div>
          {!finished && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-1 flex-wrap">
              <span className="flex items-center gap-1.5">
                {step === -1
                  ? (queue > 0 ? `In queue · ${queue} job${queue > 1 ? "s" : ""} ahead of you…` : "Starting…")
                  : `Processing… ${progressPct}%`}
                <InfoTip id="queueEta" />
              </span>
              {eta != null && eta > 0 && <span className="font-mono-num">ETA ~{fmtEta(eta)}</span>}
              <span className="font-mono-num">Elapsed {fmtEta(elapsed)}</span>
            </div>
          )}
          {!finished && (
            <p className="text-sm text-muted-foreground mb-5">This can take a few minutes; status refreshes once a minute.</p>
          )}

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

          {finished && jobId ? (
            <Button size="lg" className="w-full gap-2" onClick={() => go("watch", { id: jobId })}>Open in player <ArrowRight className="h-4 w-4" /></Button>
          ) : finished ? (
            <Button size="lg" className="w-full gap-2" onClick={() => go("library")}>Go to library <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => { clearTimeout(timer.current); setRunning(false); setJobId(null); }}>Run in background</Button>
          )}
        </div>
      )}
    </div>
  );
}
