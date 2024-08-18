import asyncio
from typing import List, Optional, Union
from typing_extensions import Literal
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import pipeline, TextIteratorStreamer
from threading import Thread
import whisper
import redis
import json
import os
import logging
from dotenv import load_dotenv
import numpy as np
import soundfile as sf
import time
import base64
import tempfile
import subprocess
import websockets
import shutil

print("\n--- Starting application ---\n")

# Load environment variables
load_dotenv()
print("\nEnvironment variables loaded\n")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
print("\nLogging configured\n")

app = FastAPI()
print("\nFastAPI app initialized\n")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print("\nCORS middleware added\n")

# Initialize Redis
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0,
    decode_responses=True
)
print("\nRedis client initialized\n")

# Initialize Llama model
print("\nInitializing Llama model...\n")
model_id = "../Meta-Llama-3.1-8B-Instruct"
pipe = pipeline(
    "text-generation",
    model=model_id,
    model_kwargs={"torch_dtype": torch.bfloat16},
    device_map="auto",
)
terminators = [
    pipe.tokenizer.eos_token_id,
    pipe.tokenizer.convert_tokens_to_ids("<|eot_id|>")
]
print("\nLlama model initialized\n")

# Initialize Whisper model
print("\nInitializing Whisper model...\n")
whisper_model = whisper.load_model("base")
print("\nWhisper model initialized\n")

class Message(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str

class Conversation(BaseModel):
    messages: Union[List[Message], List[List[Message]]]
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None

# async def generate_response_stream(prompt: str, max_tokens: int, temperature: float, top_p: float):
#     new_prompt = pipe.tokenizer.apply_chat_template(
#         [
#             {
#                 "role": "system",
#                 "content": "You are a software developer."
#             },{
#                 "role": "user",
#                 "content": prompt
#             }
#         ], tokenize=False, add_generation_prompt=True
#     )
#     print(f"\nGenerating response for prompt: {prompt[:50]}...\n")
    
#     streamer = TextIteratorStreamer(pipe.tokenizer, skip_prompt=True, skip_special_tokens=True)
#     generation_kwargs = dict(
#         text_inputs=new_prompt,
#         max_new_tokens=max_tokens,
#         streamer=streamer,
#         do_sample=True,
#         temperature=temperature,
#         top_p=top_p,
#         eos_token_id=terminators,
#     )

#     thread = Thread(target=pipe, kwargs=generation_kwargs)
#     thread.start()

#     for new_text in streamer:
#         yield new_text

async def stream_to_tts(text: str):
    uri = "ws://localhost:8001/ws_tts"
    try:
        async with websockets.connect(uri) as websocket:
            # Send the text in chunks (you can adjust the chunk size)
            chunk_size = 100
            for i in range(0, len(text), chunk_size):
                chunk = text[i:i+chunk_size]
                await websocket.send(chunk)
            await websocket.send("[END]")
            audio_data = await websocket.recv()
        return audio_data
    except websockets.exceptions.ConnectionClosed:
        print("WebSocket connection to TTS service closed unexpectedly")
        raise Exception("TTS service disconnected")
    except Exception as e:
        print(f"Error in stream_to_tts: {str(e)}")
        raise Exception(f"Failed to communicate with TTS service: {str(e)}")

async def transcribe_audio(audio_data: bytes, mime_type: str) -> str:
    print(f"\nTranscribing audio of type {mime_type}...\n")
    try:
        # Save the incoming audio to a temporary file
        with tempfile.NamedTemporaryFile(suffix=f'.{mime_type.split("/")[1]}', delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name

        print(f"\nSaved incoming audio to temporary file: {temp_audio_path}\n")

        # Convert audio to WAV using ffmpeg
        temp_wav_path = temp_audio_path.replace(f'.{mime_type.split("/")[1]}', '.wav')
        
        # Find ffmpeg executable
        ffmpeg_path = shutil.which('ffmpeg')
        if ffmpeg_path is None:
            # If ffmpeg is not in PATH, try common installation locations
            common_locations = [
                '/usr/bin/ffmpeg',
                '/usr/local/bin/ffmpeg',
                '/opt/homebrew/bin/ffmpeg',  # Common location on M1 Macs
                'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',  # Common location on Windows
            ]
            for location in common_locations:
                if os.path.isfile(location):
                    ffmpeg_path = location
                    break
            
            if ffmpeg_path is None:
                raise Exception("ffmpeg not found. Please install ffmpeg and ensure it's in your system PATH.")

        print(f"Using ffmpeg from: {ffmpeg_path}")
        
        subprocess.run([ffmpeg_path, '-i', temp_audio_path, '-acodec', 'pcm_s16le', '-ar', '16000', temp_wav_path], check=True)

        print(f"\nConverted audio to WAV: {temp_wav_path}\n")

        # Transcribe the audio
        result = whisper_model.transcribe(temp_wav_path)
        print(f"\nTranscription result: {result['text']}\n")
        
        if not result['text']:
            print("\nWARNING: Transcription result is empty\n")
        
        # Clean up temporary files
        os.remove(temp_audio_path)
        os.remove(temp_wav_path)
        
        return result["text"]
    except Exception as e:
        print(f"\nError in transcribe_audio: {str(e)}\n")
        logger.error(f"Error in transcribe_audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print("\nWebSocket connection opened\n")
    await websocket.accept()
    try:
        while True:
            print("\nWaiting for WebSocket data...\n")
            data = await websocket.receive_text()
            audio_data = json.loads(data)
            mime_type = audio_data['mimeType']
            base64_audio = audio_data['data']
            
            print(f"\nReceived audio data with MIME type: {mime_type}\n")
            
            audio_bytes = base64.b64decode(base64_audio)
            print(f"\nDecoded audio data size: {len(audio_bytes)} bytes\n")
            
            # Transcribe audio
            try:
                text = await transcribe_audio(audio_bytes, mime_type)
                print(f"\nTranscribed text: {text}\n")
                
                # Send transcribed text immediately to the frontend
                await websocket.send_json({
                    "type": "transcription",
                    "text": text
                })
                print("\nTranscription sent to frontend\n")
                
                # Process and respond asynchronously
                asyncio.create_task(process_and_respond(websocket, text))
                print("\nAsynchronous task created for processing and responding\n")
                
            except Exception as e:
                print(f"\nError in audio processing: {str(e)}\n")
                logger.error(f"Error in audio processing: {str(e)}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Failed to process audio: {str(e)}"
                })
    except Exception as e:
        print(f"\nWebSocket error: {str(e)}\n")
        logger.error(f"WebSocket error: {str(e)}")
    # finally:
    #     print("\nWebSocket connection closed\n")
        # await websocket.close()

# async def process_and_respond(websocket: WebSocket, text: str):
#     print(f"\nProcessing and responding to: {text}\n")
#     try:
#         # Generate response
#         response_generator = generate_response_stream(text, max_tokens=50, temperature=0.7, top_p=0.7)
        
#         full_response = ""
#         async for chunk in response_generator:
#             full_response += chunk
#             # Optionally, you can send partial responses to the frontend here
#             # await websocket.send_json({"type": "partial_response", "text": chunk})
        
#         print(f"\nGenerated full response: {full_response}\n")
        
#         # Stream response to TTS service and get audio
#         audio_response = await stream_to_tts([full_response])
#         print(f"\nGenerated speech of {len(audio_response)} bytes\n")
        
#         # Send the audio response back to the client
#         await websocket.send_bytes(audio_response)
#         print("\nAudio response sent to frontend\n")
#     except Exception as e:
#         print(f"\nError in response processing: {str(e)}\n")
#         logger.error(f"Error in response processing: {str(e)}")
#         await websocket.send_json({
#             "type": "error",
#             "message": f"Failed to generate response: {str(e)}"
#         })






async def generate_response_stream(prompt: str, max_tokens: int, temperature: float, top_p: float):
    print(f"\nGenerating response for prompt: {prompt[:50]}...\n")
    
    # Hard-coded response for testing
    test_response = "This is a test response. It will be streamed word by word to simulate real-time generation. This should help test the streaming functionality without relying on the language model."
    
    # Split the response into words
    words = test_response.split()
    
    # Stream each word with a small delay
    for word in words:
        yield word + " "
        await asyncio.sleep(0.1)  # Add a small delay between words

async def process_and_respond(websocket: WebSocket, text: str):
    print(f"\nProcessing and responding to: {text}\n")
    try:
        # Generate response
        response_generator = generate_response_stream(text, max_tokens=50, temperature=0.7, top_p=0.7)
        
        full_response = ""
        async for chunk in response_generator:
            full_response += chunk
            print(f"Received chunk: {chunk}")  # Print each chunk for testing
            # Send partial responses to the frontend
            await websocket.send_json({"type": "partial_response", "text": chunk})
        
        print(f"\nGenerated full response: {full_response}\n")
        
        # Stream response to TTS service and get audio
        audio_response = await stream_to_tts(full_response)
        print(f"\nGenerated speech of {len(audio_response)} bytes\n")
        
        # Send the audio response back to the client
        await websocket.send_bytes(audio_response)
        print("\nAudio response sent to frontend\n")
    except Exception as e:
        print(f"\nError in response processing: {str(e)}\n")
        logger.error(f"Error in response processing: {str(e)}")
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to generate response: {str(e)}"
        })





