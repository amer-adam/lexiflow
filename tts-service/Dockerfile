# Fun-CosyVoice3-0.5B-2512 served by CosyVoice's own official FastAPI server
# (runtime/python/fastapi/server.py) — no Triton, no TensorRT-LLM, no custom
# inference code. Same shape as the libretranslate service: one off-the-shelf
# image, called over plain HTTP by backend-fastapi.
#
# Based on CosyVoice's own official Dockerfile: plain pip (even via the
# pytorch/pytorch base image) fails to build openai-whisper/pynini because
# pynini needs conda-forge, not pip. Conda + conda-forge avoids that.
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ARG VENV_NAME="cosyvoice"
ENV VENV=$VENV_NAME
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
SHELL ["/bin/bash", "--login", "-c"]

RUN apt-get update -y --fix-missing
RUN apt-get install -y git build-essential curl wget ffmpeg unzip git-lfs sox libsox-dev && \
    apt-get clean && \
    git lfs install

RUN wget --quiet https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh -O ~/miniforge.sh && \
    /bin/bash ~/miniforge.sh -b -p /opt/conda && \
    rm ~/miniforge.sh && \
    ln -s /opt/conda/etc/profile.d/conda.sh /etc/profile.d/conda.sh && \
    echo "source /opt/conda/etc/profile.d/conda.sh" >> ~/.bashrc && \
    echo "conda activate ${VENV}" >> ~/.bashrc

ENV PATH=/opt/conda/bin:$PATH

RUN conda config --add channels conda-forge && \
    conda config --set channel_priority strict

RUN conda create -y -n ${VENV} python=3.10
ENV CONDA_DEFAULT_ENV=${VENV}
ENV PATH=/opt/conda/bin:/opt/conda/envs/${VENV}/bin:$PATH

WORKDIR /workspace
ENV PYTHONPATH="${PYTHONPATH}:/workspace/CosyVoice:/workspace/CosyVoice/third_party/Matcha-TTS"

RUN git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git

# Upstream's runtime/python/fastapi/server.py pre-loads prompt_wav into a
# tensor and reuses it across cosyvoice's internal load_wav() calls at
# different sample rates — breaks for zero-shot/cross-lingual/instruct2 on
# this checkpoint. See server.py in this directory for the fix.
COPY server.py /workspace/CosyVoice/runtime/python/fastapi/server.py

RUN conda activate ${VENV} && conda install -y -c conda-forge pynini==2.1.5

# openai-whisper (pinned in requirements.txt) still does `import pkg_resources`
# in its legacy setup.py. pip's build-isolation venv pulls the *latest*
# setuptools regardless of what's in this conda env, and setuptools>=81
# dropped pkg_resources — so pin it globally via PIP_CONSTRAINT, which pip
# also applies inside isolated build environments.
RUN echo "setuptools<81" > /tmp/constraints.txt
ENV PIP_CONSTRAINT=/tmp/constraints.txt
ENV UV_CONSTRAINT=/tmp/constraints.txt
ENV UV_BUILD_CONSTRAINT=/tmp/constraints.txt

# deepspeed otherwise compiles all its CUDA ops at install time (slow); it
# JIT-builds whichever op it actually needs on first use, so skip that here.
ENV DS_BUILD_OPS=0
ENV DS_BUILD_AIO=0

RUN conda activate ${VENV} && pip install --no-cache-dir "setuptools<81" wheel uv
# --system: target the active (conda) interpreter directly instead of uv's
# own venv management, since uv doesn't recognize conda envs as a "venv".
# requirements.txt pins packages (e.g. protobuf) that only resolve by
# combining versions across its multiple --extra-index-url entries; uv's
# default per-index resolution is stricter than pip's about that.
RUN conda activate ${VENV} && cd CosyVoice && \
    uv pip install --system --index-strategy unsafe-best-match --no-cache-dir -r requirements.txt && \
    uv pip install --system --no-cache-dir fastapi uvicorn[standard] "huggingface_hub[hf_xet]"

WORKDIR /workspace/CosyVoice

# Model is downloaded on first container start (see entrypoint.sh) into a
# volume-backed directory instead of at build time, so the image itself
# doesn't need network/GPU during build.
ENV MODEL_DIR=/opt/models/Fun-CosyVoice3-0.5B

COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

EXPOSE 50000
ENTRYPOINT ["/opt/entrypoint.sh"]
