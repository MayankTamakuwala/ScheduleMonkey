# from typing import List, Optional, Union
# from typing_extensions import Literal

# from fastapi import FastAPI
# from pydantic import BaseModel

# import torch
# from transformers import pipeline

# app = FastAPI()

# model_id = "./Meta-Llama-3.1-8B-Instruct"

# # With Quantization

# pipe = pipeline(
#     "text-generation",
#     model=model_id,
#     model_kwargs={"torch_dtype": torch.bfloat16},
#     device_map="auto",
# )

# # Without Quantization

# # pipe = pipeline(
# #     "text-generation",
# #     model=model_id,
# #     model_kwargs={
# #         "torch_dtype": torch.float16,
# #         "quantization_config": {"load_in_4bit": True},
# #         "low_cpu_mem_usage": True,
# #     },
# # )

# terminators = [
#     pipe.tokenizer.eos_token_id,
#     pipe.tokenizer.convert_tokens_to_ids("<|eot_id|>")
# ]

# class Message(BaseModel):
#     role: Literal['user', 'assistant', 'system']
#     content: str

# class Conversation(BaseModel):
#     messages: Union[List[Message], List[List[Message]]]
#     user_id: Optional[str] = None
#     conversation_id: Optional[str] = None


# @app.post("/chat/")
# async def chat_with_llama(conversation: Conversation, message_history=[], max_tokens=10, temperature=0.6, top_p=0.9):
#     user_prompt = message_history + conversation.messages
#     prompt = pipe.tokenizer.apply_chat_template(
#         user_prompt, tokenize=False, add_generation_prompt=True
#     )
#     outputs = pipe(
#         prompt,
#         max_new_tokens=max_tokens,
#         eos_token_id=terminators,
#         do_sample=True,
#         temperature=temperature,
#         top_p=top_p,
#     )
#     response = outputs[0]["generated_text"][len(prompt):]
#     return {message: response, conversation: user_prompt + [{"role": "assistant", "content": response}]}



import asyncio
from typing import List, Optional, Union
from typing_extensions import Literal
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import pipeline
from concurrent.futures import ThreadPoolExecutor

app = FastAPI()

model_id = "./Meta-Llama-3.1-8B-Instruct"

# Initialize the pipeline with quantization
pipe = pipeline(
    "text-generation",
    model=model_id,
    model_kwargs={"torch_dtype": torch.bfloat16},
    device_map="auto",
)

# Define terminators
terminators = [
    pipe.tokenizer.eos_token_id,
    pipe.tokenizer.convert_tokens_to_ids("<|eot_id|>")
]

class Message(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str

class Conversation(BaseModel):
    messages: Union[List[Message], List[List[Message]]]
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None

thread_pool = ThreadPoolExecutor(max_workers=4)

def generate_response(prompt: str, max_tokens: int, temperature: float, top_p: float) -> str:
    outputs = pipe(
        prompt,
        max_new_tokens=max_tokens,
        eos_token_id=terminators,
        do_sample=True,
        temperature=temperature,
        top_p=top_p,
    )
    return outputs[0]["generated_text"][len(prompt):]

async def async_generate_response(prompt: str, max_tokens: int, temperature: float, top_p: float) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(thread_pool, generate_response, prompt, max_tokens, temperature, top_p)

@app.post("/chat/")
async def chat_with_llama(
    conversation: Conversation, 
    max_tokens: int = 10,
    temperature: float = 0.6, 
    top_p: float = 0.9
):
    if not conversation.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    # Flattening messages if they're nested
    messages = conversation.messages[0] if isinstance(conversation.messages[0], list) else conversation.messages

    prompt = pipe.tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )

    response = await async_generate_response(prompt, max_tokens, temperature, top_p)

    assistant_message = Message(role="assistant", content=response.strip())

    return {
        "message": assistant_message.content,
        "conversation": messages + [assistant_message]
    }
