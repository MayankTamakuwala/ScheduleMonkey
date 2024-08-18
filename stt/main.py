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
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
import os
from datetime import datetime, timedelta
import uuid
from google.cloud import firestore
from google.oauth2 import service_account
from google.cloud.firestore_v1.async_client import AsyncClient
import requests
from ConnectionManager import ConnectionManager

print("\n--- Starting application ---\n")
manager = ConnectionManager()

# Load environment variables
load_dotenv()
print("\nEnvironment variables loaded\n")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
print("\nLogging configured\n")

app = FastAPI()
print("\nFastAPI app initialized\n")

print("\nInitializing Firestore async client...\n")
service_account_key_path = './schedule-monkey-99721-firebase-adminsdk-7db1g-75f8bf2c57.json'

# Initialize Firebase Admin SDK
cred = credentials.Certificate(service_account_key_path)
firebase_admin.initialize_app(cred)

# Initialize Firestore client with explicit credentials
with open(service_account_key_path) as f:
    service_account_info = json.load(f)

credentials = service_account.Credentials.from_service_account_info(
    service_account_info)

db = firestore.AsyncClient(credentials=credentials)
print("\nFirestore async client initialized\n")


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

# intent_classifier = pipeline(
#     "text-classification", 
#     model=model_id,
#     model_kwargs={"torch_dtype": torch.bfloat16},
#     device_map="auto"
# )

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

async def generate_response_stream(prompt: str, max_tokens: int, temperature: float, top_p: float):
    new_prompt = pipe.tokenizer.apply_chat_template(
        [
            {
                "role": "system",
                "content": "You are a software developer."
            },{
                "role": "user",
                "content": prompt
            }
        ], tokenize=False, add_generation_prompt=True
    )
    print(f"\nGenerating response for prompt: {prompt[:50]}...\n")
    
    streamer = TextIteratorStreamer(pipe.tokenizer, skip_prompt=True, skip_special_tokens=True)
    generation_kwargs = dict(
        text_inputs=new_prompt,
        max_new_tokens=max_tokens,
        streamer=streamer,
        do_sample=True,
        temperature=temperature,
        top_p=top_p,
        eos_token_id=terminators,
    )

    thread = Thread(target=pipe, kwargs=generation_kwargs)
    thread.start()

    for new_text in streamer:
        yield new_text

