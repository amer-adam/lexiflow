from tqdm import tqdm
import yt_dlp
import os

class YouTubeDownloader:
    def __init__(self, download_folder='temp/downloads'):
        self.download_folder = download_folder
        os.makedirs(self.download_folder, exist_ok=True)
        self.progress_bar = None

    class MyLogger:
        def debug(self, msg):
            pass

        def warning(self, msg):
            pass

        def error(self, msg):
            print(msg)

    def my_hook(self, d):
        if d['status'] == 'finished':
            self.progress_bar.close()
            print('Done downloading, now post-processing ...')
        if d['status'] == 'downloading':
            if self.progress_bar is None:
                total = d.get('total_bytes', 0)
                self.progress_bar = tqdm(total=total, unit='B', unit_scale=True, ncols=100)
            self.progress_bar.update(d['downloaded_bytes'] - self.progress_bar.n)

    def download(self, url):
        ydl_opts = {
            'logger': self.MyLogger(),
            'progress_hooks': [self.my_hook],
            'format': 'm4a/bestaudio/best',
            'postprocessors': [{  # Extract audio using ffmpeg
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
            }],
            'outtmpl': os.path.join(self.download_folder, '%(title)s.%(ext)s'),
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=False)  # Get video info without downloading
            filename = ydl.prepare_filename(info_dict).split('.')[0] + '.m4a'
            if os.path.exists(filename):
                print(f"File '{filename}' already exists. Skipping download.")
            else:
                # ydl.download([url])
                print(f"Downloaded {filename}")
            return filename



if __name__ == "__main__":
    downloader = YouTubeDownloader()
    url = 'https://www.youtube.com/watch?v=5fWvyFMrD9g'
    try:
        downloaded_file = downloader.download(url)
    except Exception as e:
        print(f"An error occurred: {e}")