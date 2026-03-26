"""
Layout engine v7 — Real Indian residential architecture.

FIXED RULES (standard Indian home):
1. SETBACK at BACK (farthest from road, ~5ft open)
2. GALLERY = 3-4ft side passage running front→back, meets setback
3. GARDEN + PARKING = ALWAYS at front (road side), parallel
4. LIVING ROOM after parking, KITCHEN parallel but smaller
5. BEDROOMS at back (private zone)
6. POOJA ROOM after/near kitchen
7. Open spaces = LOBBY (not "Open")
8. STAIRS can be inside lobby
9. PORCH is rare — only if user explicitly adds

VARIANTS:
A: Standard (bedrooms across full width at back)
B: Mirrored (left↔right swap)
C: Bedrooms shifted to one side, kitchen goes deeper
"""

from typing import Optional
import math

BEDROOM_TYPES = frozenset({"bedroom", "masterBedroom", "kidsRoom"})

ROOM_COLORS = {
    "entrance": "#bfdbfe", "livingRoom": "#dbeafe", "tvLounge": "#c7d2fe",
    "dining": "#fed7aa", "parking": "#d1d5db", "garden": "#bbf7d0",
    "lawn": "#d9f99d", "porch": "#e5e7eb", "kitchen": "#bbf7d0",
    "study": "#fde68a", "garage": "#d1d5db", "utility": "#e5e7eb",
    "terrace": "#bae6fd", "store": "#e5e7eb", "bedroom": "#ddd6fe",
    "masterBedroom": "#fbcfe8", "guestRoom": "#c7d2fe", "kidsRoom": "#fde68a",
    "bathroom": "#a5f3fc", "poojaRoom": "#fef3c7", "stairs": "#e5e7eb",
    "lobby": "#f3f4f6", "balcony": "#bae6fd", "gallery": "#f0fdf4",
    "setback": "#fafaf9", "porch": "#e5e7eb", "open": "#ecfccb",
}

EXTRA_NAMES = {
    "parking": "Parking", "poojaRoom": "Pooja Room", "stairs": "Stairs",
    "garden": "Garden", "terrace": "Terrace", "store": "Store Room",
    "gallery": "Gallery", "balcony": "Balcony", "porch": "Porch",
    "setback": "Setback",
}

# weight = relative area share, ratio = w/h, min/max = absolute bounds
ROOM_CONFIG = {
    "entrance":      {"weight": 0.12, "ratio": 1.2,  "min": (4, 4),   "max": (8, 6)},
    "livingRoom":    {"weight": 1.0,  "ratio": 0.85, "min": (10, 10), "max": (20, 20)},
    "tvLounge":      {"weight": 0.8,  "ratio": 0.9,  "min": (10, 10), "max": (18, 18)},
    "dining":        {"weight": 0.6,  "ratio": 0.9,  "min": (8, 8),   "max": (16, 16)},
    "parking":       {"weight": 0.5,  "ratio": 0.6,  "min": (8, 14),  "max": (14, 18)},
    "garden":        {"weight": 0.4,  "ratio": 1.5,  "min": (8, 5),   "max": (20, 10)},
    "lawn":          {"weight": 0.3,  "ratio": 1.8,  "min": (8, 4),   "max": (20, 10)},
    "porch":         {"weight": 0.3,  "ratio": 1.0,  "min": (6, 6),   "max": (12, 10)},
    "kitchen":       {"weight": 0.45, "ratio": 0.8,  "min": (6, 7),   "max": (12, 13)},
    "study":         {"weight": 0.4,  "ratio": 1.0,  "min": (7, 7),   "max": (12, 12)},
    "garage":        {"weight": 0.7,  "ratio": 0.6,  "min": (9, 16),  "max": (14, 18)},
    "utility":       {"weight": 0.15, "ratio": 1.1,  "min": (5, 5),   "max": (10, 8)},
    "terrace":       {"weight": 0.3,  "ratio": 1.5,  "min": (8, 5),   "max": (18, 10)},
    "store":         {"weight": 0.15, "ratio": 1.1,  "min": (5, 5),   "max": (10, 8)},
    "bedroom":       {"weight": 1.0,  "ratio": 0.8,  "min": (9, 10),  "max": (16, 16)},
    "masterBedroom": {"weight": 1.2,  "ratio": 0.9,  "min": (10, 10), "max": (18, 18)},
    "guestRoom":     {"weight": 0.55, "ratio": 0.85, "min": (8, 8),   "max": (12, 12)},
    "kidsRoom":      {"weight": 0.6,  "ratio": 0.85, "min": (8, 8),   "max": (12, 12)},
    "bathroom":      {"weight": 0.2,  "ratio": 0.65, "min": (4, 5),   "max": (7, 9)},
    "poojaRoom":     {"weight": 0.12, "ratio": 0.85, "min": (4, 4),   "max": (7, 7)},
    "stairs":        {"weight": 0.3,  "ratio": 0.75, "min": (6, 8),   "max": (10, 12)},
    "lobby":         {"weight": 0.15, "ratio": 1.0,  "min": (3, 3),   "max": (10, 10)},
    "open":          {"weight": 0.1,  "ratio": 1.0,  "min": (3, 3),   "max": (8, 8)},
    "balcony":       {"weight": 0.15, "ratio": 2.0,  "min": (4, 3),   "max": (10, 5)},
    "gallery":       {"weight": 0.08, "ratio": 0.15, "min": (3, 10),  "max": (4, 40)},
    "setback":       {"weight": 0.05, "ratio": 6.0,  "min": (4, 3),   "max": (30, 5)},
}
_DEF = {"weight": 0.3, "ratio": 1.0, "min": (6, 6), "max": (14, 14)}

