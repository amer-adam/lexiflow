# Patched copy of CosyVoice's runtime/python/fastapi/server.py.
#
# The upstream version pre-loads prompt_wav into a single tensor via
# load_wav() and passes that tensor through to cosyvoice.inference_*(). But
# frontend_zero_shot()/frontend_cross_lingual() (cosyvoice/cli/frontend.py)
# call load_wav() on that same value themselves, multiple times, at
# different sample rates (16kHz for speaker embedding/speech tokens, 24kHz
# for speech features) — they expect a re-openable file, not an
# already-consumed tensor. Passing a tensor breaks on the second internal
# load_wav() call ("Invalid file: tensor(...)").
#
# Fix: write the upload to a temp file and pass its path through instead, so
# the frontend's internal load_wav() calls can each open it fresh.
import os
import sys
import argparse
import logging
import tempfile
logging.getLogger('matplotlib').setLevel(logging.WARNING)
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append('{}/../../..'.format(ROOT_DIR))
sys.path.append('{}/../../../third_party/Matcha-TTS'.format(ROOT_DIR))
from cosyvoice.cli.cosyvoice import AutoModel

app = FastAPI()
# set cross region allowance
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])


def generate_data(model_output, cleanup_path=None):
    try:
        for i in model_output:
            tts_audio = (i['tts_speech'].numpy() * (2 ** 15)).astype(np.int16).tobytes()
            yield tts_audio
    finally:
        if cleanup_path is not None:
            try:
                os.remove(cleanup_path)
            except OSError:
                pass


async def _save_prompt_wav(prompt_wav: UploadFile) -> str:
    fd, path = tempfile.mkstemp(suffix=".wav")
    with os.fdopen(fd, "wb") as f:
        f.write(await prompt_wav.read())
    return path


@app.get("/inference_sft")
@app.post("/inference_sft")
async def inference_sft(tts_text: str = Form(), spk_id: str = Form()):
    model_output = cosyvoice.inference_sft(tts_text, spk_id)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_zero_shot")
@app.post("/inference_zero_shot")
async def inference_zero_shot(tts_text: str = Form(), prompt_text: str = Form(), prompt_wav: UploadFile = File()):
    path = await _save_prompt_wav(prompt_wav)
    model_output = cosyvoice.inference_zero_shot(tts_text, prompt_text, path)
    return StreamingResponse(generate_data(model_output, cleanup_path=path))


@app.get("/inference_cross_lingual")
@app.post("/inference_cross_lingual")
async def inference_cross_lingual(tts_text: str = Form(), prompt_wav: UploadFile = File()):
    path = await _save_prompt_wav(prompt_wav)
    model_output = cosyvoice.inference_cross_lingual(tts_text, path)
    return StreamingResponse(generate_data(model_output, cleanup_path=path))


@app.get("/inference_instruct")
@app.post("/inference_instruct")
async def inference_instruct(tts_text: str = Form(), spk_id: str = Form(), instruct_text: str = Form()):
    model_output = cosyvoice.inference_instruct(tts_text, spk_id, instruct_text)
    return StreamingResponse(generate_data(model_output))


@app.get("/inference_instruct2")
@app.post("/inference_instruct2")
async def inference_instruct2(tts_text: str = Form(), instruct_text: str = Form(), prompt_wav: UploadFile = File()):
    path = await _save_prompt_wav(prompt_wav)
    model_output = cosyvoice.inference_instruct2(tts_text, instruct_text, path)
    return StreamingResponse(generate_data(model_output, cleanup_path=path))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',
                        type=int,
                        default=50000)
    parser.add_argument('--model_dir',
                        type=str,
                        default='iic/CosyVoice2-0.5B',
                        help='local path or modelscope repo id')
    args = parser.parse_args()
    cosyvoice = AutoModel(model_dir=args.model_dir)
    uvicorn.run(app, host="0.0.0.0", port=args.port)
