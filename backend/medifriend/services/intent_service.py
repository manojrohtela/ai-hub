from __future__ import annotations

import json
from typing import Callable, Sequence

import httpx

from ..schemas import IntentResponse
from .medicine_service import normalize_text


class IntentService:
    GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str | None, model: str) -> None:
        self.api_key = api_key
        self.model = model

    async def extract_intent(
        self,
        text: str,
        known_medicines: Sequence[str] | None = None,
        known_salt_keys: Sequence[str] | None = None,
        medicine_lookup: Callable[[str], str | None] | None = None,
    ) -> IntentResponse:
        if self.api_key:
            try:
                return await self._extract_with_groq(
                    text=text,
                    known_medicines=known_medicines or [],
                    known_salt_keys=known_salt_keys or [],
                )
            except Exception:
                pass

        return self._extract_with_heuristics(
            text=text,
            known_medicines=known_medicines or [],
            known_salt_keys=known_salt_keys or [],
            medicine_lookup=medicine_lookup,
        )

    async def _extract_with_groq(
        self,
        text: str,
        known_medicines: Sequence[str],
        known_salt_keys: Sequence[str],
    ) -> IntentResponse:
        prompt_context = self._build_prompt_context(text, known_medicines, known_salt_keys)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "temperature": 0,
            "max_completion_tokens": 250,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You extract intent only for a medicine search application. "
                        "Do not give treatment advice. Return JSON with keys: "
                        "entity_type, entity_value, requested_action, extracted_medicine, "
                        "extracted_symptom, follow_up_questions, confidence. "
                        "entity_type must be medicine, symptom, or unknown. "
                        "requested_action must be search, alternatives, details, uses, "
                        "or unsupported_medical_advice. Use unsupported_medical_advice "
                        "for side effects, dosage, safety, contraindications, or interactions."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt_context,
                },
            ],
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(self.GROQ_ENDPOINT, headers=headers, json=payload)
            response.raise_for_status()
            raw_response = response.json()

        content = raw_response["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return self._normalize_parsed_payload(
            text=text,
            payload=parsed,
            parser="groq",
        )

    def _extract_with_heuristics(
        self,
        text: str,
        known_medicines: Sequence[str],
        known_salt_keys: Sequence[str],
        medicine_lookup: Callable[[str], str | None] | None = None,
    ) -> IntentResponse:
        normalized_text = normalize_text(text)
        requested_action = self._detect_action(normalized_text)
        extracted_medicine = medicine_lookup(text) if medicine_lookup else None
        if not extracted_medicine:
            extracted_medicine = self._match_known_entity(
                normalized_text,
                list(known_medicines) + list(known_salt_keys),
            )
        extracted_symptom = None
        entity_type = "unknown"
        entity_value = None

        if extracted_medicine:
            entity_type = "medicine"
            entity_value = extracted_medicine
        else:
            extracted_symptom = self._extract_symptom_phrase(normalized_text)
            if extracted_symptom:
                entity_type = "symptom"
                entity_value = extracted_symptom

        follow_up_questions = self._build_follow_up_questions(
            entity_type=entity_type,
            entity_value=entity_value,
        )

        return IntentResponse(
            original_text=text,
            entity_type=entity_type,
            entity_value=entity_value,
            requested_action=requested_action,
            extracted_medicine=extracted_medicine,
            extracted_symptom=extracted_symptom,
            follow_up_questions=follow_up_questions,
            confidence=0.72 if entity_value else 0.35,
            parser="heuristic",
        )

    def _normalize_parsed_payload(
        self,
        text: str,
        payload: dict[str, object],
        parser: str,
    ) -> IntentResponse:
        entity_type = str(payload.get("entity_type", "unknown")).lower().strip()
        if entity_type not in {"medicine", "symptom", "unknown"}:
            entity_type = "unknown"

        requested_action = str(payload.get("requested_action", "search")).lower().strip()
        if requested_action not in {
            "search",
            "alternatives",
            "details",
            "uses",
            "unsupported_medical_advice",
        }:
            requested_action = "search"

        entity_value = self._clean_optional_string(payload.get("entity_value"))
        extracted_medicine = self._clean_optional_string(payload.get("extracted_medicine"))
        extracted_symptom = self._clean_optional_string(payload.get("extracted_symptom"))
        follow_up_questions = [
            str(question).strip()
            for question in payload.get("follow_up_questions", [])
            if str(question).strip()
        ][:3]
        confidence = payload.get("confidence", 0.0)

        return IntentResponse(
            original_text=text,
            entity_type=entity_type,
            entity_value=entity_value,
            requested_action=requested_action,
            extracted_medicine=extracted_medicine,
            extracted_symptom=extracted_symptom,
            follow_up_questions=follow_up_questions
            or self._build_follow_up_questions(entity_type, entity_value),
            confidence=max(0.0, min(1.0, float(confidence or 0.0))),
            parser=parser,  # type: ignore[arg-type]
        )

    def _build_prompt_context(
        self,
        text: str,
        known_medicines: Sequence[str],
        known_salt_keys: Sequence[str],
    ) -> str:
        medicine_hints = ", ".join(list(known_medicines)[:25])
        salt_hints = ", ".join(list(known_salt_keys)[:20])
        return (
            f"User text: {text}\n"
            f"Known medicine names: {medicine_hints or 'none'}\n"
            f"Known salt keys: {salt_hints or 'none'}\n"
            "Output JSON only."
        )

    def _detect_action(self, normalized_text: str) -> str:
        if any(
            keyword in normalized_text
            for keyword in [
                "alternative",
                "alternatives",
                "substitute",
                "replacement",
                "same salt",
                "same composition",
                "option",
            ]
        ):
            return "alternatives"
        if any(
            keyword in normalized_text
            for keyword in [
                "side effect",
                "side effects",
                "dosage",
                "dose",
                "safe",
                "safety",
                "interaction",
                "contraindication",
                "pregnant",
            ]
        ):
            return "unsupported_medical_advice"
        if any(keyword in normalized_text for keyword in ["what is", "tell me about", "details"]):
            return "details"
        if any(keyword in normalized_text for keyword in ["used for", "use", "uses", "relief"]):
            return "uses"
        return "search"

    def _match_known_entity(
        self,
        normalized_text: str,
        candidates: Sequence[str],
    ) -> str | None:
        sorted_candidates = sorted(candidates, key=lambda item: len(normalize_text(item)), reverse=True)
        for candidate in sorted_candidates:
            normalized_candidate = normalize_text(candidate)
            if normalized_candidate and normalized_candidate in normalized_text:
                return candidate
        return None

    def _extract_symptom_phrase(self, normalized_text: str) -> str | None:
        symptom_keywords = [
            "fever",
            "headache",
            "pain",
            "body ache",
            "cold",
            "cough",
            "allergy",
            "acidity",
            "heartburn",
            "infection",
            "nausea",
        ]
        for keyword in symptom_keywords:
            if keyword in normalized_text:
                return keyword
        return None

    def _build_follow_up_questions(
        self,
        entity_type: str,
        entity_value: str | None,
    ) -> list[str]:
        if entity_type == "medicine" and entity_value:
            return [
                f"Show alternatives for {entity_value}",
                f"What is {entity_value} used for?",
                "Find fever medicines",
            ]
        if entity_type == "symptom" and entity_value:
            return [
                f"Find more medicines for {entity_value}",
                "Search for paracetamol alternatives",
                "Search by medicine name",
            ]
        return [
            "Search for paracetamol alternatives",
            "Find headache relief medicines",
            "Search by medicine name",
        ]

    def _clean_optional_string(self, value: object) -> str | None:
        cleaned = str(value).strip() if value is not None else ""
        return cleaned or None