DOOR_SIDE = {
    "entrance": "south", "livingRoom": "south", "tvLounge": "south",
    "dining": "west", "parking": "south", "garden": None, "lawn": None,
    "porch": "south", "kitchen": "east", "bedroom": "south",
    "masterBedroom": "south", "guestRoom": "south", "kidsRoom": "south",
    "bathroom": "west", "poojaRoom": "east", "stairs": None,
    "study": "south", "store": "north", "open": None, "balcony": None,
    "gallery": None, "setback": None, "lobby": None,
}

WALL_T = 0.75
WINDOW_ROOMS = frozenset({
    "bedroom", "masterBedroom", "guestRoom", "kidsRoom",
    "livingRoom", "dining", "kitchen", "study", "tvLounge",
})
_ROT = {
    "north": {"north":"south","south":"north","east":"west","west":"east"},
    "east":  {"north":"west","south":"east","east":"north","west":"south"},
    "west":  {"north":"east","south":"west","east":"south","west":"north"},
    "south": {"north":"north","south":"south","east":"east","west":"west"},
}


def _dims(entries, pw, pl):
    usable = pw * pl * 0.88
    tw = sum(ROOM_CONFIG.get(e["roomType"], _DEF)["weight"] for e in entries) or 1
    counts = {}
    for e in entries: counts[e["roomType"]] = counts.get(e["roomType"], 0) + 1
    d = {}
    for rt, cnt in counts.items():
        cfg = ROOM_CONFIG.get(rt, _DEF)
        per = (cfg["weight"] * cnt / tw) * usable / cnt
        r = cfg["ratio"]
        w = max(cfg["min"][0], min(cfg["max"][0], round(math.sqrt(per * r), 1)))
        h = max(cfg["min"][1], min(cfg["max"][1], round(math.sqrt(per / r), 1)))
        d[rt] = (min(w, pw * 0.55), min(h, pl * 0.3))
    return d

def _expand(rooms):
    o = []
    for r in rooms:
        c, rt, nm = r.get("count",1), r.get("roomType","room"), r.get("name",r.get("roomType","room"))
        for i in range(c): o.append({"roomType":rt, "name":nm if c==1 else f"{nm} {i+1}"})
    return o

def _extras(extras):
    return [{"roomType":e, "name":EXTRA_NAMES.get(e,e.capitalize())} for e in extras]

def _c(rt): return ROOM_COLORS.get(rt, "#e5e7eb")
def _d(rt): return DOOR_SIDE.get(rt, "south")
def _z(rt):
    if rt in BEDROOM_TYPES or rt == "bathroom": return "private"
    if rt in ("kitchen","dining","stairs","poojaRoom","study","store","utility","tvLounge","guestRoom","lobby"): return "semi-private"
    return "public"
def _r(d, road):
    if d is None or road == "south": return d
    return _ROT.get(road, {}).get(d, d)


def _row(entries, y, pw, depth, dims, road="south"):
    if not entries: return []
    pws = [dims.get(e["roomType"],(10,10))[0] for e in entries]
    tpw = sum(pws) or 1
    raw = [(p/tpw)*pw for p in pws]
    cap = [min(r, p*2.0) for r,p in zip(raw, pws)]
    rem = pw - sum(cap)
    if rem > 0.01:
        for _ in range(5):
            hr = [max(p*2-c,0) for c,p in zip(cap, pws)]
            th = sum(hr)
            if th < 0.01: cap = [(p/tpw)*pw for p in pws]; break
            cap = [c+h/th*rem for c,h in zip(cap, hr)]
            rem = pw - sum(cap); 
            if abs(rem)<0.01: break
    out, x = [], 0.0
    for e, aw in zip(entries, cap):
        rt = e["roomType"]
        il, ir = x<0.01, abs(x+aw-pw)<0.01
        win = []
        if rt in WINDOW_ROOMS:
            if il: win.append("west")
            if ir: win.append("east")
        rd = {"roomType":rt, "name":e["name"], "x":round(x,2), "y":round(y,2),
              "width":round(aw,2), "height":round(depth,2), "color":_c(rt),
              "door":_r(_d(rt),road), "zone":_z(rt), "windows":win}
        if rt=="stairs": rd["stairType"]="L-shaped" if aw>=8 else "straight"; rd["stairDir"]="up"
        out.append(rd); x+=aw
    return out


