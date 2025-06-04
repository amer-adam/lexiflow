import whisper
import os
from datetime import datetime
import json
import math
from typing import Callable, Iterator, Union
import argparse

from io import StringIO
import os
import pathlib
import tempfile
import zipfile
import numpy as np

import torch
import gc

from src.config import VAD_INITIAL_PROMPT_MODE_VALUES, ApplicationConfig, VadInitialPromptMode
from src.hooks.progressListener import ProgressListener
from src.hooks.subTaskProgressListener import SubTaskProgressListener
from src.languages import get_language_names
from src.prompts.jsonPromptStrategy import JsonPromptStrategy
from src.prompts.prependPromptStrategy import PrependPromptStrategy
from src.source import AudioSource, get_audio_source_collection
from src.download import ExceededMaximumDuration, download_url, uri_validator
from src.modelCache import ModelCache

# External programs
import ffmpeg

from src.utils import optional_int, str2bool, write_srt, write_vtt, optional_float

from src.vad import AbstractTranscription, NonSpeechStrategy, TranscriptionConfig, VadSileroTranscription
from src.whisper.abstractWhisperContainer import AbstractWhisperContainer
from src.whisper.whisperFactory import create_whisper_container
from src.vadParallel import ParallelContext, ParallelTranscription

# Configure more application defaults in config.json5

# Gradio seems to truncate files without keeping the extension, so we need to truncate the file prefix ourself
MAX_FILE_PREFIX_LENGTH = 17

# Limit auto_parallel to a certain number of CPUs (specify vad_cpu_cores to get a higher number)
MAX_AUTO_CPU_CORES = 8

WHISPER_MODELS = ["tiny", "base", "small",
                  "medium", "large", "large-v1", "large-v2"]


class VadOptions:
    def __init__(self, vad: str = None, vadMergeWindow: float = 5, vadMaxMergeSize: float = 150, vadPadding: float = 1, vadPromptWindow: float = 1,
                 vadInitialPromptMode: Union[VadInitialPromptMode, str] = VadInitialPromptMode.PREPREND_FIRST_SEGMENT):
        self.vad = vad
        self.vadMergeWindow = vadMergeWindow
        self.vadMaxMergeSize = vadMaxMergeSize
        self.vadPadding = vadPadding
        self.vadPromptWindow = vadPromptWindow
        self.vadInitialPromptMode = vadInitialPromptMode if isinstance(vadInitialPromptMode, VadInitialPromptMode) \
            else VadInitialPromptMode.from_string(vadInitialPromptMode)


