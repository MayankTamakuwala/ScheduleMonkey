from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from tortoise.api import TextToSpeech
import io
import soundfile as sf
import torch
from tortoise.api import TextToSpeech
from tortoise.utils.audio import load_audio
import torchaudio

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Tortoise-TTS
tts = TextToSpeech(use_deepspeed=True, kv_cache=True, half=True)

@app.websocket("/ws_tts")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    buffer = []
    try:
        while True:
            data = await websocket.receive_text()
            if data == "[END]":
                # Process the complete text
                full_text = "".join(buffer)
                gen = tts.tts_with_preset(full_text, preset="ultra_fast")

                # Convert the generated audio to bytes
                audio_buffer = io.BytesIO()
                sf.write(audio_buffer, gen.squeeze().cpu().numpy(), 24000, format='WAV', subtype='PCM_16')
                audio_data = audio_buffer.getvalue()

                # Send the audio data back
                await websocket.send_bytes(audio_data)
                buffer = []  # Reset buffer for next stream
            else:
                buffer.append(data)
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"Error in WebSocket: {str(e)}")
    finally:
        print("WebSocket connection closed")
