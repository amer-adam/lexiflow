from tqdm import tqdm
import yt_dlp
import shutil
import os
from math import ceil

URL = 'https://youtu.be/5fWvyFMrD9g?si=31T80I5fy-Q6vpPc'


# Define the folders to clear
folders_to_clear = ['temp/downloads']

for folder in folders_to_clear:
    if os.path.exists(folder):
        shutil.rmtree(folder)
        print(f"Cleared {folder} folder.")
    else:
        print(f"{folder} folder does not exist.")

# Create the folders
os.makedirs('temp/downloads', exist_ok=True)

class MyLogger:
    def debug(self, msg):
        pass

    def warning(self, msg):
        pass

    def error(self, msg):
        print(msg)

progress_bar = None

def my_hook(d):
    global progress_bar
    if d['status'] == 'finished':
        progress_bar.close()
        print('Done downloading, now post-processing ...')
    if d['status'] == 'downloading':
        if progress_bar is None:
            total = d.get('total_bytes', 0)
            progress_bar = tqdm(total=total, unit='B', unit_scale=True, ncols=100)
        progress_bar.update(d['downloaded_bytes'] - progress_bar.n)


ydl_opts = {
    'logger': MyLogger(),
    'progress_hooks': [my_hook],
    'format': 'm4a/bestaudio/best',
    'postprocessors': [{  # Extract audio using ffmpeg
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'm4a',
    }],
    'outtmpl': 'translator/temp/downloads/%(title)s.%(ext)s',

}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    ydl.download(URL)

