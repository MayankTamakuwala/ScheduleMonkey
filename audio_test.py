from fastapi import FastAPI, WebSocket
# import whisper
import io

app = FastAPI()

# model = whisper.load_model("base")  # Load the Whisper model

@app.websocket("/stream-audio")
async def websocket_endpoint(websocket: WebSocket):
  try:
    await websocket.accept()
    print("Connected!")
    
    # audio_buffer = io.BytesIO()  # Buffer to accumulate audio data
    
    while True:
        
      try:
          data = await websocket.receive_bytes()
          print(f"Received {len(data)} bytes of audio data")
          await websocket.send_text(f"Received {len(data)} bytes")
      except Exception as e:
          print(f"Connection error: {e}")
          break
        

        # data = await websocket.receive_bytes()
        # print(f"Received {len(data)} bytes of audio data")
        
        # audio_buffer.write(data)

        # # Optionally, transcribe after every X bytes or Y seconds
        # # Echo back the received data size to the frontend
        # await websocket.send_text(f"Received {len(data)} bytes")

        # # You can also log the data to the console for verification
        # print(f"Received {len(data)} bytes of audio data")
    


    # audio_buffer.seek(0)  # Reset buffer pointer
    # transcription = model.transcribe(audio_buffer)
    # await websocket.send_text(transcription['text'])
    await websocket.send_text("done")
    await websocket.close()

  except Exception as e:
    print(f"Failed to accept WebSocket connection: {e}")

  finally:
    await websocket.close()
    print("Finally WebSocket connection closed")

# # test GET endpoint
# @app.get("/")
# async def root():
#     return {"message": "asdfHello World"}

html = """
<!DOCTYPE html>
<html>
    <head>
        <title>Chat</title>
    </head>
    <body>
        <h1>WebSocket Chat</h1>
        <form action="" onsubmit="sendMessage(event)">
            <input type="text" id="messageText" autocomplete="off"/>
            <button>Send</button>
        </form>
        <ul id='messages'>
        </ul>
        <script>
            var ws = new WebSocket("ws://localhost:8000/ws");
            ws.onmessage = function(event) {
                var messages = document.getElementById('messages')
                var message = document.createElement('li')
                var content = document.createTextNode(event.data)
                message.appendChild(content)
                messages.appendChild(message)
            };
            function sendMessage(event) {
                var input = document.getElementById("messageText")
                ws.send(input.value)
                input.value = ''
                event.preventDefault()
            }
        </script>
    </body>
</html>
"""


@app.get("/")
async def get():
    return {"message": 'hi'}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")

# run server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    