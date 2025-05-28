# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Copy only the requirements file first to leverage Docker cache
COPY ./backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update && apt-get install -y ffmpeg


# Copy the rest of the application
COPY ./backend /app

# Expose the port the app runs on
EXPOSE 4556

# Command to run the application
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "4556"]