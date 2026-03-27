from __future__ import annotations
import json, re
from groq import Groq
from ..schemas import ChatResponse, DayPlan, Meal, PlanRequest, PlanResponse

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

_PLAN_SYSTEM = """You are a professional nutritionist and meal planner. Create a personalised meal plan
and return it as a JSON object with exactly this structure:
{
  "daily_calorie_target": <int>,
  "days": [
    {
      "day": "<day name>",
      "meals": [
        {
          "name": "<meal name>",
          "calories": <int>,
          "protein_g": <int>,
          "carbs_g": <int>,
          "fat_g": <int>,
          "ingredients": ["<item>", ...],
          "prep_minutes": <int>
        }
      ],
      "total_calories": <int>,
      "total_protein_g": <int>
    }
  ],
  "shopping_list": ["<item>", ...],
  "tips": ["<nutrition or lifestyle tip>", ...]
}
Return ONLY the JSON — no markdown, no extra text."""

_CHAT_SYSTEM = """You are a friendly, expert nutritionist. Answer the user's question about diet,
nutrition, meal planning, or healthy eating clearly and concisely. Keep responses under 200 words."""


def _extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        return json.loads(fenced.group(1).strip())
    brace = re.search(r"\{[\s\S]+\}", text)
    if brace:
        return json.loads(brace.group(0))
    raise ValueError("No JSON in response")


class NutritionService:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Groq(api_key=api_key)
        self._model = model

    def generate_plan(self, req: PlanRequest) -> PlanResponse:
        allergy_str = ", ".join(req.allergies) if req.allergies else "none"
        user_msg = (
            f"Goal: {req.goal}\n"
            f"Diet type: {req.diet_type}\n"
            f"Calorie target: {req.calories_target or 'auto-calculate based on goal'} kcal/day\n"
            f"Allergies/avoid: {allergy_str}\n"
            f"Number of days: {req.days}\n"
            f"Meals per day: {req.meals_per_day}\n"
            f"Day names: {', '.join(DAYS[:req.days])}"
        )
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _PLAN_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.4,
            max_tokens=3000,
        )
        data = _extract_json(resp.choices[0].message.content or "{}")

        days = [
            DayPlan(
                day=d["day"],
                meals=[Meal(**m) for m in d.get("meals", [])],
                total_calories=d.get("total_calories", 0),
                total_protein_g=d.get("total_protein_g", 0),
            )
            for d in data.get("days", [])
        ]

        return PlanResponse(
            goal=req.goal,
            diet_type=req.diet_type,
            daily_calorie_target=data.get("daily_calorie_target", req.calories_target or 2000),
            days=days,
            shopping_list=data.get("shopping_list", []),
            tips=data.get("tips", []),
        )

    def chat(self, question: str, plan_summary: str | None) -> ChatResponse:
        context = f"User's current plan context:\n{plan_summary}\n\n" if plan_summary else ""
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _CHAT_SYSTEM},
                {"role": "user", "content": f"{context}Question: {question}"},
            ],
            temperature=0.5,
            max_tokens=512,
        )
        return ChatResponse(answer=resp.choices[0].message.content or "")
