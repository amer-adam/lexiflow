from silero_vad import (load_silero_vad,
                        read_audio,
                        get_speech_timestamps,
                        save_audio,
                        VADIterator,
                        collect_chunks)
import torch
from IPython.display import Audio
from pprint import pprint

torch.set_num_threads(1)
SAMPLING_RATE = 16000


torch.hub.download_url_to_file(
    'https://models.silero.ai/vad_models/en.wav', 'en_example.wav')
model = load_silero_vad(onnx=False)

wav = read_audio('en_example.wav', sampling_rate=SAMPLING_RATE)
# get speech timestamps from full audio file
speech_timestamps = get_speech_timestamps(wav, model, sampling_rate=SAMPLING_RATE,
                                          #    return_seconds=True,
                                          #  threshold=0.2,
                                          min_speech_duration_ms=3000,
                                          #  min_silence_duration_ms=500,
                                          max_speech_duration_s=6)
pprint(speech_timestamps)

for i, segment in enumerate(speech_timestamps):

    output_file = f'chunks/chunk_{i}.wav'
    save_audio(output_file,
               collect_chunks([segment], wav), SAMPLING_RATE)
