from __future__ import annotations

import csv
import heapq
import os
import re
import sqlite3
from contextlib import contextmanager
from itertools import count
from pathlib import Path
from typing import Iterator, Mapping, Sequence

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
    READ_BATCH_SIZE = 2_000

    def __init__(self, csv_path: Path) -> None:
        if not csv_path.exists():
            raise FileNotFoundError(f"Medicine dataset not found at {csv_path}")

        self._csv_path = csv_path
        self._db_path = csv_path.with_suffix(".sqlite3")
        self._ensure_database()

    @property
    def known_medicine_names(self) -> list[str]:
        return self.get_prompt_medicine_names()

    @property
    def known_salt_keys(self) -> list[str]:
        return self.get_prompt_salt_keys()

    def _ensure_database(self) -> None:
        csv_mtime = self._csv_path.stat().st_mtime
        db_exists = self._db_path.exists()
        db_is_fresh = db_exists and self._db_path.stat().st_mtime >= csv_mtime

        if db_is_fresh:
            return

        build_path = self._db_path.with_suffix(self._db_path.suffix + ".building")
        if build_path.exists():
            build_path.unlink()

        self._build_database(self._csv_path, build_path)
        os.replace(build_path, self._db_path)

    def _build_database(self, csv_path: Path, db_path: Path) -> None:
        with csv_path.open("r", newline="", encoding="utf-8", errors="replace") as csv_file:
            reader = csv.DictReader(csv_file)
            if not reader.fieldnames:
                raise ValueError(f"Medicine dataset at {csv_path} has no header row")

            available_columns = set(reader.fieldnames)
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

            with sqlite3.connect(str(db_path)) as conn:
                conn.execute("PRAGMA journal_mode = OFF")
                conn.execute("PRAGMA synchronous = OFF")
                conn.execute("PRAGMA temp_store = MEMORY")
                conn.execute(
                    """
                    CREATE TABLE medicines (
                        name TEXT NOT NULL,
                        composition TEXT NOT NULL,
                        category TEXT NOT NULL,
                        uses TEXT NOT NULL,
                        salt_key TEXT NOT NULL,
                        manufacturer TEXT NOT NULL,
                        normalized_name TEXT NOT NULL,
                        normalized_composition TEXT NOT NULL,
                        normalized_category TEXT NOT NULL,
                        normalized_uses TEXT NOT NULL,
                        normalized_salt_key TEXT NOT NULL,
                        normalized_manufacturer TEXT NOT NULL
                    )
                    """
                )

                insert_sql = (
                    "INSERT INTO medicines ("
                    "name, composition, category, uses, salt_key, manufacturer, "
                    "normalized_name, normalized_composition, normalized_category, "
                    "normalized_uses, normalized_salt_key, normalized_manufacturer"
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )

                batch: list[tuple[str, ...]] = []
                for row in reader:
                    standardized = self._standardize_row(row, requested_columns)
                    if standardized is None:
                        continue

                    batch.append(
                        (
                            standardized["name"],
                            standardized["composition"],
                            standardized["category"],
                            standardized["uses"],
                            standardized["salt_key"],
                            standardized["manufacturer"],
                            normalize_text(standardized["name"]),
                            normalize_text(standardized["composition"]),
                            normalize_text(standardized["category"]),
                            normalize_text(standardized["uses"]),
                            normalize_text(standardized["salt_key"]),
                            normalize_text(standardized["manufacturer"]),
                        )
                    )

                    if len(batch) >= self.READ_BATCH_SIZE:
                        conn.executemany(insert_sql, batch)
                        batch.clear()

                if batch:
                    conn.executemany(insert_sql, batch)

                conn.execute("CREATE INDEX idx_medicines_name ON medicines(normalized_name)")
                conn.execute("CREATE INDEX idx_medicines_salt_key ON medicines(normalized_salt_key)")
                conn.execute("CREATE INDEX idx_medicines_category ON medicines(normalized_category)")
                conn.execute("CREATE INDEX idx_medicines_uses ON medicines(normalized_uses)")
                conn.execute("CREATE INDEX idx_medicines_composition ON medicines(normalized_composition)")
                conn.execute("CREATE INDEX idx_medicines_manufacturer ON medicines(normalized_manufacturer)")
                conn.commit()

    def _standardize_row(
        self,
        row: Mapping[str, str],
        requested_columns: set[str],
    ) -> dict[str, str] | None:
        normalized_row = {column: self._clean_value(row.get(column, "")) for column in requested_columns}

        name = self._pick_first_non_empty_from_row(normalized_row, self.COLUMN_ALIASES["name"])
        manufacturer = self._pick_first_non_empty_from_row(
            normalized_row,
            self.COLUMN_ALIASES["manufacturer"],
        )
        category = self._pick_first_non_empty_from_row(normalized_row, self.COLUMN_ALIASES["category"])
        uses = self._pick_first_non_empty_from_row(normalized_row, self.COLUMN_ALIASES["uses"])
        salt_key = self._clean_salt_key(
            self._pick_first_non_empty_from_row(normalized_row, self.COLUMN_ALIASES["salt_key"])
        )
        composition = self._build_composition_from_row(normalized_row)

        if not name or not salt_key:
            return None

        discontinued_value = next(
            (
                normalized_row[column]
                for column in self.DISCONTINUED_COLUMNS
                if column in normalized_row and normalized_row[column]
            ),
            "",
        ).lower()
        if discontinued_value in {"true", "1", "yes"}:
            return None

        return {
            "name": name,
            "composition": composition,
            "category": category,
            "uses": uses,
            "salt_key": salt_key,
            "manufacturer": manufacturer,
        }

    def _pick_first_non_empty_from_row(
        self,
        row: Mapping[str, str],
        candidate_columns: list[str],
    ) -> str:
        for column in candidate_columns:
            value = self._clean_value(row.get(column, ""))
            if value:
                return value
        return ""

    def _build_composition_from_row(self, row: Mapping[str, str]) -> str:
        direct = self._clean_value(row.get("composition", ""))
        if direct:
            return direct

        parts = [
            self._clean_value(row.get(column, ""))
            for column in self.COMPOSITION_COLUMNS
            if column in row and column != "composition"
        ]
        parts = [part for part in parts if part]
        if not parts:
            return ""
        return " + ".join(parts)

    def _clean_value(self, value: object) -> str:
        text = str(value or "")
        text = text.replace("\x00", " ").strip()
        if text.lower() in {"nan", "none", "null"}:
            return ""
        return text

    def _clean_salt_key(self, value: str) -> str:
        cleaned = (
            self._clean_value(value)
            .replace("+nan", "")
            .replace("nan+", "")
            .replace("_nan", "")
        )
        cleaned = re.sub(r"\++", "+", cleaned)
        return cleaned.strip("+_ ")

    @contextmanager
    def _open_connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(f"file:{self._db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA query_only = ON")
            yield conn
        finally:
            conn.close()

    def _fetch_rows(
        self,
        conn: sqlite3.Connection,
        columns: Sequence[str],
        where_clause: str = "",
        params: Sequence[object] = (),
    ) -> Iterator[dict[str, str]]:
        sql = f"SELECT {', '.join(columns)} FROM medicines"
        if where_clause:
            sql = f"{sql} WHERE {where_clause}"

        cursor = conn.execute(sql, params)
        while True:
            rows = cursor.fetchmany(self.READ_BATCH_SIZE)
            if not rows:
                break
            for row in rows:
                yield dict(row)

    def _fetch_one(
        self,
        conn: sqlite3.Connection,
        columns: Sequence[str],
        where_clause: str,
        params: Sequence[object],
    ) -> dict[str, str] | None:
        sql = f"SELECT {', '.join(columns)} FROM medicines WHERE {where_clause} LIMIT 1"
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row is not None else None

    def _push_candidate(
        self,
        heap: list[tuple[float, int, dict[str, object]]],
        candidate: dict[str, object],
        max_size: int,
        seq: count,
    ) -> None:
        score = float(candidate["score"])
        entry = (score, next(seq), candidate)
        if len(heap) < max_size:
            heapq.heappush(heap, entry)
            return

        if score > heap[0][0]:
            heapq.heapreplace(heap, entry)

    def _finalize_candidates(self, heap: list[tuple[float, int, dict[str, object]]]) -> list[dict[str, object]]:
        candidates = [entry[2] for entry in heap]
        candidates.sort(
            key=lambda item: (
                -float(item["score"]),
                str(item["record"]["name"]).lower(),
            )
        )
        return candidates

    def _row_to_response_record(
        self,
        record: Mapping[str, object],
        score: float | int | None = None,
        match_tags: list[str] | None = None,
        match_reason: str | None = None,
    ) -> MedicineRecord:
        normalized_score = round(float(score), 2) if score is not None else None
        uses_value = str(record.get("uses", ""))
        return MedicineRecord(
            name=str(record.get("name", "")),
            composition=str(record.get("composition", "")),
            category=str(record.get("category", "")),
            uses=split_uses(uses_value),
            salt_key=str(record.get("salt_key", "")),
            manufacturer=str(record.get("manufacturer", "")),
            match_reason=match_reason,
            match_tags=match_tags or [],
            score=normalized_score,
        )

    def get_prompt_medicine_names(self, limit: int = 25) -> list[str]:
        with self._open_connection() as conn:
            rows = conn.execute(
                """
                SELECT name
                FROM medicines
                WHERE name <> ''
                ORDER BY LENGTH(normalized_name) DESC, name
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [str(row["name"]) for row in rows]

    def get_prompt_salt_keys(self, limit: int = 20) -> list[str]:
        with self._open_connection() as conn:
            rows = conn.execute(
                """
                SELECT salt_key
                FROM medicines
                WHERE salt_key <> ''
                ORDER BY LENGTH(normalized_salt_key) DESC, salt_key
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [str(row["salt_key"]) for row in rows]

    def find_medicine_mention(self, text: str) -> str | None:
        normalized_text = normalize_text(text)
        if not normalized_text:
            return None

        tokens = normalized_text.split()
        phrases = self._build_candidate_phrases(tokens)
        if not phrases:
            return None

        with self._open_connection() as conn:
            for phrase in phrases:
                wildcard = f"%{phrase}%"
                exact_match = self._fetch_one(
                    conn,
                    ["name"],
                    "normalized_name = ? OR normalized_salt_key = ?",
                    (phrase, phrase),
                )
                if exact_match:
                    return str(exact_match["name"])

                exact_composition_match = self._fetch_one(
                    conn,
                    ["composition"],
                    "normalized_composition = ?",
                    (phrase,),
                )
                if exact_composition_match:
                    return phrase

                composition_match = self._fetch_one(
                    conn,
                    ["composition"],
                    "normalized_composition LIKE ?",
                    (wildcard,),
                )
                if composition_match:
                    return phrase

                fuzzy_name_match = self._fetch_one(
                    conn,
                    ["name"],
                    "normalized_name LIKE ? OR normalized_salt_key LIKE ?",
                    (wildcard, wildcard),
                )
                if fuzzy_name_match:
                    return str(fuzzy_name_match["name"])

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

        initial_candidates = self._score_medicine_matches(normalized_query, limit=limit)
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
            self._row_to_response_record(
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
        candidates: list[tuple[float, int, dict[str, object]]] = []
        candidate_limit = max(limit * 8, 50)
        seq = count()

        with self._open_connection() as conn:
            for record in self._fetch_rows(
                conn,
                [
                    "name",
                    "composition",
                    "category",
                    "uses",
                    "salt_key",
                    "manufacturer",
                    "normalized_name",
                    "normalized_composition",
                    "normalized_category",
                    "normalized_uses",
                    "normalized_salt_key",
                    "normalized_manufacturer",
                ],
            ):
                normalized_uses = record["normalized_uses"]
                normalized_category = record["normalized_category"]
                normalized_name = record["normalized_name"]

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

                self._push_candidate(
                    candidates,
                    {
                        "record": record,
                        "score": score,
                        "match_tags": sorted(match_tags),
                        "match_reason": reasons[0] if reasons else "Matched symptom keywords in the dataset",
                    },
                    candidate_limit,
                    seq,
                )

        ranked_candidates = self._finalize_candidates(candidates)
        medicines = [
            self._row_to_response_record(
                record=candidate["record"],
                score=candidate["score"],
                match_tags=candidate["match_tags"],
                match_reason=candidate["match_reason"],
            )
            for candidate in ranked_candidates[:limit]
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

        with self._open_connection() as conn:
            params: list[object] = [normalized_salt_key]
            where_clause = "normalized_salt_key = ?"
            if normalized_exclude_name:
                where_clause += " AND normalized_name != ?"
                params.append(normalized_exclude_name)

            rows = conn.execute(
                f"""
                SELECT name, composition, category, uses, salt_key, manufacturer
                FROM medicines
                WHERE {where_clause}
                ORDER BY name
                LIMIT ?
                """,
                (*params, limit),
            ).fetchall()

        medicines = [
            self._row_to_response_record(
                record=dict(row),
                score=90.0,
                match_tags=["same_salt"],
                match_reason="Shares the same salt key",
            )
            for row in rows
        ]
        return AlternativesResponse(
            salt_key=salt_key,
            count=len(medicines),
            medicines=medicines,
        )

    def _score_medicine_matches(self, normalized_query: str, limit: int = 12) -> list[dict[str, object]]:
        query_tokens = set(normalized_query.split())
        candidates: list[tuple[float, int, dict[str, object]]] = []
        candidate_limit = max(limit * 8, 50)
        seq = count()

        with self._open_connection() as conn:
            for record in self._fetch_rows(
                conn,
                [
                    "name",
                    "composition",
                    "category",
                    "uses",
                    "salt_key",
                    "manufacturer",
                    "normalized_name",
                    "normalized_composition",
                    "normalized_category",
                    "normalized_uses",
                    "normalized_salt_key",
                    "normalized_manufacturer",
                ],
            ):
                normalized_name = record["normalized_name"]
                normalized_salt_key = record["normalized_salt_key"]
                normalized_composition = record["normalized_composition"]
                normalized_manufacturer = record["normalized_manufacturer"]

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

                self._push_candidate(
                    candidates,
                    {
                        "record": record,
                        "score": score,
                        "match_tags": sorted(match_tags),
                        "match_reason": reasons[0] if reasons else "Matched medicine query in the dataset",
                    },
                    candidate_limit,
                    seq,
                )

        return self._finalize_candidates(candidates)

    def _build_related_medicine_candidates(
        self,
        primary_record: Mapping[str, object],
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

        primary_salt_key = normalize_text(str(primary_record.get("salt_key", "")))
        primary_category = normalize_text(str(primary_record.get("category", "")))
        primary_name = normalize_text(str(primary_record.get("name", "")))

        candidates: list[tuple[float, int, dict[str, object]]] = []
        candidate_limit = max(limit * 8, 50)
        seq = count()

        with self._open_connection() as conn:
            for record in self._fetch_rows(
                conn,
                [
                    "name",
                    "composition",
                    "category",
                    "uses",
                    "salt_key",
                    "manufacturer",
                    "normalized_name",
                    "normalized_composition",
                    "normalized_category",
                    "normalized_uses",
                    "normalized_salt_key",
                    "normalized_manufacturer",
                ],
            ):
                score = 0.0
                match_tags: set[str] = set()
                reasons: list[str] = []

                if record["normalized_name"] == primary_name:
                    score += 200
                    match_tags.add("exact_match")
                    reasons.append("Primary medicine match")
                if primary_salt_key and record["normalized_salt_key"] == primary_salt_key:
                    score += 95
                    match_tags.add("same_salt")
                    reasons.append("Shares the same salt key")
                if primary_category and record["normalized_category"] == primary_category:
                    score += 42
                    match_tags.add("same_category")
                    reasons.append("Shares the same category")

                if score <= 0:
                    continue

                self._push_candidate(
                    candidates,
                    {
                        "record": record,
                        "score": score,
                        "match_tags": sorted(match_tags),
                        "match_reason": reasons[0] if reasons else "Related medicine in the dataset",
                    },
                    candidate_limit,
                    seq,
                )

        for candidate in self._finalize_candidates(candidates):
            upsert(candidate)

        all_candidates = list(merged.values())
        all_candidates.sort(
            key=lambda item: (
                -float(item["score"]),
                str(item["record"]["name"]).lower(),
            )
        )
        return all_candidates[:limit]

    def _expand_symptom_keywords(self, normalized_query: str) -> set[str]:
        keywords = set(normalized_query.split())
        for symptom, hints in self.SYMPTOM_HINTS.items():
            if symptom in normalized_query:
                keywords.update(normalize_text(hint) for hint in hints)
        return {keyword for keyword in keywords if keyword}

    def _build_candidate_phrases(self, tokens: list[str], max_window: int = 5) -> list[str]:
        phrases: list[str] = []
        seen: set[str] = set()
        upper = min(max_window, len(tokens))

        for size in range(upper, 0, -1):
            for start in range(0, len(tokens) - size + 1):
                phrase = " ".join(tokens[start : start + size]).strip()
                if not phrase or phrase in seen:
                    continue
                seen.add(phrase)
                phrases.append(phrase)

        return phrases
