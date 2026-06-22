import hashlib
import os
import re
from tempfile import mkdtemp
from typing import List
from yt_dlp import YoutubeDL
from urllib.parse import urlparse, parse_qs

import yt_dlp
from yt_dlp.postprocessor import PostProcessor

from src.firecrawlFallback import FirecrawlUnavailable, download_audio as firecrawl_download_audio
from src.ytdlpCookies import cookie_opts
from src.ytdlpPot import pot_provider_extractor_args
from src.ytdlpProxy import is_proxy_configured, is_proxy_reachable, proxy_opts

class FilenameCollectorPP(PostProcessor):
    def __init__(self):
        super(FilenameCollectorPP, self).__init__(None)
        self.filenames = []

    def run(self, information):
        self.filenames.append(information["filepath"])
        return [], information

def download_url(url: str, maxDuration: int = None, destinationDirectory: str = None, playlistItems: str = "1") -> List[str]:
    """
    Downloads a video's audio. YouTube bot-walls datacenter/VPS IPs by reputation
    regardless of cookie/PO-token validity (see src/ytdlpCookies.py, src/ytdlpPot.py),
    so the real fix is routing yt-dlp through a non-datacenter IP - normally a SOCKS5
    proxy tunneled back through an SSH reverse forward to a home connection
    (YTDLP_PROXY_URL). If that tunnel is down, fall back to Firecrawl's audio-extraction
    API (FIRECRAWL_API_KEY, self-rate-limited - see src/firecrawlFallback.py) before
    finally trying a direct, unproxied yt-dlp call as a last resort.
    """
    if destinationDirectory is None:
        destinationDirectory = mkdtemp()

    if is_proxy_configured() and not is_proxy_reachable():
        print("YTDLP_PROXY_URL is configured but unreachable (tunnel down?) - trying Firecrawl fallback")
        try:
            return [_download_via_firecrawl(url, destinationDirectory)]
        except FirecrawlUnavailable as e:
            print(f"Firecrawl fallback unavailable ({e}); falling back to a direct (likely bot-walled) yt-dlp attempt")

    try:
        return _perform_download(url, maxDuration=maxDuration, outputTemplate=None, destinationDirectory=destinationDirectory, playlistItems=playlistItems)
    except yt_dlp.utils.DownloadError as e:
        # In case of an OS error, try again with a different output template
        if e.msg and e.msg.find("[Errno 36] File name too long") >= 0:
            return _perform_download(url, maxDuration=maxDuration, outputTemplate="%(title).10s %(id)s.%(ext)s", destinationDirectory=destinationDirectory)

        # Last resort: the proxy was reachable (or unconfigured) but yt-dlp still
        # failed outright (e.g. bot-walled) - try Firecrawl once before giving up.
        try:
            return [_download_via_firecrawl(url, destinationDirectory)]
        except FirecrawlUnavailable:
            pass
        raise e


def _download_via_firecrawl(url: str, destination_directory: str) -> str:
    destination_path = os.path.join(destination_directory, _firecrawl_filename(url))
    firecrawl_download_audio(url, destination_path)
    print("Downloaded (via Firecrawl) " + destination_path)
    return destination_path


def _firecrawl_filename(url: str) -> str:
    parsed = urlparse(url)
    video_id = (parse_qs(parsed.query).get("v") or [None])[0]

    if not video_id:
        # youtu.be/<id> and youtube.com/shorts/<id> links - id is the last path segment
        match = re.search(r"/(?:shorts/)?([\w-]{6,})/?$", parsed.path)
        video_id = match.group(1) if match else hashlib.sha1(url.encode()).hexdigest()[:11]

    return f"firecrawl_{video_id}.mp3"

def _perform_download(url: str, maxDuration: int = None, outputTemplate: str = None, destinationDirectory: str = None, playlistItems: str = "1"):
    # Create a temporary directory to store the downloaded files
    if destinationDirectory is None:
        destinationDirectory = mkdtemp()

    import shutil
    node_path = shutil.which("node")

    ydl_opts = {
        "format": "bestaudio/best",
        'paths': {
            'home': destinationDirectory
        },
        'remote_components': ['ejs:github'],
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'logtostderr': False,
        'quiet': True,
        'no_warnings': True,
        'default_search': 'auto',
        'source_address': '0.0.0.0',
        'force_ipv4': True,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        # The android/ios player clients are designed for cookie-less, signed-out
        # access and can return an empty/restricted format list once real auth
        # cookies are attached (see YTDLP_COOKIES_FILE below) - "web" is the
        # client that actually benefits from cookies, so try it first. "web"
        # in turn needs a PO token once cookies are present - see
        # YTDLP_POT_PROVIDER_URL / pot_provider_extractor_args().
        'extractor_args': {
            'youtube': {'player_client': ['web', 'android', 'ios']},
            **pot_provider_extractor_args(),
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
    }

    if node_path:
        ydl_opts['js_runtimes'] = {'node': {'path': node_path}}
    else:
        ydl_opts['js_runtimes'] = {'node': {}}
    if (playlistItems):
        ydl_opts['playlist_items'] = playlistItems

    ydl_opts.update(cookie_opts())
    ydl_opts.update(proxy_opts())

    # Add output template if specified
    if outputTemplate:
        ydl_opts['outtmpl'] = outputTemplate

    filename_collector = FilenameCollectorPP()

    with YoutubeDL(ydl_opts) as ydl:
        if maxDuration and maxDuration > 0:
            info = ydl.extract_info(url, download=False)
            entries = "entries" in info and info["entries"] or [info]

            total_duration = 0

            # Compute total duration
            for entry in entries:
                total_duration += float(entry["duration"])

            if total_duration >= maxDuration:
                raise ExceededMaximumDuration(videoDuration=total_duration, maxDuration=maxDuration, message="Video is too long")

        ydl.add_post_processor(filename_collector)
        ydl.download([url])

    if len(filename_collector.filenames) <= 0:
        raise Exception("Cannot download " + url)

    result = []

    for filename in filename_collector.filenames:
        result.append(filename)
        print("Downloaded " + filename)

    return result 

class ExceededMaximumDuration(Exception):
    def __init__(self, videoDuration, maxDuration, message):
        self.videoDuration = videoDuration
        self.maxDuration = maxDuration
        super().__init__(message)

def uri_validator(x):
    try:
        result = urlparse(x)
        return all([result.scheme, result.netloc])
    except:
        return False


def get_duration(url: str) -> float:
    """
    Get the total duration (in seconds) of a YouTube video.
    """
    import shutil
    node_path = shutil.which("node")
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'remote_components': ['ejs:github'],
        'force_ipv4': True,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        # See the comment in _perform_download above - "web" goes first since
        # it's the client that actually benefits from cookies (and needs a PO
        # token in turn - see pot_provider_extractor_args()).
        'extractor_args': {
            'youtube': {'player_client': ['web', 'android', 'ios']},
            **pot_provider_extractor_args(),
        }
    }
    
    if node_path:
        ydl_opts['js_runtimes'] = {'node': {'path': node_path}}
    else:
        ydl_opts['js_runtimes'] = {'node': {}}

    ydl_opts.update(cookie_opts())
    ydl_opts.update(proxy_opts())

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

        # Handle playlists (return total duration of all videos)
        if 'entries' in info:
            return sum(float(entry['duration']) for entry in info['entries'] if entry.get('duration'))
        
        return float(info.get('duration', 0))