@app.post("/chat/")
async def chat_with_llama(
    conversation: Conversation,
    background_tasks: BackgroundTasks,
    max_tokens: int = 50,
    temperature: float = 0.7,
    top_p: float = 0.9
):
    print(f"\nReceived chat request for user {conversation.user_id}\n")
    if not conversation.messages:
        print("\nNo messages provided in the request\n")
        raise HTTPException(status_code=400, detail="No messages provided")
    
    # Check cache
    cache_key = f"chat:{conversation.user_id}:{conversation.conversation_id}"
    cached_response = redis_client.get(cache_key)
    if cached_response:
        print("\nReturning cached response\n")
        return json.loads(cached_response)
    
    messages = conversation.messages[0] if isinstance(conversation.messages[0], list) else conversation.messages
    prompt = pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    print(f"\nGenerated prompt: {prompt[:50]}...\n")
    
    try:
        response_generator = generate_response_stream(prompt, max_tokens, temperature, top_p)
        response = "".join([chunk for chunk in response_generator])
        assistant_message = Message(role="assistant", content=response.strip())
        result = {
            "message": assistant_message.content,
            "conversation": messages + [assistant_message]
        }
        
        background_tasks.add_task(redis_client.setex, cache_key, 3600, json.dumps(result))
        print("\nResponse cached\n")
        
        return result
    except Exception as e:
        print(f"\nError in chat_with_llama: {str(e)}\n")
        logger.error(f"Error in chat_with_llama: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while processing your request")

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)