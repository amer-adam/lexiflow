from transcribe import api_transcribe
from transformers import SeamlessM4Tv2ForTextToText, AutoProcessor
import json
from pypinyin import pinyin
import torch
import gc


class Translator:
    def __init__(self):
        self.get_pinyin = False

    def translate(self, result, model, processor, target_language="en"):
        if not processor or not model:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        if not result or "language" not in result:
            raise ValueError(
                "Invalid transcription result or language not detected.")

        source_language = result["language"]

        if source_language == 'zh':
            source_language = 'cmn'
            self.get_pinyin = True
        elif source_language == 'en':
            source_language = 'eng'
        elif source_language == 'ms':
            source_language = 'zsm'
        else:
            raise ValueError(
                f"Unsupported source language: {source_language}")

        print(f"Transcribing audio in {source_language}...")

        text = result["text"]

        for segment in result["segments"]:
            if "text" not in segment or not segment["text"]:
                continue

            text = segment["text"]
            print(f"Translating segment: {text}")

            inputs = processor(text, src_lang=source_language,
                               return_tensors="pt", padding=True).to(model.device)
            outputs = model.generate(
                **inputs, tgt_lang="eng")
            translated_text_from_text = processor.decode(
                outputs.tolist()[0], skip_special_tokens=True)
            print(f"Translated text: {translated_text_from_text}")
            segment["translated_text"] = translated_text_from_text
            if self.get_pinyin:
                pinyin_text = pinyin(text, style='normal')
                segment["pinyin"] = ' '.join(
                    [word[0] for word in pinyin_text])

        json.dump(result, open("translated_result.json", "w",
                  encoding="utf-8"), ensure_ascii=False, indent=4)
        return result


def print_vram_info():
    free_memory, total_memory = torch.cuda.mem_get_info()

    free_memory_gb = free_memory / 1024**3
    total_memory_gb = total_memory / 1024**3

    print(f"Free Memory: {free_memory_gb:.2f}/{total_memory_gb:.2f} GB")


def clear_vram(variable=None):
    if variable != None:
        del variable
    torch.cuda.empty_cache()
    gc.collect()

def api_translate(url):
    print_vram_info()
    
    response = api_transcribe(url)
    # josn_data = '/home/amer/lexiflow/backend/temp/TeaTime News 茶歇新闻 ｜ 2024年12月20日： 习近平去澳门，退休年龄，死刑 [7v2BMJvUhOk].webm-result.json'
    # josn_data = '/home/amer/lexiflow/backend/translated_result.json'
    # with open(josn_data, "r") as f:
    #     response = json.load(f)

    # return response

    try:
        print(f"Loading facebook/seamless-m4t-v2-large...")
        # Processor stays on CPU
        processor = AutoProcessor.from_pretrained(
            "facebook/seamless-m4t-v2-large")
        
        # Model loaded to CPU first
        model = SeamlessM4Tv2ForTextToText.from_pretrained(
            "facebook/seamless-m4t-v2-large", 
            device_map="cpu")
        
        # Explicitly move only model to GPU if available
        if torch.cuda.is_available():
            model = model.to('cuda')
        
        print("Model loaded successfully.")
        print_vram_info()

        translator = Translator()
        result = translator.translate(response, model=model, processor=processor)
        
        return result
    finally:
        # Ensure cleanup happens even if an error occurs
        print("Cleaning up...")
        if 'model' in locals():
            model.to('cpu')  # Move model back to CPU before deletion
            del model
        if 'processor' in locals():
            del processor
        if 'translator' in locals():
            del translator
        
        gc.collect()
        torch.cuda.empty_cache()
        print_vram_info()
