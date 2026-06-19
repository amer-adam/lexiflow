import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { useApi } from "@/app/useApi";
import { cn } from "@/lib/utils";

/**
 * Reusable "listen to this word/sentence" icon button. Drop it next to any
 * Chinese text anywhere in the app — dictionary results, word lookup,
 * flashcard faces, quiz questions, vocab rows, subtitles.
 */
export function SpeakButton({
  text, className, size = "sm",
}: { text: string; className?: string; size?: "sm" | "md" }) {
  const { api } = useApi();
  const [busy, setBusy] = useState(false);

  async function play(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy || !text) return;
    setBusy(true);
    try {
      const url = await api.speak(text);
      const audio = new Audio(url);
      audio.play().catch(() => { /* autoplay/user-gesture issues — ignore */ });
      audio.onended = () => setBusy(false);
      audio.onerror = () => setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      title={`Listen: ${text}`}
      disabled={busy}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-secondary/80 hover:text-primary hover:bg-secondary/10 transition-colors disabled:opacity-60",
        size === "sm" ? "h-6 w-6" : "h-8 w-8",
        className
      )}
    >
      {busy ? <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} /> : <Volume2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
    </button>
  );
}
