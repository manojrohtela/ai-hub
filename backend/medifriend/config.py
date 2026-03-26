from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


MEDIFRIEND_DIR = Path(__file__).resolve().parent
BACKEND_DIR = MEDIFRIEND_DIR.parent
PROJECT_ROOT = MEDIFRIEND_DIR  # kept for backwards compat with dataset_path logic
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(MEDIFRIEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    app_name: str
    groq_api_key: str | None
    groq_model: str
    dataset_path: Path
    cors_origins: list[str]


@lru_cache
def get_settings() -> Settings:
    root_dataset_path = MEDIFRIEND_DIR / "data" / "advanced_medicine_dataset.csv"
    bundled_dataset_path = MEDIFRIEND_DIR / "data" / "medicines.csv"
    default_dataset_path = (
        root_dataset_path if root_dataset_path.exists() else bundled_dataset_path
    )
    cors_origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]

    return Settings(
        app_name=os.getenv("APP_NAME", "MediFriend API"),
        groq_api_key=os.getenv("GROQ_API_KEY"),
        groq_model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        dataset_path=Path(os.getenv("MEDICINE_CSV_PATH", default_dataset_path)),
        cors_origins=cors_origins,
    )
