import os
import re
import io
import wave
import uuid
import json
import time
import asyncio
import subprocess
import requests
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, APIRouter, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Existing core processing libraries
from lingua import Language, LanguageDetectorBuilder
from pypinyin import pinyin

# Internal media processing module imports
from transcribe import api_transcribe
from postprocces import api_postprocess
from src.download import download_url, uri_validator, get_duration
from src.captions import find_existing_captions, download_and_parse_captions

from services.quiz.generator import QuizGenerator
from services.quiz.judge import QuizJudge

# Initialize environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

app = FastAPI()

active_jobs = {}  # Format: {job_id: {"status": ..., "result": ...}}

# Initialize Quiz Layer Singletons
quiz_generator = QuizGenerator()
quiz_judge = QuizJudge()

class JobRequest(BaseModel):
    url: str
    job_id: Optional[str] = None
    is_local: bool = False


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: float
    current_step: str | None
    result: dict | None


class DurationResponse(BaseModel):
    url: str
    duration_seconds: float
    success: bool
    error: Optional[str] = None


class DurationRequest(BaseModel):
    url: str

class VocabItemPayload(BaseModel):
    id: Optional[str] = None
    vocabularyListItemId: Optional[str] = None
    simplified: str
    meaning: str
    pinyin: Optional[str] = ""
    contextSentence: Optional[str] = ""
    contextTranslation: Optional[str] = ""

class QuizGenerateRequest(BaseModel):
    vocab_items: List[VocabItemPayload]
    count: int
    allowed_types: List[str]

class ShortAnswerEvaluateRequest(BaseModel):
    correct_reference: str
    user_response: str


@app.post("/duration")
async def get_video_duration(request: DurationRequest) -> DurationResponse:
    """    Get duration of a YouTube video    """
    try:
        url = request.url
        if not uri_validator(url):
            raise HTTPException(status_code=400, detail="Invalid URL format")
        duration_seconds = get_duration(url)
        return DurationResponse(
            url=url,
            duration_seconds=duration_seconds,
            success=True
        )
    except Exception as e:
        print(f"Error getting duration: {e}")
        return DurationResponse(
            url=url,
            duration_seconds=0,
            success=False,
            error=str(e)
        )


def download_video(url: str, job_id: str) -> str:
    """Download video and return file path"""

    output_dir = os.path.join(os.path.dirname(__file__), "temp")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    if not uri_validator(url):
        raise HTTPException(status_code=400, detail="Invalid URL format")
    file_path = download_url(
        url, maxDuration=-1, destinationDirectory=output_dir, playlistItems=None)
    
    # Convert to 16kHz WAV for Whisper
    wav_path = file_path[0].rsplit('.', 1)[0] + "_16k.wav"
    subprocess.run([
        'ffmpeg', '-y', '-i', file_path[0],
        '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
        wav_path
    ], check=True)
    
    return wav_path


def api_translate(transcription_result):
    url = os.getenv("TRANSLATION_API_URL", "http://127.0.0.1:5000/translate")
    get_pinyin = False

    # detect source language
    source_language = transcription_result["language"]

    if source_language == '':
        languages = [Language.ENGLISH, Language.ARABIC,
                        Language.MALAY, Language.CHINESE]
        detector = LanguageDetectorBuilder.from_languages(
            *languages).build()
        source_language = detector.detect_language_of(
            transcription_result["text"]).name.lower()
        print(f"Detected language: {source_language}")

    if source_language == 'arabic' or source_language == 'ar':
        source_language = 'ar'
    elif source_language == 'english' or source_language == 'en':
        source_language = 'en'
    elif source_language == 'malay' or source_language == 'ms':
        source_language = 'ms'
    elif source_language == 'chinese' or source_language == 'zh':
        source_language = 'zh'
        get_pinyin = True
    else:
        raise ValueError(
            f"Unsupported source language: {source_language}")

    
    transcription_result["language"] = source_language

    # translate segments
    for segment in transcription_result['segments']:
        text = segment['text']
        # text = json.dumps(text, ensure_ascii=False)
        print(f"Translating text: {text}")

        payload = {
            "q": text,
            "source": source_language,
            "target": "en"
        }
        headers = {"Content-Type": "application/json"}

        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 200:
            raise Exception(f"Translation failed: {response.text}")

        segment['translated_text'] = response.json()['translatedText']
        print(f"Translated text: {segment['translated_text']}")

        if get_pinyin:
                pinyin_text = pinyin(text, style='normal')
                segment["pinyin"] = ' '.join(
                    [word[0] for word in pinyin_text])

    return transcription_result


@app.post("/process")
async def start_processing(request: JobRequest) -> JobStatus:
    job_id = request.job_id
    active_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "current_step": "download",
        "result": None
    }

    # Run pipeline in background
    asyncio.create_task(run_pipeline(job_id, request.url, request.is_local))
    # asyncio.create_task(run_dummy_pipeline(job_id, request.url))

    return JobStatus(
        job_id=job_id,
        **active_jobs[job_id]
    )


