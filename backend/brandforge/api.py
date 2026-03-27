from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, Request
from .config import get_settings
from .schemas import BrandRequest, BrandResponse, RefineRequest, RefineResponse
from .services.brand_service import BrandService

router = APIRouter()
_service: BrandService | None = None


def get_service(request: Request) -> BrandService:
    global _service
    if _service is None:
        s = get_settings()
        _service = BrandService(api_key=s.groq_api_key, model=s.groq_model)
    return _service


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/generate", response_model=BrandResponse)
async def generate_brand(
    payload: BrandRequest,
    svc: Annotated[BrandService, Depends(get_service)],
) -> BrandResponse:
    return svc.generate(payload)


@router.post("/refine", response_model=RefineResponse)
async def refine_brand(
    payload: RefineRequest,
    svc: Annotated[BrandService, Depends(get_service)],
) -> RefineResponse:
    return svc.refine(payload)
