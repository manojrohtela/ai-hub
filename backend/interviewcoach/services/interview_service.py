from __future__ import annotations

import json
import re
import uuid

from groq import Groq

from ..schemas import AnswerResponse, FeedbackItem, StartResponse, SummaryResponse

TOTAL_QUESTIONS = 5

_QUESTION_SYSTEM = """You are an expert technical interviewer. Generate a single interview question
appropriate for the given role and level. Return ONLY the question text — no numbering, no preamble."""

_FEEDBACK_SYSTEM = """You are an expert interview coach. Evaluate the candidate's answer and return
a JSON object with exactly this structure:
{
  "feedback": [
    {"category": "Clarity", "score": <0-10>, "comment": "<brief>"},
    {"category": "Depth", "score": <0-10>, "comment": "<brief>"},
    {"category": "Examples", "score": <0-10>, "comment": "<brief>"},
    {"category": "Relevance", "score": <0-10>, "comment": "<brief>"}
  ],
  "overall_score": <0-10>,
  "sample_answer": "<a model answer in 3-5 sentences>"
}
Return ONLY the JSON — no markdown, no extra text."""

_SUMMARY_SYSTEM = """You are an expert interview coach. Given the interview results, return a JSON:
{
  "verdict": "<one of: Excellent, Good, Needs Improvement, Not Ready>",
  "top_strengths": ["<strength>", "<strength>"],
  "top_improvements": ["<improvement>", "<improvement>"]
}
Return ONLY the JSON."""

# Session store: session_id -> session dict
_sessions: dict[str, dict] = {}


def _extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        return json.loads(fenced.group(1).strip())
    brace = re.search(r"\{[\s\S]+\}", text)
    if brace:
        return json.loads(brace.group(0))
    raise ValueError("No JSON in LLM response")


class InterviewService:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Groq(api_key=api_key)
        self._model = model

    def _generate_question(self, role: str, level: str, focus: str | None,
                            asked: list[str]) -> str:
        avoid = "\n".join(f"- {q}" for q in asked) if asked else "none"
        user_msg = (
            f"Role: {role}\nLevel: {level}\n"
            + (f"Focus area: {focus}\n" if focus else "")
            + f"Already asked (do not repeat):\n{avoid}\n\n"
            "Generate the next interview question."
        )
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _QUESTION_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
            max_tokens=256,
        )
        return (resp.choices[0].message.content or "").strip()

    def start(self, role: str, level: str, focus: str | None) -> StartResponse:
        session_id = str(uuid.uuid4())
        question = self._generate_question(role, level, focus, [])
        _sessions[session_id] = {
            "role": role,
            "level": level,
            "focus": focus,
            "questions": [question],
            "scores": [],
            "question_number": 1,
        }
        return StartResponse(
            session_id=session_id,
            first_question=question,
            question_number=1,
            total_questions=TOTAL_QUESTIONS,
        )

    def answer(self, session_id: str, answer: str) -> AnswerResponse:
        if session_id not in _sessions:
            raise ValueError("Session not found")

        sess = _sessions[session_id]
        current_q = sess["questions"][-1]
        q_num = sess["question_number"]

        # Get feedback
        user_msg = (
            f"Role: {sess['role']}, Level: {sess['level']}\n"
            f"Question: {current_q}\nCandidate answer: {answer}"
        )
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _FEEDBACK_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=512,
        )
        data = _extract_json(resp.choices[0].message.content or "{}")
        feedback = [FeedbackItem(**f) for f in data.get("feedback", [])]
        overall = data.get("overall_score", 5)
        sample = data.get("sample_answer", "")
        sess["scores"].append(overall)

        is_complete = q_num >= TOTAL_QUESTIONS
        next_q = None

        if not is_complete:
            next_q = self._generate_question(
                sess["role"], sess["level"], sess["focus"], sess["questions"]
            )
            sess["questions"].append(next_q)
            sess["question_number"] += 1

        return AnswerResponse(
            feedback=feedback,
            overall_score=overall,
            sample_answer=sample,
            next_question=next_q,
            is_complete=is_complete,
            question_number=q_num,
            total_questions=TOTAL_QUESTIONS,
        )

    def summary(self, session_id: str) -> SummaryResponse:
        if session_id not in _sessions:
            raise ValueError("Session not found")

        sess = _sessions[session_id]
        avg = round(sum(sess["scores"]) / len(sess["scores"])) if sess["scores"] else 0

        qs_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(sess["questions"]))
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _SUMMARY_SYSTEM},
                {"role": "user", "content": (
                    f"Role: {sess['role']}, Level: {sess['level']}\n"
                    f"Average score: {avg}/10\n"
                    f"Questions asked:\n{qs_text}"
                )},
            ],
            temperature=0.3,
            max_tokens=256,
        )
        data = _extract_json(resp.choices[0].message.content or "{}")

        return SummaryResponse(
            session_id=session_id,
            role=sess["role"],
            level=sess["level"],
            average_score=avg,
            total_questions=len(sess["scores"]),
            verdict=data.get("verdict", "Good"),
            top_strengths=data.get("top_strengths", []),
            top_improvements=data.get("top_improvements", []),
        )
