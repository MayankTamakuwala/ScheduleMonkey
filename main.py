from typing import List, Optional, Union
from typing_extensions import Literal

from fastapi import FastAPI
from pydantic import BaseModel

import torch
import transformers

app = FastAPI()

model_id = "./Meta-Llama-3.1-8B-Instruct"

# With Quantization

pipeline = transformers.pipeline(
    "text-generation",
    model=model_id,
    model_kwargs={"torch_dtype": torch.bfloat16},
    device_map="auto",
)

# Without Quantization

# pipeline = transformers.pipeline(
#     "text-generation",
#     model=model_id,
#     model_kwargs={
#         "torch_dtype": torch.float16,
#         "quantization_config": {"load_in_4bit": True},
#         "low_cpu_mem_usage": True,
#     },
# )

terminators = [
    pipeline.tokenizer.eos_token_id,
    pipeline.tokenizer.convert_tokens_to_ids("<|eot_id|>")
]

class Message(BaseModel):
    role: Literal['user', 'assistant', 'system']
    content: str

class Conversation(BaseModel):
    messages: Union[List[Message], List[List[Message]]]
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None


@app.post("/chat/")
async def chat_with_llama(conversation: Conversation, message_history=[], max_tokens=10, temperature=0.6, top_p=0.9):
    user_prompt = message_history + conversation.messages
    prompt = pipeline.tokenizer.apply_chat_template(
        user_prompt, tokenize=False, add_generation_prompt=True
    )
    outputs = pipeline(
        prompt,
        max_new_tokens=max_tokens,
        eos_token_id=terminators,
        do_sample=True,
        temperature=temperature,
        top_p=top_p,
    )
    response = outputs[0]["generated_text"][len(prompt):]
    return {message: response, conversation: user_prompt + [{"role": "assistant", "content": response}]}