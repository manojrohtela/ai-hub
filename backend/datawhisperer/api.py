from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile

from .config import get_settings
from .schemas import QueryRequest, QueryResponse, UploadResponse
from .services.sql_service import SQLService

router = APIRouter()

_sql_service: SQLService | None = None


def get_sql_service(request: Request) -> SQLService:
    global _sql_service
    if _sql_service is None:
        settings = get_settings()
        _sql_service = SQLService(api_key=settings.groq_api_key, model=settings.groq_model)
    return _sql_service


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: Annotated[UploadFile, File()],
    sql_service: Annotated[SQLService, Depends(get_sql_service)],
) -> UploadResponse:
    contents = await file.read()
    return sql_service.load_csv(contents, file.filename or "data.csv")


@router.post("/query", response_model=QueryResponse)
async def run_query(
    payload: QueryRequest,
    sql_service: Annotated[SQLService, Depends(get_sql_service)],
) -> QueryResponse:
    return sql_service.run_query(
        session_id=payload.session_id,
        question=payload.question,
    )
