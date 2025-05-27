from transformers import AutoProcessor, SeamlessM4Tv2Model
import torch
import torchaudio
import os

from backend.vad import SileroVADProcessor

processor = AutoProcessor.from_pretrained(
    "facebook/seamless-m4t-v2-large",  device_map="auto", torch_dtype=torch.float16, low_cpu_mem_usage=True)
model = SeamlessM4Tv2Model.from_pretrained(
    "facebook/seamless-m4t-v2-large",  device_map="auto", torch_dtype=torch.float16, low_cpu_mem_usage=True)
folder_path = "temp/chunks"
len_chunks = len([name for name in os.listdir(folder_path)
                 if os.path.isfile(os.path.join(folder_path, name))])

# audiofile = '/home/amer/lexiflow/backend/temp/downloads/第93集： 张骞和丝绸之路 Zhang Qian and the Silk Road ｜ intermediate Chinese podcast.m4a'
# vadProcessor = SileroVADProcessor()
# vadProcessor.process_audio(
#     audiofile, min_speech_duration_ms=500, max_speech_duration_s=25, min_silence_duration_ms=1200)


with open(f"{os.listdir('temp/downloads')[0].split('.')[0]}.txt", 'w') as file:
    file.seek(0)
    file.truncate(0)

    for i in range(len_chunks):
        audio, orig_freq = torchaudio.load(
            f"temp/chunks/chunk_{i}.wav")
        audio = torchaudio.functional.resample(
            audio, orig_freq=orig_freq, new_freq=16_000)  # must be a 16 kHz waveform array
        audio_inputs = processor(
            audios=audio, return_tensors="pt", sampling_rate=16_000).to(model.device)
        output_tokens = model.generate(
            **audio_inputs, tgt_lang="zh", generate_speech=False, )
        translated_text_from_audio = processor.decode(
            output_tokens[0].tolist()[0], skip_special_tokens=True)
        print(translated_text_from_audio)
        file.write(f"{translated_text_from_audio}\n")

        del audio_inputs
        torch.cuda.empty_cache()
