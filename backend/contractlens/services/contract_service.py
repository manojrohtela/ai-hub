from __future__ import annotations
import io, json, re
from groq import Groq
from ..schemas import AnalyzeResponse, ChatResponse, RiskItem

_ANALYZE_SYSTEM = """You are an expert legal analyst. Analyze the contract and return a JSON object:
{
  "contract_type": "<e.g. Employment Agreement, NDA, SaaS Terms>",
  "party_summary": "<who are the parties and their roles>",
  "key_dates": ["<date or deadline>", ...],
  "key_obligations": ["<obligation>", ...],
  "risks": [
    {
      "clause": "<quoted clause or title>",
      "severity": "<high|medium|low>",
      "explanation": "<why it is risky>",
      "suggestion": "<how to fix or negotiate>"
    },
    ...
  ],
  "risk_score": <0-100>,
  "plain_summary": "<3-5 sentence plain-English summary of what this contract means>",
  "missing_clauses": ["<clause that should be present but is missing>", ...]
}
Return ONLY the JSON. No markdown, no explanation."""

_CHAT_SYSTEM = """You are an expert legal assistant. The user has a contract they uploaded.
Answer their question clearly and concisely. Always recommend consulting a qualified lawyer
for binding legal advice. Keep responses under 250 words."""


def _extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        return json.loads(fenced.group(1).strip())
    brace = re.search(r"\{[\s\S]+\}", text)
    if brace:
        return json.loads(brace.group(0))
    raise ValueError("No JSON in response")


def _read_pdf(contents: bytes) -> str:
    import PyPDF2
    reader = PyPDF2.PdfReader(io.BytesIO(contents))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


class ContractService:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Groq(api_key=api_key)
        self._model = model

    def analyze(self, contract_text: str) -> AnalyzeResponse:
        # Truncate to ~12000 chars to stay within token limits
        text = contract_text[:12000]
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _ANALYZE_SYSTEM},
                {"role": "user", "content": f"CONTRACT:\n{text}"},
            ],
            temperature=0.1,
            max_tokens=1500,
        )
        data = _extract_json(resp.choices[0].message.content or "{}")
        return AnalyzeResponse(
            contract_type=data.get("contract_type", "Unknown"),
            party_summary=data.get("party_summary", ""),
            key_dates=data.get("key_dates", []),
            key_obligations=data.get("key_obligations", []),
            risks=[RiskItem(**r) for r in data.get("risks", [])],
            risk_score=data.get("risk_score", 0),
            plain_summary=data.get("plain_summary", ""),
            missing_clauses=data.get("missing_clauses", []),
        )

    def analyze_file(self, contents: bytes, filename: str) -> AnalyzeResponse:
        if filename.lower().endswith(".pdf"):
            text = _read_pdf(contents)
        else:
            text = contents.decode("utf-8", errors="ignore")
        return self.analyze(text)

    def chat(self, contract_text: str, question: str) -> ChatResponse:
        text = contract_text[:12000]
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _CHAT_SYSTEM},
                {"role": "user", "content": f"CONTRACT:\n{text}\n\nQuestion: {question}"},
            ],
            temperature=0.4,
            max_tokens=512,
        )
        return ChatResponse(answer=resp.choices[0].message.content or "")
