from __future__ import annotations

import json
import re

from groq import Groq

from ..schemas import AnalyzeResponse, ChatResponse, ScoreSection

_ANALYZE_SYSTEM = """You are an expert career coach and ATS (Applicant Tracking System) specialist.
Analyze the given resume and return a JSON object with exactly this structure:
{
  "overall_score": <0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "sections": [
    {"label": "Contact & Header", "score": <0-100>, "feedback": "<brief feedback>"},
    {"label": "Work Experience", "score": <0-100>, "feedback": "<brief feedback>"},
    {"label": "Skills", "score": <0-100>, "feedback": "<brief feedback>"},
    {"label": "Education", "score": <0-100>, "feedback": "<brief feedback>"},
    {"label": "ATS Compatibility", "score": <0-100>, "feedback": "<brief feedback>"}
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "keywords_found": ["<keyword>", ...],
  "keywords_missing": ["<keyword>", ...]
}
Return ONLY the JSON object — no markdown, no extra text."""

_CHAT_SYSTEM = """You are an expert career coach helping a candidate improve their resume.
You have access to the candidate's resume text. Answer questions helpfully and concisely.
Give actionable, specific advice. Keep responses under 200 words unless detail is necessary."""


def _extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        return json.loads(fenced.group(1).strip())
    brace = re.search(r"\{[\s\S]+\}", text)
    if brace:
        return json.loads(brace.group(0))
    raise ValueError("No JSON found in LLM response")


class ResumeService:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Groq(api_key=api_key)
        self._model = model

    def analyze(self, resume_text: str, job_description: str | None) -> AnalyzeResponse:
        user_content = f"RESUME:\n{resume_text}"
        if job_description:
            user_content += f"\n\nJOB DESCRIPTION:\n{job_description}"
            user_content += "\n\nAlso check for keyword alignment with the job description."

        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _ANALYZE_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        raw = response.choices[0].message.content or "{}"
        data = _extract_json(raw)

        return AnalyzeResponse(
            overall_score=data.get("overall_score", 0),
            summary=data.get("summary", ""),
            sections=[ScoreSection(**s) for s in data.get("sections", [])],
            strengths=data.get("strengths", []),
            improvements=data.get("improvements", []),
            keywords_found=data.get("keywords_found", []),
            keywords_missing=data.get("keywords_missing", []),
        )

    def chat(self, resume_text: str, question: str, job_description: str | None) -> ChatResponse:
        context = f"RESUME:\n{resume_text}"
        if job_description:
            context += f"\n\nJOB DESCRIPTION:\n{job_description}"

        response = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _CHAT_SYSTEM},
                {"role": "user", "content": f"{context}\n\nQuestion: {question}"},
            ],
            temperature=0.5,
            max_tokens=512,
        )
        return ChatResponse(answer=response.choices[0].message.content or "")
