import os
import threading

import requests

from src.rateLimiter import RateLimiter

FIRECRAWL_API_URL = "https://api.firecrawl.dev/v2/scrape"

_rate_limiter = None
_rate_limiter_lock = threading.Lock()


class FirecrawlUnavailable(Exception):
    """Raised when Firecrawl isn't configured, or the self-imposed rate limit
    (default 1 call/hour, to ration the free tier) is already used up."""


def _get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    with _rate_limiter_lock:
        if _rate_limiter is None:
            max_requests = int(os.environ.get("FIRECRAWL_RATE_LIMIT", "1"))
            period_seconds = float(os.environ.get("FIRECRAWL_RATE_LIMIT_PERIOD_SECONDS", "3600"))
            _rate_limiter = RateLimiter(max_requests, period_seconds=period_seconds)
        return _rate_limiter


def is_configured() -> bool:
    return bool(os.environ.get("FIRECRAWL_API_KEY"))


def download_audio(url: str, destination_path: str) -> str:
    """
    Downloads a YouTube video's audio via Firecrawl's /scrape endpoint
    (formats=["audio"], 5 credits/call - 1 base + 4 for audio) as a last-resort
    fallback for when yt-dlp can't reach YouTube at all (e.g. the SSH-tunnel
    proxy is down and the datacenter IP gets bot-walled). Self-rate-limited
    (default 1/hour) to ration the free tier rather than burn through it.

    Returns the local path the audio was saved to (destination_path).
    Raises FirecrawlUnavailable if not configured or the rate limit is exhausted.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise FirecrawlUnavailable("FIRECRAWL_API_KEY is not set")

    if not _get_rate_limiter().try_acquire():
        raise FirecrawlUnavailable("Firecrawl self-imposed rate limit exhausted - try again later")

    response = requests.post(
        FIRECRAWL_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"url": url, "formats": ["audio"]},
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()

    audio_url = (payload.get("data") or {}).get("audio")
    if not audio_url:
        raise FirecrawlUnavailable(f"Firecrawl response had no audio URL: {payload}")

    audio_response = requests.get(audio_url, timeout=120)
    audio_response.raise_for_status()

    with open(destination_path, "wb") as f:
        f.write(audio_response.content)

    return destination_path
