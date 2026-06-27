"""
Baseline end-to-end pipeline test - exercises the real /process endpoint
against a real YouTube video, instead of manual click-through testing.

Run from backend-fastapi/ (or anywhere, just point --base-url at the running
service):

    python tests/test_pipeline_baseline.py
    python tests/test_pipeline_baseline.py --base-url http://localhost:4557
    python tests/test_pipeline_baseline.py --url "https://www.youtube.com/watch?v=..."

Exits 0 on success (subtitles/translations were produced and the downloaded
video was cleaned up afterwards), non-zero otherwise.
"""
import argparse
import os
import sys
import time
import uuid

import requests

DEFAULT_URL = "https://www.youtube.com/watch?v=GC907UR2OL4&t=24s"
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp")


def _temp_dir_snapshot() -> set:
    if not os.path.isdir(TEMP_DIR):
        return set()
    return set(os.listdir(TEMP_DIR))


def run_test(base_url: str, video_url: str, poll_interval: float, timeout: float) -> bool:
    job_id = str(uuid.uuid4())

    before_files = _temp_dir_snapshot()

    print(f"--- Submitting job {job_id} for {video_url} ---")
    resp = requests.post(f"{base_url}/process", json={"url": video_url, "job_id": job_id, "is_local": False})
    resp.raise_for_status()
    print(f"Job accepted: {resp.json()}")

    print("--- Polling /status until completed/failed ---")
    deadline = time.time() + timeout
    status = None
    result = None
    while time.time() < deadline:
        resp = requests.get(f"{base_url}/status/{job_id}")
        resp.raise_for_status()
        payload = resp.json()
        status = payload["status"]
        print(f"  status={status} progress={payload.get('progress')} step={payload.get('current_step')}")

        if status in ("completed", "failed"):
            result = payload.get("result")
            break

        time.sleep(poll_interval)
    else:
        print(f"FAIL: job did not finish within {timeout}s (last status={status})")
        return False

    if status != "completed":
        print(f"FAIL: job ended with status={status}, result={result}")
        return False

    # --- Validate the actual subtitle/translation output ---
    segments = (result or {}).get("segments") or []
    if not segments:
        print("FAIL: job completed but produced no segments")
        return False

    missing_translation = [s for s in segments if not s.get("translated_text")]
    if missing_translation:
        print(f"FAIL: {len(missing_translation)}/{len(segments)} segments have no translated_text")
        return False

    print(f"PASS: job completed with {len(segments)} segments, all translated")
    print(f"  sample segment: {segments[0]}")

    # --- Verify cleanup: no new files should remain in temp/ for this job ---
    after_files = _temp_dir_snapshot()
    leftover = after_files - before_files
    if leftover:
        print(f"FAIL: downloaded/converted files were not cleaned up after the job: {leftover}")
        for fname in leftover:
            try:
                os.remove(os.path.join(TEMP_DIR, fname))
                print(f"  (test cleanup) removed leftover file: {fname}")
            except OSError as e:
                print(f"  (test cleanup) failed to remove {fname}: {e}")
        return False

    print("PASS: no leftover video/audio files in temp/ after the job (cleanup confirmed)")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("LEXIFLOW_API_BASE_URL", "http://localhost:4557"))
    parser.add_argument("--url", default=DEFAULT_URL, help="YouTube URL to run the pipeline against")
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--timeout", type=float, default=600.0, help="Max seconds to wait for the job to finish")
    args = parser.parse_args()

    ok = run_test(args.base_url, args.url, args.poll_interval, args.timeout)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
