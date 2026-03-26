EXTRA_LABELS = {
    "parking":   "Parking",
    "poojaRoom": "Pooja Room",
    "stairs":    "Stairs",
    "garden":    "Garden",
    "terrace":   "Terrace",
    "store":     "Store Room",
    "gallery":   "Gallery",
    "balcony":   "Balcony",
    "sitout":    "Sitout",
    "porch":     "Porch",
    "setback":   "Setback",
}


def generate_notes(state: dict) -> list:
    """Derive sticky notes from state. Each note optionally carries a deleteAction."""
    notes = []

    if not state:
        return notes

    # Plot size — not deletable
    plot = state.get("plot", {})
    if plot.get("width") and plot.get("length"):
        notes.append({
            "id": "plot",
            "label": "Plot Size",
            "value": f"{plot['width']} x {plot['length']} ft",
        })

    # Road direction — not deletable
    if state.get("roadDirection"):
        notes.append({
            "id": "roadDirection",
            "label": "Road Facing",
            "value": state["roadDirection"],
        })

    # House style — not deletable
    if state.get("houseType"):
        notes.append({
            "id": "houseType",
            "label": "Style",
            "value": state["houseType"].capitalize(),
        })

    # Floors — not deletable
    if state.get("floors"):
        notes.append({
            "id": "floors",
            "label": "Floors",
            "value": str(state["floors"]),
        })

    # Rooms — deletable
    for room in state.get("rooms", []):
        room_type = room.get("roomType", "")
        if not room_type:
            continue
        count = room.get("count", 1)
        name = room.get("name", room_type)
        notes.append({
            "id": room_type,
            "label": name,
            "value": str(count),
            "deleteAction": {
                "type": "remove_room",
                "payload": {"roomType": room_type},
            },
        })

    # Extras — deletable
    for extra_type in state.get("extras", []):
        notes.append({
            "id": extra_type,
            "label": EXTRA_LABELS.get(extra_type, extra_type.capitalize()),
            "value": "Yes",
            "deleteAction": {
                "type": "remove_extra",
                "payload": {"extraType": extra_type},
            },
        })

    # Preferences
    for key, val in state.get("preferences", {}).items():
        notes.append({
            "id": f"pref_{key}",
            "label": key.replace("_", " ").title(),
            "value": str(val),
        })

    return notes