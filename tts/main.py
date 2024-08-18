import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from tortoise.api import TextToSpeech
import io
import soundfile as sf
import torch
from pydantic import BaseModel
import redis
import hashlib
import time

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Redis client
redis_client = redis.Redis(host='localhost', port=6379, db=0)
device = "cuda" if torch.cuda.is_available() else "cpu"
# Initialize Tortoise-TTS
tts = TextToSpeech(use_deepspeed=torch.cuda.is_available(), kv_cache=True, half=True, device=device)
print(f"Using device: {device}")

class TTSRequest(BaseModel):
    text: str

def get_cache_key(text: str) -> str:
    """Generate a cache key based on the input text."""
    return f"tts:{hashlib.md5(text.encode()).hexdigest()}"

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    start_time = time.time()
    try:
        if redis_client:
            cache_key = get_cache_key(request.text)
            try:
                # Try to get the audio data from cache
                cached_audio = redis_client.get(cache_key)
                if cached_audio:
                    print(f"Cache hit. Returning cached audio data. Time taken: {time.time() - start_time:.2f} seconds")
                    return Response(content=cached_audio, media_type="audio/wav")
            except redis.RedisError as e:
                print(f"Redis error: {str(e)}. Proceeding without caching.")
        
        print(f"Generating audio for text: {request.text[:50]}...")
        
        # Generate audio from text
        gen_start_time = time.time()
        gen = tts.tts_with_preset(request.text, preset="ultra_fast")
        gen_time = time.time() - gen_start_time
        print(f"Audio generation completed. Time taken: {gen_time:.2f} seconds")
        # Convert the generated audio to bytes
        conv_start_time = time.time()
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, gen.squeeze().cpu().numpy(), 24000, format='WAV', subtype='PCM_16')
        audio_data = audio_buffer.getvalue()
        conv_time = time.time() - conv_start_time
        print(f"Audio conversion completed. Time taken: {conv_time:.2f} seconds")
        
        
        # audio_file_path = './sample_denoised.wav'  # Replace with your actual file path

        # # Start the timing as if the audio generation just happened
        # gen_start_time = time.time()
        # audio_data, sample_rate = sf.read(audio_file_path)
        # gen_time = time.time() - gen_start_time
        # print(f"Audio generation (simulated) completed. Time taken: {gen_time:.2f} seconds")

        # # Convert the loaded audio to a BytesIO buffer
        # conv_start_time = time.time()
        # audio_buffer = io.BytesIO()
        # sf.write(audio_buffer, audio_data, sample_rate, format='WAV', subtype='PCM_16')
        # audio_data_bytes = audio_buffer.getvalue()  # Convert the buffer to bytes
        # conv_time = time.time() - conv_start_time
        # print(f"Audio conversion completed. Time taken: {conv_time:.2f} seconds")

        if redis_client:
            try:
                # Cache the generated audio data
                redis_client.set(cache_key, audio_data, ex=3600)  # Cache for 1 hour
                print("Audio data cached successfully")
            except redis.RedisError as e:
                print(f"Failed to cache audio data: {str(e)}")

        total_time = time.time() - start_time
        print(f"TTS generation successful. Total time taken: {total_time:.2f} seconds")
        # Return the audio data as a response
        return Response(content=audio_data, media_type="audio/wav")
    except Exception as e:
        print(f"Error in TTS processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process TTS request: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
