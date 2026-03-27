from __future__ import annotations
from pydantic import BaseModel


class RiskItem(BaseModel):
    clause: str
    severity: str     # high | medium | low
    explanation: str
    suggestion: str


class AnalyzeResponse(BaseModel):
    contract_type: str
    party_summary: str
    key_dates: list[str]
    key_obligations: list[str]
    risks: list[RiskItem]
    risk_score: int        # 0-100 (higher = more risky)
    plain_summary: str
    missing_clauses: list[str]


class ChatRequest(BaseModel):
    contract_text: str
    question: str


class ChatResponse(BaseModel):
    answer: str
