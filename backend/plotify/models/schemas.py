from pydantic import BaseModel
from typing import List, Optional


class ChatMessage(BaseModel):
    type: str = "user"  # "user" or "ai"
    text: str = ""


class ChatRequest(BaseModel):
    message: str = ""
    currentState: Optional[dict] = {}
    action: Optional[dict] = None
    chatHistory: Optional[List[ChatMessage]] = []  # NEW: for multi-turn context


class ChatResponse(BaseModel):
    llmResponse: dict
    state: dict
    layout: dict
    notes: List[dict]