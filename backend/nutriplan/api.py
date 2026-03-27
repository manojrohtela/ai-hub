from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, Request
from .config import get_settings
from .schemas import ChatRequest, ChatResponse, PlanRequest, PlanResponse
from .services.nutrition_service import NutritionService

router = APIRouter()
_service: NutritionService | None = None


def get_service(request: Request) -> NutritionService:
    global _service
    if _service is None:
        s = get_settings()
        _service = NutritionService(api_key=s.groq_api_key, model=s.groq_model)
    return _service


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/plan", response_model=PlanResponse)
async def generate_plan(
    payload: PlanRequest,
    svc: Annotated[NutritionService, Depends(get_service)],
) -> PlanResponse:
    return svc.generate_plan(payload)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    svc: Annotated[NutritionService, Depends(get_service)],
) -> ChatResponse:
    return svc.chat(payload.question, payload.plan_summary)
