from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware import Middleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import sys
import asyncio
import logging
from translate import api_translate
import json
from uuid import uuid4
from enum import Enum
from typing import Optional, Dict
from pydantic import BaseModel
from time import perf_counter

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(middleware=[Middleware(HTTPSRedirectMiddleware)])
app.state.limiter = limiter

# Configure CORS
allowed_origins = [
    "https://lexiflow.amerai.top",  # production domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class JobRequest(BaseModel):
    url: str


class Job:
    def __init__(self, url: str):
        self.id = str(uuid4())
        self.url = url
        self.status = JobStatus.PENDING
        self.result: Optional[Dict] = None
        self.error: Optional[str] = None


class DualOutput:
    def __init__(self, original, web_stream):
        self.original = original
        self.web_stream = web_stream

    def write(self, message):
        self.original.write(message)
        self.web_stream.write(message)

    def flush(self):
        self.original.flush()

    def isatty(self):
        return self.original.isatty()

    def fileno(self):
        return self.original.fileno()

    def close(self):
        self.original.close()

    # Add any other methods your environment might need
    def __getattr__(self, name):
        return getattr(self.original, name)


class WebStream:
    def __init__(self):
        self.listeners = []

    def write(self, message):
        if message.strip():  # Don't send empty messages
            for queue in self.listeners:
                try:
                    queue.put_nowait(message)
                except asyncio.QueueFull:
                    pass  # Handle queue full situation

    def add_listener(self):
        queue = asyncio.Queue(maxsize=100)  # Prevent memory issues
        self.listeners.append(queue)
        return queue


web_stream = WebStream()

# Backup original stdout/stderr
original_stdout = sys.stdout
original_stderr = sys.stderr

# Setup dual output
sys.stdout = DualOutput(original_stdout, web_stream)
sys.stderr = DualOutput(original_stderr, web_stream)

# Configure logging carefully
logger = logging.getLogger()
logger.handlers.clear()  # Remove existing handlers

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Global state for job management
current_job: Optional[Job] = None
job_history: Dict[str, Job] = {}


@app.get("/lexiflow/data/logs")
async def stream_logs(request: Request):
    async def event_stream():
        queue = web_stream.add_listener()
        try:
            while True:
                message = await queue.get()
                yield f"data: {message}\n\n"
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            web_stream.listeners.remove(queue)
        except Exception as e:
            logging.error(f"Stream error: {e}")

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# Replace the existing get_data endpoint with these new endpoints
@app.post("/lexiflow/data/jobs")
@limiter.limit("5/minute")
async def create_job(request: Request, job_request: JobRequest):
    global current_job

    if current_job is not None and current_job.status not in [JobStatus.COMPLETED, JobStatus.FAILED]:
        raise HTTPException(
            status_code=409, detail="Another job is already in progress")

    job = Job(job_request.url)
    current_job = job
    job_history[job.id] = job

    # Start processing the job
    asyncio.create_task(process_job(job))

    return {"job_id": job.id}


async def process_job(job: Job):
    try:
        job.status = JobStatus.PROCESSING
        start_time = perf_counter()
        job.result = await asyncio.to_thread(api_translate, job.url)
        end_time = perf_counter()
        logging.info(f"Job completed in {end_time - start_time:.2f} seconds")
        job.status = JobStatus.COMPLETED
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)


@app.get("/lexiflow/data/jobs/{job_id}")
async def get_job_status(job_id: str):
    job = job_history.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "status": job.status,
        "error": job.error,
        "result_available": job.status == JobStatus.COMPLETED
    }


@app.get("/lexiflow/data/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    job = job_history.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job not completed yet")

    return job.result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4556)
