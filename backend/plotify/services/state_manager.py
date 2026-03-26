import copy

_state: dict = {}


def get_state() -> dict:
    return copy.deepcopy(_state)


def set_state(new_state: dict) -> dict:
    global _state
    _state = copy.deepcopy(new_state)
    return get_state()


def apply_action(action: dict) -> dict:
    action_type = action.get("type", "")
    payload = action.get("payload", {})
    if not action_type:
        return get_state()

    if action_type == "add_room":
        rt = payload.get("roomType", "")
        if not rt: return get_state()
        rooms = _state.get("rooms", [])
        existing = next((r for r in rooms if r.get("roomType") == rt), None)
        if existing:
            existing["count"] = existing.get("count", 1) + payload.get("count", 1)
        else:
            rooms.append({"roomType": rt, "count": payload.get("count", 1), "name": payload.get("name", rt)})
        _state["rooms"] = rooms

    elif action_type == "remove_room":
        rt = payload.get("roomType", "")
        _state["rooms"] = [r for r in _state.get("rooms", []) if r.get("roomType") != rt]

    elif action_type == "update_room_count":
        rt = payload.get("roomType", "")
        count = payload.get("count", 1)
        rooms = _state.get("rooms", [])
        matched = False
        for r in rooms:
            if r.get("roomType") == rt:
                r["count"] = count; matched = True; break
        if not matched:
            rooms.append({"roomType": rt, "count": count, "name": payload.get("name", rt)})
        _state["rooms"] = rooms

    elif action_type == "update_plot":
        _state["plot"] = {**_state.get("plot", {}), **payload}

    elif action_type == "add_extra":
        et = payload.get("extraType", "")
        if et:
            extras = _state.get("extras", [])
            if et not in extras: extras.append(et)
            _state["extras"] = extras

    elif action_type == "remove_extra":
        et = payload.get("extraType", "")
        _state["extras"] = [e for e in _state.get("extras", []) if e != et]

    elif action_type == "update_road_direction":
        d = payload.get("direction", "")
        if d: _state["roadDirection"] = d

    elif action_type == "update_preference":
        k, v = payload.get("key", ""), payload.get("value")
        if k and v is not None:
            _state.setdefault("preferences", {})[k] = v

    elif action_type == "mark_answered":
        k = payload.get("key", "")
        if k:
            ans = _state.get("_answered", [])
            if k not in ans: ans.append(k)
            _state["_answered"] = ans

    return get_state()


def set_current_question(key: str) -> None:
    _state["_currentQuestionKey"] = key