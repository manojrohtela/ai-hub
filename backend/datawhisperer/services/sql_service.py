from __future__ import annotations

import io
import re
import sqlite3
import uuid
from typing import Any

import pandas as pd
from groq import Groq

from ..schemas import ColumnInfo, QueryResponse, UploadResponse

# In-memory session store: session_id -> (sqlite connection, table_name, schema_text)
_sessions: dict[str, tuple[sqlite3.Connection, str, str]] = {}


def _sanitize_table_name(filename: str) -> str:
    name = re.sub(r"[^a-zA-Z0-9_]", "_", filename.split(".")[0])
    return name[:32] or "data"


def _build_schema_text(table_name: str, df: pd.DataFrame) -> str:
    lines = [f"Table: {table_name}"]
    lines.append("Columns:")
    for col in df.columns:
        dtype = str(df[col].dtype)
        samples = df[col].dropna().head(3).tolist()
        lines.append(f"  - {col} ({dtype}): e.g. {samples}")
    return "\n".join(lines)


def _extract_sql(text: str) -> str:
    """Pull the first SQL statement out of a potentially markdown-fenced response."""
    # Try to extract from ```sql ... ``` or ``` ... ```
    fenced = re.search(r"```(?:sql)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()
    # Otherwise take the first SELECT statement
    select = re.search(r"(SELECT[\s\S]+?;)", text, re.IGNORECASE)
    if select:
        return select.group(1).strip()
    return text.strip()


class SQLService:
    def __init__(self, api_key: str, model: str) -> None:
        self._client = Groq(api_key=api_key)
        self._model = model

    def load_csv(self, contents: bytes, filename: str) -> UploadResponse:
        df = pd.read_csv(io.BytesIO(contents))
        # Sanitise column names
        df.columns = [re.sub(r"[^a-zA-Z0-9_]", "_", c).strip("_") or f"col_{i}"
                      for i, c in enumerate(df.columns)]
        table_name = _sanitize_table_name(filename)
        session_id = str(uuid.uuid4())

        conn = sqlite3.connect(":memory:", check_same_thread=False)
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        schema_text = _build_schema_text(table_name, df)
        _sessions[session_id] = (conn, table_name, schema_text)

        columns = [
            ColumnInfo(
                name=col,
                dtype=str(df[col].dtype),
                sample_values=df[col].dropna().head(3).tolist(),
            )
            for col in df.columns
        ]

        sample_rows = df.head(3).fillna("").to_dict(orient="records")

        return UploadResponse(
            session_id=session_id,
            table_name=table_name,
            columns=columns,
            row_count=len(df),
            sample_rows=sample_rows,
        )

    def run_query(self, session_id: str, question: str) -> QueryResponse:
        if session_id not in _sessions:
            return QueryResponse(
                question=question,
                sql="",
                columns=[],
                rows=[],
                row_count=0,
                error="Session not found. Please upload your CSV again.",
            )

        conn, table_name, schema_text = _sessions[session_id]

        # Generate SQL with Groq
        system_prompt = (
            "You are a SQLite expert. Given a table schema, write a single valid SQLite "
            "SELECT query that answers the user's question. "
            "Return ONLY the SQL query — no explanation, no markdown fences, no extra text. "
            "Always end the query with a semicolon."
        )
        user_prompt = f"{schema_text}\n\nQuestion: {question}"

        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                max_tokens=512,
            )
            raw_sql = response.choices[0].message.content or ""
            sql = _extract_sql(raw_sql)
        except Exception as exc:
            return QueryResponse(
                question=question,
                sql="",
                columns=[],
                rows=[],
                row_count=0,
                error=f"LLM error: {exc}",
            )

        # Execute the generated SQL
        try:
            cursor = conn.execute(sql)
            col_names = [d[0] for d in cursor.description] if cursor.description else []
            rows: list[list[Any]] = [list(row) for row in cursor.fetchall()]
            return QueryResponse(
                question=question,
                sql=sql,
                columns=col_names,
                rows=rows,
                row_count=len(rows),
            )
        except sqlite3.Error as exc:
            return QueryResponse(
                question=question,
                sql=sql,
                columns=[],
                rows=[],
                row_count=0,
                error=f"SQL error: {exc}",
            )
