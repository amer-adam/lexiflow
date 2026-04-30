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

# Download dependencies
RUN wget https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-linux-x64-1.16.3.tgz && \
    tar -xzf onnxruntime-linux-x64-1.16.3.tgz

RUN wget https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h
RUN mkdir nlohmann && wget https://github.com/nlohmann/json/releases/download/v3.11.2/json.hpp -O nlohmann/json.hpp

COPY main.cpp .

# Compile
RUN g++ -O3 -std=c++17 main.cpp -o vad-server \
    -I./onnxruntime-linux-x64-1.16.3/include \
    -L./onnxruntime-linux-x64-1.16.3/lib \
    -lonnxruntime \
    -lpthread -ldl

# Final stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary and runtime libs
COPY --from=builder /app/vad-server /app/vad-server
COPY --from=builder /app/onnxruntime-linux-x64-1.16.3/lib/libonnxruntime.so.1.16.3 /usr/lib/libonnxruntime.so.1.16.3
RUN ln -s /usr/lib/libonnxruntime.so.1.16.3 /usr/lib/libonnxruntime.so.1 && \
    ln -s /usr/lib/libonnxruntime.so.1 /usr/lib/libonnxruntime.so

# Download model
RUN mkdir -p models && \
    wget https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx -O models/silero_vad.onnx

EXPOSE 8000

CMD ["./vad-server"]