def _build(entries, pw, pl, dims, road="south", mirror=False, alt=False):
    """
    Layout order (TOP to BOTTOM, top = back of plot, bottom = road):
    
    1. SETBACK (back boundary, ~5ft)
    2. BEDROOMS + attached bathrooms (private, backside)
    3. GUEST ROOM + common bath
    4. POOJA ROOM + LOBBY/STAIRS (after kitchen zone)
    5. KITCHEN + LIVING ROOM (parallel, kitchen smaller)
    6. DINING (if present)
    7. PARKING + GARDEN (front, road side)
    
    GALLERY = side strip (not a row) — handled separately
    """
    by = {}
    for e in entries: by.setdefault(e["roomType"],[]).append(e)

    bedrooms = []
    for rt in ("masterBedroom","bedroom","kidsRoom"): bedrooms.extend(by.get(rt,[]))
    guests   = list(by.get("guestRoom",[]))
    baths    = list(by.get("bathroom",[]))
    kitchens = list(by.get("kitchen",[]))
    dinings  = list(by.get("dining",[]))
    livings  = list(by.get("livingRoom",[]))
    parkings = list(by.get("parking",[]))
    gardens  = list(by.get("garden",[]))
    stairs_l = list(by.get("stairs",[]))
    pooja    = list(by.get("poojaRoom",[]))
    studies  = list(by.get("study",[]))
    stores   = list(by.get("store",[]))
    entrances= list(by.get("entrance",[]))
    porches  = list(by.get("porch",[]))
    garages  = list(by.get("garage",[]))
    galleries= list(by.get("gallery",[]))
    balconies= list(by.get("balcony",[]))
    setbacks = list(by.get("setback",[]))
    terraces = list(by.get("terrace",[]))

    D = lambda rt: dims.get(rt,(10,10))
    rows = []
    bi = 0
    if alt: bedrooms = list(reversed(bedrooms))
    bpr = 2 if pw >= 25 else 1

    # Has gallery? Reserve side width
    has_gallery = len(galleries) > 0
    gallery_w = 4 if has_gallery else 0  # 4ft gallery passage
    usable_w = pw - gallery_w  # rooms use this width, gallery takes the rest

    # ── ROW 1: SETBACK (back of plot, farthest from road) ──────────────
    if setbacks:
        rows.append((setbacks, 5))

    # ── ROW 2: BEDROOMS + attached bathrooms (PRIVATE, back) ──────────
    for i in range(0, len(bedrooms), bpr):
        re = []
        for bed in bedrooms[i:i+bpr]:
            if mirror:
                if bi<len(baths): re.append(baths[bi]); bi+=1
                re.append(bed)
            else:
                re.append(bed)
                if bi<len(baths): re.append(baths[bi]); bi+=1
        # Fill leftover width with lobby (not "open")
        prw = sum(D(e["roomType"])[0] for e in re)
        if usable_w - prw > 4:
            re.append({"roomType":"lobby","name":"Lobby"})
        d = max((D(e["roomType"])[1] for e in re), default=10)
        rows.append((re, d))

    # ── ROW 3: GUEST ROOM + common bathrooms + study ──────────────────
    remaining_baths = baths[bi:]
    guest_row = list(guests) + list(remaining_baths) + list(studies) + list(terraces)
    if len(guest_row) == 1 and guest_row[0]["roomType"] == "guestRoom":
        guest_row.append({"roomType":"lobby","name":"Lobby"})
    if guest_row:
        d = max((D(e["roomType"])[1] for e in guest_row), default=10)
        rows.append((guest_row, d))

    # ── ROW 4: POOJA + STAIRS/LOBBY (service, after bedrooms) ─────────
    svc = list(pooja) + list(stairs_l) + list(stores)
    # If no stairs but leftover space, add lobby
    if svc and not stairs_l:
        svc.append({"roomType":"lobby","name":"Lobby"})
    if svc:
        d = max((D(e["roomType"])[1] for e in svc), default=8)
        rows.append((svc, d))

    # ── ROW 5: KITCHEN + LIVING ROOM parallel (kitchen SMALLER) ───────
    kl = []
    if mirror:
        kl.extend(livings); kl.extend(kitchens)
    else:
        kl.extend(kitchens); kl.extend(livings)
    kl.extend(entrances)
    if kl:
        d = max((D(e["roomType"])[1] for e in kl), default=12)
        rows.append((kl, d))

    # ── ROW 6: DINING (if present, between kitchen and parking) ───────
    if dinings:
        d = max((D(e["roomType"])[1] for e in dinings), default=10)
        rows.append((dinings, d))

    # ── ROW 7: PARKING + GARDEN parallel (ALWAYS front, road side) ────
    front = []
    if mirror:
        front.extend(gardens); front.extend(garages); front.extend(parkings)
    else:
        front.extend(parkings); front.extend(garages); front.extend(gardens)
    front.extend(porches); front.extend(balconies)
    if front:
        d = max((D(e["roomType"])[1] for e in front), default=10)
        d = min(d, 18)  # parking max 18ft
        rows.append((front, d))

    # ── Place rows ──────────────────────────────────────────────────────
    if not rows: return []
    th = sum(d for _,d in rows)
    sy = min(pl / th if th>0 else 1.0, 1.2)

    all_rooms = []
    y = 0.0
    for re, pd in rows:
        ad = round(pd * sy, 2)
        # Cap parking/front row
        if any(e["roomType"] in ("parking","garage","garden") for e in re):
            ad = min(ad, 18)
        rw = usable_w if has_gallery else pw
        all_rooms.extend(_row(re, y, rw, ad, dims, road))
        y += ad

    # ── GALLERY: side passage (runs full height on one side) ──────────
    if has_gallery and all_rooms:
        total_h = y
        gx = usable_w if not mirror else 0  # right side normally, left if mirrored
        all_rooms.append({
            "roomType": "gallery", "name": "Gallery",
            "x": round(gx, 2), "y": 0,
            "width": round(gallery_w, 2), "height": round(total_h, 2),
            "color": _c("gallery"), "door": None,
            "zone": "semi-private", "windows": [],
        })

    # Remaining space at bottom = approach area
    remaining = pl - y
    if remaining > 2:
        all_rooms.extend(_row([{"roomType":"lobby","name":"Approach"}], y, pw, round(remaining,2), dims, road))

    # ── Post: guest < bedroom ───────────────────────────────────────────
    bed_a = max((r["width"]*r["height"] for r in all_rooms if r["roomType"] in BEDROOM_TYPES), default=0)
    if bed_a > 0:
        for r in all_rooms:
            if r["roomType"]=="guestRoom" and r["width"]*r["height"] >= bed_a:
                r["width"] = round(min(r["width"], bed_a*0.7/r["height"]), 2)

    # ── Windows ─────────────────────────────────────────────────────────
    if all_rooms:
        miny = min(r["y"] for r in all_rooms)
        maxy = max(r["y"]+r["height"] for r in all_rooms)
        for r in all_rooms:
            if r["roomType"] in WINDOW_ROOMS:
                if abs(r["y"]-miny)<0.01: r["windows"].append("north")
                if abs(r["y"]+r["height"]-maxy)<0.5: r["windows"].append("south")

    return all_rooms


