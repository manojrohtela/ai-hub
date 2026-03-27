from __future__ import annotations
from pydantic import BaseModel


class BrandRequest(BaseModel):
    startup_idea: str
    industry: str
    target_audience: str
    tone: str           # e.g. "professional", "playful", "bold", "minimal"
    competitors: list[str] = []


class ColorPalette(BaseModel):
    primary: str        # hex
    secondary: str      # hex
    accent: str         # hex
    background: str     # hex
    text: str           # hex
    rationale: str


class NameOption(BaseModel):
    name: str
    domain_hint: str    # e.g. "tryacme.com"
    rationale: str


class BrandResponse(BaseModel):
    brand_names: list[NameOption]
    taglines: list[str]
    brand_voice: str
    mission_statement: str
    value_propositions: list[str]
    color_palette: ColorPalette
    font_recommendations: list[str]
    social_bio: str
    elevator_pitch: str


class RefineRequest(BaseModel):
    brand_data: str     # JSON stringified brand response
    feedback: str


class RefineResponse(BaseModel):
    updated_section: str
    suggestion: str
