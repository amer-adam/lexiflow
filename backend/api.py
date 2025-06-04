from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
import subprocess
import json
import os
from pathlib import Path
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
import asyncio

from time import sleep

from transcribe import api_transcribe
from translate import api_translate
from src.download import download_url, uri_validator, get_duration

app = FastAPI()

active_jobs = {}  # Format: {job_id: {"status": ..., "result": ...}}

# Models


class JobRequest(BaseModel):
    url: str
    job_id: Optional[str] = None


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
    # asyncio.create_task(run_pipeline(job_id, request.url))
    asyncio.create_task(run_dummy_pipeline(job_id, request.url))

    return JobStatus(
        job_id=job_id,
        **active_jobs[job_id]
    )


async def run_pipeline(job_id: str, url: str):
    try:
        # 1. Download (33%)
        active_jobs[job_id].update({
            "progress": 25,
            "current_step": "download"
        })
        file_path = await asyncio.to_thread(download_video, url, job_id)

        # 2. Transcribe (66%)
        active_jobs[job_id].update({
            "progress": 50,
            "current_step": "transcribe"
        })
        transcription = await asyncio.to_thread(api_transcribe, file_path)

        # 3. Translate (100%)
        active_jobs[job_id].update({
            "progress": 75,
            "current_step": "translate"
        })
        translation = await asyncio.to_thread(api_translate, transcription)

        # Success
        active_jobs[job_id].update({
            "status": "completed",
            "result": translation,
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
        await asyncio.sleep(10)
        # Simulate transcription
        active_jobs[job_id].update({
            "progress": 50,
            "current_step": "transcribe"
        })
        await asyncio.sleep(10)
        # Simulate translation
        active_jobs[job_id].update({
            "progress": 75,
            "current_step": "translate"
        })
        await asyncio.sleep(10)

        josn_data = '/home/amer/lexiflow/backend/translated_result.json'
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


# Add CORS middleware if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4556"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4557)
