from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
import subprocess
import json
import os
import requests
from pathlib import Path
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
import asyncio

from lingua import Language, LanguageDetectorBuilder
from pypinyin import pinyin


from time import sleep

from transcribe import api_transcribe
from postprocces import api_postprocess
# from translate import Translator
from src.download import download_url, uri_validator, get_duration

app = FastAPI()

active_jobs = {}  # Format: {job_id: {"status": ..., "result": ...}}



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
        return DurationResponse(
            url=url,
            duration_seconds=0,
            success=False,
            error=str(e)
        )


def download_video(url: str, job_id: str) -> str:
    """Download video and return file path"""

    output_dir = "/home/amer/lexiflow/backend/temp"
    if not uri_validator(url):
        raise HTTPException(status_code=400, detail="Invalid URL format")
    file_path = download_url(
        url, maxDuration=-1, destinationDirectory=output_dir, playlistItems=None)
    return file_path[0]

def api_translate(transcription_result):
    url = "http://127.0.0.1:5000/translate"
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
        # 1. Download (33%)
        active_jobs[job_id].update({
            "progress": 25,
            "current_step": "download"
        })
        
        if is_local:
            file_path = url
        else:
            file_path = await asyncio.to_thread(download_video, url, job_id)

        # 2. Transcribe (66%)
        active_jobs[job_id].update({
            "progress": 50,
            "current_step": "transcribe"
        })
        transcription = await asyncio.to_thread(api_transcribe, file_path)

        # 3. Translate (99%)
        active_jobs[job_id].update({
            "progress": 75,
            "current_step": "translate"
        })
        translation = await asyncio.to_thread(api_translate, transcription)

        # 4. Post-process (100%)
        end_result = await asyncio.to_thread(api_postprocess, translation)

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

        josn_data = '/home/amer/lexiflow/backend/pinyin_result.json'
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


# Add CORS middleware if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4556"],
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