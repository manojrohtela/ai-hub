from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from .config import get_settings
from .schemas import AnswerRequest, AnswerResponse, StartRequest, StartResponse, SummaryResponse
from .services.interview_service import InterviewService

router = APIRouter()
_interview_service: InterviewService | None = None


def get_interview_service(request: Request) -> InterviewService:
    global _interview_service
    if _interview_service is None:
        s = get_settings()
        _interview_service = InterviewService(api_key=s.groq_api_key, model=s.groq_model)
    return _interview_service


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/start", response_model=StartResponse)
async def start_interview(
    payload: StartRequest,
    svc: Annotated[InterviewService, Depends(get_interview_service)],
) -> StartResponse:
    return svc.start(payload.role, payload.level, payload.focus)


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(
    payload: AnswerRequest,
    svc: Annotated[InterviewService, Depends(get_interview_service)],
) -> AnswerResponse:
    try:
        return svc.answer(payload.session_id, payload.answer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/summary/{session_id}", response_model=SummaryResponse)
async def get_summary(
    session_id: str,
    svc: Annotated[InterviewService, Depends(get_interview_service)],
) -> SummaryResponse:
    try:
        return svc.summary(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
