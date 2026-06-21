import json
import os
from typing import List

from src.llm.llmProvider import LlmProvider

# Batch segments into time windows rather than translating one-by-one (saves
# repeated prompt overhead and gives the model cross-sentence context) or
# sending the whole transcript in one call (risks the model truncating a very
# long JSON response). See the cost analysis discussion: chunk size barely
# affects price, it's a reliability/context tradeoff.
DEFAULT_CHUNK_MINUTES = 5

SYSTEM_PROMPT = (
    "You are a professional subtitle translator. You will receive a JSON array of source "
    "sentences, in order. Translate every sentence into natural, fluent {target_language}, "
    "preserving the meaning and tone. Respond with a JSON object of the exact form "
    '{{"translations": ["...", "...", ...]}} containing exactly {count} strings, '
    "in the same order as the input. Do not merge, split, omit, or reorder entries, "
    "and do not add commentary outside the JSON object."
)


def translate_segments(segments: List[dict], source_language: str, target_language: str = "English",
                       provider: LlmProvider = None, chunk_minutes: float = None) -> List[dict]:
    """
    Translate transcript segments in place (sets segment['translated_text']) using a
    chat-completion LLM, batched into time-windowed chunks. Returns the same list.
    """
    if not segments:
        return segments

    provider = provider or LlmProvider()
    chunk_minutes = chunk_minutes if chunk_minutes is not None else float(
        os.environ.get("LLM_TRANSLATE_CHUNK_MINUTES", DEFAULT_CHUNK_MINUTES))
    chunk_seconds = chunk_minutes * 60

    for chunk in _chunk_by_time(segments, chunk_seconds):
        _translate_chunk(chunk, source_language, target_language, provider)

    return segments


def _chunk_by_time(segments: List[dict], chunk_seconds: float) -> List[List[dict]]:
    chunks = []
    current = []
    window_start = None

    for segment in segments:
        start = segment.get("start") or 0.0

        if window_start is None:
            window_start = start
        elif current and (start - window_start) >= chunk_seconds:
            chunks.append(current)
            current = []
            window_start = start

        current.append(segment)

    if current:
        chunks.append(current)

    return chunks


def _translate_chunk(chunk: List[dict], source_language: str, target_language: str, provider: LlmProvider):
    texts = [segment["text"] for segment in chunk]

    translations = _request_translations(texts, target_language, provider)

    if translations is None:
        # Persistent malformed JSON from the model - fall back to translating this
        # chunk's sentences one at a time rather than failing the whole video.
        print(f"LLM translation: falling back to per-sentence calls for a chunk of {len(texts)} segments")
        translations = [_translate_single(text, target_language, provider) for text in texts]

    for segment, translated_text in zip(chunk, translations):
        segment["translated_text"] = translated_text


def _request_translations(texts: List[str], target_language: str, provider: LlmProvider, retry: int = 0):
    system = SYSTEM_PROMPT.format(target_language=target_language, count=len(texts))
    user = json.dumps(texts, ensure_ascii=False)

    content = provider.chat_complete(system=system, user=user, json_mode=True)

    try:
        parsed = json.loads(content)
        translations = parsed["translations"]
    except (json.JSONDecodeError, KeyError, TypeError):
        translations = None

    if translations is not None and len(translations) == len(texts):
        return translations

    if retry < 1:
        print(f"LLM translation: response shape mismatch (expected {len(texts)} entries); retrying once")
        return _request_translations(texts, target_language, provider, retry=retry + 1)

    return None


def _translate_single(text: str, target_language: str, provider: LlmProvider) -> str:
    system = (
        f"You are a professional subtitle translator. Translate the user's sentence into natural, "
        f"fluent {target_language}. Respond with only the translation, no quotes or commentary."
    )

    try:
        return provider.chat_complete(system=system, user=text, json_mode=False).strip()
    except Exception as e:
        print(f"LLM translation: per-sentence fallback failed for segment: {e}")
        return ""