async def run_pipeline(job_id: str, url: str, is_local: bool = False):
    try:
        overall_start = time.time()

        # 0. Check for existing captions first — if the video already has a
        # manually-uploaded Chinese subtitle track, reuse it and skip both
        # the download and transcription steps entirely.
        used_existing_captions = False
        existing_track = None
        if not is_local:
            print("\n--- Step 0: Checking for existing captions ---")
            active_jobs[job_id].update({
                "progress": 10,
                "current_step": "captions_check"
            })
            try:
                existing_track = await asyncio.to_thread(find_existing_captions, url)
            except Exception as e:
                print(f"Caption lookup failed, falling back to download + transcribe: {e}")
                existing_track = None

        if existing_track:
            print(f"USED EXISTING CC instead of downloading + transcribing — "
                  f"lang={existing_track['lang']}, url={url}")
            step_start = time.time()
            active_jobs[job_id].update({
                "progress": 50,
                "current_step": "captions"
            })
            transcription = await asyncio.to_thread(download_and_parse_captions, existing_track)
            download_time = 0.0
            transcribe_time = time.time() - step_start
            num_segments = len(transcription.get('segments', []))
            used_existing_captions = True
            print(f"Reused existing captions in {transcribe_time:.2f}s (Found {num_segments} segments)")
        else:
            # 1. Download (25%)
            print("\n--- Step 1: Downloading Video ---")
            step_start = time.time()
            active_jobs[job_id].update({
                "progress": 25,
                "current_step": "download"
            })

            if is_local:
                file_path = url
                download_time = 0
            else:
                file_path = await asyncio.to_thread(download_video, url, job_id)
                download_time = time.time() - step_start
            print(f"Download completed in {download_time:.2f}s")

            # 2. Transcribe (50%)
            print("\n--- Step 2: Transcribing Audio ---")
            step_start = time.time()
            active_jobs[job_id].update({
                "progress": 50,
                "current_step": "transcribe"
            })
            transcription = await asyncio.to_thread(api_transcribe, file_path)
            transcribe_time = time.time() - step_start
            num_segments = len(transcription.get('segments', []))
            print(f"Transcription completed in {transcribe_time:.2f}s (Found {num_segments} segments)")

        # 3. Translate (75%)
        print("\n--- Step 3: Translating Segments ---")
        step_start = time.time()
        active_jobs[job_id].update({
            "progress": 75,
            "current_step": "translate"
        })
        translation = await asyncio.to_thread(api_translate, transcription)
        translate_time = time.time() - step_start
        print(f"Translation completed in {translate_time:.2f}s")

        # 4. Post-process (100%)
        print("\n--- Step 4: Post-processing ---")
        step_start = time.time()
        end_result = await asyncio.to_thread(api_postprocess, translation)
        postprocess_time = time.time() - step_start
        print(f"Post-processing completed in {postprocess_time:.2f}s")

        total_duration = time.time() - overall_start

        print("\n" + "="*50)
        print(f"DETAILED TIME LOGGING FOR JOB: {job_id}")
        if used_existing_captions:
            print(f"Used existing CC instead of download + transcribe (lang={existing_track['lang']})")
        print(f"1. Download:      {download_time:>8.2f}s")
        print(f"2. Transcribe:    {transcribe_time:>8.2f}s")
        print(f"3. Translate:     {translate_time:>8.2f}s")
        print(f"4. Post-process:  {postprocess_time:>8.2f}s")
        print("-" * 50)
        print(f"TOTAL DURATION:   {total_duration:>8.2f}s")
        print("="*50 + "\n")

        end_result["used_existing_captions"] = used_existing_captions

        # Success
        active_jobs[job_id].update({
            "status": "completed",
            "result": end_result,
            "progress": 100,
        })

    except Exception as e:
        active_jobs[job_id].update({
            "status": "failed",
            "result": {"error": str(e)}
        })
        print(f"Job {job_id} failed: {e}")
        print("Active jobs:", active_jobs)


async def run_dummy_pipeline(job_id: str, url: str):
    try:
        # Simulate download
        active_jobs[job_id].update({
            "progress": 25,
            "current_step": "download"
        })
        await asyncio.sleep(2)
        # Simulate transcription
        active_jobs[job_id].update({
            "progress": 50,
            "current_step": "transcribe"
        })
        await asyncio.sleep(2)
        # Simulate translation
        active_jobs[job_id].update({
            "progress": 75,
            "current_step": "translate"
        })
        await asyncio.sleep(2)

        josn_data = os.path.join(os.path.dirname(__file__), 'pinyin_result.json')
        with open(josn_data, "r") as f:
            response = json.load(f)

        # Success
        active_jobs[job_id].update({
            "status": "completed",
            "result": response,
            "progress": 100,
        })

    except Exception as e:
        active_jobs[job_id].update({
            "status": "failed",
            "result": {"error": str(e)}
        })
        print(f"Job {job_id} failed: {e}")
        print("Active jobs:", active_jobs)


