"""
Rule-based answer parser.
Given (question_key, user_answer) → returns the action to apply.
No LLM needed for standard answers — only for genuine ambiguity.
"""

import re

YES_WORDS = {"yes", "y", "yeah", "sure", "ok", "okay", "yep", "please", "want", "add", "need"}
NO_WORDS  = {"no", "n", "nope", "skip", "nah", "dont", "don't", "not", "pass", "none"}

WORD_NUMBERS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}

ROOM_NAMES = {
    "bedroom":    "Bedroom",
    "kitchen":    "Kitchen",
    "livingRoom": "Living Room",
    "bathroom":   "Bathroom",
    "guestRoom":  "Guest Room",
    "dining":     "Dining Room",
    "kidsRoom":   "Kids Room",
    "lobby":      "Lobby",
}


def parse_answer(question_key: str, user_answer: str) -> dict:
    """
    Returns one of:
      { "action": {...} }
      { "action": {...}, "clarify": True, "message": "...", "options": [...] }   ← partial + ask
      { "clarify": True, "message": "...", "options": [...] }
    """
    text = user_answer.strip().lower()

    if question_key == "plot":
        return _parse_plot(user_answer)

    if question_key in ("bedroom", "bathroom"):
        return _parse_count(question_key, text)

    if question_key in ("kitchen", "livingRoom", "guestRoom", "dining", "kidsRoom", "lobby"):
        return _parse_yes_no_room(question_key, text)

    if question_key in ("parking", "poojaRoom", "stairs"):
        return _parse_yes_no_extra(question_key, text)

    # Unknown key — just mark as answered
    return {"action": {"type": "mark_answered", "payload": {"key": question_key}}}


# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_plot(answer: str) -> dict:
    match = re.search(r'(\d+)\s*[x×*by]\s*(\d+)', answer, re.IGNORECASE)
    if match:
        w, l = int(match.group(1)), int(match.group(2))
        return {"action": {"type": "update_plot", "payload": {"width": w, "length": l}}}
    # Single number — not enough
    return {
        "clarify": True,
        "message": "Please share both width and length (e.g. 30×90 or 40×60).",
        "options": ["30×50", "30×60", "40×60", "40×80"],
    }


def _parse_count(room_key: str, text: str) -> dict:
    # Ambiguous "2+1" pattern (only for bedrooms)
    ambiguous = re.search(r'(\d+)\s*\+\s*(\d+)', text)
    if ambiguous and room_key == "bedroom":
        base = int(ambiguous.group(1))
        return {
            "action": {
                "type": "add_room",
                "payload": {"roomType": "bedroom", "count": base, "name": "Bedroom"},
            },
            "clarify": True,
            "message": f"Got {base} bedrooms! What is the '+{ambiguous.group(2)}'?",
            "options": ["Guest Room", "Kids Room", "Study Room", "Pooja Room"],
        }

    # Digit
    nums = re.findall(r'\d+', text)
    if nums:
        count = int(nums[0])
        name = ROOM_NAMES.get(room_key, room_key)
        return {"action": {"type": "add_room", "payload": {"roomType": room_key, "count": count, "name": name}}}

    # Word number (four, three…)
    for word, num in WORD_NUMBERS.items():
        if word in text:
            name = ROOM_NAMES.get(room_key, room_key)
            return {"action": {"type": "add_room", "payload": {"roomType": room_key, "count": num, "name": name}}}

    return {
        "clarify": True,
        "message": f"How many {ROOM_NAMES.get(room_key, room_key).lower()}s would you like?",
        "options": ["1", "2", "3", "4"],
    }


def _parse_yes_no_room(room_key: str, text: str) -> dict:
    words = set(text.split())
    name = ROOM_NAMES.get(room_key, room_key)
    room_type = "entrance" if room_key == "lobby" else room_key

    if words & YES_WORDS:
        return {"action": {"type": "add_room", "payload": {"roomType": room_type, "count": 1, "name": name}}}
    if words & NO_WORDS:
        return {"action": {"type": "mark_answered", "payload": {"key": room_key}}}
    return {"clarify": True, "message": f"Would you like a {name}?", "options": ["Yes", "No"]}


def _parse_yes_no_extra(extra_key: str, text: str) -> dict:
    words = set(text.split())
    labels = {"parking": "parking", "poojaRoom": "pooja room", "stairs": "stairs"}
    label = labels.get(extra_key, extra_key)

    if words & YES_WORDS:
        return {"action": {"type": "add_extra", "payload": {"extraType": extra_key}}}
    if words & NO_WORDS:
        return {"action": {"type": "mark_answered", "payload": {"key": extra_key}}}
    return {"clarify": True, "message": f"Would you like {label}?", "options": ["Yes", "No"]}
