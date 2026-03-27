from __future__ import annotations

import io
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from .config import get_settings
from .schemas import AnalyzeResponse, ChatRequest, ChatResponse
from .services.resume_service import ResumeService

router = APIRouter()

_resume_service: ResumeService | None = None


def get_resume_service(request: Request) -> ResumeService:
    global _resume_service
    if _resume_service is None:
        settings = get_settings()
        _resume_service = ResumeService(api_key=settings.groq_api_key, model=settings.groq_model)
    return _resume_service


def _extract_text_from_pdf(contents: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(contents))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise ValueError(f"Could not read PDF: {exc}") from exc


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_resume(
    file: Annotated[UploadFile, File()],
    job_description: Annotated[str | None, Form()] = None,
    resume_service: ResumeService = Depends(get_resume_service),
) -> AnalyzeResponse:
    contents = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith(".pdf"):
        resume_text = _extract_text_from_pdf(contents)
    else:
        resume_text = contents.decode("utf-8", errors="ignore")

    return resume_service.analyze(resume_text, job_description)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    resume_service: ResumeService = Depends(get_resume_service),
) -> ChatResponse:
    return resume_service.chat(
        resume_text=payload.resume_text,
        question=payload.question,
        job_description=payload.job_description,
    )
