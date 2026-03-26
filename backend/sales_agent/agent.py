import os
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from .analyzer import AnalysisResult, ComparisonResult, analyze_dataset, compare_datasets
from .dataset_generator import generate_demo_dataset, load_or_generate_demo_dataset
from .tools import generate_structured_ai_response


router = APIRouter()


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CHARTS_DIR = os.path.join(os.path.dirname(__file__), "charts")
DEMO_CSV_PATH = os.path.join(DATA_DIR, "demo_dataset.csv")


class AnalysisResponse(BaseModel):
    structured_report: str
    charts: dict[str, Any]
    follow_up_questions: list[str]
    dataset_summary: str
    key_insights: list[str]
    visual_analysis: list[str]
    business_recommendations: list[str]
    action_plan: list[str]
    stats_snapshot: dict[str, Any]
    forecast: dict[str, Any] = Field(default_factory=dict)
    what_if: dict[str, Any] = Field(default_factory=dict)
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    answer_audit: dict[str, Any] = Field(default_factory=dict)


class ComparisonResponse(BaseModel):
    comparison_summary: str
    highlights: list[str] = Field(default_factory=list)
    shared_columns: list[str] = Field(default_factory=list)
    cards: list[dict[str, Any]] = Field(default_factory=list)
    charts: dict[str, Any] = Field(default_factory=dict)
    baseline_label: str
    comparison_label: str
    primary_metric: Optional[str] = None


def _ensure_demo_dataset() -> pd.DataFrame:
    return load_or_generate_demo_dataset(DEMO_CSV_PATH)


def _read_uploaded_csv(uploaded_file: UploadFile) -> pd.DataFrame:
    """Read uploaded CSV with flexible column support, preserving original columns."""
    content = uploaded_file.file.read()
    from io import StringIO
    
    try:
        decoded_content = content.decode("utf-8")
    except UnicodeDecodeError:
        decoded_content = content.decode("latin1")

    s = StringIO(decoded_content)
    df = pd.read_csv(s)
    
    # Strip whitespace from column names to avoid issues
    df.columns = df.columns.astype(str).str.strip()
    
    # Attempt to find and parse dates without enforcing names
    for col in df.columns:
        if "date" in col.lower() or "time" in col.lower():
            try:
                df[col] = pd.to_datetime(df[col], errors="coerce")
            except Exception:
                pass
                
    return df


def _load_demo_dataset_by_name(demo_dataset_name: Optional[str]) -> pd.DataFrame:
    if demo_dataset_name and demo_dataset_name.endswith(".csv"):
        file_path = os.path.join(DATA_DIR, os.path.basename(demo_dataset_name))
        if os.path.exists(file_path):
            df = pd.read_csv(file_path, encoding="utf-8", encoding_errors="replace")
            df.columns = df.columns.astype(str).str.strip()
            for col in df.columns:
                if "date" in col.lower() or "time" in col.lower():
                    try:
                        df[col] = pd.to_datetime(df[col], errors="coerce")
                    except Exception:
                        pass
            return df
    return _ensure_demo_dataset()


def _load_dataset_from_source(
    use_demo: bool = True,
    demo_dataset_name: Optional[str] = None,
    file: Optional[UploadFile] = None,
) -> pd.DataFrame:
    if file is not None:
        return _read_uploaded_csv(file)
    if demo_dataset_name:
        return _load_demo_dataset_by_name(demo_dataset_name)
    if use_demo:
        return _ensure_demo_dataset()
    return generate_demo_dataset(save_path=DEMO_CSV_PATH)


def _derive_dataset_label(
    use_demo: bool = True,
    demo_dataset_name: Optional[str] = None,
    file: Optional[UploadFile] = None,
    fallback_label: str = "Dataset",
) -> str:
    if file is not None and file.filename:
        return os.path.basename(file.filename)
    if demo_dataset_name:
        return os.path.basename(demo_dataset_name)
    return fallback_label

