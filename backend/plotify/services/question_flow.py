"""
Defines the ordered question sequence.
Orchestrator calls get_next_question() to always know what to ask next.
"""

FLOW = [
    # ── Core (must complete before Generate is enabled) ──────────────────
    {
        "key":      "plot",
        "phase":    "core",
        "question": "What is the size of your plot? (e.g. 30×90)",
        "options":  [],
    },
    {
        "key":      "bedroom",
        "phase":    "core",
        "question": "How many bedrooms would you like?",
        "options":  ["1", "2", "3", "4"],
    },
    {
        "key":      "kitchen",
        "phase":    "core",
        "question": "Would you like a kitchen?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "livingRoom",
        "phase":    "core",
        "question": "Would you like a living / drawing room?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "bathroom",
        "phase":    "core",
        "question": "How many bathrooms would you like?",
        "options":  ["1", "2", "3"],
    },
    # ── Extras ────────────────────────────────────────────────────────────
    {
        "key":      "guestRoom",
        "phase":    "extras",
        "question": "Would you like a guest room?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "parking",
        "phase":    "extras",
        "question": "Would you like parking space?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "poojaRoom",
        "phase":    "extras",
        "question": "Would you like a pooja room?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "dining",
        "phase":    "extras",
        "question": "Would you like a dining room?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "kidsRoom",
        "phase":    "extras",
        "question": "Would you like a kids room?",
        "options":  ["Yes", "No"],
    },
    # ── Structure ─────────────────────────────────────────────────────────
    {
        "key":      "stairs",
        "phase":    "structure",
        "question": "Will this be a multi-floor home? Would you like stairs?",
        "options":  ["Yes", "No"],
    },
    {
        "key":      "lobby",
        "phase":    "structure",
        "question": "Would you like a lobby / entrance area?",
        "options":  ["Yes", "No"],
    },
]

CORE_KEYS = {"plot", "bedroom", "kitchen", "livingRoom", "bathroom"}

# Map question key → roomType (for checking if already added)
KEY_TO_ROOM = {
    "bedroom":    "bedroom",
    "kitchen":    "kitchen",
    "livingRoom": "livingRoom",
    "bathroom":   "bathroom",
    "guestRoom":  "guestRoom",
    "dining":     "dining",
    "kidsRoom":   "kidsRoom",
    "lobby":      "entrance",
}

# Map question key → extraType
KEY_TO_EXTRA = {
    "parking":   "parking",
    "poojaRoom": "poojaRoom",
    "stairs":    "stairs",
}


def _is_answered(state: dict, key: str) -> bool:
    if key == "plot":
        return bool(state.get("plot", {}).get("width"))

    # Already in answered list (user said No, or explicitly marked)
    if key in state.get("_answered", []):
        return True

    # Check rooms
    if key in KEY_TO_ROOM:
        room_type = KEY_TO_ROOM[key]
        return any(r.get("roomType") == room_type for r in state.get("rooms", []))

    # Check extras
    if key in KEY_TO_EXTRA:
        return KEY_TO_EXTRA[key] in state.get("extras", [])

    return False


def get_next_question(state: dict) -> dict | None:
    """Return the next unanswered question, or None if all done."""
    for item in FLOW:
        if not _is_answered(state, item["key"]):
            return item
    return None


def get_question_by_key(key: str) -> dict | None:
    return next((q for q in FLOW if q["key"] == key), None)


def is_core_complete(state: dict) -> bool:
    return all(_is_answered(state, k) for k in CORE_KEYS)
