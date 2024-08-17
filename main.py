import asyncio
from typing import List, Optional, Union
from typing_extensions import Literal
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import pipeline
import whisper
from TTS.api import TTS
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
model_id = "./Meta-Llama-3.1-8B-Instruct"
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

# Initialize TTS model
print("\nInitializing TTS model...\n")
tts = TTS("tts_models/en/ljspeech/tacotron2-DDC")
print("\nTTS model initialized\n")

class Message(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str

class Conversation(BaseModel):
    messages: Union[List[Message], List[List[Message]]]
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None

async def generate_response(prompt: str, max_tokens: int, temperature: float, top_p: float) -> str:
    print(f"\nGenerating response for prompt: {prompt[:50]}...\n")
    outputs = pipe(
        prompt,
        max_new_tokens=max_tokens,
        eos_token_id=terminators,
        do_sample=True,
        temperature=temperature,
        top_p=top_p,
    )
    response = outputs[0]["generated_text"][len(prompt):]
    print(f"\nGenerated response: {response[:50]}...\n")
    return response

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
        subprocess.run(['ffmpeg', '-i', temp_audio_path, '-acodec', 'pcm_s16le', '-ar', '16000', temp_wav_path], check=True)

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

async def generate_speech(text: str) -> bytes:
    print(f"\nGenerating speech for text: {text[:50]}...\n")
    try:
        # Generate speech
        wav = tts.tts(text=text)
        sf.write("temp_speech.wav", wav, 22050, format='WAV', subtype='PCM_16')
        print("\nTemporary speech file saved\n")
        
        # Read the generated audio file
        with open("temp_speech.wav", "rb") as f:
            audio_data = f.read()
        
        # Remove the temporary file
        os.remove("temp_speech.wav")
        print("\nTemporary speech file removed\n")
        
        return audio_data
    except Exception as e:
        print(f"\nError in generate_speech: {str(e)}\n")
        logger.error(f"Error in generate_speech: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate speech")

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
            
            # Decode base64 data
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
                
                # Start background tasks for response generation and speech synthesis
                background_tasks = BackgroundTasks()
                background_tasks.add_task(process_and_respond, websocket, text)
                print("\nBackground tasks added\n")
                
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
    finally:
        print("\nWebSocket connection closed\n")
        await websocket.close()

async def process_and_respond(websocket: WebSocket, text: str):
    print(f"\nProcessing and responding to: {text}\n")
    try:
        # Generate response
        response = await generate_response(text, max_tokens=50, temperature=0.7, top_p=0.9)
        print(f"\nGenerated response: {response}\n")
        
        # Send text response to the frontend
        await websocket.send_json({
            "type": "response",
            "text": response
        })
        print("\nText response sent to frontend\n")
        
        # Generate speech from the response
        audio_response = await generate_speech(response)
        print(f"\nGenerated speech of {len(audio_response)} bytes\n")
        
        # Send the audio response back to the client
        await websocket.send_bytes(audio_response)
        print("\nAudio response sent to frontend\n")
    except Exception as e:
        print(f"\nError in response processing: {str(e)}\n")
        logger.error(f"Error in response processing: {str(e)}")
        await websocket.send_json({
            "type": "error",
            "message": "Failed to generate response"
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
    
    # Flattening messages if they're nested
    messages = conversation.messages[0] if isinstance(conversation.messages[0], list) else conversation.messages
    prompt = pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    print(f"\nGenerated prompt: {prompt[:50]}...\n")
    
    try:
        response = await generate_response(prompt, max_tokens, temperature, top_p)
        assistant_message = Message(role="assistant", content=response.strip())
        result = {
            "message": assistant_message.content,
            "conversation": messages + [assistant_message]
        }
        
        # Cache the result
        background_tasks.add_task(redis_client.setex, cache_key, 3600, json.dumps(result))  # Cache for 1 hour
        print("\nResponse cached\n")
        
        return result
    except Exception as e:
        print(f"\nError in chat_with_llama: {str(e)}\n")
        logger.error(f"Error in chat_with_llama: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred while processing your request")
