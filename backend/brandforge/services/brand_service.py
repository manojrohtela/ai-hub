from __future__ import annotations
import json, re
from groq import Groq
from ..schemas import BrandRequest, BrandResponse, ColorPalette, NameOption, RefineRequest, RefineResponse

_BRAND_SYSTEM = """You are an expert startup branding strategist and creative director.
Generate a complete brand identity for the startup and return a JSON object:
{
  "brand_names": [
    {"name": "<name>", "domain_hint": "<suggested-domain.com>", "rationale": "<why>"},
    {"name": "<name>", "domain_hint": "<suggested-domain.com>", "rationale": "<why>"},
    {"name": "<name>", "domain_hint": "<suggested-domain.com>", "rationale": "<why>"}
  ],
  "taglines": ["<tagline 1>", "<tagline 2>", "<tagline 3>"],
  "brand_voice": "<description of tone, style, personality>",
  "mission_statement": "<one sentence mission>",
  "value_propositions": ["<VP 1>", "<VP 2>", "<VP 3>"],
  "color_palette": {
    "primary": "#<hex>",
    "secondary": "#<hex>",
    "accent": "#<hex>",
    "background": "#<hex>",
    "text": "#<hex>",
    "rationale": "<why these colors fit the brand>"
  },
  "font_recommendations": ["<font name + style>", "<font name + style>"],
  "social_bio": "<150-char social media bio>",
  "elevator_pitch": "<2-3 sentence investor pitch>"
}
Return ONLY the JSON."""

_REFINE_SYSTEM = """You are a branding expert. The user has feedback on their brand package.
Respond with a JSON:
{
  "updated_section": "<the section name being refined>",
  "suggestion": "<your revised suggestion or advice based on the feedback>"
}
Return ONLY the JSON."""


def _extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        return json.loads(fenced.group(1).strip())
    brace = re.search(r"\{[\s\S]+\}", text)
    if brace:
        return json.loads(brace.group(0))
    raise ValueError("No JSON in response")


class BrandService:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Groq(api_key=api_key)
        self._model = model

    def generate(self, req: BrandRequest) -> BrandResponse:
        comp_str = ", ".join(req.competitors) if req.competitors else "none specified"
        user_msg = (
            f"Startup idea: {req.startup_idea}\n"
            f"Industry: {req.industry}\n"
            f"Target audience: {req.target_audience}\n"
            f"Desired brand tone: {req.tone}\n"
            f"Main competitors: {comp_str}"
        )
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _BRAND_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.6,
            max_tokens=1500,
        )
        data = _extract_json(resp.choices[0].message.content or "{}")
        palette = data.get("color_palette", {})
        return BrandResponse(
            brand_names=[NameOption(**n) for n in data.get("brand_names", [])],
            taglines=data.get("taglines", []),
            brand_voice=data.get("brand_voice", ""),
            mission_statement=data.get("mission_statement", ""),
            value_propositions=data.get("value_propositions", []),
            color_palette=ColorPalette(**palette),
            font_recommendations=data.get("font_recommendations", []),
            social_bio=data.get("social_bio", ""),
            elevator_pitch=data.get("elevator_pitch", ""),
        )

    def refine(self, req: RefineRequest) -> RefineResponse:
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _REFINE_SYSTEM},
                {"role": "user", "content": f"Current brand:\n{req.brand_data}\n\nFeedback: {req.feedback}"},
            ],
            temperature=0.5,
            max_tokens=512,
        )
        data = _extract_json(resp.choices[0].message.content or "{}")
        return RefineResponse(
            updated_section=data.get("updated_section", ""),
            suggestion=data.get("suggestion", ""),
        )