async def transcribe_audio(audio_data: bytes, mime_type: str) -> str:
    print(f"\nTranscribing audio of type {mime_type}...\n")
    try:
        with tempfile.NamedTemporaryFile(suffix=f'.{mime_type.split("/")[1]}', delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name

        print(f"\nSaved incoming audio to temporary file: {temp_audio_path}\n")

        temp_wav_path = temp_audio_path.replace(f'.{mime_type.split("/")[1]}', '.wav')
        
        ffmpeg_path = shutil.which('ffmpeg')
        if ffmpeg_path is None:
            common_locations = [
                '/usr/bin/ffmpeg',
                '/usr/local/bin/ffmpeg',
                '/opt/homebrew/bin/ffmpeg',
                'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
            ]
            for location in common_locations:
                if os.path.isfile(location):
                    ffmpeg_path = location
                    break
            
            if ffmpeg_path is None:
                raise Exception("ffmpeg not found. Please install ffmpeg and ensure it's in your system PATH.")

        print(f"Using ffmpeg from: {ffmpeg_path}")
        
        # Use asyncio.subprocess.create_subprocess_exec for asynchronous subprocess execution
        process = await asyncio.create_subprocess_exec(
            ffmpeg_path, '-i', temp_audio_path, '-acodec', 'pcm_s16le', '-ar', '16000', temp_wav_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Wait for the subprocess to complete
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            print(f"FFmpeg error: {stderr.decode()}")
            raise Exception("FFmpeg conversion failed")

        print(f"\nConverted audio to WAV: {temp_wav_path}\n")

        # Run Whisper transcription in a separate thread to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, whisper_model.transcribe, temp_wav_path)
        
        print(f"\nTranscription result: {result['text']}\n")
        
        if not result['text']:
            print("\nWARNING: Transcription result is empty\n")
        
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
    
    conversation_id = str(uuid.uuid4())
    
    try:
        while True:
            print("\nWaiting for WebSocket data...\n")
            data = await websocket.receive_text()
            audio_data = json.loads(data)
            mime_type = audio_data['mimeType']
            base64_audio = audio_data['data']
            user_id = audio_data.get('userId', f'anonymous_{uuid.uuid4()}')  # Generate a unique anonymous ID if userId is not provided
            
            print(f"\nReceived audio data with MIME type: {mime_type} for user: {user_id}\n")
            
            audio_bytes = base64.b64decode(base64_audio)
            print(f"\nDecoded audio data size: {len(audio_bytes)} bytes\n")
            
            try:
                text = await transcribe_audio(audio_bytes, mime_type)
                print(f"\nTranscribed text: {text}\n")
                
                await store_chat_message(user_id, conversation_id, "user", text)
                
                await websocket.send_json({
                    "type": "transcription",
                    "text": text
                })
                print("\nTranscription sent to frontend\n")
                
                await process_and_respond(websocket, text, user_id, conversation_id)
                print("\nProcessing and responding completed\n")
                
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
    #     await websocket.close()

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

# async def generate_response_stream(prompt: str, max_tokens: int, temperature: float, top_p: float):
#     print(f"\nGenerating response for prompt: {prompt[:50]}...\n")
    
#     # Hard-coded response for testing
#     test_response = "This is a test response. It will be streamed word by word to simulate real-time generation. This should help test the streaming functionality without relying on the language model."
    
#     # Split the response into words
#     words = test_response.split()
    
#     # Stream each word with a small delay
#     for word in words:
#         yield word + " "
#         await asyncio.sleep(0.1)  # Add a small delay between words

# async def generate_tts(websocket: WebSocket, text: str):
#     tts_url = "http://localhost:8001/tts"
#     tts_data = {"text": text}
#     try:
#         tts_response = await asyncio.to_thread(requests.post, tts_url, json=tts_data, timeout=30)
#         tts_response.raise_for_status()
#         await websocket.send_bytes(tts_response.content)
#         print("\nAudio response sent to frontend\n")
#     except Exception as e:
#         print(f"\nError in TTS API call: {str(e)}\n")
#         await websocket.send_json({
#             "type": "error",
#             "message": f"Failed to generate speech: {str(e)}"
#         })

async def process_and_respond(websocket: WebSocket, text: str, user_id: str, conversation_id: str):
    print(f"\nProcessing and responding to: {text}\n")
    try:
        # Generate response using Llama model
        response = ""
        async for chunk in generate_response_stream(text, max_tokens=2, temperature=0.7, top_p=0.7):
            response += chunk
            
        # response = "Hi I am Mayank Tamakuwala"

        print(f"\nGenerated full response: {response[:100]}...")  # Print first 100 characters of the response
        
        # Store the complete assistant's response in Firestore
        await store_chat_message(user_id, conversation_id, "assistant", response)
        
        # Send the response text to the frontend
        await websocket.send_json({
            "type": "response",
            "text": response
        })

        # Start TTS generation in the background
        asyncio.create_task(generate_tts(websocket, response))

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


async def generate_tts(websocket: WebSocket, text: str):
    tts_url = "http://localhost:8001/tts"
    tts_data = {"text": text}
    try:
        print(f"Sending TTS request: {text[:100]}...")  # Log the first 100 characters of the text
        tts_response = await asyncio.to_thread(requests.post, tts_url, json=tts_data, timeout=360)
        tts_response.raise_for_status()
        await websocket.send_bytes(tts_response.content)
        print("\nAudio response sent to frontend\n")
    except Exception as e:
        print(f"\nError in TTS API call: {str(e)}\n")
        await websocket.send_json({
            "type": "error",
            "message": f"Failed to generate speech: {str(e)}"
        })

async def store_chat_message(user_id: str, conversation_id: str, role: str, content: str):
    chat_ref = db.collection('users').document(user_id).collection('conversations').document(conversation_id).collection('chat')
    
    chat_message = {
        'time': firestore.SERVER_TIMESTAMP,
        'role': role,
        'content': content
    }
    
    await chat_ref.add(chat_message)
    print(f"Stored chat message for user {user_id} in conversation {conversation_id}")


# SCOPES = ['https://www.googleapis.com/auth/calendar']
# CLIENT_SECRET_FILE = './client_secret_568291304032-u5rg3u35gu0argh79ai16utueo042764.apps.googleusercontent.com.json'
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# def get_calendar_service(credentials_json):
#     credentials = Credentials.from_authorized_user_info(info=credentials_json, scopes=SCOPES)
#     return build('calendar', 'v3', credentials=credentials)

# async def create_event(service, summary, start_time, end_time, description=""):
#     event = {
#         'summary': summary,
#         'description': description,
#         'start': {
#             'dateTime': start_time.isoformat(),
#             'timeZone': 'Your_Timezone',
#         },
#         'end': {
#             'dateTime': end_time.isoformat(),
#             'timeZone': 'Your_Timezone',
#         },
#     }

#     try:
#         event = service.events().insert(calendarId='primary', body=event).execute()
#         return event['id']
#     except HttpError as error:
#         raise HTTPException(status_code=400, detail=f"An error occurred: {error}")
    
# async def update_event(service, event_id, summary=None, start_time=None, end_time=None, description=None):
#     try:
#         event = service.events().get(calendarId='primary', eventId=event_id).execute()
        
#         if summary:
#             event['summary'] = summary
#         if description:
#             event['description'] = description
#         if start_time:
#             event['start']['dateTime'] = start_time.isoformat()
#         if end_time:
#             event['end']['dateTime'] = end_time.isoformat()

#         updated_event = service.events().update(calendarId='primary', eventId=event_id, body=event).execute()
#         return updated_event['id']
#     except HttpError as error:
#         raise HTTPException(status_code=400, detail=f"An error occurred: {error}")

# async def delete_event(service, event_id):
#     try:
#         service.events().delete(calendarId='primary', eventId=event_id).execute()
#         return True
#     except HttpError as error:
#         raise HTTPException(status_code=400, detail=f"An error occurred: {error}")

# @app.post("/calendar/{action}")
# async def handle_calendar_action(action: str, event_details: dict, token: str = Depends(oauth2_scheme)):
#     user_id = get_user_id_from_token(token)  # Implement this function to extract user_id from the token
#     user_credentials = await get_user_credentials(user_id)  # Implement this function to get user's Google credentials
    
#     service = get_calendar_service(user_credentials)
    
#     if action == "create":
#         summary = event_details['summary']
#         start_time = datetime.fromisoformat(event_details['start_time'])
#         end_time = datetime.fromisoformat(event_details['end_time'])
#         description = event_details.get('description', '')
#         event_id = await create_event(service, summary, start_time, end_time, description)
#         return {"message": "Event created", "event_id": event_id}
    
#     elif action == "update":
#         event_id = event_details['event_id']
#         summary = event_details.get('summary')
#         start_time = datetime.fromisoformat(event_details['start_time']) if 'start_time' in event_details else None
#         end_time = datetime.fromisoformat(event_details['end_time']) if 'end_time' in event_details else None
#         description = event_details.get('description')
#         updated_event_id = await update_event(service, event_id, summary, start_time, end_time, description)
#         return {"message": "Event updated", "event_id": updated_event_id}
    
#     elif action == "delete":
#         event_id = event_details['event_id']
#         success = await delete_event(service, event_id)
#         return {"message": "Event deleted" if success else "Failed to delete event"}
    
#     else:
#         raise HTTPException(status_code=400, detail="Invalid action")


# def extract_event_details(text):
#     # This is a placeholder implementation. You should replace this with a more sophisticated
#     # natural language processing solution to accurately extract event details.
#     details = {}
    
#     # Simple keyword matching (you should use a more robust method)
#     if "summary:" in text.lower():
#         details['summary'] = text.split("summary:")[1].split()[0]
#     if "start:" in text.lower():
#         details['start_time'] = parse_datetime(text.split("start:")[1].split()[0])
#     if "end:" in text.lower():
#         details['end_time'] = parse_datetime(text.split("end:")[1].split()[0])
#     if "description:" in text.lower():
#         details['description'] = text.split("description:")[1].split(".")[0]
#     if "event id:" in text.lower():
#         details['event_id'] = text.split("event id:")[1].split()[0]

#     return details

# def parse_datetime(datetime_str):
#     # Implement datetime parsing logic here
#     # This is a placeholder implementation
#     return datetime.fromisoformat(datetime_str)