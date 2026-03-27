from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, File, Request, UploadFile
from .config import get_settings
from .schemas import AnalyzeResponse, ChatRequest, ChatResponse
from .services.contract_service import ContractService

router = APIRouter()
_contract_service: ContractService | None = None


def get_contract_service(request: Request) -> ContractService:
    global _contract_service
    if _contract_service is None:
        s = get_settings()
        _contract_service = ContractService(api_key=s.groq_api_key, model=s.groq_model)
    return _contract_service


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_contract(
    file: Annotated[UploadFile, File()],
    svc: ContractService = Depends(get_contract_service),
) -> AnalyzeResponse:
    contents = await file.read()
    return svc.analyze_file(contents, file.filename or "contract.txt")


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    svc: ContractService = Depends(get_contract_service),
) -> ChatResponse:
    return svc.chat(payload.contract_text, payload.question)