class WhisperTranscriber:
    def __init__(self, input_audio_max_duration: float = None, vad_process_timeout: float = None,
                 vad_cpu_cores: int = 1, delete_uploaded_files: bool = False, output_dir: str = None,
                 app_config: ApplicationConfig = None):
        self.model_cache = ModelCache()
        self.parallel_device_list = None
        self.gpu_parallel_context = None
        self.cpu_parallel_context = None
        self.vad_process_timeout = vad_process_timeout
        self.vad_cpu_cores = vad_cpu_cores
        self.diarization = None

        self.vad_model = None
        self.inputAudioMaxDuration = input_audio_max_duration
        self.deleteUploadedFiles = delete_uploaded_files
        self.output_dir = output_dir

        # Support for diarization
        # Dictionary with parameters to pass to diarization.run - if None, diarization is not enabled
        self.diarization_kwargs = None
        self.app_config = app_config

    def set_parallel_devices(self, vad_parallel_devices: str):
        self.parallel_device_list = [device.strip() for device in vad_parallel_devices.split(
            ",")] if vad_parallel_devices else None

    def set_auto_parallel(self, auto_parallel: bool):
        if auto_parallel:
            if torch.cuda.is_available():
                self.parallel_device_list = [
                    str(gpu_id) for gpu_id in range(torch.cuda.device_count())]

            self.vad_cpu_cores = min(os.cpu_count(), MAX_AUTO_CPU_CORES)
            print("[Auto parallel] Using GPU devices " + str(self.parallel_device_list) +
                  " and " + str(self.vad_cpu_cores) + " CPU cores for VAD/transcription.")

    def transcribe_file(self, model: AbstractWhisperContainer, audio_path: str, language: str, task: str = None,
                        vadOptions: VadOptions = VadOptions(),
                        progressListener: ProgressListener = None,  **decodeOptions: dict):

        initial_prompt = decodeOptions.pop('initial_prompt', None)

        if progressListener is None:
            # Default progress listener
            progressListener = ProgressListener()

        initial_prompt_mode = vadOptions.vadInitialPromptMode

        # Set default initial prompt mode
        if (initial_prompt_mode is None):
            initial_prompt_mode = VadInitialPromptMode.PREPREND_FIRST_SEGMENT

        if (initial_prompt_mode == VadInitialPromptMode.PREPEND_ALL_SEGMENTS or
                initial_prompt_mode == VadInitialPromptMode.PREPREND_FIRST_SEGMENT):
            # Prepend initial prompt
            prompt_strategy = PrependPromptStrategy(
                initial_prompt, initial_prompt_mode)
        elif (vadOptions.vadInitialPromptMode == VadInitialPromptMode.JSON_PROMPT_MODE):
            # Use a JSON format to specify the prompt for each segment
            prompt_strategy = JsonPromptStrategy(initial_prompt)
        else:
            raise ValueError(
                "Invalid vadInitialPromptMode: " + initial_prompt_mode)

        # Callable for processing an audio file
        whisperCallable = model.create_callback(
            language, task, prompt_strategy=prompt_strategy, **decodeOptions)

        # The results
        if (vadOptions.vad == 'silero-vad'):
            # Silero VAD where non-speech gaps are transcribed
            process_gaps = self._create_silero_config(
                NonSpeechStrategy.CREATE_SEGMENT, vadOptions)
            result = self.process_vad(
                audio_path, whisperCallable, self.vad_model, process_gaps, progressListener=progressListener)
        elif (vadOptions.vad == 'silero-vad-skip-gaps'):
            # Silero VAD where non-speech gaps are simply ignored
            skip_gaps = self._create_silero_config(
                NonSpeechStrategy.SKIP, vadOptions)
            result = self.process_vad(
                audio_path, whisperCallable, self.vad_model, skip_gaps, progressListener=progressListener)
        elif (vadOptions.vad == 'silero-vad-expand-into-gaps'):
            # Use Silero VAD where speech-segments are expanded into non-speech gaps
            expand_gaps = self._create_silero_config(
                NonSpeechStrategy.EXPAND_SEGMENT, vadOptions)
            result = self.process_vad(
                audio_path, whisperCallable, self.vad_model, expand_gaps, progressListener=progressListener)

        else:
            # Default VAD
            result = whisperCallable.invoke(
                audio_path, 0, None, None, progress_listener=progressListener)

        return result

    def process_vad(self, audio_path, whisperCallable, vadModel: AbstractTranscription, vadConfig: TranscriptionConfig,
                    progressListener: ProgressListener = None):
        if (not self._has_parallel_devices()):
            # No parallel devices, so just run the VAD and Whisper in sequence
            return vadModel.transcribe(audio_path, whisperCallable, vadConfig, progressListener=progressListener)

        gpu_devices = self.parallel_device_list

        if (gpu_devices is None or len(gpu_devices) == 0):
            # No GPU devices specified, pass the current environment variable to the first GPU process. This may be NULL.
            gpu_devices = [os.environ.get("CUDA_VISIBLE_DEVICES", None)]

        # Create parallel context if needed
        if (self.gpu_parallel_context is None):
            # Create a context wih processes and automatically clear the pool after 1 hour of inactivity
            self.gpu_parallel_context = ParallelContext(num_processes=len(
                gpu_devices), auto_cleanup_timeout_seconds=self.vad_process_timeout)
        # We also need a CPU context for the VAD
        if (self.cpu_parallel_context is None):
            self.cpu_parallel_context = ParallelContext(
                num_processes=self.vad_cpu_cores, auto_cleanup_timeout_seconds=self.vad_process_timeout)

        parallel_vad = ParallelTranscription()
        return parallel_vad.transcribe_parallel(transcription=vadModel, audio=audio_path, whisperCallable=whisperCallable,
                                                config=vadConfig, cpu_device_count=self.vad_cpu_cores, gpu_devices=gpu_devices,
                                                cpu_parallel_context=self.cpu_parallel_context, gpu_parallel_context=self.gpu_parallel_context,
                                                progress_listener=progressListener)

    def _has_parallel_devices(self):
        return (self.parallel_device_list is not None and len(self.parallel_device_list) > 0) or self.vad_cpu_cores > 1

    def _concat_prompt(self, prompt1, prompt2):
        if (prompt1 is None):
            return prompt2
        elif (prompt2 is None):
            return prompt1
        else:
            return prompt1 + " " + prompt2

    def _create_silero_config(self, non_speech_strategy: NonSpeechStrategy, vadOptions: VadOptions):
        # Use Silero VAD
        if (self.vad_model is None):
            self.vad_model = VadSileroTranscription()

        config = TranscriptionConfig(non_speech_strategy=non_speech_strategy,
                                     max_silent_period=vadOptions.vadMergeWindow, max_merge_size=vadOptions.vadMaxMergeSize,
                                     segment_padding_left=vadOptions.vadPadding, segment_padding_right=vadOptions.vadPadding,
                                     max_prompt_window=vadOptions.vadPromptWindow)

        return config

    def write_result(self, result: dict, source_name: str, output_dir: str, highlight_words: bool = False):
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        text = result["text"]
        language = result["language"] if "language" in result else None
        languageMaxLineWidth = self.__get_max_line_width(language)

        # We always create the JSON file for debugging purposes
        json_result = json.dumps(result, indent=4, ensure_ascii=False)
        json_file = self.__create_file(
            json_result, output_dir, source_name + "-result.json")
        print("Created JSON file " + json_file)

        print("Max line width " + str(languageMaxLineWidth))
        vtt = self.__get_subs(
            result["segments"], "vtt", languageMaxLineWidth, highlight_words=highlight_words)
        srt = self.__get_subs(
            result["segments"], "srt", languageMaxLineWidth, highlight_words=highlight_words)

        output_files = []
        output_files.append(self.__create_file(
            srt, output_dir, source_name + "-subs.srt"))
        output_files.append(self.__create_file(
            vtt, output_dir, source_name + "-subs.vtt"))
        output_files.append(self.__create_file(
            text, output_dir, source_name + "-transcript.txt"))
        output_files.append(json_file)

        return output_files, text, vtt

    def clear_cache(self):
        self.model_cache.clear()
        self.vad_model = None

    def __get_source(self, urlData, multipleFiles, microphoneData):
        return get_audio_source_collection(urlData, multipleFiles, microphoneData, self.inputAudioMaxDuration)

    def __get_max_line_width(self, language: str) -> int:
        if (language and language.lower() in ["japanese", "ja", "chinese", "zh"]):
            # Chinese characters and kana are wider, so limit line length to 40 characters
            return 40
        else:
            # TODO: Add more languages
            # 80 latin characters should fit on a 1080p/720p screen
            return 80

    def __get_subs(self, segments: Iterator[dict], format: str, maxLineWidth: int, highlight_words: bool = False) -> str:
        segmentStream = StringIO()

        if format == 'vtt':
            write_vtt(segments, file=segmentStream,
                      maxLineWidth=maxLineWidth, highlight_words=highlight_words)
        elif format == 'srt':
            write_srt(segments, file=segmentStream,
                      maxLineWidth=maxLineWidth, highlight_words=highlight_words)
        else:
            raise Exception("Unknown format " + format)

        segmentStream.seek(0)
        return segmentStream.read()

    def __create_file(self, text: str, directory: str, fileName: str) -> str:
        # Write the text to a file
        with open(os.path.join(directory, fileName), 'w+', encoding="utf-8") as file:
            file.write(text)

        return file.name

    def close(self):
        print("Closing parallel contexts")
        self.clear_cache()

        if (self.gpu_parallel_context is not None):
            self.gpu_parallel_context.close()
        if (self.cpu_parallel_context is not None):
            self.cpu_parallel_context.close()

        # Cleanup diarization
        if (self.diarization is not None):
            self.diarization.cleanup()
            self.diarization = None

        if torch.cuda.is_available():
            torch.cuda.empty_cache()



