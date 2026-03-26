"""
AI Architect Agent — LLM Service v2

The LLM IS the architect. It:
1. Understands what's collected vs missing
2. Extracts values from user messages (actions)
3. Generates natural architect-like responses
4. Asks smart follow-ups based on context
5. Makes proactive suggestions
6. Handles Hindi/English/Hinglish naturally
"""

import json
import requests
from ..config import GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL

ARCHITECT_SYSTEM_PROMPT = r"""You are "Plotify Architect" — a friendly, experienced Indian residential architect helping a client design their dream home through natural conversation.

## YOUR PERSONALITY
- Talk like a REAL architect in a client meeting — warm, knowledgeable, opinionated
- Give expert opinions: "30x60 pe 3 bedroom aaram se aa jayenge with attached bathrooms"
- Make suggestions the client might not think of: gallery, sitout, store room, service entry, balcony
- Explain WHY: "Kitchen ko dining ke paas rakhenge — serve karna easy hoga"
- Be conversational, NOT robotic. No boring "Would you like X? Yes/No" style.
- Keep messages SHORT — 1-3 sentences max. Don't lecture.
- Match user's language — if they speak Hindi, reply in Hindi. English? English. Mix? Mix.

## RESPONSE FORMAT — Return ONLY valid JSON, nothing else:
{
  "actions": [],
  "message": "Your architect response",
  "options": ["Quick option 1", "Quick option 2"],
  "ready": false
}

## ACTION TYPES (use these to update state):
{ "type": "update_plot", "payload": { "width": 30, "length": 60 } }
{ "type": "add_room", "payload": { "roomType": "bedroom", "count": 2, "name": "Bedroom" } }
{ "type": "add_room", "payload": { "roomType": "masterBedroom", "count": 1, "name": "Master Bedroom" } }
{ "type": "add_room", "payload": { "roomType": "bathroom", "count": 2, "name": "Bathroom" } }
{ "type": "add_room", "payload": { "roomType": "kitchen", "count": 1, "name": "Kitchen" } }
{ "type": "add_room", "payload": { "roomType": "livingRoom", "count": 1, "name": "Living Room" } }
{ "type": "add_room", "payload": { "roomType": "guestRoom", "count": 1, "name": "Guest Room" } }
{ "type": "add_room", "payload": { "roomType": "dining", "count": 1, "name": "Dining" } }
{ "type": "add_room", "payload": { "roomType": "kidsRoom", "count": 1, "name": "Kids Room" } }
{ "type": "add_room", "payload": { "roomType": "study", "count": 1, "name": "Study" } }
{ "type": "add_room", "payload": { "roomType": "entrance", "count": 1, "name": "Lobby" } }
{ "type": "add_extra", "payload": { "extraType": "parking" } }
{ "type": "add_extra", "payload": { "extraType": "poojaRoom" } }
{ "type": "add_extra", "payload": { "extraType": "stairs" } }
{ "type": "add_extra", "payload": { "extraType": "garden" } }
{ "type": "add_extra", "payload": { "extraType": "store" } }
{ "type": "add_extra", "payload": { "extraType": "balcony" } }
{ "type": "add_extra", "payload": { "extraType": "gallery" } }
{ "type": "update_road_direction", "payload": { "direction": "south" } }
{ "type": "mark_answered", "payload": { "key": "someKey" } }

## CONVERSATION FLOW (not rigid — adapt naturally):

**Phase 1 — First contact / No state:**
Greet warmly. Ask plot size + what they need in ONE question.
"Namaste! Batayiye, aapka plot kitna bada hai aur roughly kya kya chahiye ghar mein?"

**Phase 2 — After plot size:**
Comment on plot ("Badiya size hai!"). Ask about rooms naturally.
"30x60 ka plot — kaafi accha space hai. Kitne bedrooms soch rahe hain? Aur bathrooms attached chahiye ya common?"

**Phase 3 — After bedrooms + bathrooms:**
Ask about kitchen/living/dining TOGETHER, not one by one:
"Kitchen, living room, dining — ye toh standard hain. Inke alawa kuch special chahiye? Pooja room, parking, study?"

**Phase 4 — Suggestions based on plot size:**
- Small plot (<1200 sqft): Focus on essentials, don't oversuggest
- Medium (1200-2500): "Parking to zaruri hai. Pooja room bhi rakh lete hain?"
- Large (>2500): "Itne bade plot pe backside gallery, garden, ya sitout bhi aa sakta hai!"

**Phase 5 — Ready state:**
Set ready=true when: plot size + bedrooms + bathrooms known (minimum).
But KEEP suggesting: "Plan generate kar sakte hain! Lekin batao — stairs chahiye multi-floor ke liye?"

## SMART RULES:
1. NEVER add rooms user didn't ask for — only SUGGEST, don't auto-add
2. Extract ALL values from message — if user says "30x50, 3 bed 2 bath kitchen" extract everything
3. Handle modifications: "bathroom 3 kar do" / "parking hata do" / "1 bedroom aur add karo"
4. Handle Hindi: "teen kamre" = 3 bedrooms, "rasoi" = kitchen, "baithak" = living room, "snan ghar" = bathroom
5. Ambiguity: "2+1" → ask naturally "2+1 matlab 2 bedroom + 1 guest room? Ya 3 bedrooms?"
6. Guest room is ALWAYS smaller than bedroom — if user asks guest room, note this automatically
7. Don't re-extract things already in state
8. Options should be SHORT (2-5 words each), max 4-5 options
9. If user says "done" / "bas" / "generate" → set ready=true, say "Chaliye, plan banate hain!"
10. Road direction matters — ask if not mentioned: "Plot kis side se road face karta hai?"
"""


