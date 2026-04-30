import time
from transcribe import api_transcribe
from transformers import SeamlessM4Tv2ForTextToText, AutoProcessor
import json
from pypinyin import pinyin
import torch
import gc
from lingua import Language, LanguageDetectorBuilder


class Translator:
    def __init__(self):
        self.get_pinyin = False

        print(f"Loading facebook/seamless-m4t-v2-large...")
        # Processor stays on CPU
        init_start = time.time()
        self.processor = AutoProcessor.from_pretrained(
            "facebook/seamless-m4t-v2-large")

        # Model loaded to CPU first
        self.model = SeamlessM4Tv2ForTextToText.from_pretrained(
            "facebook/seamless-m4t-v1-medium",
            device_map="cpu")

        # Explicitly move only model to GPU if available
        if torch.cuda.is_available():
            self.model = self.model.to('cuda')

        print(f"Model loaded successfully in {time.time() - init_start:.2f}s.")
        print_vram_info()

    def close(self):
        # Ensure cleanup happens even if an error occurs
        print("Cleaning up...")
        if 'model' in locals():
            self.model.to('cpu')  # Move model back to CPU before deletion
            del self.model
        if 'processor' in locals():
            del processor
        gc.collect()
        torch.cuda.empty_cache()
        print_vram_info()

    def translate(self, result, target_language="en"):
        if not self.processor or not self.model:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        if not result or "language" not in result:
            raise ValueError(
                "Invalid transcription result or language not detected.")

        source_language = result["language"]

        if source_language == '':
            languages = [Language.ENGLISH, Language.ARABIC,
                         Language.MALAY, Language.CHINESE]
            detector = LanguageDetectorBuilder.from_languages(
                *languages).build()
            source_language = detector.detect_language_of(
                result["text"]).name.lower()
            print(f"Detected language: {source_language}")

        if source_language == 'arabic' or source_language == 'ar':
            source_language = 'ara'
        elif source_language == 'english' or source_language == 'en':
            source_language = 'eng'
        elif source_language == 'malay' or source_language == 'ms':
            source_language = 'zsm'
        elif source_language == 'chinese' or source_language == 'zh':
            source_language = 'cmn'
            self.get_pinyin = True
        else:
            raise ValueError(
                f"Unsupported source language: {source_language}")

        print(f"Transcribing audio in {source_language}...")

        result["language"] = source_language

        text = result["text"]

        for segment in result["segments"]:
            if "text" not in segment or not segment["text"]:
                continue

            text = segment["text"]
            print(f"Translating segment: {text}")

            inputs = self.processor(text, src_lang=source_language,
                                    return_tensors="pt", padding=True).to(self.model.device)
            outputs = self.model.generate(
                **inputs, tgt_lang="eng")
            translated_text_from_text = self.processor.decode(
                outputs.tolist()[0], skip_special_tokens=True)
            print(f"Translated text: {translated_text_from_text}")
            segment["translated_text"] = translated_text_from_text
            if self.get_pinyin:
                pinyin_text = pinyin(text, style='normal')
                segment["pinyin"] = ' '.join(
                    [word[0] for word in pinyin_text])

        # MAX_CONTEXT_LENGTH = 30  # or your model’s true limit

        # segments = [seg for seg in result["segments"] if "text" in seg and seg["text"]]
        # num_segments = len(segments)

        # for i, segment in enumerate(segments):
        #     current = segment["text"]

        #     # Add previous and next segments for context
        #     prev = segments[i - 1]["text"] if i > 0 else ""
        #     next_ = segments[i + 1]["text"] if i < num_segments - 1 else ""

        #     # Combine with context (limited to 30 characters if needed)
        #     combined = prev + current + next_
        #     combined = combined[:MAX_CONTEXT_LENGTH]  # clip if necessary

        #     # Translate combined text
        #     inputs = processor(combined, src_lang=source_language, return_tensors="pt", padding=True).to(model.device)
        #     outputs = model.generate(**inputs, tgt_lang="eng")
        #     translated_combined = processor.decode(outputs.tolist()[0], skip_special_tokens=True)

        #     print(f"Translated combined text: {translated_combined}")

        #     # Heuristic: Extract middle part (assumes lengths roughly match)
        #     len_prev = len(prev)
        #     len_current = len(current)

        #     # Map char positions proportionally
        #     total_len = len(prev + current + next_)
        #     start_ratio = len_prev / total_len
        #     end_ratio = (len_prev + len_current) / total_len

        #     # Map these to translated token positions
        #     translated_tokens = translated_combined.strip().split()
        #     total_tokens = len(translated_tokens)
        #     start_token = round(start_ratio * total_tokens)
        #     end_token = round(end_ratio * total_tokens)

        #     # Extract only current part
        #     current_translation = " ".join(translated_tokens[start_token:end_token])
        #     segment["translated_text"] = current_translation

        json.dump(result, open("translated_result.json", "w", encoding="utf-8"), ensure_ascii=False, indent=4)
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


def api_translate(transcription_result):
    print_vram_info()

    # response = api_transcribe(url)
    # josn_data = '/home/amer/lexiflow/backend/temp/TeaTime News 茶歇新闻 ｜ 2024年12月20日： 习近平去澳门，退休年龄，死刑 [7v2BMJvUhOk].webm-result.json'
    # josn_data = '/home/amer/lexiflow/backend/translated_result.json'
    # with open(josn_data, "r") as f:
    #     response = json.load(f)

    # return response

    try:
        print("Initializing Translator...")
        translator_start = time.time()
        translator = Translator()
        
        print("Starting translation...")
        translate_start = time.time()
        result = translator.translate(transcription_result)
        print(f"Translation call took {time.time() - translate_start:.2f}s")
        print(f"Total api_translate took {time.time() - translator_start:.2f}s")

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
