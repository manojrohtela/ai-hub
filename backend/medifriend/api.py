from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from .config import get_settings
from .schemas import (
    AlternativesResponse,
    EntityType,
    IntentRequest,
    IntentResponse,
    SearchResponse,
)
from .services.intent_service import IntentService
from .services.medicine_service import MedicineService


router = APIRouter()

# Lazy init — MedicineService loads a 65MB pickle cache on first request
# (~0.3s) instead of parsing the raw CSV (~8s). This keeps startup memory
# within Render's 512MB limit while making chat responses fast.
_medicine_service: MedicineService | None = None
_intent_service: IntentService | None = None


def get_medicine_service(request: Request) -> MedicineService:
    global _medicine_service
    if _medicine_service is None:
        settings = get_settings()
        _medicine_service = MedicineService(settings.dataset_path)
    return _medicine_service


def get_intent_service(request: Request) -> IntentService:
    global _intent_service
    if _intent_service is None:
        settings = get_settings()
        _intent_service = IntentService(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        )
    return _intent_service


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/intent", response_model=IntentResponse)
async def extract_intent(
    payload: IntentRequest,
    intent_service: Annotated[IntentService, Depends(get_intent_service)],
    medicine_service: Annotated[MedicineService, Depends(get_medicine_service)],
) -> IntentResponse:
    return await intent_service.extract_intent(
        text=payload.text,
        known_medicines=medicine_service.known_medicine_names,
        known_salt_keys=medicine_service.known_salt_keys,
    )


@router.get("/search", response_model=SearchResponse)
async def search_medicines(
    query: Annotated[str, Query(min_length=1)],
    medicine_service: Annotated[MedicineService, Depends(get_medicine_service)],
    kind: Annotated[EntityType | None, Query(alias="kind")] = None,
) -> SearchResponse:
    return medicine_service.search(query=query, entity_type=kind)


@router.get("/alternatives", response_model=AlternativesResponse)
async def medicine_alternatives(
    salt_key: Annotated[str, Query(min_length=1)],
    medicine_service: Annotated[MedicineService, Depends(get_medicine_service)],
    exclude_name: Annotated[str | None, Query()] = None,
) -> AlternativesResponse:
    return medicine_service.get_alternatives(
        salt_key=salt_key,
        exclude_name=exclude_name,
    )
