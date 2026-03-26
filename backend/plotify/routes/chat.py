from fastapi import APIRouter, HTTPException
from ..models.schemas import ChatRequest, ChatResponse
from ..services.orchestrator import process_chat
from ..services.state_manager import set_state

router = APIRouter()


@router.post("/reset")
async def reset():
    """Clear all state — called when frontend starts a new session."""
    set_state({})
    return {"ok": True}


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Convert chat history to simple dicts for the LLM
        history = []
        if request.chatHistory:
            history = [{"type": m.type, "text": m.text} for m in request.chatHistory]

        result = process_chat(
            message=request.message,
            current_state=request.currentState or {},
            action=request.action,
            chat_history=history,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))