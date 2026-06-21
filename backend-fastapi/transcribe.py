import os

from src.config import ApplicationConfig, VadInitialPromptMode
from src.hooks.progressListener import ProgressListener
from src.prompts.prependPromptStrategy import PrependPromptStrategy
from src.whisper.whisperFactory import create_whisper_container


def transcribe_file(audio_path: str, app_config: ApplicationConfig) -> dict:
    """
    Transcribe a single audio file via the configured Whisper implementation. The "api"
    implementation (the only one used in practice - see src/whisper/apiWhisperContainer.py)
    sends the whole file in one request, falling back to size-capped sequential chunks only
    if needed; there's no local model, VAD, or GPU/CUDA involved anywhere in this path.
    """
    model = create_whisper_container(
        whisper_implementation=app_config.whisper_implementation,
        model_name=app_config.default_model_name,
        device=app_config.device,
        compute_type=app_config.compute_type,
        download_root=app_config.model_dir,
        models=app_config.models,
    )

    prompt_strategy = PrependPromptStrategy(app_config.initial_prompt, VadInitialPromptMode.PREPREND_FIRST_SEGMENT) \
        if app_config.initial_prompt else None

    whisper_callback = model.create_callback(
        language=app_config.language,
        task=app_config.task,
        prompt_strategy=prompt_strategy,
    )

    return whisper_callback.invoke(audio_path, 0, None, None, progress_listener=ProgressListener())


def api_transcribe(audio_path: str) -> dict:
    app_config = ApplicationConfig.create_default()

    # Preserve the WHISPER_IMPLEMENTATION env var override (set in docker-compose.yml)
    # even though there's no CLI parser sourcing it anymore.
    whisper_implementation = os.environ.get("WHISPER_IMPLEMENTATION", app_config.whisper_implementation)
    if whisper_implementation != app_config.whisper_implementation:
        app_config = app_config.update(whisper_implementation=whisper_implementation)

    print(f"Using {app_config.whisper_implementation} for Whisper")

    result = transcribe_file(audio_path, app_config)

    num_segments = len(result.get("segments", []))
    print(f"Transcription generated {num_segments} segments")

    return result
