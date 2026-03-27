from __future__ import annotations
from pydantic import BaseModel


class PlanRequest(BaseModel):
    goal: str               # e.g. "lose weight", "build muscle", "maintain"
    diet_type: str          # e.g. "vegetarian", "vegan", "omnivore", "keto"
    calories_target: int | None = None
    allergies: list[str] = []
    days: int = 7           # 1-7
    meals_per_day: int = 3  # 2-5


class Meal(BaseModel):
    name: str
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    ingredients: list[str]
    prep_minutes: int


class DayPlan(BaseModel):
    day: str   # e.g. "Monday"
    meals: list[Meal]
    total_calories: int
    total_protein_g: int


class PlanResponse(BaseModel):
    goal: str
    diet_type: str
    daily_calorie_target: int
    days: list[DayPlan]
    shopping_list: list[str]
    tips: list[str]


class ChatRequest(BaseModel):
    question: str
    plan_summary: str | None = None


class ChatResponse(BaseModel):
    answer: str
