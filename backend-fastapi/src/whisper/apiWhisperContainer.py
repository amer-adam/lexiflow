import math
import os
import tempfile
import threading
import time
import wave
from typing import List

import ffmpeg
import numpy as np
import requests

from src.config import ModelConfig
from src.hooks.progressListener import ProgressListener
from src.languages import get_language_from_name
from src.modelCache import ModelCache
from src.prompts.abstractPromptStrategy import AbstractPromptStrategy
from src.whisper.abstractWhisperContainer import AbstractWhisperCallback, AbstractWhisperContainer
from src.whisper.rateLimiter import RateLimiter

# Defaults per provider, so swapping providers is just an env var change -
# no code change required. Any provider that speaks the OpenAI
# audio/transcriptions multipart API can be plugged in this way.
PROVIDER_DEFAULTS = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "whisper-large-v3-turbo",
        "api_key_env": "GROQ_API_KEY",
        "rate_limit": 30,
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "whisper-1",
        "api_key_env": "OPENAI_API_KEY",
        "rate_limit": 50,
    },
}

# We send the whole file in a single request whenever possible (no local
# VAD/Whisper involved at all) and let the API's own segments stand in for
# VAD output. Audio is transcoded to a low-bitrate mono mp3 before upload so
# far more audio fits under the per-request size cap than raw/lossless audio
# would allow; chunking by time only kicks in as a fallback for audio that's
# still too big after compression.
UPLOAD_SAMPLE_RATE = 16000
UPLOAD_BITRATE_KBPS = 64

# Stay safely under the documented 25MB/request cap. Override via
# WHISPER_API_MAX_FILE_MB if your account has a higher limit (e.g. 100MB on
# Groq's paid Dev tier) - check the exact value on your account's limits page.
DEFAULT_MAX_UPLOAD_MB = 24

# Groq bills (and in some cases rejects) requests below this many seconds of
# audio, so chunk boundaries should never produce a piece shorter than this.
MIN_CHUNK_SECONDS = 10


class ApiWhisperContainer(AbstractWhisperContainer):
    """
    Whisper container backed by a remote, OpenAI-compatible transcription
    API (Groq by default) instead of a local model. Avoids any GPU/CPU
    hardware requirements for running Whisper itself.
    """

    _rate_limiter = None
    _rate_limiter_max = None
    _rate_limiter_lock = threading.Lock()

    def __init__(self, model_name: str = None, device: str = None, compute_type: str = "float16",
                 download_root: str = None,
                 cache: ModelCache = None, models: List[ModelConfig] = []):
        super().__init__(model_name, device, compute_type, download_root, cache, models)

        provider = os.environ.get("WHISPER_API_PROVIDER", "groq").lower()
        defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS["groq"])

        self.base_url = os.environ.get("WHISPER_API_BASE_URL", defaults["base_url"]).rstrip("/")
        self.api_model = os.environ.get("WHISPER_API_MODEL", defaults["model"])
        self.api_key = os.environ.get("WHISPER_API_KEY") or os.environ.get(defaults["api_key_env"])

        if not self.api_key:
            raise ValueError(
                f"Missing API key for Whisper API provider '{provider}'. "
                f"Set WHISPER_API_KEY or {defaults['api_key_env']} in the environment."
            )

        rate_limit = int(os.environ.get("WHISPER_API_RATE_LIMIT", defaults["rate_limit"]))
        self.rate_limiter = self._get_rate_limiter(rate_limit)

        max_upload_mb = float(os.environ.get("WHISPER_API_MAX_FILE_MB", DEFAULT_MAX_UPLOAD_MB))
        self.max_upload_bytes = int(max_upload_mb * 1024 * 1024)

    @classmethod
    def _get_rate_limiter(cls, max_requests: int) -> RateLimiter:
        # Shared across all containers/callbacks in this process, so segments
        # transcribed back-to-back for the same job (or concurrently across
        # jobs) still respect a single requests-per-minute budget.
        with cls._rate_limiter_lock:
            if cls._rate_limiter is None or cls._rate_limiter_max != max_requests:
                cls._rate_limiter = RateLimiter(max_requests, period_seconds=60.0)
                cls._rate_limiter_max = max_requests
            return cls._rate_limiter

    def ensure_downloaded(self):
        # Nothing to download - the model runs behind the API.
        pass

    def _create_model(self):
        # No local model object is needed.
        return None

    def create_callback(self, language: str = None, task: str = None,
                        prompt_strategy: AbstractPromptStrategy = None,
                        **decodeOptions: dict) -> AbstractWhisperCallback:
        return ApiWhisperCallback(self, language=language, task=task, prompt_strategy=prompt_strategy, **decodeOptions)

    # Multiprocessing support (mirrors AbstractWhisperContainer, plus our own fields)
    def __getstate__(self):
        state = super().__getstate__()
        state.update({
            "base_url": self.base_url,
            "api_model": self.api_model,
            "api_key": self.api_key,
            "rate_limit": self.rate_limiter.max_requests,
            "max_upload_bytes": self.max_upload_bytes,
        })
        return state

    def __setstate__(self, state):
        super().__setstate__(state)
        self.base_url = state["base_url"]
        self.api_model = state["api_model"]
        self.api_key = state["api_key"]
        self.rate_limiter = self._get_rate_limiter(state["rate_limit"])
        self.max_upload_bytes = state["max_upload_bytes"]


