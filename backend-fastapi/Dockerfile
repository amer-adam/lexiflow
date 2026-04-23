FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    build-essential \
    pkg-config \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    libavdevice-dev \
    libswresample-dev \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install core build dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools==69.5.1 wheel numpy==2.1.3 torch==2.7.0

# Copy requirements
COPY requirements.txt .

# Install dependencies using the pre-installed core packages
# Using --no-build-isolation for whisper and others that have pkg_resources issues
RUN pip install --no-cache-dir -r requirements.txt --no-build-isolation

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 4557

# Command to run the application
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "4557"]
