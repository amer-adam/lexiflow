from transcribe import api_transcribe

if __name__ == '__main__':
    # This prevents child processes from re-running the transcription logic
    print(api_transcribe("/home/amer/lexiflow/backend/temp/How to say Happy New Year in Chinese [X-fwsUcvs6U].webm"))