from transformers import AutoProcessor, SeamlessM4Tv2Model
import torch
import torchaudio

processor = AutoProcessor.from_pretrained(
    "facebook/seamless-m4t-v2-large",  device_map="auto", torch_dtype=torch.float16, low_cpu_mem_usage=True)
model = SeamlessM4Tv2Model.from_pretrained(
    "facebook/seamless-m4t-v2-large",  device_map="auto", torch_dtype=torch.float16, low_cpu_mem_usage=True)
folder_path = "translator/temp/chunks"
len_chunks = len([name for name in os.listdir(folder_path)
                 if os.path.isfile(os.path.join(folder_path, name))])

with open(f"{os.listdir('temp/downloads')[0].split('.')[0]}.txt", 'w') as file:
    file.seek(0)
    file.truncate(0)

    for i in range(len_chunks):
        audio, orig_freq = torchaudio.load(
            f"temp/chunks/chunk{i}.mp3")
        audio = torchaudio.functional.resample(
            audio, orig_freq=orig_freq, new_freq=16_000)  # must be a 16 kHz waveform array
        audio_inputs = processor(
            audios=audio, return_tensors="pt", sampling_rate=16_000).to(model.device)
        output_tokens = model.generate(
            **audio_inputs, tgt_lang="eng", generate_speech=False, )
        translated_text_from_audio = processor.decode(
            output_tokens[0].tolist()[0], skip_special_tokens=True)
        print(translated_text_from_audio)
        file.write(f"{translated_text_from_audio}\n")

        del audio_inputs
        torch.cuda.empty_cache()
