from silero_vad import (load_silero_vad,
                        read_audio,
                        get_speech_timestamps,
                        save_audio,
                        VADIterator,
                        collect_chunks)
import torch
from pprint import pprint
import os
import shutil

class SileroVADProcessor:
    def __init__(self, sampling_rate=16000, chunks_folder='temp/chunks', device=None):
        self.sampling_rate = sampling_rate
        self.chunks_folder = chunks_folder
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {self.device}")
        self.model = load_silero_vad(onnx=False).to(self.device)
        self._prepare_chunks_folder()
        # torch.set_num_threads(1)

    def _prepare_chunks_folder(self):
        if os.path.exists(self.chunks_folder):
            shutil.rmtree(self.chunks_folder)
        os.makedirs(self.chunks_folder)

    def process_audio(self, audiofile, min_speech_duration_ms=3000, max_speech_duration_s=6):
        wav = read_audio(audiofile, sampling_rate=self.sampling_rate)
        wav_tensor = wav.clone().detach().requires_grad_(True).to(self.device)  # Move audio to the same device as the model
        speech_timestamps = get_speech_timestamps(
            wav_tensor, self.model, 
            sampling_rate=self.sampling_rate,
            min_speech_duration_ms=min_speech_duration_ms,
            max_speech_duration_s=max_speech_duration_s
        )
        pprint(speech_timestamps)
        self._save_chunks(wav, speech_timestamps)
        return speech_timestamps

    def _save_chunks(self, wav, speech_timestamps):
        for i, segment in enumerate(speech_timestamps):
            output_file = os.path.join(self.chunks_folder, f'chunk_{i}.wav')
            save_audio(output_file, collect_chunks([segment], wav), self.sampling_rate)

# Example usage:
if __name__ == "__main__":
    # audiofile = '/home/amer/lexiflow/backend/temp/downloads/en_example.wav'
    audiofile = '/home/amer/lexiflow/backend/temp/downloads/第93集： 张骞和丝绸之路 Zhang Qian and the Silk Road ｜ intermediate Chinese podcast.m4a'
    processor = SileroVADProcessor()
    processor.process_audio(audiofile)
