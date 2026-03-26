import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


METRIC_PRIORITY_KEYWORDS = (
    "revenue",
    "sales",
    "profit",
    "amount",
    "value",
    "spend",
    "cost",
    "price",
    "units",
    "quantity",
    "count",
)


@dataclass
class AnalysisResult:
    dataset_summary: str
    key_insights: List[str]
    visual_analysis: List[str]
    business_recommendations: List[str]
    action_plan: List[str]
    charts: Dict[str, Any]
    stats_snapshot: Dict[str, Any]
    forecast: Dict[str, Any] = field(default_factory=dict)
    what_if: Dict[str, Any] = field(default_factory=dict)
    alerts: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ComparisonResult:
    comparison_summary: str
    highlights: List[str]
    shared_columns: List[str]
    cards: List[Dict[str, Any]]
    charts: Dict[str, Any]
    baseline_label: str
    comparison_label: str
    primary_metric: Optional[str] = None


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _humanize(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _pick_primary_metric(columns: List[str]) -> Optional[str]:
    if not columns:
        return None

    lowered = {column: column.lower() for column in columns}
    for keyword in METRIC_PRIORITY_KEYWORDS:
        for column in columns:
            if keyword in lowered[column]:
                return column

    return columns[0]


def _pick_primary_dimension(columns: List[str]) -> Optional[str]:
    return columns[0] if columns else None


def _pick_secondary_dimension(columns: List[str], primary_dimension: Optional[str]) -> Optional[str]:
    for column in columns:
        if column != primary_dimension:
            return column
    return None


def _pick_date_columns(df: pd.DataFrame, categorical_columns: List[str]) -> Tuple[List[str], List[str]]:
    date_columns = df.select_dtypes(include=["datetime64"]).columns.tolist()
    remaining_categories = list(categorical_columns)

    if date_columns:
        return date_columns, remaining_categories

    for column in categorical_columns:
        if "date" in column.lower() or "time" in column.lower():
            try:
                parsed = pd.to_datetime(df[column], errors="coerce")
            except Exception:
                continue

            if parsed.notna().sum() == 0:
                continue

            df[column] = parsed
            date_columns = [column]
            remaining_categories = [value for value in categorical_columns if value != column]
            break

    return date_columns, remaining_categories


def _format_metric(metric_name: str, value: float) -> str:
    if not np.isfinite(value):
        return "N/A"

    if any(keyword in metric_name.lower() for keyword in ("revenue", "sales", "profit", "spend", "cost", "amount", "price")):
        return f"${value:,.0f}"

    if abs(value) >= 1000000:
        return f"{value / 1000000:.1f}M"
    if abs(value) >= 1000:
        return f"{value / 1000:.1f}K"

    return f"{value:,.0f}" if value == int(value) else f"{value:,.2f}"


def _format_period_label(timestamp: pd.Timestamp, period_label: str) -> str:
    if period_label == "Month":
        return timestamp.strftime("%b %Y")
    if period_label == "Week":
        return timestamp.strftime("%d %b")
    return timestamp.strftime("%d %b")


def _get_time_series(
    df: pd.DataFrame,
    date_column: Optional[str],
    metric_column: str,
) -> Tuple[Optional[pd.DataFrame], str]:
    if not date_column or metric_column not in df.columns:
        return None, "Period"

    series_df = df[[date_column, metric_column]].copy()
    series_df[date_column] = pd.to_datetime(series_df[date_column], errors="coerce")
    series_df[metric_column] = pd.to_numeric(series_df[metric_column], errors="coerce")
    series_df = series_df.dropna(subset=[date_column, metric_column])

    if len(series_df) < 3:
        return None, "Period"

    series_df = series_df.sort_values(date_column)

    unique_dates = series_df[date_column].drop_duplicates().sort_values()
    if len(unique_dates) < 3:
        return None, "Period"

    diffs = unique_dates.diff().dropna()
    median_gap_days = diffs.dt.total_seconds().div(86400).median() if not diffs.empty else None

    if median_gap_days is None or median_gap_days <= 2:
        frequency = "D"
        period_label = "Day"
    elif median_gap_days <= 10:
        frequency = "W"
        period_label = "Week"
    else:
        frequency = "ME"
        period_label = "Month"

    grouped = (
        series_df.set_index(date_column)[metric_column]
        .resample(frequency)
        .sum()
        .dropna()
        .reset_index()
    )

    if len(grouped) < 3:
        grouped = series_df.groupby(date_column, as_index=False)[metric_column].sum().sort_values(date_column)
        period_label = "Day"

    return grouped, period_label


def _build_forecast_module(
    df: pd.DataFrame,
    metric_column: str,
    date_column: Optional[str],
) -> Dict[str, Any]:
    grouped, period_label = _get_time_series(df, date_column, metric_column)
    if grouped is None or len(grouped) < 4:
        return {
            "enabled": False,
            "summary": "Forecasting becomes available when the dataset has enough dated history and a numeric metric.",
            "metric": metric_column,
            "period_label": period_label,
            "data": [],
            "confidence_level": "80%",
        }

    x_values = np.arange(len(grouped))
    y_values = grouped[metric_column].astype(float).to_numpy()

    slope, intercept = np.polyfit(x_values, y_values, 1)
    fitted = (slope * x_values) + intercept
    residual_std = float(np.std(y_values - fitted)) if len(y_values) > 1 else 0.0

    horizon = min(4, max(2, len(grouped) // 3))
    future_x = np.arange(len(grouped), len(grouped) + horizon)
    forecast_values = (slope * future_x) + intercept
    z_score = 1.28
    step_multiplier = np.sqrt(np.arange(1, horizon + 1))
    lower_values = np.maximum(0.0, forecast_values - (z_score * residual_std * step_multiplier))
    upper_values = np.maximum(lower_values, forecast_values + (z_score * residual_std * step_multiplier))

    date_column_name = grouped.columns[0]
    last_date = pd.to_datetime(grouped[date_column_name].iloc[-1])
    future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq="ME" if period_label == "Month" else ("W" if period_label == "Week" else "D"))[1:]

    chart_rows: List[Dict[str, Any]] = []
    for timestamp, actual_value, fitted_value in zip(grouped[date_column_name], y_values, fitted):
        chart_rows.append(
            {
                "name": _format_period_label(pd.Timestamp(timestamp), period_label),
                "actual": float(actual_value),
                "trend": float(fitted_value),
                "forecast": None,
                "lower": None,
                "upper": None,
                "bandBase": None,
                "bandSize": None,
            }
        )

    for timestamp, forecast_value, lower_value, upper_value in zip(
        future_dates, forecast_values, lower_values, upper_values
    ):
        chart_rows.append(
            {
                "name": _format_period_label(pd.Timestamp(timestamp), period_label),
                "actual": None,
                "trend": None,
                "forecast": float(forecast_value),
                "lower": float(lower_value),
                "upper": float(upper_value),
                "bandBase": float(lower_value),
                "bandSize": float(max(upper_value - lower_value, 0.0)),
            }
        )

    latest_actual = float(y_values[-1])
    next_period = float(forecast_values[0])
    recent_growth = 0.0
    if len(y_values) > 1 and y_values[-2] != 0:
        recent_growth = ((y_values[-1] - y_values[-2]) / abs(y_values[-2])) * 100

    direction = "upward" if slope >= 0 else "downward"
    summary = (
        f"{_humanize(metric_column)} is tracking in an {direction} direction. "
        f"The next {period_label.lower()} is projected near {_format_metric(metric_column, next_period)} "
        f"with an 80% confidence range of {_format_metric(metric_column, lower_values[0])} to {_format_metric(metric_column, upper_values[0])}. "
        f"The latest actual period closed at {_format_metric(metric_column, latest_actual)} ({recent_growth:+.1f}% vs prior period)."
    )

    return {
        "enabled": True,
        "summary": summary,
        "metric": metric_column,
        "period_label": period_label,
        "data": chart_rows,
        "confidence_level": "80%",
        "latest_actual": latest_actual,
        "next_forecast": next_period,
    }


def _build_what_if_module(df: pd.DataFrame, metric_column: str, numeric_columns: List[str]) -> Dict[str, Any]:
    base_total = float(pd.to_numeric(df[metric_column], errors="coerce").fillna(0).sum())
    base_average = float(pd.to_numeric(df[metric_column], errors="coerce").fillna(0).mean())
    drivers: List[Dict[str, Any]] = []

    for column in numeric_columns:
        if column == metric_column:
            continue

        candidate_df = df[[metric_column, column]].copy()
        candidate_df[metric_column] = pd.to_numeric(candidate_df[metric_column], errors="coerce")
        candidate_df[column] = pd.to_numeric(candidate_df[column], errors="coerce")
        candidate_df = candidate_df.dropna()

        if len(candidate_df) < 8:
            continue
        if candidate_df[column].std() == 0 or candidate_df[metric_column].std() == 0:
            continue

        correlation = float(candidate_df[column].corr(candidate_df[metric_column]))
        if not np.isfinite(correlation):
            continue

        slope, _ = np.polyfit(candidate_df[column].to_numpy(), candidate_df[metric_column].to_numpy(), 1)
        mean_metric = float(candidate_df[metric_column].mean())
        mean_driver = float(candidate_df[column].mean())

        if mean_metric == 0 or mean_driver == 0:
            elasticity = correlation
        else:
            elasticity = float((slope * mean_driver) / mean_metric)

        elasticity = float(np.clip(elasticity, -3.0, 3.0))
        default_change_pct = 12 if elasticity >= 0 else -12
        projected_total = base_total * (1 + ((elasticity * default_change_pct) / 100))

        drivers.append(
            {
                "name": column,
                "label": _humanize(column),
                "elasticity": elasticity,
                "correlation": correlation,
                "base_value": mean_driver,
                "default_change_pct": default_change_pct,
                "projected_total": float(max(projected_total, 0.0)),
                "impact_summary": (
                    f"A {default_change_pct:+d}% change in {_humanize(column)} points to roughly "
                    f"{((elasticity * default_change_pct)):+.1f}% movement in {_humanize(metric_column)}."
                ),
            }
        )

    drivers = sorted(drivers, key=lambda item: abs(item["elasticity"]), reverse=True)[:3]

    if not drivers:
        projected_total = base_total * 1.1
        drivers = [
            {
                "name": "__row_volume__",
                "label": "Record Volume",
                "elasticity": 1.0,
                "correlation": 1.0,
                "base_value": float(len(df)),
                "default_change_pct": 10,
                "projected_total": float(projected_total),
                "impact_summary": (
                    f"If record volume rises by 10%, {_humanize(metric_column)} is projected to move by about 10% "
                    "using a simple proportional scenario."
                ),
            }
        ]

    return {
        "enabled": True,
        "target_metric": metric_column,
        "base_total": base_total,
        "base_average": base_average,
        "drivers": drivers,
        "assumptions": [
            "Scenarios use historical linear relationships, so they are directional rather than guaranteed outcomes.",
            "Only one driver is adjusted at a time in the simulator.",
            "The projection keeps the rest of the dataset behavior constant.",
        ],
    }


def _build_alerts_module(
    df: pd.DataFrame,
    metric_column: str,
    category_columns: List[str],
    date_column: Optional[str],
    total_metric: float,
) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    numeric_metric = pd.to_numeric(df[metric_column], errors="coerce")

    missing_ratio = float(df.isna().mean().mean()) if len(df) > 0 else 0.0
    if missing_ratio >= 0.08:
        alerts.append(
            {
                "id": "data-quality",
                "severity": "medium",
                "title": "Data quality drift detected",
                "message": f"About {missing_ratio * 100:.1f}% of all cells are missing, which can weaken forecasts and comparisons.",
                "cadence": "Weekly briefing",
            }
        )

    valid_metric = numeric_metric.dropna()
    if len(valid_metric) >= 8 and valid_metric.mean() != 0:
        coefficient_of_variation = float(valid_metric.std() / abs(valid_metric.mean()))
        if coefficient_of_variation >= 0.75:
            alerts.append(
                {
                    "id": "volatility",
                    "severity": "medium",
                    "title": "High volatility in the primary metric",
                    "message": (
                        f"{_humanize(metric_column)} is fluctuating heavily relative to its average, "
                        "so decisions should be reviewed with a shorter monitoring loop."
                    ),
                    "cadence": "Daily watch",
                }
            )

        outliers = valid_metric[
            (valid_metric > valid_metric.mean() + (2.5 * valid_metric.std()))
            | (valid_metric < valid_metric.mean() - (2.5 * valid_metric.std()))
        ]
        if len(outliers) > 0:
            alerts.append(
                {
                    "id": "outliers",
                    "severity": "high" if len(outliers) >= max(3, len(valid_metric) * 0.05) else "medium",
                    "title": "Unusual spikes or drops found",
                    "message": f"{len(outliers)} records sit far outside the normal {_humanize(metric_column)} range.",
                    "cadence": "Daily watch",
                }
            )

    if category_columns and total_metric:
        primary_category = category_columns[0]
        grouped = (
            df.groupby(primary_category)[metric_column]
            .sum()
            .sort_values(ascending=False)
        )
        if not grouped.empty:
            top_share = float(grouped.iloc[0] / total_metric) if total_metric else 0.0
            if top_share >= 0.45:
                alerts.append(
                    {
                        "id": "concentration",
                        "severity": "medium",
                        "title": f"Heavy reliance on one {_humanize(primary_category)}",
                        "message": (
                            f"{grouped.index[0]} contributes {top_share * 100:.1f}% of total {_humanize(metric_column)}, "
                            "so the dataset looks concentrated."
                        ),
                        "cadence": "Weekly briefing",
                    }
                )

    grouped_series, period_label = _get_time_series(df, date_column, metric_column)
    if grouped_series is not None and len(grouped_series) >= 2:
        metric_values = grouped_series[metric_column].astype(float).to_numpy()
        previous_value = metric_values[-2]
        latest_value = metric_values[-1]
        if previous_value != 0:
            recent_change = ((latest_value - previous_value) / abs(previous_value)) * 100
            if abs(recent_change) >= 12:
                alerts.append(
                    {
                        "id": "recent-change",
                        "severity": "high" if recent_change < 0 else "positive",
                        "title": f"Latest {period_label.lower()} moved sharply",
                        "message": (
                            f"{_humanize(metric_column)} changed by {recent_change:+.1f}% in the most recent "
                            f"{period_label.lower()} versus the prior one."
                        ),
                        "cadence": "Morning digest",
                    }
                )

    if not alerts:
        alerts.append(
            {
                "id": "healthy",
                "severity": "positive",
                "title": "No urgent risk signals detected",
                "message": "The dataset looks stable enough for a weekly executive briefing cadence.",
                "cadence": "Weekly briefing",
            }
        )

    return alerts[:4]


def _build_visual_analysis(
    metric_column: str,
    primary_dimension: Optional[str],
    secondary_dimension: Optional[str],
    forecast: Dict[str, Any],
) -> List[str]:
    visual_analysis = [
        f"The main trend charts show how {_humanize(metric_column)} moves over time and where the biggest spikes are concentrated.",
    ]

    if primary_dimension:
        visual_analysis.append(
            f"The ranking charts make it easy to see which {_humanize(primary_dimension)} values lead and lag on {_humanize(metric_column)}."
        )

    if secondary_dimension:
        visual_analysis.append(
            f"The distribution view highlights how {_humanize(metric_column)} is split across {_humanize(secondary_dimension)}."
        )

    if forecast.get("enabled"):
        visual_analysis.append(
            "The forecast line extends the historical trend and the confidence band shows the likely range for the next periods."
        )

    return visual_analysis


def analyze_dataset(df: pd.DataFrame, charts_dir: str) -> AnalysisResult:
    _ensure_dir(charts_dir)

    numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_columns = df.select_dtypes(include=["object", "category"]).columns.tolist()
    date_columns, categorical_columns = _pick_date_columns(df, categorical_columns)

    metric_column = _pick_primary_metric(numeric_columns)
    if metric_column is None:
        df = df.copy()
        df["Count"] = 1
        metric_column = "Count"
        numeric_columns = ["Count"]

    primary_dimension = _pick_primary_dimension(categorical_columns)
    secondary_dimension = _pick_secondary_dimension(categorical_columns, primary_dimension)

    row_count, column_count = df.shape
    total_metric = float(pd.to_numeric(df[metric_column], errors="coerce").fillna(0).sum())
    average_metric = float(pd.to_numeric(df[metric_column], errors="coerce").fillna(0).mean())

    dataset_summary_lines = [f"Rows: {row_count}, Columns: {column_count}"]
    stats_snapshot: Dict[str, Any] = {
        "metric_name": str(metric_column),
        "total_metric": total_metric,
        "average_metric": average_metric,
        "row_count": int(row_count),
        "column_count": int(column_count),
        "cat1_name": str(primary_dimension or "Category"),
        "cat2_label": str(secondary_dimension or primary_dimension or "Segment"),
    }

    date_column = date_columns[0] if date_columns else None
    if date_column:
        min_date = pd.to_datetime(df[date_column], errors="coerce").min()
        max_date = pd.to_datetime(df[date_column], errors="coerce").max()
        if pd.notna(min_date) and pd.notna(max_date):
            dataset_summary_lines.append(f"Date range: {min_date.date()} to {max_date.date()}")
            stats_snapshot["date_range_start"] = str(min_date.date())
            stats_snapshot["date_range_end"] = str(max_date.date())

    dataset_summary_lines.append(f"Total {_humanize(metric_column)}: {_format_metric(metric_column, total_metric)}")
    dataset_summary = "\n".join(dataset_summary_lines)

    key_insights: List[str] = []
    charts: Dict[str, Any] = {}

    if primary_dimension:
        primary_grouped = (
            df.groupby(primary_dimension)[metric_column]
            .sum()
            .sort_values(ascending=False)
        )
        if not primary_grouped.empty:
            stats_snapshot["top_cat1"] = str(primary_grouped.index[0])
            stats_snapshot["weakest_cat1"] = str(primary_grouped.index[-1])
            stats_snapshot["top_product"] = str(primary_grouped.index[0])
            stats_snapshot["weakest_product"] = str(primary_grouped.index[-1])
            key_insights.append(
                f"Top {_humanize(primary_dimension)}: {primary_grouped.index[0]} ({_format_metric(metric_column, float(primary_grouped.iloc[0]))})"
            )
            key_insights.append(
                f"Weakest {_humanize(primary_dimension)}: {primary_grouped.index[-1]} ({_format_metric(metric_column, float(primary_grouped.iloc[-1]))})"
            )
            charts["barData"] = (
                primary_grouped.head(5)
                .reset_index()
                .rename(columns={primary_dimension: "name", metric_column: "value"})
                .to_dict(orient="records")
            )
    else:
        charts["barData"] = [{"name": "Overall", "value": total_metric}]

    if secondary_dimension:
        secondary_grouped = (
            df.groupby(secondary_dimension)[metric_column]
            .sum()
            .sort_values(ascending=False)
        )
        if not secondary_grouped.empty:
            stats_snapshot["strongest_cat2"] = str(secondary_grouped.index[0])
            stats_snapshot["weakest_cat2"] = str(secondary_grouped.index[-1])
            stats_snapshot["strongest_region"] = str(secondary_grouped.index[0])
            stats_snapshot["weakest_region"] = str(secondary_grouped.index[-1])
            key_insights.append(
                f"Strongest {_humanize(secondary_dimension)}: {secondary_grouped.index[0]} ({_format_metric(metric_column, float(secondary_grouped.iloc[0]))})"
            )
            key_insights.append(
                f"Weakest {_humanize(secondary_dimension)}: {secondary_grouped.index[-1]} ({_format_metric(metric_column, float(secondary_grouped.iloc[-1]))})"
            )
            charts["pieData"] = (
                secondary_grouped.head(4)
                .reset_index()
                .rename(columns={secondary_dimension: "name", metric_column: "value"})
                .to_dict(orient="records")
            )
    elif primary_dimension and "barData" in charts:
        charts["pieData"] = charts["barData"][:4]
        stats_snapshot["strongest_cat2"] = stats_snapshot.get("top_cat1", "Overall")
        stats_snapshot["weakest_cat2"] = stats_snapshot.get("weakest_cat1", "Overall")
        stats_snapshot["strongest_region"] = stats_snapshot.get("top_cat1", "Overall")
        stats_snapshot["weakest_region"] = stats_snapshot.get("weakest_cat1", "Overall")
    else:
        charts["pieData"] = [{"name": "Overall", "value": total_metric}]
        stats_snapshot["top_cat1"] = "Overall"
        stats_snapshot["weakest_cat1"] = "Overall"
        stats_snapshot["strongest_cat2"] = "Overall"
        stats_snapshot["weakest_cat2"] = "Overall"
        stats_snapshot["top_product"] = "Overall"
        stats_snapshot["weakest_product"] = "Overall"
        stats_snapshot["strongest_region"] = "Overall"
        stats_snapshot["weakest_region"] = "Overall"

    metric_series = pd.to_numeric(df[metric_column], errors="coerce").dropna()
    if len(metric_series) > 0:
        mean_value = float(metric_series.mean())
        std_value = float(metric_series.std()) if len(metric_series) > 1 else 0.0
        key_insights.append(
            f"{_humanize(metric_column)} averages {_format_metric(metric_column, mean_value)} with variability of {_format_metric(metric_column, std_value)}."
        )

    if len(numeric_columns) > 1:
        correlation_matrix = df[numeric_columns].corr()
        correlation_pairs = correlation_matrix.abs().unstack()
        correlation_pairs = correlation_pairs[correlation_pairs < 1.0]
        if not correlation_pairs.empty:
            col_a, col_b = correlation_pairs.idxmax()
            correlation_value = float(correlation_matrix.loc[col_a, col_b])
            relation = "positive" if correlation_value >= 0 else "negative"
            strength = "strong" if abs(correlation_value) > 0.65 else "moderate" if abs(correlation_value) > 0.35 else "weak"
            key_insights.append(
                f"{_humanize(col_a)} and {_humanize(col_b)} show a {strength} {relation} relationship ({correlation_value:.2f})."
            )

    grouped_series, period_label = _get_time_series(df, date_column, metric_column)
    if grouped_series is not None:
        grouped_column = grouped_series.columns[0]
        grouped_series[grouped_column] = pd.to_datetime(grouped_series[grouped_column], errors="coerce")
        charts["lineData"] = [
            {
                "name": _format_period_label(pd.Timestamp(row[grouped_column]), period_label),
                "value": float(row[metric_column]),
            }
            for _, row in grouped_series.iterrows()
        ]
        charts["areaData"] = charts["lineData"]

        if len(grouped_series) > 2:
            peak_row = grouped_series.loc[grouped_series[metric_column].idxmax()]
            trough_row = grouped_series.loc[grouped_series[metric_column].idxmin()]
            stats_snapshot["peak_period_name"] = str(pd.Timestamp(peak_row[grouped_column]).date())
            stats_snapshot["peak_period_value"] = float(peak_row[metric_column])
            stats_snapshot["low_period_name"] = str(pd.Timestamp(trough_row[grouped_column]).date())
            stats_snapshot["low_period_value"] = float(trough_row[metric_column])

            first_value = float(grouped_series[metric_column].iloc[0])
            last_value = float(grouped_series[metric_column].iloc[-1])
            if first_value != 0:
                growth_rate = ((last_value - first_value) / abs(first_value)) * 100
                key_insights.append(
                    f"Across the tracked {period_label.lower()}s, {_humanize(metric_column)} moved by {growth_rate:+.1f}% overall."
                )
    else:
        charts["lineData"] = [{"name": "All", "value": total_metric}]
        charts["areaData"] = [{"name": "All", "value": total_metric}]

    for chart_key, chart_rows in charts.items():
        if isinstance(chart_rows, list):
            for item in chart_rows:
                if "value" in item:
                    item["value"] = float(item["value"]) if pd.notna(item["value"]) else 0.0
                if "name" in item:
                    item["name"] = str(item["name"])

    forecast = _build_forecast_module(df, metric_column, date_column)
    what_if = _build_what_if_module(df, metric_column, numeric_columns)
    alerts = _build_alerts_module(df, metric_column, categorical_columns, date_column, total_metric)

    if forecast.get("enabled"):
        charts["forecastData"] = forecast["data"]

    visual_analysis = _build_visual_analysis(metric_column, primary_dimension, secondary_dimension, forecast)

    business_recommendations = [
        f"Double down on the strongest {_humanize(primary_dimension)} patterns and document what is driving {_humanize(metric_column)} there."
        if primary_dimension
        else f"Use the biggest historical peaks in {_humanize(metric_column)} to identify the operating conditions worth repeating.",
        "Use the alert feed as a review queue so sudden changes and concentration risks are checked before the next reporting cycle.",
        "Pressure-test the what-if simulator before making budget or planning changes to understand directional impact on the main metric.",
    ]

    action_plan = [
        "Review the forecast outlook and confirm whether the trend matches current business expectations.",
        "Run one or two what-if scenarios on the most sensitive driver before committing to the next plan.",
        "Use the comparison workspace to benchmark new uploads against the current dataset and investigate the biggest gaps.",
    ]

    return AnalysisResult(
        dataset_summary=dataset_summary,
        key_insights=key_insights,
        visual_analysis=visual_analysis,
        business_recommendations=business_recommendations,
        action_plan=action_plan,
        charts=charts,
        stats_snapshot=stats_snapshot,
        forecast=forecast,
        what_if=what_if,
        alerts=alerts,
    )


def compare_datasets(
    baseline_df: pd.DataFrame,
    comparison_df: pd.DataFrame,
    baseline_label: str,
    comparison_label: str,
) -> ComparisonResult:
    baseline = baseline_df.copy()
    comparison = comparison_df.copy()

    for frame in (baseline, comparison):
        frame.columns = frame.columns.astype(str).str.strip()
        object_columns = frame.select_dtypes(include=["object", "category"]).columns.tolist()
        _pick_date_columns(frame, object_columns)

    shared_columns = sorted(set(baseline.columns).intersection(comparison.columns))

    baseline_numeric = baseline.select_dtypes(include=[np.number]).columns.tolist()
    comparison_numeric = comparison.select_dtypes(include=[np.number]).columns.tolist()
    shared_numeric = [column for column in shared_columns if column in baseline_numeric and column in comparison_numeric]
    primary_metric = _pick_primary_metric(shared_numeric)

    baseline_categories = baseline.select_dtypes(include=["object", "category"]).columns.tolist()
    comparison_categories = comparison.select_dtypes(include=["object", "category"]).columns.tolist()
    shared_categories = [column for column in shared_columns if column in baseline_categories and column in comparison_categories]
    primary_dimension = _pick_primary_dimension(shared_categories)

    baseline_dates = baseline.select_dtypes(include=["datetime64"]).columns.tolist()
    comparison_dates = comparison.select_dtypes(include=["datetime64"]).columns.tolist()
    shared_dates = [column for column in shared_columns if column in baseline_dates and column in comparison_dates]
    shared_date = shared_dates[0] if shared_dates else None

    cards: List[Dict[str, Any]] = [
        {
            "label": "Rows",
            "baseline_value": f"{len(baseline):,}",
            "comparison_value": f"{len(comparison):,}",
            "delta": len(comparison) - len(baseline),
        },
        {
            "label": "Columns",
            "baseline_value": f"{baseline.shape[1]:,}",
            "comparison_value": f"{comparison.shape[1]:,}",
            "delta": comparison.shape[1] - baseline.shape[1],
        },
    ]

    charts: Dict[str, Any] = {}
    highlights: List[str] = []

    if primary_metric:
        baseline_metric = float(pd.to_numeric(baseline[primary_metric], errors="coerce").fillna(0).sum())
        comparison_metric = float(pd.to_numeric(comparison[primary_metric], errors="coerce").fillna(0).sum())
        delta_pct = ((comparison_metric - baseline_metric) / abs(baseline_metric) * 100) if baseline_metric else 0.0

        cards.append(
            {
                "label": f"Total {_humanize(primary_metric)}",
                "baseline_value": _format_metric(primary_metric, baseline_metric),
                "comparison_value": _format_metric(primary_metric, comparison_metric),
                "delta": delta_pct,
            }
        )
        cards.append(
            {
                "label": f"Average {_humanize(primary_metric)}",
                "baseline_value": _format_metric(primary_metric, float(pd.to_numeric(baseline[primary_metric], errors="coerce").mean())),
                "comparison_value": _format_metric(primary_metric, float(pd.to_numeric(comparison[primary_metric], errors="coerce").mean())),
                "delta": float(pd.to_numeric(comparison[primary_metric], errors="coerce").mean() - pd.to_numeric(baseline[primary_metric], errors="coerce").mean()),
            }
        )

        highlights.append(
            f"{comparison_label} is {delta_pct:+.1f}% versus {baseline_label} on total {_humanize(primary_metric)}."
        )
        charts["metricComparison"] = [
            {"name": baseline_label, "value": baseline_metric},
            {"name": comparison_label, "value": comparison_metric},
        ]

        if primary_dimension:
            baseline_by_dimension = baseline.groupby(primary_dimension)[primary_metric].sum()
            comparison_by_dimension = comparison.groupby(primary_dimension)[primary_metric].sum()
            shared_dimension_values = baseline_by_dimension.index.union(comparison_by_dimension.index)

            delta_rows: List[Dict[str, Any]] = []
            for value in shared_dimension_values:
                baseline_value = float(baseline_by_dimension.get(value, 0.0))
                comparison_value = float(comparison_by_dimension.get(value, 0.0))
                delta_rows.append(
                    {
                        "name": str(value),
                        baseline_label: baseline_value,
                        comparison_label: comparison_value,
                        "delta": comparison_value - baseline_value,
                    }
                )

            delta_rows = sorted(delta_rows, key=lambda item: abs(item["delta"]), reverse=True)[:6]
            charts["dimensionComparison"] = delta_rows

            if delta_rows:
                top_shift = delta_rows[0]
                direction = "higher" if top_shift["delta"] >= 0 else "lower"
                highlights.append(
                    f"The biggest shared {_humanize(primary_dimension)} swing is {top_shift['name']}, where {comparison_label} is {direction} by {_format_metric(primary_metric, abs(float(top_shift['delta'])))}."
                )

        grouped_baseline, period_label = _get_time_series(baseline, shared_date, primary_metric)
        grouped_comparison, _ = _get_time_series(comparison, shared_date, primary_metric)
        if grouped_baseline is not None and grouped_comparison is not None:
            merged = pd.merge(
                grouped_baseline.rename(columns={grouped_baseline.columns[0]: "period", primary_metric: baseline_label}),
                grouped_comparison.rename(columns={grouped_comparison.columns[0]: "period", primary_metric: comparison_label}),
                on="period",
                how="outer",
            ).sort_values("period")
            charts["trendComparison"] = [
                {
                    "name": _format_period_label(pd.Timestamp(row["period"]), period_label),
                    baseline_label: float(row.get(baseline_label, 0.0) or 0.0),
                    comparison_label: float(row.get(comparison_label, 0.0) or 0.0),
                }
                for _, row in merged.iterrows()
            ]

    if not highlights:
        highlights.append(
            "These datasets share only structural fields right now, so the comparison focuses on size and schema overlap."
        )

    comparison_summary = (
        f"Compared {baseline_label} against {comparison_label}. "
        f"They share {len(shared_columns)} columns, and the main comparison metric is "
        f"{_humanize(primary_metric) if primary_metric else 'not available'}."
    )

    return ComparisonResult(
        comparison_summary=comparison_summary,
        highlights=highlights,
        shared_columns=shared_columns,
        cards=cards,
        charts=charts,
        baseline_label=baseline_label,
        comparison_label=comparison_label,
        primary_metric=primary_metric,
    )
