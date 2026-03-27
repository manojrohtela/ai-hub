from __future__ import annotations
from pydantic import BaseModel


class StartRequest(BaseModel):
    role: str
    level: str          # junior | mid | senior
    focus: str | None = None   # e.g. "system design", "behavioural"


class StartResponse(BaseModel):
    session_id: str
    first_question: str
    question_number: int
    total_questions: int


class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class FeedbackItem(BaseModel):
    category: str     # e.g. "Clarity", "Depth", "STAR Method"
    score: int        # 0-10
    comment: str


class AnswerResponse(BaseModel):
    feedback: list[FeedbackItem]
    overall_score: int
    sample_answer: str
    next_question: str | None = None
    is_complete: bool
    question_number: int
    total_questions: int


class SummaryResponse(BaseModel):
    session_id: str
    role: str
    level: str
    average_score: int
    total_questions: int
    verdict: str
    top_strengths: list[str]
    top_improvements: list[str]
