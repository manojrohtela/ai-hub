"""
Orchestrator v2 — LLM-driven architect conversation.

No more fixed question_flow.py dependency.
The LLM decides what to ask, when to ask, and how to respond.
"""

import json
from .state_manager import get_state, apply_action
from .layout_engine import generate_layout
from .notes_generator import generate_notes
from .llm_service import architect_chat


DONE_TRIGGERS = {
    "done", "generate", "finish", "finished", "complete", "ready",
    "that's all", "thats all", "all done", "all set", "create",
    "build", "show", "ok done", "bas", "ban jao", "bana do",
    "plan banao", "generate karo", "ho gaya", "hogaya",
}


def _is_done(message: str) -> bool:
    low = message.lower().strip()
    return any(t in low for t in DONE_TRIGGERS)


def _build_response(message: str, options: list, ready: bool) -> dict:
    state = get_state()
    return {
        "llmResponse": {"message": message, "options": options, "ready": ready},
        "state": state,
        "layout": generate_layout(state),
        "notes": generate_notes(state),
    }


def _has_minimum_info(state: dict) -> bool:
    """Check if we have enough to generate a plan."""
    has_plot = bool(state.get("plot", {}).get("width"))
    has_beds = any(
        r.get("roomType") in ("bedroom", "masterBedroom")
        for r in state.get("rooms", [])
    )
    return has_plot and has_beds


def process_chat(message: str, current_state: dict, action: dict = None,
                 chat_history: list = None) -> dict:
    """
    Process a chat message. Three paths:

    1. Direct action (note deletion from sticky notes) → apply immediately
    2. User says "done" / "generate" → finalize
    3. Everything else → LLM architect agent handles it
    """

    # ── Path 1: Direct action (sticky note delete, etc.) ─────────────────
    if action:
        apply_action(action)
        state = get_state()
        ready = _has_minimum_info(state)
        return _build_response(
            message="Done! Aur kuch change karna hai?",
            options=["Plan generate karo", "Aur changes"],
            ready=ready,
        )

    # ── Path 2: User says done ───────────────────────────────────────────
    if _is_done(message):
        state = get_state()
        if _has_minimum_info(state):
            return _build_response(
                message="Chaliye, aapka plan ready hai! Generate button dabao aur dekho. 🏠",
                options=[],
                ready=True,
            )
        else:
            return _build_response(
                message="Abhi plan banane ke liye thodi aur info chahiye — at least plot size aur bedrooms batao!",
                options=["Plot size batao", "Rooms batao"],
                ready=False,
            )

    # ── Path 3: LLM Architect Agent ──────────────────────────────────────
    state = get_state()

    # Call the AI architect
    llm_result = architect_chat(
        message=message,
        state=state,
        chat_history=chat_history,
    )

    # Apply any extracted actions
    for act in llm_result.get("actions", []):
        act_type = act.get("type", "")
        if act_type:
            apply_action(act)

    # Check readiness
    state = get_state()
    ready = llm_result.get("ready", False) or _has_minimum_info(state)

    return _build_response(
        message=llm_result.get("message", "Samajh gaya! Aur batao."),
        options=llm_result.get("options", []),
        ready=ready,
    )