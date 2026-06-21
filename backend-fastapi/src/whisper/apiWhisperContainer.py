import os
import tempfile
import threading
import time
import wave
from typing import List

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
        "model": "whisper-large-v3",
        "api_key_env": "GROQ_API_KEY",
        # Groq's free tier allows 20 req/min for whisper-large-v3; default to
        # 30 as requested, override with WHISPER_API_RATE_LIMIT if needed.
        "rate_limit": 30,
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "model": "whisper-1",
        "api_key_env": "OPENAI_API_KEY",
        "rate_limit": 50,
    },
}


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
        })
        return state

    def __setstate__(self, state):
        super().__setstate__(state)
        self.base_url = state["base_url"]
        self.api_model = state["api_model"]
        self.api_key = state["api_key"]
        self.rate_limiter = self._get_rate_limiter(state["rate_limit"])


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
        Peform the transcription of the given audio file or data via the remote API.

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

        audio_path, is_temp_file = self._ensure_audio_file(audio)

        try:
            result = self._transcribe(audio_path, language_code or detected_language, initial_prompt)
        finally:
            if is_temp_file:
                os.remove(audio_path)

        if self.prompt_strategy:
            self.prompt_strategy.on_segment_finished(segment_index, prompt, detected_language, result)

        if progress_listener is not None:
            progress_listener.on_finished()

        return result

    def _ensure_audio_file(self, audio):
        if isinstance(audio, str):
            return audio, False

        # VAD segments arrive as a float32 array (pcm_s16le, 16kHz mono) - the
        # API needs a real file, so write it out to a temp WAV.
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

    def _transcribe(self, audio_path: str, language_code: str, initial_prompt: str, retry: int = 0):
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
            files = {"file": (os.path.basename(audio_path), audio_file, "audio/wav")}
            response = requests.post(url, headers=headers, data=data, files=files, timeout=120)

        if response.status_code == 429 and retry < 3:
            retry_after = float(response.headers.get("Retry-After", 2 ** retry))
            print(f"Whisper API rate limited (429); retrying in {retry_after:.1f}s")
            time.sleep(retry_after)
            return self._transcribe(audio_path, language_code, initial_prompt, retry=retry + 1)

        response.raise_for_status()
        payload = response.json()

        segments = [{
            "text": segment.get("text", "").strip(),
            "start": segment.get("start"),
            "end": segment.get("end"),
            "words": [],
        } for segment in payload.get("segments", [])]

        text = payload.get("text", "").strip()

        if not segments and text:
            segments = [{"text": text, "start": 0, "end": None, "words": []}]

        return {
            "segments": segments,
            "text": text,
            "language": payload.get("language", language_code),
        }

    def _lookup_language_code(self, language: str):
        language = get_language_from_name(language)

        if language is None:
            raise ValueError("Invalid language: " + language)

        return language.code