def _run_full_analysis(df: pd.DataFrame, user_question: Optional[str] = "") -> AnalysisResponse:
    result: AnalysisResult = analyze_dataset(df, charts_dir=CHARTS_DIR)
    
    # Get response with potential chart data
    structured_report, chart_obj, answer_audit = generate_structured_ai_response(
        df=df,
        dataset_summary=result.dataset_summary,
        stats_snapshot=result.stats_snapshot,
        user_question=user_question or "",
    )
    
    # If a dynamic chart was generated, add it to the charts
    charts = dict(result.charts)  # Copy existing charts
    if chart_obj:
        charts["dynamic_chart"] = chart_obj
    
    follow_up_questions = [
        "Would you like a forecast with confidence bands?",
        "Would you like to compare this dataset against another CSV?",
        "Would you like to test a what-if scenario on the main driver?",
    ]
    return AnalysisResponse(
        structured_report=structured_report,
        charts=charts,
        follow_up_questions=follow_up_questions,
        dataset_summary=result.dataset_summary,
        key_insights=result.key_insights,
        visual_analysis=result.visual_analysis,
        business_recommendations=result.business_recommendations,
        action_plan=result.action_plan,
        stats_snapshot=result.stats_snapshot,
        forecast=result.forecast,
        what_if=result.what_if,
        alerts=result.alerts,
        answer_audit=answer_audit,
    )


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    use_demo: bool = Form(default=True),
    demo_dataset_name: Optional[str] = Form(default=None),
    question: Optional[str] = Form(default=""),
    file: Optional[UploadFile] = File(default=None),
):
    """
    Main endpoint for autonomous analysis and Q&A.

    - If a CSV is uploaded, it is used.
    - If a specific demo dataset name is provided, it is loaded.
    - Otherwise, a realistic demo dataset is generated or loaded.
    - The agent always returns a structured report, charts, and proactive follow-up questions.
    """
    df = _load_dataset_from_source(
        use_demo=use_demo,
        demo_dataset_name=demo_dataset_name,
        file=file,
    )

    return _run_full_analysis(df, user_question=question or "")


@router.post("/compare", response_model=ComparisonResponse)
async def compare(
    primary_use_demo: bool = Form(default=True),
    primary_demo_dataset_name: Optional[str] = Form(default=None),
    comparison_demo_dataset_name: Optional[str] = Form(default=None),
    primary_file: Optional[UploadFile] = File(default=None),
    comparison_file: Optional[UploadFile] = File(default=None),
):
    baseline_df = _load_dataset_from_source(
        use_demo=primary_use_demo,
        demo_dataset_name=primary_demo_dataset_name,
        file=primary_file,
    )
    comparison_df = _load_dataset_from_source(
        use_demo=bool(comparison_demo_dataset_name) and comparison_file is None,
        demo_dataset_name=comparison_demo_dataset_name,
        file=comparison_file,
    )

    result: ComparisonResult = compare_datasets(
        baseline_df=baseline_df,
        comparison_df=comparison_df,
        baseline_label=_derive_dataset_label(
            use_demo=primary_use_demo,
            demo_dataset_name=primary_demo_dataset_name,
            file=primary_file,
            fallback_label="Current Dataset",
        ),
        comparison_label=_derive_dataset_label(
            use_demo=bool(comparison_demo_dataset_name),
            demo_dataset_name=comparison_demo_dataset_name,
            file=comparison_file,
            fallback_label="Comparison Dataset",
        ),
    )

    return ComparisonResponse(
        comparison_summary=result.comparison_summary,
        highlights=result.highlights,
        shared_columns=result.shared_columns,
        cards=result.cards,
        charts=result.charts,
        baseline_label=result.baseline_label,
        comparison_label=result.comparison_label,
        primary_metric=result.primary_metric,
    )


@router.get("/health")
async def health():
    return {"status": "ok"}
