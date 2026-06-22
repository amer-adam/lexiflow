import os
from tempfile import mkdtemp
from typing import List
from yt_dlp import YoutubeDL
from urllib.parse import urlparse

import yt_dlp
from yt_dlp.postprocessor import PostProcessor

from src.ytdlpCookies import cookie_opts

class FilenameCollectorPP(PostProcessor):
    def __init__(self):
        super(FilenameCollectorPP, self).__init__(None)
        self.filenames = []

    def run(self, information):
        self.filenames.append(information["filepath"])
        return [], information

def download_url(url: str, maxDuration: int = None, destinationDirectory: str = None, playlistItems: str = "1") -> List[str]: 
    try:
        return _perform_download(url, maxDuration=maxDuration, outputTemplate=None, destinationDirectory=destinationDirectory, playlistItems=playlistItems)
    except yt_dlp.utils.DownloadError as e:
        # In case of an OS error, try again with a different output template
        if e.msg and e.msg.find("[Errno 36] File name too long") >= 0:
            return _perform_download(url, maxDuration=maxDuration, outputTemplate="%(title).10s %(id)s.%(ext)s")
        raise e

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
        'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
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

    # Add output template if specified

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
        'extractor_args': {'youtube': {'player_client': ['android', 'ios']}}
    }
    
    if node_path:
        ydl_opts['js_runtimes'] = {'node': {'path': node_path}}
    else:
        ydl_opts['js_runtimes'] = {'node': {}}

    ydl_opts.update(cookie_opts())

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

        # Handle playlists (return total duration of all videos)
        if 'entries' in info:
            return sum(float(entry['duration']) for entry in info['entries'] if entry.get('duration'))
        
        return float(info.get('duration', 0))