# tts-service

Fun-CosyVoice3-0.5B-2512, served by CosyVoice's own official FastAPI server
(`runtime/python/fastapi/server.py` in the
[FunAudioLLM/CosyVoice](https://github.com/FunAudioLLM/CosyVoice) repo) — no
Triton, no TensorRT-LLM, no custom inference code. It's an off-the-shelf
container, exactly like `libretranslate` in the root `docker-compose.yml`:

```
frontend → backend-node → backend-fastapi → tts-service
```

`backend-node` never calls this service directly. `backend-fastapi` proxies
to it via `GET /tts?text=...&voice=...` (see `api.py`'s `synthesize_speech`),
the same way it proxies to libretranslate for translation. That keeps a
single, consistent "backend-fastapi talks to all the off-the-shelf model
servers" pattern, and `backend-node` only ever has one upstream
(`PYTHON_API`) to worry about.

## Why not Triton + TensorRT-LLM

TensorRT-LLM engine builds are GPU-architecture- and driver-specific, and the
export step needs a GPU available at build time — that doesn't work in a
portable Docker image, and the model here is only synthesizing short
words/phrases (not long-form narration), so the latency win from
TensorRT-LLM isn't worth running a second, heavier server process (Triton)
that has its own model-repository format and ports. Plain PyTorch inference
via the official FastAPI server is good enough and far simpler to operate.

## How it's built

See `Dockerfile` — it clones the CosyVoice repo and installs its
`requirements.txt` at build time, but does **not** download the model at
build time (that would make the image 10+ GB and need network/GPU during
`docker build`). Instead `entrypoint.sh` downloads
`FunAudioLLM/Fun-CosyVoice3-0.5B-2512` from ModelScope into a volume-backed
directory (`tts-models` volume, mounted at `/opt/models`) on first container
start, so it's cached across rebuilds/restarts.

## GPU sharing

`tts-service` and `backend-fastapi` (faster-whisper/ctranslate2) both
reserve the host GPU via Compose's `deploy.resources.reservations.devices`.
On a single-GPU box (e.g. one RTX 3070 Ti) they'll queue on the same CUDA
context if a transcription job and a TTS request land at the same time —
that's expected and fine for this workload; nothing here assumes dedicated
GPU access.

## Verifying it directly

```bash
docker compose up -d tts-service
curl "http://localhost:4558/inference_sft?tts_text=你好&spk_id=中文女" --output test.pcm
```

Normally you don't call this directly — exercise it through
`backend-fastapi`'s `/tts` route instead:

```bash
curl "http://localhost:4557/tts?text=你好" --output test.wav
```
