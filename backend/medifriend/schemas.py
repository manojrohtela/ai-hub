from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


EntityType = Literal["medicine", "symptom", "unknown"]
RequestedAction = Literal[
    "search",
    "alternatives",
    "details",
    "uses",
    "unsupported_medical_advice",
]


class IntentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class MedicineRecord(BaseModel):
    name: str
    composition: str
    category: str
    uses: list[str] = Field(default_factory=list)
    salt_key: str
    manufacturer: str
    match_reason: str | None = None
    match_tags: list[str] = Field(default_factory=list)
    score: float | None = None


class IntentResponse(BaseModel):
    original_text: str
    entity_type: EntityType
    entity_value: str | None = None
    requested_action: RequestedAction = "search"
    extracted_medicine: str | None = None
    extracted_symptom: str | None = None
    follow_up_questions: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    parser: Literal["groq", "heuristic"]


class SearchResponse(BaseModel):
    query: str
    entity_type: EntityType
    matched_text: str | None = None
    summary: str
    categories: list[str] = Field(default_factory=list)
    primary_result: MedicineRecord | None = None
    medicines: list[MedicineRecord] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    warning: str = "Consult a doctor before taking any medicine."


class AlternativesResponse(BaseModel):
    salt_key: str
    count: int
    medicines: list[MedicineRecord] = Field(default_factory=list)