def create_parser(app_config: ApplicationConfig = None, output_dir: str = '') -> argparse.ArgumentParser:

    whisper_models = app_config.get_model_names()

    # Environment variable overrides
    default_whisper_implementation = os.environ.get(
        "WHISPER_IMPLEMENTATION", app_config.whisper_implementation)


    parser = argparse.ArgumentParser(
    formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    parser.add_argument("--model", default=app_config.default_model_name, choices=whisper_models,
                        help="name of the Whisper model to use")  # medium
    parser.add_argument("--model_dir", type=str, default=app_config.model_dir,
                        help="the path to save model files; uses ~/.cache/whisper by default")
    parser.add_argument("--device", default=app_config.device,
                        help="device to use for PyTorch inference")
    parser.add_argument("--output_dir", "-o", type=str, default=output_dir,
                        help="directory to save the outputs")
    parser.add_argument("--verbose", type=str2bool, default=app_config.verbose,
                        help="whether to print out the progress and debug messages")
    parser.add_argument("--whisper_implementation", type=str, default=default_whisper_implementation, choices=["whisper", "faster-whisper"],
                        help="the Whisper implementation to use")

    parser.add_argument("--task", type=str, default=app_config.task, choices=["transcribe", "translate"],
                        help="whether to perform X->X speech recognition ('transcribe') or X->English translation ('translate')")
    parser.add_argument("--language", type=str, default=app_config.language, choices=sorted(get_language_names()),
                        help="language spoken in the audio, specify None to perform language detection")

    parser.add_argument("--vad", type=str, default=app_config.default_vad, choices=["none", "silero-vad", "silero-vad-skip-gaps", "silero-vad-expand-into-gaps", "periodic-vad"],
                        help="The voice activity detection algorithm to use")  # silero-vad
    parser.add_argument("--vad_initial_prompt_mode", type=str, default=app_config.vad_initial_prompt_mode, choices=VAD_INITIAL_PROMPT_MODE_VALUES,
                        help="Whether or not to prepend the initial prompt to each VAD segment (prepend_all_segments), or just the first segment (prepend_first_segment)")  # prepend_first_segment
    parser.add_argument("--vad_merge_window", type=optional_float, default=app_config.vad_merge_window,
                        help="The window size (in seconds) to merge voice segments")
    parser.add_argument("--vad_max_merge_size", type=optional_float, default=app_config.vad_max_merge_size,
                        help="The maximum size (in seconds) of a voice segment")
    parser.add_argument("--vad_padding", type=optional_float, default=app_config.vad_padding,
                        help="The padding (in seconds) to add to each voice segment")
    parser.add_argument("--vad_prompt_window", type=optional_float, default=app_config.vad_prompt_window,
                        help="The window size of the prompt to pass to Whisper")
    parser.add_argument("--vad_cpu_cores", type=int, default=app_config.vad_cpu_cores,
                        help="The number of CPU cores to use for VAD pre-processing.")  # 1
    parser.add_argument("--vad_parallel_devices", type=str, default=app_config.vad_parallel_devices,
                        help="A commma delimited list of CUDA devices to use for parallel processing. If None, disable parallel processing.")  # ""
    parser.add_argument("--auto_parallel", type=bool, default=app_config.auto_parallel,
                        help="True to use all available GPUs and CPU cores for processing. Use vad_cpu_cores/vad_parallel_devices to specify the number of CPU cores/GPUs to use.")  # False

    parser.add_argument("--temperature", type=float, default=app_config.temperature,
                        help="temperature to use for sampling")
    parser.add_argument("--best_of", type=optional_int, default=app_config.best_of,
                        help="number of candidates when sampling with non-zero temperature")
    parser.add_argument("--beam_size", type=optional_int, default=app_config.beam_size,
                        help="number of beams in beam search, only applicable when temperature is zero")
    parser.add_argument("--patience", type=float, default=app_config.patience,
                        help="optional patience value to use in beam decoding, as in https://arxiv.org/abs/2204.05424, the default (1.0) is equivalent to conventional beam search")
    parser.add_argument("--length_penalty", type=float, default=app_config.length_penalty,
                        help="optional token length penalty coefficient (alpha) as in https://arxiv.org/abs/1609.08144, uses simple lengt normalization by default")

    parser.add_argument("--suppress_tokens", type=str, default=app_config.suppress_tokens,
                        help="comma-separated list of token ids to suppress during sampling; '-1' will suppress most special characters except common punctuations")
    parser.add_argument("--initial_prompt", type=str, default=app_config.initial_prompt,
                        help="optional text to provide as a prompt for the first window.")
    parser.add_argument("--condition_on_previous_text", type=str2bool, default=app_config.condition_on_previous_text,
                        help="if True, provide the previous output of the model as a prompt for the next window; disabling may make the text inconsistent across windows, but the model becomes less prone to getting stuck in a failure loop")
    parser.add_argument("--fp16", type=str2bool, default=app_config.fp16,
                        help="whether to perform inference in fp16; True by default")
    parser.add_argument("--compute_type", type=str, default=app_config.compute_type, choices=["default", "auto", "int8", "int8_float16", "int16", "float16", "float32"],
                        help="the compute type to use for inference")

    parser.add_argument("--temperature_increment_on_fallback", type=optional_float, default=app_config.temperature_increment_on_fallback,
                        help="temperature to increase when falling back when the decoding fails to meet either of the thresholds below")
    parser.add_argument("--compression_ratio_threshold", type=optional_float, default=app_config.compression_ratio_threshold,
                        help="if the gzip compression ratio is higher than this value, treat the decoding as failed")
    parser.add_argument("--logprob_threshold", type=optional_float, default=app_config.logprob_threshold,
                        help="if the average log probability is lower than this value, treat the decoding as failed")
    parser.add_argument("--no_speech_threshold", type=optional_float, default=app_config.no_speech_threshold,
                        help="if the probability of the <|nospeech|> token is higher than this value AND the decoding has failed due to `logprob_threshold`, consider the segment as silence")

    parser.add_argument("--word_timestamps", type=str2bool, default=app_config.word_timestamps,
                        help="(experimental) extract word-level timestamps and refine the results based on them")
    parser.add_argument("--prepend_punctuations", type=str, default=app_config.prepend_punctuations,
                        help="if word_timestamps is True, merge these punctuation symbols with the next word")
    parser.add_argument("--append_punctuations", type=str, default=app_config.append_punctuations,
                        help="if word_timestamps is True, merge these punctuation symbols with the previous word")
    parser.add_argument("--highlight_words", type=str2bool, default=app_config.highlight_words,
                        help="(requires --word_timestamps True) underline each word as it is spoken in srt and vtt")
    parser.add_argument("--threads", type=optional_int, default=8,
                        help="number of threads used by torch for CPU inference; supercedes MKL_NUM_THREADS/OMP_NUM_THREADS")
    return parser




# Main Fuction for usage
def api_transcribe(audio_path: str):
    app_config = ApplicationConfig.create_default()

    # For the CLI, we fallback to saving the output to the current directory
    output_dir = app_config.output_dir if app_config.output_dir is not None else "."


    # Create the parser and parse the arguments
    parser = create_parser(app_config=app_config, output_dir=output_dir)

    args = parser.parse_args().__dict__
    model_name: str = args.pop("model")
    model_dir: str = args.pop("model_dir")
    output_dir: str = args.pop("output_dir")
    device: str = args.pop("device")
    os.makedirs(output_dir, exist_ok=True)

    if (threads := args.pop("threads")) > 0:
        torch.set_num_threads(threads)

    whisper_implementation = args.pop("whisper_implementation")
    print(f"Using {whisper_implementation} for Whisper")


    temperature = args.pop("temperature")
    temperature_increment_on_fallback = args.pop(
        "temperature_increment_on_fallback")
    if temperature_increment_on_fallback is not None:
        temperature = tuple(np.arange(temperature, 1.0 +
                            1e-6, temperature_increment_on_fallback))
    else:
        temperature = [temperature]

    vad = args.pop("vad")
    vad_initial_prompt_mode = args.pop("vad_initial_prompt_mode")
    vad_merge_window = args.pop("vad_merge_window")
    vad_max_merge_size = args.pop("vad_max_merge_size")
    vad_padding = args.pop("vad_padding")
    vad_prompt_window = args.pop("vad_prompt_window")
    vad_cpu_cores = args.pop("vad_cpu_cores")
    auto_parallel = args.pop("auto_parallel")

    compute_type = args.pop("compute_type")
    highlight_words = args.pop("highlight_words")


    transcriber = WhisperTranscriber(
        delete_uploaded_files=False, vad_cpu_cores=vad_cpu_cores, app_config=app_config)
    transcriber.set_parallel_devices(args.pop("vad_parallel_devices"))
    transcriber.set_auto_parallel(auto_parallel)


    model = create_whisper_container(whisper_implementation=whisper_implementation, model_name=model_name,
                                     device=device, compute_type=compute_type, download_root=model_dir, models=app_config.models)

    if (transcriber._has_parallel_devices()):
        print("Using parallel devices:", transcriber.parallel_device_list)


    # audio_path = '/home/amer/lexiflow/backend/temp/downloads/en_example.wav'
    # audio_path = '/home/amer/lexiflow/backend/temp/downloads/第93集： 张骞和丝绸之路 Zhang Qian and the Silk Road ｜ intermediate Chinese podcast.m4a'
    # audio_path = 'https://www.youtube.com/watch?v=9FNRb71akL4'
    sources = []

    sources.append(
        {"path": audio_path, "name": os.path.basename(audio_path)})

    for source in sources:
        source_path = source["path"]
        source_name = source["name"]

        vadOptions = VadOptions(vad, vad_merge_window, vad_max_merge_size, vad_padding, vad_prompt_window,
                                VadInitialPromptMode.from_string(vad_initial_prompt_mode))

        result = transcriber.transcribe_file(model, source_path, temperature=temperature, vadOptions=vadOptions, **args)

        transcriber.write_result(result, source_name, output_dir, highlight_words)


    print("Transcription completed. closing transcriber.")
    transcriber.close()
    # clear_vram(model)
    # clear_vram(transcriber)
    return result
    # return json.dumps(result, indent=4, ensure_ascii=False)