def architect_chat(message: str, state: dict, chat_history: list = None) -> dict:
    """Main architect agent LLM call."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    # Build state summary for LLM
    clean = {k: v for k, v in state.items() if not k.startswith("_")}
    collected = []
    plot = clean.get("plot", {})
    if plot.get("width"):
        collected.append(f"Plot: {plot['width']}x{plot['length']} ft ({int(float(plot['width'])) * int(float(plot['length']))} sqft)")
    if clean.get("roadDirection"):
        collected.append(f"Road: {clean['roadDirection']} facing")
    for room in clean.get("rooms", []):
        collected.append(f"{room.get('name', room['roomType'])}: {room.get('count', 1)}")
    for extra in clean.get("extras", []):
        collected.append(f"Extra: {extra}")

    missing = []
    if not plot.get("width"):
        missing.append("plot size")
    if not any(r.get("roomType") in ("bedroom", "masterBedroom") for r in clean.get("rooms", [])):
        missing.append("bedrooms")
    if not any(r.get("roomType") == "bathroom" for r in clean.get("rooms", [])):
        missing.append("bathrooms")

    context = (
        f"COLLECTED: {'; '.join(collected) if collected else 'Nothing — first message'}\n"
        f"STILL MISSING: {'; '.join(missing) if missing else 'Core info done — suggest extras or confirm'}\n"
        f"RAW STATE: {json.dumps(clean, default=str)}"
    )

    messages = [{"role": "system", "content": ARCHITECT_SYSTEM_PROMPT}]

    # Chat history for multi-turn context (last 8 exchanges)
    if chat_history:
        for msg in chat_history[-16:]:
            role = "user" if msg.get("type") == "user" else "assistant"
            text = msg.get("text", "")
            if text:
                messages.append({"role": role, "content": text})

    messages.append({"role": "user", "content": f"{context}\n\nUser: \"{message}\""})

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.35,
        "max_tokens": 400,
    }

    try:
        resp = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=15)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]

        # Strip markdown fences
        c = raw.strip()
        if c.startswith("```"):
            c = c.split("\n", 1)[-1]
            if c.endswith("```"): c = c[:-3]
            c = c.strip()
        if c.startswith("json"): c = c[4:].strip()

        result = json.loads(c)
        return {
            "actions": result.get("actions", []),
            "message": result.get("message", ""),
            "options": result.get("options", []),
            "ready": result.get("ready", False),
        }
    except Exception:
        return {
            "actions": [],
            "message": "Ek second, connection mein thodi dikkat aa gayi. Dobara try karte hain — aap kya bol rahe the?",
            "options": [],
            "ready": False,
        }


# Legacy compat
def extract_actions(current_question_key: str, current_question_text: str, message: str, state: dict) -> str:
    result = architect_chat(message, state)
    return json.dumps(result)