from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class UploadResponse(BaseModel):
    session_id: str
    table_name: str
    columns: list[ColumnInfo]
    row_count: int
    sample_rows: list[dict[str, Any]]


class ColumnInfo(BaseModel):
    name: str
    dtype: str
    sample_values: list[Any]


class QueryRequest(BaseModel):
    session_id: str
    question: str


class QueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    error: str | None = None