@app.get("/status/{job_id}")
async def get_status(job_id: str) -> JobStatus:
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatus(job_id=job_id, **active_jobs[job_id])


@app.get("/dictionary/{word}")
async def fetch_dictionary_definition(word: str):
    try:
        from pycccedict.cccedict import CcCedict
        cccedict = getattr(getattr(__import__("threading"), "local")(), "cccedict", None)
        if not cccedict:
            cccedict = CcCedict()
        
        entry = cccedict.get_entry(word)
        if entry:
            return {"word": word, "definitions": entry.get('definitions', []), "pinyin": entry.get('pinyin', '')}
        return {"word": word, "definitions": [], "pinyin": ''}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/translate-text")
async def translate_text(text: str, source: str = "zh", target: str = "en"):
    """Ad-hoc single-string translation (e.g. video titles in the library
    view), as opposed to api_translate() above which translates every
    segment of a transcription during video processing. Same libretranslate
    backend, just a thin passthrough for one string at a time."""
    url = os.getenv("TRANSLATION_API_URL", "http://127.0.0.1:5000/translate")
    try:
        response = requests.post(
            url,
            json={"q": text, "source": source, "target": target},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Translation service unreachable: {e}")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Translation failed: {response.text}")
    return {"translatedText": response.json().get("translatedText", text)}

## Which TTS backend /tts proxies to. Switch with the TTS_BACKEND env var:
##   "edge"      (default) -> edge-tts service (openai-edge-tts, cloud-backed,
##                no GPU, fast, reliable even for single-character words)
##   "cosyvoice" -> tts-service (self-hosted Fun-CosyVoice3-0.5B-2512, GPU,
##                needs the tts-service container running)
## Both code paths stay implemented side by side so flipping back is just an
## env var change (and starting/stopping the relevant docker compose
## service), with no code changes needed either way.
TTS_BACKEND = os.getenv("TTS_BACKEND", "edge")


def _sniff_audio_content_type(audio_bytes: bytes) -> str:
    """openai-edge-tts (without the -ffmpeg image variant) can't actually
    convert formats — it ignores response_format and always returns mp3,
    but still lies and sends `Content-Type: audio/wav` on the response.
    Sniffing the real container from its magic bytes is the only reliable
    way to tell the client what it's actually getting."""
    if audio_bytes[:4] == b"RIFF":
        return "audio/wav"
    if audio_bytes[:3] == b"ID3" or audio_bytes[:2] == b"\xff\xfb" or audio_bytes[:2] == b"\xff\xf3":
        return "audio/mpeg"
    return "audio/mpeg"


def _synthesize_edge_tts(text: str, voice: Optional[str]) -> tuple[bytes, str]:
    """Calls openai-edge-tts (github.com/travisvn/openai-edge-tts), an
    OpenAI-compatible /v1/audio/speech wrapper around Microsoft Edge's cloud
    TTS. It returns a fully-formed audio file directly — no PCM-wrapping or
    short-text retry dance needed, unlike the self-hosted CosyVoice path."""
    url = os.getenv("EDGE_TTS_API_URL", "http://edge-tts:5050")
    api_key = os.getenv("EDGE_TTS_API_KEY", "")
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    try:
        response = requests.post(
            f"{url}/v1/audio/speech",
            json={
                "model": "tts-1",
                "input": text,
                "voice": voice or os.getenv("EDGE_TTS_VOICE", "zh-CN-XiaoxiaoNeural"),
                "response_format": "wav",
            },
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"TTS service unreachable: {e}")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {response.text}")
    return response.content, _sniff_audio_content_type(response.content)


## Fun-CosyVoice3-0.5B-2512 is the base checkpoint and ships no SFT preset
## speakers (no spk2info.pt) — only zero-shot voice cloning works, using a
## short reference clip + its transcript. CosyVoice's own repo ships exactly
## such a clip for demos, baked into the tts-service image at this path.
TTS_PROMPT_WAV = os.path.join(os.path.dirname(__file__), "assets", "tts_prompt.wav")
## CosyVoice3's LLM asserts that the combined prompt_text+text token sequence
## contains the special <|endofprompt|> token (id 151646) — without it,
## inference fails with "<|endofprompt|> not detected in CosyVoice3 text or
## prompt_text, check your input!" (cosyvoice/llm/llm.py).
TTS_PROMPT_TEXT = "希望你以后能够做的比我还好呦。<|endofprompt|>"


