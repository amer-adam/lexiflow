# Build stage
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    pkg-config \
    libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone https://github.com/ggerganov/whisper.cpp.git .

# Build whisper.cpp statically
RUN mkdir build && cd build && \
    cmake .. -DWHISPER_CURL=ON -DWHISPER_BUILD_EXAMPLES=ON -DBUILD_SHARED_LIBS=OFF && \
    make -j$(nproc)

# Download the models
RUN bash ./models/download-ggml-model.sh large-v3-turbo
RUN bash ./models/download-vad-model.sh silero-v6.2.0

# Final stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libcurl4 \
    ca-certificates \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/build/bin/whisper-server /app/whisper-server
COPY --from=builder /app/models/ggml-large-v3-turbo.bin /app/models/model.bin
COPY --from=builder /app/models/ggml-silero-v6.2.0.bin /app/models/vad-model.bin

EXPOSE 8080

ENTRYPOINT ["/app/whisper-server"]
CMD ["-m", "/app/models/model.bin", \
    "--host", "0.0.0.0", \
    "--port", "8080", \
    "-t", "12", \
    "--vad", \
    "--vad-model", "/app/models/vad-model.bin", \
    "--vad-threshold", "0.3", \
    "--vad-min-speech-duration-ms", "500", \
    "--vad-min-silence-duration-ms", "500", \
    "--vad-max-speech-duration-s", "5", \
    "--vad-speech-pad-ms", "1000"]