class ApiWhisperCallback(AbstractWhisperCallback):
    def __init__(self, model_container: ApiWhisperContainer, language: str = None, task: str = None,
                 prompt_strategy: AbstractPromptStrategy = None,
                 **decodeOptions: dict):
        self.model_container = model_container
        self.language = language
        self.task = task
        self.prompt_strategy = prompt_strategy
        self.decodeOptions = decodeOptions

    def invoke(self, audio, segment_index: int, prompt: str, detected_language: str, progress_listener: ProgressListener = None):
        """
        Transcribe the given audio via the remote API. The whole input is sent in a single
        request whenever it fits under the size cap once compressed; only audio that's still
        too large after compression gets split into sequential time-based chunks (not VAD).

        Parameters
        ----------
        audio: Union[str, np.ndarray, torch.Tensor]
            The audio file to transcribe, or the audio data as a numpy array or torch tensor.
        segment_index: int
            The target language of the transcription. If not specified, the language will be inferred from the audio content.
        task: str
            The task - either translate or transcribe.
        progress_listener: ProgressListener
            A callback to receive progress updates.
        """
        language_code = self._lookup_language_code(self.language) if self.language else None

        initial_prompt = self.prompt_strategy.get_segment_prompt(segment_index, prompt, detected_language) \
            if self.prompt_strategy else prompt

        source_path, is_temp_source = self._ensure_source_file(audio)

        try:
            result = self._transcribe_audio(source_path, language_code or detected_language, initial_prompt, progress_listener)
        finally:
            if is_temp_source:
                os.remove(source_path)

        if self.prompt_strategy:
            self.prompt_strategy.on_segment_finished(segment_index, prompt, detected_language, result)

        if progress_listener is not None:
            progress_listener.on_finished()

        return result

    def _ensure_source_file(self, audio):
        """Returns (path, is_temp_file) for whatever audio was passed in."""
        if isinstance(audio, str):
            return audio, False

        # A pre-split (e.g. VAD) segment arrives as a float32 array (pcm_s16le, 16kHz mono).
        array = audio.cpu().numpy() if hasattr(audio, "cpu") else np.asarray(audio)

        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.close()

        pcm16 = (np.clip(array, -1.0, 1.0) * 32767).astype(np.int16)
        with wave.open(tmp.name, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(16000)
            wav_file.writeframes(pcm16.tobytes())

        return tmp.name, True

    def _transcribe_audio(self, source_path: str, language_code: str, initial_prompt: str,
                          progress_listener: ProgressListener = None):
        container = self.model_container
        duration = float(ffmpeg.probe(source_path)["format"]["duration"])

        # Estimate the compressed size up front so we only pay for a (cheap, local)
        # encode of the whole file when it's actually going to fit in one request.
        estimated_bytes = duration * (UPLOAD_BITRATE_KBPS * 1000 / 8)

        if estimated_bytes <= container.max_upload_bytes:
            encoded_path = self._encode_for_upload(source_path)
            try:
                if os.path.getsize(encoded_path) <= container.max_upload_bytes:
                    result = self._transcribe_chunk(encoded_path, language_code, initial_prompt, time_offset=0.0)
                    if progress_listener is not None:
                        progress_listener.on_progress(duration, duration)
                    return result
            finally:
                os.remove(encoded_path)

        # Compressed whole file is still too big for one request - fall back to
        # sequential time-based chunks (no VAD; just even time slices).
        return self._transcribe_in_chunks(source_path, duration, language_code, initial_prompt, progress_listener)

    def _transcribe_in_chunks(self, source_path: str, total_duration: float, language_code: str,
                              initial_prompt: str, progress_listener: ProgressListener = None):
        container = self.model_container

        bytes_per_second = UPLOAD_BITRATE_KBPS * 1000 / 8
        # 10% margin for container/format overhead on top of the raw bitrate estimate.
        max_chunk_seconds = (container.max_upload_bytes / bytes_per_second) * 0.9
        max_chunk_seconds = max(max_chunk_seconds, MIN_CHUNK_SECONDS)

        num_chunks = max(1, math.ceil(total_duration / max_chunk_seconds))
        chunk_seconds = total_duration / num_chunks

        boundaries = [i * chunk_seconds for i in range(num_chunks)] + [total_duration]

        combined_segments = []
        combined_text_parts = []
        detected_lang = None

        for i in range(num_chunks):
            start = boundaries[i]
            end = boundaries[i + 1]
            length = end - start

            encoded_path = self._encode_for_upload(source_path, start=start, length=length)
            try:
                chunk_result = self._transcribe_chunk(encoded_path, language_code, initial_prompt, time_offset=start)
            finally:
                os.remove(encoded_path)

            combined_segments.extend(chunk_result["segments"])
            if chunk_result["text"]:
                combined_text_parts.append(chunk_result["text"])
            detected_lang = detected_lang or chunk_result["language"]

            if progress_listener is not None:
                progress_listener.on_progress(end, total_duration)

        return {
            "segments": combined_segments,
            "text": " ".join(combined_text_parts),
            "language": detected_lang or language_code,
        }

    def _encode_for_upload(self, source_path: str, start: float = None, length: float = None) -> str:
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp.close()

        input_kwargs = {}
        if start is not None:
            input_kwargs["ss"] = start
        if length is not None:
            input_kwargs["t"] = length

        try:
            (
                ffmpeg
                .input(source_path, **input_kwargs)
                .output(tmp.name, ac=1, ar=UPLOAD_SAMPLE_RATE, audio_bitrate=f"{UPLOAD_BITRATE_KBPS}k", format="mp3")
                .overwrite_output()
                .run(cmd="ffmpeg", capture_stdout=True, capture_stderr=True)
            )
        except ffmpeg.Error as e:
            raise RuntimeError(f"Failed to encode audio for upload: {e.stderr.decode()}")

        return tmp.name

    def _transcribe_chunk(self, audio_path: str, language_code: str, initial_prompt: str,
                          time_offset: float = 0.0, retry: int = 0):
        container = self.model_container

        endpoint = "audio/translations" if self.task == "translate" else "audio/transcriptions"
        url = f"{container.base_url}/{endpoint}"
        headers = {"Authorization": f"Bearer {container.api_key}"}

        data = {
            "model": container.api_model,
            "response_format": "verbose_json",
        }
        if language_code and self.task != "translate":
            data["language"] = language_code
        if initial_prompt:
            data["prompt"] = initial_prompt

        # Respect the requests-per-minute budget before every call, including retries.
        container.rate_limiter.acquire()

        with open(audio_path, "rb") as audio_file:
            files = {"file": (os.path.basename(audio_path), audio_file, "audio/mpeg")}
            response = requests.post(url, headers=headers, data=data, files=files, timeout=300)

        if response.status_code == 429 and retry < 3:
            retry_after = float(response.headers.get("Retry-After", 2 ** retry))
            print(f"Whisper API rate limited (429); retrying in {retry_after:.1f}s")
            time.sleep(retry_after)
            return self._transcribe_chunk(audio_path, language_code, initial_prompt, time_offset, retry=retry + 1)

        response.raise_for_status()
        payload = response.json()

        segments = [{
            "text": segment.get("text", "").strip(),
            "start": (segment.get("start") or 0.0) + time_offset,
            "end": (segment.get("end") + time_offset) if segment.get("end") is not None else None,
            "words": [],
        } for segment in payload.get("segments", [])]

        text = payload.get("text", "").strip()

        if not segments and text:
            segments = [{"text": text, "start": time_offset, "end": None, "words": []}]

        return {
            "segments": segments,
            "text": text,
            "language": self._normalize_response_language(payload.get("language")) or language_code,
        }

    def _normalize_response_language(self, language: str):
        # The API returns the detected language as a full name (e.g. "Chinese",
        # "english") rather than an ISO code, unlike faster-whisper's info.language.
        # Normalize it the same way so downstream consumers (e.g. api_translate's
        # lowercase 'chinese'/'zh' checks) keep working regardless of casing.
        if not language:
            return None

        lang = get_language_from_name(language)
        if lang is not None:
            return lang.code

        return language.lower()

    def _lookup_language_code(self, language: str):
        language = get_language_from_name(language)

        if language is None:
            raise ValueError("Invalid language: " + language)

        return language.code
