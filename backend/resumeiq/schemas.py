from __future__ import annotations

from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str | None = None


class ScoreSection(BaseModel):
    label: str
    score: int           # 0–100
    feedback: str


class AnalyzeResponse(BaseModel):
    overall_score: int
    summary: str
    sections: list[ScoreSection]
    strengths: list[str]
    improvements: list[str]
    keywords_found: list[str]
    keywords_missing: list[str]


class ChatRequest(BaseModel):
    resume_text: str
    question: str
    job_description: str | None = None


class ChatResponse(BaseModel):
    answer: str
