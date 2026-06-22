"""
Checks for an existing, manually-uploaded ("real CC") Chinese subtitle track
on a video before falling back to downloading the audio and running Whisper.
When one exists, it's reused instead — skipping both the (slow) download and
the (slower) transcription step entirely, since we already have ground-truth
Chinese text and timestamps. The result is reshaped to match what
transcribe.api_transcribe() would have produced, so the existing translate +
postprocess steps run completely unchanged afterwards.

Deliberately excludes YouTube's auto-generated captions — those are machine
ASR output, the same caliber of thing our own Whisper step produces, so
using them wouldn't be a meaningful quality/time shortcut, just a different
(usually worse) ASR engine standing in for ours.
"""
import re
import shutil

import requests
import yt_dlp

from src.ytdlpCookies import cookie_opts

# Caption track language codes YouTube uses for (variants of) Chinese.
ZH_LANG_CODES = ("zh-Hans", "zh-Hant", "zh-CN", "zh-TW", "zh-HK", "zh")

_COMMON_YDL_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "remote_components": ["ejs:github"],
    "force_ipv4": True,
    "user_agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    # The android/ios player clients are designed for cookie-less, signed-out
    # access and can return an empty/restricted format list once real auth
    # cookies are attached (see YTDLP_COOKIES_FILE) - "web" is the client that
    # actually benefits from cookies, so try it first.
    "extractor_args": {"youtube": {"player_client": ["web", "android", "ios"]}},
}


def _ydl_opts() -> dict:
    opts = dict(_COMMON_YDL_OPTS)
    node_path = shutil.which("node")
    opts["js_runtimes"] = {"node": {"path": node_path}} if node_path else {"node": {}}
    opts.update(cookie_opts())
    return opts


def find_existing_captions(url: str) -> dict | None:
    """Returns {"lang", "url", "ext"} for the first matching manually-uploaded
    Chinese subtitle track, or None if there isn't one (or the lookup fails —
    callers should treat that as "no captions" and fall back to transcribing)."""
    with yt_dlp.YoutubeDL(_ydl_opts()) as ydl:
        info = ydl.extract_info(url, download=False)

    subtitles = info.get("subtitles") or {}
    for lang in ZH_LANG_CODES:
        formats = subtitles.get(lang)
        if not formats:
            continue
        fmt = next((f for f in formats if f.get("ext") == "vtt"), formats[0])
        if not fmt.get("url"):
            continue
        return {"lang": lang, "url": fmt["url"], "ext": fmt.get("ext", "vtt")}
    return None


_VTT_TIME_RE = re.compile(
    r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})"
)


def _vtt_timestamp_to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def _strip_vtt_tags(line: str) -> str:
    # Drop <00:00:01.000><c> karaoke-style timing tags and any other markup.
    return re.sub(r"<[^>]+>", "", line).strip()


def download_and_parse_captions(track: dict) -> dict:
    """Fetches a caption track and returns a transcription-shaped dict —
    {"language", "text", "segments": [{"start", "end", "text"}, ...]} —
    matching what api_transcribe() would have produced."""
    resp = requests.get(track["url"], timeout=30)
    resp.raise_for_status()
    lines = resp.text.splitlines()

    segments = []
    i = 0
    while i < len(lines):
        m = _VTT_TIME_RE.search(lines[i])
        if not m:
            i += 1
            continue
        g = m.groups()
        start = _vtt_timestamp_to_seconds(*g[0:4])
        end = _vtt_timestamp_to_seconds(*g[4:8])
        i += 1
        text_lines = []
        while i < len(lines) and lines[i].strip() and not _VTT_TIME_RE.search(lines[i]):
            text_lines.append(_strip_vtt_tags(lines[i]))
            i += 1
        text = " ".join(t for t in text_lines if t).strip()
        # Manual VTT cues are normally one-shot (unlike rolling auto-captions),
        # but skip an exact repeat of the previous cue just in case.
        if text and (not segments or segments[-1]["text"] != text):
            segments.append({"start": start, "end": end, "text": text})

    return {
        "language": "zh",
        "text": " ".join(s["text"] for s in segments),
        "segments": segments,
    }
