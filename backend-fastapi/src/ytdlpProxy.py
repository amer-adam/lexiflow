import os
import socket
from urllib.parse import urlparse


def _proxy_url() -> str:
    return os.environ.get("YTDLP_PROXY_URL") or ""


def proxy_opts() -> dict:
    """
    Returns {"proxy": url} if YTDLP_PROXY_URL is set, else {}.

    Intended for a SOCKS5 proxy tunneled back through an SSH reverse forward to a
    non-datacenter (e.g. home) connection - YouTube blocks datacenter/VPS IPs by
    reputation regardless of cookie/PO-token validity (see src/ytdlpCookies.py,
    src/ytdlpPot.py), so the only real fix is exiting through a different IP.
    """
    url = _proxy_url()
    return {"proxy": url} if url else {}


def is_proxy_configured() -> bool:
    return bool(_proxy_url())


def is_proxy_reachable(timeout: float = 3.0) -> bool:
    """Quick TCP reachability check, so callers can fail over fast instead of
    waiting for yt-dlp's own (much longer) connect/retry machinery to time out
    against a dead tunnel."""
    url = _proxy_url()
    if not url:
        return False

    parsed = urlparse(url)
    if not parsed.hostname or not parsed.port:
        return False

    try:
        with socket.create_connection((parsed.hostname, parsed.port), timeout=timeout):
            return True
    except OSError:
        return False
