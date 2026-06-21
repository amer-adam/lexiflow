from typing import List
from src import modelCache
from src.config import ModelConfig
from src.whisper.abstractWhisperContainer import AbstractWhisperContainer

def create_whisper_container(whisper_implementation: str, 
                             model_name: str, device: str = None, compute_type: str = "float16",
                             download_root: str = None,
                             cache: modelCache = None, models: List[ModelConfig] = [],
                             cpu_threads: int = 4, num_workers: int = 1) -> AbstractWhisperContainer:
    print("Creating whisper container for " + whisper_implementation)

    if (whisper_implementation == "whisper"):
        from src.whisper.whisperContainer import WhisperContainer
        return WhisperContainer(model_name=model_name, device=device, compute_type=compute_type, download_root=download_root, cache=cache, models=models)
    elif (whisper_implementation == "faster-whisper" or whisper_implementation == "faster_whisper"):
        from src.whisper.fasterWhisperContainer import FasterWhisperContainer
        return FasterWhisperContainer(model_name=model_name, device=device, compute_type=compute_type, download_root=download_root, cache=cache, models=models, 
                                      cpu_threads=cpu_threads, num_workers=num_workers)
    elif (whisper_implementation == "dummy-whisper" or whisper_implementation == "dummy_whisper" or whisper_implementation == "dummy"):
        # This is useful for testing
        from src.whisper.dummyWhisperContainer import DummyWhisperContainer
        return DummyWhisperContainer(model_name=model_name, device=device, compute_type=compute_type, download_root=download_root, cache=cache, models=models)
    elif (whisper_implementation in ("api", "api-whisper", "groq", "groq-whisper")):
        # Calls a remote, OpenAI-compatible transcription API (Groq by default) instead
        # of loading a local model - no GPU/CPU model inference required. See
        # src/whisper/apiWhisperContainer.py for the provider env vars (WHISPER_API_PROVIDER,
        # WHISPER_API_KEY, WHISPER_API_BASE_URL, WHISPER_API_MODEL, WHISPER_API_RATE_LIMIT).
        from src.whisper.apiWhisperContainer import ApiWhisperContainer
        return ApiWhisperContainer(model_name=model_name, device=device, compute_type=compute_type, download_root=download_root, cache=cache, models=models)
    else:
        raise ValueError("Unknown Whisper implementation: " + whisper_implementation)