def _call_tts_service(url: str, text: str) -> bytes:
    with open(TTS_PROMPT_WAV, "rb") as prompt_file:
        response = requests.post(
            f"{url}/inference_zero_shot",
            data={"tts_text": text, "prompt_text": TTS_PROMPT_TEXT},
            files={"prompt_wav": ("prompt.wav", prompt_file, "audio/wav")},
            timeout=30,
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {response.text}")
    return response.content


def _synthesize_cosyvoice(text: str) -> bytes:
    """Proxies to the CosyVoice FastAPI server (tts-service). The official
    server streams raw 16-bit PCM with no container, so we wrap it into a
    real .wav here before handing it back to backend-node.

    CosyVoice3's LLM uses top-k sampling, and for very short text (1-2
    characters) against our long fixed reference prompt, the combined
    prompt+text length pushes its token-ratio bounds into a range where an
    early stop (near-empty output) is the dominant outcome rather than a rare
    fluke — request still comes back 200 with a "valid" but near-silent wav.
    There's no sampling knob exposed through the official server, so we lean
    on retrying more times for short inputs, since it's not 100%
    deterministic, just heavily skewed toward failing."""
    url = os.getenv("TTS_API_URL", "http://tts-service:50000")
    sample_rate = 22050

    # Below ~3 characters, this checkpoint's zero-shot sampling lands in a
    # degenerate near-empty-output regime far more often than not (confirmed
    # empirically — even 20 retries sometimes all fail for a single
    # character), because the combined prompt+text length is too short
    # relative to our long fixed reference prompt. Doubling the text reliably
    # escapes that regime (matches durations seen for genuine 2-char words),
    # so we synthesize "XX" instead of "X" and keep only the first half of
    # the resulting audio.
    is_short = len(text) <= 2
    synth_text = text * 2 if is_short else text
    min_seconds = max(0.25, 0.18 * len(synth_text))
    max_attempts = 8 if is_short else 3

    pcm = b""
    last_error = None
    for attempt in range(max_attempts):
        try:
            pcm = _call_tts_service(url, synth_text)
            last_error = None
        except (requests.RequestException, OSError) as e:
            # A model crash from too-few-generated-tokens (the same failure
            # mode as the near-silent-audio case below) surfaces here as a
            # ChunkedEncodingError mid-stream rather than a clean error
            # response — retry it like any other bad generation instead of
            # failing the whole request on the first bad attempt.
            last_error = e
            pcm = b""
            continue

        duration = len(pcm) / 2 / sample_rate
        if duration >= min_seconds:
            break

    if last_error is not None:
        raise HTTPException(status_code=503, detail=f"TTS service unreachable: {last_error}")

    if is_short and pcm:
        half = (len(pcm) // 2) // 2 * 2  # first half, rounded to a whole 16-bit sample
        pcm = pcm[:half]

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)

    return buf.getvalue()


@app.get("/tts")
async def synthesize_speech(text: str, voice: Optional[str] = None):
    """Proxies to whichever TTS backend TTS_BACKEND selects (see above)."""
    if TTS_BACKEND == "cosyvoice":
        audio_bytes, content_type = _synthesize_cosyvoice(text), "audio/wav"
    else:
        audio_bytes, content_type = _synthesize_edge_tts(text, voice)

    return Response(content=audio_bytes, media_type=content_type)


@app.post("/quiz/generate", response_model=List[Dict[str, Any]], tags=["Quiz System Engine"])
async def generate_quiz_payload(payload: QuizGenerateRequest):
    """
    Transforms plain vocabulary arrays into randomized multiple-choice, 
    fill-in-the-blank, or short-answer prompt blocks using linguistic heuristics.
    """
    try:
        items_dict = [item.model_dump() for item in payload.vocab_items]
        generated_questions = quiz_generator.generate_quiz(
            vocab_items=items_dict,
            count=payload.count,
            allowed_types=payload.allowed_types
        )
        return generated_questions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz collection safely: {str(e)}"
        )

@app.post("/quiz/evaluate", tags=["Quiz System Engine"])
async def evaluate_short_answer_response(payload: ShortAnswerEvaluateRequest):
    """
    Evaluates dynamic open-ended user responses by calculating text semantic similarity 
    against baseline configurations via multilingual Sentence-BERT embeddings.
    """
    try:
        evaluation_report = quiz_judge.evaluate_short_answer(
            correct_reference=payload.correct_reference,
            user_response=payload.user_response
        )
        return evaluation_report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic short-answer text evaluation failed: {str(e)}"
        )


# Add CORS middleware if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:4555"), os.getenv("NODE_URL", "http://localhost:4556")],
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    try:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=4557)
        print("Server started successfully")
    except Exception as e:
        print(f"Failed to start server: {e}")
        exit(1)
    finally:
        print("Server stopped and resources cleaned up.")