def generate_layout(state):
    plot = state.get("plot",{})
    pw = float(plot.get("width",30))
    pl = float(plot.get("length",60))
    road = (state.get("roadDirection") or "south").lower()
    entries = _expand(state.get("rooms",[])) + _extras(state.get("extras",[]))
    if not entries:
        return {"variants":[],"plotWidth":pw,"plotLength":pl,"totalArea":0,
                "description":"No rooms yet","wallThickness":WALL_T,"roadDirection":road}
    dims = _dims(entries, pw, pl)
    variants = [
        {"id":1,"label":"Layout A","rooms":_build(entries,pw,pl,dims,road,False,False)},
        {"id":2,"label":"Layout B","rooms":_build(entries,pw,pl,dims,road,True,False)},
        {"id":3,"label":"Layout C","rooms":_build(entries,pw,pl,dims,road,False,True)},
    ]
    parts = []
    if state.get("houseType"): parts.append(state["houseType"].capitalize())
    parts.append(f"{len(entries)} rooms")
    if plot.get("width"): parts.append(f"{int(pw)}×{int(pl)} ft")
    if state.get("roadDirection"): parts.append(f"{state['roadDirection']} facing")
    return {"variants":variants,"plotWidth":pw,"plotLength":pl,
            "totalArea":pw*pl,"description":" • ".join(parts),
            "wallThickness":WALL_T,"roadDirection":road}