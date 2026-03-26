from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..schemas import AlternativesResponse, MedicineRecord, SearchResponse


def normalize_text(value: str) -> str:
    lowered = value.lower().strip()
    lowered = re.sub(r"[^a-z0-9\s]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def split_uses(value: str) -> list[str]:
    parts = re.split(r"[;,/]|(?:\s+\|\s+)", value)
    uses = [part.strip() for part in parts if part.strip()]
    return uses or ([value.strip()] if value.strip() else [])


def unique_in_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        normalized = normalize_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(value)
    return ordered


class MedicineService:
    REQUIRED_COLUMNS = [
        "name",
        "composition",
        "category",
        "uses",
        "salt_key",
        "manufacturer",
    ]

    SYMPTOM_HINTS: dict[str, list[str]] = {
        "fever": ["fever", "pain relief", "antipyretic", "body ache"],
        "headache": ["headache", "pain relief", "analgesic", "migraine"],
        "pain": ["pain", "analgesic", "anti inflammatory", "pain relief"],
        "cold": ["cold", "cough", "allergy", "decongestant"],
        "cough": ["cough", "cold", "expectorant", "respiratory"],
        "allergy": ["allergy", "antihistamine", "sneezing", "itching"],
        "acidity": ["acidity", "antacid", "acid reflux", "heartburn"],
        "stomach": ["antacid", "digestion", "heartburn", "gas"],
        "infection": ["infection", "antibiotic"],
        "nausea": ["nausea", "vomiting", "antiemetic"],
    }
    COLUMN_ALIASES: dict[str, list[str]] = {
        "name": ["name"],
        "manufacturer": ["manufacturer", "manufacturer_name"],
        "category": ["category", "type"],
        "uses": ["uses"],
        "salt_key": ["salt_key", "primary_salt"],
    }
    COMPOSITION_COLUMNS = ["composition", "short_composition1", "short_composition2", "primary_salt"]
    DISCONTINUED_COLUMNS = ["Is_discontinued", "is_discontinued"]

    def __init__(self, csv_path: Path) -> None:
        if not csv_path.exists():
            raise FileNotFoundError(f"Medicine dataset not found at {csv_path}")

        frame = self._load_frame(csv_path)
        for column in self.REQUIRED_COLUMNS:
            frame[column] = frame[column].astype(str).str.strip()

        frame["uses_list"] = frame["uses"].map(split_uses)

        # Build normalized value lists separately — avoids storing them inside each
        # dict record, which triples memory for 250K+ records. Lists of strings are
        # ~4x more memory-efficient than equivalent dict fields.
        self._norms: dict[str, list[str]] = {
            col: frame[col].map(normalize_text).tolist()
            for col in self.REQUIRED_COLUMNS
        }

        # Store only the fields needed for API responses in the dicts.
        _resp_cols = ["name", "composition", "category", "uses", "salt_key", "manufacturer", "uses_list"]
        self._records: list[dict[str, object]] = frame[_resp_cols].to_dict("records")
        del frame

        name_pairs = {
            (str(record["name"]), self._norms["name"][i])
            for i, record in enumerate(self._records)
            if record["name"]
        }
        salt_pairs = {
            (str(record["salt_key"]), self._norms["salt_key"][i])
            for i, record in enumerate(self._records)
            if record["salt_key"]
        }
        self.known_medicine_names = [
            name for name, _ in sorted(name_pairs, key=lambda item: len(item[1]), reverse=True)
        ]
        self.known_salt_keys = [
            salt for salt, _ in sorted(salt_pairs, key=lambda item: len(item[1]), reverse=True)
        ]

    def _load_frame(self, csv_path: Path) -> pd.DataFrame:
        header = pd.read_csv(csv_path, nrows=0)
        available_columns = set(header.columns)
        requested_columns = {
            column
            for canonical_columns in self.COLUMN_ALIASES.values()
            for column in canonical_columns
            if column in available_columns
        }
        requested_columns.update(
            column for column in self.COMPOSITION_COLUMNS if column in available_columns
        )
        requested_columns.update(
            column for column in self.DISCONTINUED_COLUMNS if column in available_columns
        )

        frame = pd.read_csv(
            csv_path,
            usecols=sorted(requested_columns) if requested_columns else None,
            dtype=str,
        ).fillna("")

        standardized = pd.DataFrame(index=frame.index)
        standardized["name"] = self._pick_first_non_empty(frame, self.COLUMN_ALIASES["name"])
        standardized["manufacturer"] = self._pick_first_non_empty(
            frame,
            self.COLUMN_ALIASES["manufacturer"],
        )
        standardized["category"] = self._pick_first_non_empty(
            frame,
            self.COLUMN_ALIASES["category"],
        )
        standardized["uses"] = self._pick_first_non_empty(frame, self.COLUMN_ALIASES["uses"])
        standardized["salt_key"] = self._clean_salt_key(
            self._pick_first_non_empty(frame, self.COLUMN_ALIASES["salt_key"])
        )
        standardized["composition"] = self._build_composition(frame)

        missing_columns = [
            column
            for column in self.REQUIRED_COLUMNS
            if column not in standardized.columns or not standardized[column].astype(str).str.strip().any()
        ]
        if missing_columns:
            raise ValueError(
                "Dataset is missing required columns or values for: "
                + ", ".join(sorted(missing_columns))
            )

        standardized = standardized[standardized["name"].astype(str).str.strip() != ""].copy()
        standardized = standardized[standardized["salt_key"].astype(str).str.strip() != ""].copy()

        discontinued_column = next(
            (column for column in self.DISCONTINUED_COLUMNS if column in frame.columns),
            None,
        )
        if discontinued_column:
            discontinued_values = (
                frame[discontinued_column].astype(str).str.strip().str.lower()
            )
            keep_mask = ~discontinued_values.isin({"true", "1", "yes"})
            standardized = standardized.loc[keep_mask].copy()

        standardized = standardized.drop_duplicates(
            subset=["name", "manufacturer", "salt_key"],
            keep="first",
        )
        return standardized.reset_index(drop=True)

    def _pick_first_non_empty(
        self,
        frame: pd.DataFrame,
        candidate_columns: list[str],
    ) -> pd.Series:
        result = pd.Series("", index=frame.index, dtype="string")
        for column in candidate_columns:
            if column not in frame.columns:
                continue
            candidate = self._clean_series(frame[column])
            result = result.mask(result.eq(""), candidate)
        return result.fillna("")

    def _build_composition(self, frame: pd.DataFrame) -> pd.Series:
        if "composition" in frame.columns:
            direct = self._clean_series(frame["composition"])
            if direct.str.strip().any():
                return direct

        parts = [
            self._clean_series(frame[column])
            for column in self.COMPOSITION_COLUMNS
            if column in frame.columns and column != "composition"
        ]
        if not parts:
            return pd.Series("", index=frame.index, dtype="string")

        composition = parts[0]
        for part in parts[1:]:
            composition = composition.where(
                part.eq(""),
                composition.where(composition.eq(""), composition + " + ") + part,
            )
        return composition.fillna("")

    def _clean_series(self, series: pd.Series) -> pd.Series:
        return (
            series.fillna("")
            .astype(str)
            .str.replace(r"(?i)^nan$", "", regex=True)
            .str.replace(r"(?i)^none$", "", regex=True)
            .str.strip()
        )

    def _clean_salt_key(self, series: pd.Series) -> pd.Series:
        return (
            self._clean_series(series)
            .str.replace(r"(?i)\+nan\b", "", regex=True)
            .str.replace(r"(?i)\bnan\+", "", regex=True)
            .str.replace(r"(?i)_nan\b", "", regex=True)
            .str.replace(r"\++", "+", regex=True)
            .str.strip("+_ ")
        )

    def find_medicine_mention(self, text: str) -> str | None:
        normalized_text = normalize_text(text)
        candidates = self.known_medicine_names + self.known_salt_keys
        for candidate in candidates:
            normalized_candidate = normalize_text(candidate)
            if normalized_candidate and normalized_candidate in normalized_text:
                return candidate
        return None

    def search(
        self,
        query: str,
        entity_type: str | None = None,
        limit: int = 12,
    ) -> SearchResponse:
        if entity_type == "medicine":
            return self.search_by_medicine(query=query, limit=limit)
        if entity_type == "symptom":
            return self.search_by_symptom(query=query, limit=limit)

        medicine_response = self.search_by_medicine(query=query, limit=limit)
        symptom_response = self.search_by_symptom(query=query, limit=limit)

        medicine_score = medicine_response.primary_result.score if medicine_response.primary_result else 0
        symptom_score = symptom_response.primary_result.score if symptom_response.primary_result else 0

        if medicine_score >= symptom_score and medicine_score > 0:
            return medicine_response
        if symptom_score > 0:
            return symptom_response

        return SearchResponse(
            query=query,
            entity_type="unknown",
            matched_text=None,
            summary="No medicine records matched that query in the current dataset.",
            categories=[],
            primary_result=None,
            medicines=[],
            follow_up_questions=[
                "Search for paracetamol alternatives",
                "Find fever medicines",
                "Search by a medicine name",
            ],
        )

    def search_by_medicine(self, query: str, limit: int = 12) -> SearchResponse:
        normalized_query = normalize_text(query)
        if not normalized_query:
            return SearchResponse(
                query=query,
                entity_type="medicine",
                matched_text=None,
                summary="No medicine query was provided.",
                primary_result=None,
                medicines=[],
                categories=[],
                follow_up_questions=[],
            )

        initial_candidates = self._score_medicine_matches(normalized_query)
        if not initial_candidates:
            return SearchResponse(
                query=query,
                entity_type="medicine",
                matched_text=None,
                summary="No medicines matched that name, composition, or salt key in the dataset.",
                primary_result=None,
                medicines=[],
                categories=[],
                follow_up_questions=[
                    "Search for headache relief",
                    "Find fever medicines",
                    "Try a brand or salt name",
                ],
            )

        primary_candidate = initial_candidates[0]
        primary_record = primary_candidate["record"]
        related_candidates = self._build_related_medicine_candidates(
            primary_record=primary_record,
            seeded_candidates=initial_candidates,
            limit=limit,
        )

        medicines = [
            self._to_response_record(
                record=candidate["record"],
                score=candidate["score"],
                match_tags=candidate["match_tags"],
                match_reason=candidate["match_reason"],
            )
            for candidate in related_candidates
        ]
        primary_result = medicines[0] if medicines else None
        primary_uses = ", ".join(primary_result.uses[:3]) if primary_result else ""
        categories = unique_in_order([medicine.category for medicine in medicines if medicine.category])

        summary = (
            f"{primary_result.name} is in the {primary_result.category} category and is commonly used for "
            f"{primary_uses or 'general symptom relief'}."
            if primary_result
            else "No medicine details were found."
        )

        follow_up_questions = (
            [
                f"Show alternatives for {primary_result.name}",
                f"What is {primary_result.name} used for?",
                f"Find {primary_result.category.lower()} medicines",
            ]
            if primary_result
            else []
        )

        return SearchResponse(
            query=query,
            entity_type="medicine",
            matched_text=primary_result.name if primary_result else None,
            summary=summary,
            categories=categories,
            primary_result=primary_result,
            medicines=medicines,
            follow_up_questions=follow_up_questions,
        )

    def search_by_symptom(self, query: str, limit: int = 12) -> SearchResponse:
        normalized_query = normalize_text(query)
        if not normalized_query:
            return SearchResponse(
                query=query,
                entity_type="symptom",
                matched_text=None,
                summary="No symptom query was provided.",
                primary_result=None,
                medicines=[],
                categories=[],
                follow_up_questions=[],
            )

        symptom_keywords = self._expand_symptom_keywords(normalized_query)
        candidates: list[dict[str, object]] = []

        _norm_uses = self._norms["uses"]
        _norm_cats = self._norms["category"]
        _norm_names = self._norms["name"]

        for i, record in enumerate(self._records):
            normalized_uses = _norm_uses[i]
            normalized_category = _norm_cats[i]
            normalized_name = _norm_names[i]

            score = 0.0
            match_tags: set[str] = set()
            reasons: list[str] = []

            if normalized_query in normalized_uses:
                score += 70
                match_tags.add("uses_match")
                reasons.append("Matched the symptom in medicine uses")
            if normalized_query in normalized_category:
                score += 60
                match_tags.add("category_match")
                reasons.append("Matched the symptom in medicine category")

            for keyword in symptom_keywords:
                if keyword and keyword in normalized_category:
                    score += 24
                    match_tags.add("category_match")
                if keyword and keyword in normalized_uses:
                    score += 18
                    match_tags.add("uses_match")
                if keyword and keyword in normalized_name:
                    score += 10

            if score <= 0:
                continue

            candidates.append(
                {
                    "record": record,
                    "score": score,
                    "match_tags": sorted(match_tags),
                    "match_reason": reasons[0] if reasons else "Matched symptom keywords in the dataset",
                }
            )

        candidates.sort(
            key=lambda item: (
                -float(item["score"]),
                str(item["record"]["name"]).lower(),
            )
        )
        candidates = candidates[:limit]

        medicines = [
            self._to_response_record(
                record=candidate["record"],
                score=candidate["score"],
                match_tags=candidate["match_tags"],
                match_reason=candidate["match_reason"],
            )
            for candidate in candidates
        ]
        primary_result = medicines[0] if medicines else None
        categories = unique_in_order([medicine.category for medicine in medicines if medicine.category])
        summary = (
            f"Matched medicines for {query} using dataset categories and uses"
            + (f": {', '.join(categories[:3])}." if categories else ".")
        )
        if not medicines:
            summary = "No medicines matched that symptom in the current dataset."

        follow_up_questions = []
        if primary_result:
            follow_up_questions = [
                f"Show alternatives for {primary_result.name}",
                f"What is {primary_result.name} used for?",
                f"Find more medicines for {query}",
            ]
        else:
            follow_up_questions = [
                "Search for paracetamol alternatives",
                "Find fever medicines",
                "Search by medicine name",
            ]

        return SearchResponse(
            query=query,
            entity_type="symptom",
            matched_text=query,
            summary=summary,
            categories=categories,
            primary_result=primary_result,
            medicines=medicines,
            follow_up_questions=follow_up_questions,
        )

    def get_alternatives(
        self,
        salt_key: str,
        exclude_name: str | None = None,
        limit: int = 10,
    ) -> AlternativesResponse:
        normalized_salt_key = normalize_text(salt_key)
        normalized_exclude_name = normalize_text(exclude_name or "")

        _norm_salts = self._norms["salt_key"]
        _norm_names = self._norms["name"]
        matches = []
        for i, record in enumerate(self._records):
            if _norm_salts[i] != normalized_salt_key:
                continue
            if normalized_exclude_name and _norm_names[i] == normalized_exclude_name:
                continue
            matches.append(record)

        matches.sort(key=lambda record: str(record["name"]).lower())
        medicines = [
            self._to_response_record(
                record=record,
                score=90.0,
                match_tags=["same_salt"],
                match_reason="Shares the same salt key",
            )
            for record in matches[:limit]
        ]
        return AlternativesResponse(
            salt_key=salt_key,
            count=len(medicines),
            medicines=medicines,
        )

    def _score_medicine_matches(self, normalized_query: str) -> list[dict[str, object]]:
        query_tokens = set(normalized_query.split())
        candidates: list[dict[str, object]] = []

        _norm_names = self._norms["name"]
        _norm_salts = self._norms["salt_key"]
        _norm_comps = self._norms["composition"]
        _norm_manuf = self._norms["manufacturer"]

        for i, record in enumerate(self._records):
            normalized_name = _norm_names[i]
            normalized_salt_key = _norm_salts[i]
            normalized_composition = _norm_comps[i]
            normalized_manufacturer = _norm_manuf[i]

            score = 0.0
            match_tags: set[str] = set()
            reasons: list[str] = []

            if normalized_name == normalized_query:
                score += 125
                match_tags.add("exact_match")
                reasons.append("Exact medicine name match")
            elif normalized_query in normalized_name:
                score += 82
                match_tags.add("name_match")
                reasons.append("Matched medicine name")

            if normalized_salt_key == normalized_query:
                score += 110
                match_tags.add("same_salt")
                reasons.append("Matched salt key")
            elif normalized_query in normalized_salt_key:
                score += 70
                match_tags.add("same_salt")

            if normalized_composition == normalized_query:
                score += 95
                match_tags.add("composition_match")
                reasons.append("Matched composition")
            elif normalized_query in normalized_composition:
                score += 58
                match_tags.add("composition_match")

            if normalized_query in normalized_manufacturer:
                score += 25
                match_tags.add("manufacturer_match")

            token_overlap = len(query_tokens.intersection(set(normalized_name.split())))
            if token_overlap:
                score += token_overlap * 14
                match_tags.add("name_match")

            if score <= 0:
                continue

            candidates.append(
                {
                    "record": record,
                    "score": score,
                    "match_tags": sorted(match_tags),
                    "match_reason": reasons[0] if reasons else "Matched medicine query in the dataset",
                }
            )

        candidates.sort(
            key=lambda item: (
                -float(item["score"]),
                str(item["record"]["name"]).lower(),
            )
        )
        return candidates

    def _build_related_medicine_candidates(
        self,
        primary_record: dict[str, object],
        seeded_candidates: list[dict[str, object]],
        limit: int,
    ) -> list[dict[str, object]]:
        merged: dict[str, dict[str, object]] = {}

        def upsert(candidate: dict[str, object]) -> None:
            name = str(candidate["record"]["name"])
            existing = merged.get(name)
            if not existing or float(candidate["score"]) > float(existing["score"]):
                merged[name] = candidate
                return
            existing_tags = set(existing["match_tags"])
            existing_tags.update(candidate["match_tags"])
            existing["match_tags"] = sorted(existing_tags)

        for candidate in seeded_candidates[:limit]:
            upsert(candidate)

        primary_idx = next(
            (i for i, r in enumerate(self._records) if r is primary_record), None
        )
        primary_salt_key = self._norms["salt_key"][primary_idx] if primary_idx is not None else normalize_text(str(primary_record.get("salt_key", "")))
        primary_category = self._norms["category"][primary_idx] if primary_idx is not None else normalize_text(str(primary_record.get("category", "")))
        primary_name = self._norms["name"][primary_idx] if primary_idx is not None else normalize_text(str(primary_record.get("name", "")))

        _norm_names = self._norms["name"]
        _norm_salts = self._norms["salt_key"]
        _norm_cats = self._norms["category"]

        for i, record in enumerate(self._records):
            score = 0.0
            match_tags: set[str] = set()
            reasons: list[str] = []

            if _norm_names[i] == primary_name:
                score += 200
                match_tags.add("exact_match")
                reasons.append("Primary medicine match")
            if primary_salt_key and _norm_salts[i] == primary_salt_key:
                score += 95
                match_tags.add("same_salt")
                reasons.append("Shares the same salt key")
            if primary_category and _norm_cats[i] == primary_category:
                score += 42
                match_tags.add("same_category")
                reasons.append("Shares the same category")

            if score <= 0:
                continue

            upsert(
                {
                    "record": record,
                    "score": score,
                    "match_tags": sorted(match_tags),
                    "match_reason": reasons[0] if reasons else "Related medicine in the dataset",
                }
            )

        candidates = list(merged.values())
        candidates.sort(
            key=lambda item: (
                -float(item["score"]),
                str(item["record"]["name"]).lower(),
            )
        )
        return candidates[:limit]

    def _expand_symptom_keywords(self, normalized_query: str) -> set[str]:
        keywords = set(normalized_query.split())
        for symptom, hints in self.SYMPTOM_HINTS.items():
            if symptom in normalized_query:
                keywords.update(normalize_text(hint) for hint in hints)
        return {keyword for keyword in keywords if keyword}

    def _to_response_record(
        self,
        record: dict[str, object],
        score: float | int | None = None,
        match_tags: list[str] | None = None,
        match_reason: str | None = None,
    ) -> MedicineRecord:
        normalized_score = round(float(score), 2) if score is not None else None
        return MedicineRecord(
            name=str(record["name"]),
            composition=str(record["composition"]),
            category=str(record["category"]),
            uses=list(record["uses_list"]),
            salt_key=str(record["salt_key"]),
            manufacturer=str(record["manufacturer"]),
            match_reason=match_reason,
            match_tags=match_tags or [],
            score=normalized_score,
        )
