#!/bin/bash
set -e

source /opt/conda/etc/profile.d/conda.sh
conda activate cosyvoice

if [ ! -d "$MODEL_DIR" ] || [ -z "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
  echo "Downloading Fun-CosyVoice3-0.5B-2512 into $MODEL_DIR (first boot only)..."
  python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512', local_dir='$MODEL_DIR')
"
fi

cd /workspace/CosyVoice/runtime/python/fastapi
exec python3 server.py --port 50000 --model_dir "$MODEL_DIR"
