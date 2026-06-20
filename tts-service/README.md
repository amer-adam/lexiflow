# tts-service (CosyVoice backend, opt-in)

There are two interchangeable TTS backends, switched via `TTS_BACKEND` on
`backend-fastapi` (see `backend-fastapi/api.py`'s `/tts` route):

| `TTS_BACKEND` | Service           | Notes                                                              |
|----------------|-------------------|---------------------------------------------------------------------|
| `edge` (default) | `edge-tts`     | Cloud-backed (Microsoft Edge TTS via [openai-edge-tts](https://github.com/travisvn/openai-edge-tts)). No GPU, no model download, reliable for any length of text including single characters. Needs outbound internet. |
| `cosyvoice`    | `tts-service`     | Self-hosted Fun-CosyVoice3-0.5B-2512, described below. GPU required, no internet dependency once the model is downloaded, but unreliable for very short text (see caveats below). |

```
frontend → backend-node → backend-fastapi → (edge-tts | tts-service)
```

`backend-node` never calls either TTS service directly. `backend-fastapi`
proxies via `GET /tts?text=...&voice=...`, the same way it proxies to
libretranslate for translation — `backend-node` only ever has one upstream
(`PYTHON_API`) to worry about.

## Switching backends

In `docker-compose.yml`, `backend-fastapi`'s `TTS_BACKEND` env var picks the
code path. `tts-service` (this CosyVoice container) is gated behind the
`cosyvoice` Compose profile so it doesn't start by default:

```bash
# Switch to CosyVoice (self-hosted, GPU):
#   1. Edit docker-compose.yml: TTS_BACKEND=cosyvoice on backend-fastapi
#   2. docker compose up -d --build backend-fastapi
#   3. docker compose --profile cosyvoice up -d tts-service

# Switch back to edge-tts (default, no GPU):
#   1. Edit docker-compose.yml: TTS_BACKEND=edge on backend-fastapi
#   2. docker compose up -d --build backend-fastapi
#   3. docker compose stop tts-service   # optional, frees the GPU
```

No code changes needed either way — both `_synthesize_edge_tts()` and
`_synthesize_cosyvoice()` stay implemented side by side in `api.py`.

## edge-tts caveats

`openai-edge-tts`'s default image tag can't actually convert audio formats
(needs the `-ffmpeg` tag for that) — it ignores `response_format` and always
returns mp3, while still mislabeling the response `Content-Type` as
`audio/wav`. `backend-fastapi` sniffs the real container from the file's
magic bytes rather than trusting that header, and `backend-node` picks the
cache file extension (`.mp3` vs `.wav`) from the real type too, so this is
transparent — just don't assume the cached files are literally wav.

## CosyVoice backend details

Fun-CosyVoice3-0.5B-2512, served by CosyVoice's own official FastAPI server
(`runtime/python/fastapi/server.py` in the
[FunAudioLLM/CosyVoice](https://github.com/FunAudioLLM/CosyVoice) repo) — no
Triton, no TensorRT-LLM, no custom inference code, just a patched copy of
their server (see `server.py` in this directory) baked into the image.

### Why not Triton + TensorRT-LLM

TensorRT-LLM engine builds are GPU-architecture- and driver-specific, and the
export step needs a GPU available at build time — that doesn't work in a
portable Docker image, and the model here is only synthesizing short
words/phrases (not long-form narration), so the latency win from
TensorRT-LLM isn't worth running a second, heavier server process (Triton)
that has its own model-repository format and ports. Plain PyTorch inference
via the official FastAPI server is good enough and far simpler to operate.

### How it's built

See `Dockerfile` — it clones the CosyVoice repo and installs its
`requirements.txt` at build time, but does **not** download the model at
build time (that would make the image 10+ GB and need network/GPU during
`docker build`). Instead `entrypoint.sh` downloads
`FunAudioLLM/Fun-CosyVoice3-0.5B-2512` from Hugging Face into a volume-backed
directory (`tts-models` volume, mounted at `/opt/models`) on first container
start, so it's cached across rebuilds/restarts.

### Known model limitations (why edge-tts is now the default)

This is the *base* (non-SFT) checkpoint, so it ships no preset speakers —
only zero-shot voice cloning works, using a bundled reference clip
(`backend-fastapi/assets/tts_prompt.wav`). For text under ~3 characters
against that fixed reference prompt, CosyVoice3's sampling lands in a
degenerate near-silent-output regime far more often than not; `api.py`'s
`_synthesize_cosyvoice()` works around this by doubling short text and
retrying, but it's still a heavier, less reliable path than edge-tts for
short vocabulary words (which is most of what this app actually synthesizes).

### GPU sharing

`tts-service` and `backend-fastapi` (faster-whisper/ctranslate2) both
reserve the host GPU via Compose's `deploy.resources.reservations.devices`.
On a single-GPU box (e.g. one RTX 3070 Ti) they'll queue on the same CUDA
context if a transcription job and a TTS request land at the same time —
that's expected and fine for this workload; nothing here assumes dedicated
GPU access.

### Verifying it directly

```bash
docker compose --profile cosyvoice up -d tts-service
curl "http://localhost:4558/inference_zero_shot" \
  -F "tts_text=你好" -F "prompt_text=希望你以后能够做的比我还好呦。<|endofprompt|>" \
  -F "prompt_wav=@../backend-fastapi/assets/tts_prompt.wav;type=audio/wav" \
  --output test.pcm
```

Normally you don't call either backend directly — exercise it through
`backend-fastapi`'s `/tts` route instead, which works the same regardless of
which backend is active:

```bash
curl "http://localhost:4557/tts?text=你好" --output test.wav
```
