import os
from typing import Any, Dict, List, Optional, Protocol, Tuple
import logging
import re
import numpy as np
import json

import pandas as pd
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

logger = logging.getLogger(__name__)


class _LLM(Protocol):
    pass


def get_llm(
    model: Optional[str] = None,
    provider: Optional[str] = None,
) -> _LLM:
    """
    Construct a chat model via LangChain.

    Default behavior:
    - If GROQ_API_KEY is set: use Groq
    - Else: use OpenAI (OPENAI_API_KEY)
    """
    provider_env = (provider or os.environ.get("BI_AGENT_LLM_PROVIDER") or "").strip().lower()
    has_groq = bool(os.environ.get("GROQ_API_KEY"))

    if provider_env in {"groq"} or (provider_env == "" and has_groq):
        return ChatGroq(model=model or os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"), temperature=0.3)

    from langchain_openai import ChatOpenAI  # lazy import — only when OpenAI is selected
    return ChatOpenAI(model=model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini"), temperature=0.3)


def _get_dataframe_schema(df: pd.DataFrame) -> str:
    """Get the schema of the dataframe as a string."""
    schema_lines = []
    schema_lines.append(f"Columns: {list(df.columns)}")
    schema_lines.append(f"Shape: {df.shape[0]} rows, {df.shape[1]} columns")
    schema_lines.append("Data types:")
    for col in df.columns:
        dtype = str(df[col].dtype)
        schema_lines.append(f"  - {col}: {dtype}")
    
    # Sample unique values for categorical columns
    schema_lines.append("\nSample values:")
    for col in df.columns:
        if df[col].dtype == 'object' or df[col].nunique() < 20:
            unique_vals = df[col].unique()[:10]
            schema_lines.append(f"  - {col}: {list(unique_vals)}")
    
    return "\n".join(schema_lines)


def detect_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """
    Auto-detect column types: numeric, categorical, datetime, or other.
    Helps handle flexible CSV datasets.
    """
    column_types = {}
    for col in df.columns:
        dtype = df[col].dtype
        if pd.api.types.is_datetime64_any_dtype(dtype):
            column_types[col] = "datetime"
        elif pd.api.types.is_numeric_dtype(dtype):
            column_types[col] = "numeric"
        elif pd.api.types.is_object_dtype(dtype) or pd.api.types.is_categorical_dtype(dtype):
            # Check if it looks numeric
            try:
                non_null = df[col].dropna()
                if len(non_null) == 0:
                    column_types[col] = "categorical"
                else:
                    numeric_ratio = pd.to_numeric(non_null, errors='coerce').notna().sum() / len(non_null)
                    column_types[col] = "numeric" if numeric_ratio > 0.8 else "categorical"
            except:
                column_types[col] = "categorical"
        else:
            column_types[col] = "other"
    return column_types


def find_numeric_columns(df: pd.DataFrame) -> List[str]:
    """Find all numeric columns in dataframe."""
    return df.select_dtypes(include=[np.number]).columns.tolist()


def find_categorical_columns(df: pd.DataFrame) -> List[str]:
    """Find all categorical columns in dataframe."""
    return df.select_dtypes(include=['object']).columns.tolist()


def find_datetime_columns(df: pd.DataFrame) -> List[str]:
    """Find all datetime columns in dataframe."""
    return df.select_dtypes(include=['datetime64']).columns.tolist()


def generate_plotly_query(df: pd.DataFrame, question: str) -> Optional[str]:
    """Use LLM to generate a Plotly Express query."""
    schema = _get_dataframe_schema(df)
    template = """You are a Python data visualization expert using Plotly Express (px).
Your task is to write a single line of Python code that generates a Plotly Express chart for the user's question.

DataFrame info:
{schema}

User question: {question}

INSTRUCTIONS:
1. Generate ONLY a valid px expression (e.g., px.bar(df.groupby('x')['y'].sum().reset_index(), x='x', y='y', title='...'))
2. The dataframe is named "df"
3. Return ONLY the px code, no explanation, no markdown backticks, no imports.
4. If you need to aggregate data, do it inline within the px call, like above.
"""
    prompt = ChatPromptTemplate.from_template(template)
    chain = prompt | get_llm()
    try:
        msg = chain.invoke({"schema": schema, "question": question})
        code = getattr(msg, "content", str(msg)).strip()
        if code.startswith("```"):
            lines = code.split("\n")
            code = "\n".join(lines[1:-1]).strip()
        return code
    except Exception as e:
        logger.error(f"Failed to generate plotly query: {e}")
        return None

def generate_dynamic_chart(df: pd.DataFrame, question: str, chart_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Generate a Plotly chart dynamically by creating exact px code via an LLM.
    """
    import plotly.express as px  # lazy import — only loaded when charts are requested
    try:
        code = generate_plotly_query(df, question)
        if not code:
            return None

        logger.info(f"Generated Plotly code: {code}")

        namespace = {"df": df, "px": px, "pd": pd, "np": np}
        fig = eval(code, {"__builtins__": {}}, namespace)
        
        return {
            "type": "dynamic",
            "data": fig.to_json(),
            "generated_code": code,
            "question": question,
        }
    except Exception as e:
        logger.error(f"Error executing chart code: {e}")
        return None


def generate_pandas_query(df: pd.DataFrame, question: str) -> Optional[str]:
    """
    Use LLM to generate a pandas query that answers the question.
    Returns only the pandas expression code.
    
    Handles flexible CSV datasets by auto-detecting column types.
    """
    schema = _get_dataframe_schema(df)
    column_types = detect_column_types(df)
    
    # Add column type information to schema
    column_type_info = "\nColumn Classifications:\n"
    for col, col_type in column_types.items():
        column_type_info += f"  - {col}: {col_type}\n"
    
    full_schema = schema + column_type_info
    
    template = """You are a Python data analyst expert.

Your task is to write a pandas expression that answers the user's question about a dataset.

DataFrame information:
{schema}

User question: {question}

INSTRUCTIONS:
1. Generate ONLY a valid pandas expression
2. The dataframe is named "df"
3. Return ONLY the pandas code, nothing else
4. Do NOT include explanation or markdown formatting
5. Do NOT wrap in code blocks
6. Make sure the expression is executable Python code
7. Handle date comparisons if needed
8. For categorical filtering, use exact string matches
9. For numeric operations, use appropriate aggregation functions

Examples:
- For "total revenue": df["revenue"].sum()
- For "revenue by region": df.groupby("region")["revenue"].sum()
- For "top 3 products": df.groupby("product")["revenue"].sum().nlargest(3)
- For "average spend in Europe": df[df["region"]=="Europe"]["marketing_spend"].mean()
- For "revenue in December 2025": df[(df["date"].dt.month==12)&(df["date"].dt.year==2025)]["revenue"].sum()

Generate the pandas expression now:"""
    
    prompt = ChatPromptTemplate.from_template(template)
    llm = get_llm()
    chain = prompt | llm
    
    try:
        msg = chain.invoke({
            "schema": full_schema,
            "question": question,
        })
        code = getattr(msg, "content", str(msg)).strip()
        logger.info(f"Generated pandas query for '{question}': {code}")
        return code
    except Exception as e:
        logger.error(f"Failed to generate pandas query: {e}")
        return None


def execute_pandas_query(df: pd.DataFrame, code: str) -> Tuple[bool, Any, str]:
    """
    Safely execute a pandas query and return the result.
    Returns (success: bool, result: Any, error_message: str)
    """
    try:
        # Create a safe namespace with only df
        namespace = {"df": df, "pd": pd}
        
        # Execute the query
        result = eval(code, {"__builtins__": {}}, namespace)
        
        logger.info(f"Query execution successful. Result type: {type(result).__name__}")
        return True, result, ""
    except Exception as e:
        error_msg = f"Query execution failed: {str(e)}"
        logger.error(error_msg)
        return False, None, error_msg


def _format_query_result(result: Any, question: str) -> str:
    """
    Convert a pandas query result into a human-readable response.
    """
    # Handle single numeric values
    if isinstance(result, (int, float, np.integer, np.floating)):
        # Try to infer what was asked about
        q_lower = question.lower()
        
        # Format currency
        if "revenue" in q_lower or "sales" in q_lower or "spend" in q_lower:
            formatted = f"${result:,.0f}"
        else:
            formatted = f"{result:,.2f}".rstrip('0').rstrip('.')
        
        # Generate response based on question keywords
        if "total" in q_lower:
            return f"Total: {formatted}"
        elif "average" in q_lower or "avg" in q_lower or "mean" in q_lower:
            return f"Average: {formatted}"
        elif "count" in q_lower or "number" in q_lower:
            return f"Count: {int(result)}"
        else:
            return f"Result: {formatted}"
    
    # Handle Series (grouped results)
    elif isinstance(result, pd.Series):
        lines = []
        for idx, val in result.items():
            if isinstance(val, (int, float, np.integer, np.floating)):
                if "revenue" in question.lower() or "sales" in question.lower():
                    formatted = f"${val:,.0f}"
                else:
                    formatted = f"{val:,.2f}".rstrip('0').rstrip('.')
                lines.append(f"{idx}: {formatted}")
            else:
                lines.append(f"{idx}: {val}")
        return ", ".join(lines)
    
    # Handle DataFrame
    elif isinstance(result, pd.DataFrame):
        if len(result) == 0:
            return "No data found."
        
        # Format as readable table
        lines = []
        for idx, row in result.iterrows():
            row_str = " | ".join([f"{col}: {val}" for col, val in row.items()])
            lines.append(row_str)
        return "\n".join(lines[:10])  # Limit to first 10 rows
    
    # Handle list or array
    elif isinstance(result, (list, tuple)):
        if len(result) == 0:
            return "No results."
        formatted_items = []
        for item in result[:10]:  # Limit to 10 items
            if isinstance(item, (int, float)):
                formatted_items.append(f"{item:,.2f}".rstrip('0').rstrip('.'))
            else:
                formatted_items.append(str(item))
        return ", ".join(formatted_items)
    
    # Default
    else:
        return str(result)


def _extract_columns_from_code(code: str) -> List[str]:
    columns = re.findall(r"""df\[\s*["']([^"']+)["']\s*\]""", code or "")
    columns.extend(re.findall(r"""groupby\(\s*["']([^"']+)["']\s*\)""", code or ""))
    columns.extend(re.findall(r"""\[\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\]""", code or ""))

    flattened: List[str] = []
    for item in columns:
        if isinstance(item, tuple):
            flattened.extend([value for value in item if value])
        elif item:
            flattened.append(item)

    seen: List[str] = []
    for column in flattened:
        if column not in seen:
            seen.append(column)
    return seen


def _summarize_result_for_audit(result: Any) -> str:
    if isinstance(result, pd.Series):
        preview = [f"{index}: {value}" for index, value in result.head(5).items()]
        return ", ".join(preview)
    if isinstance(result, pd.DataFrame):
        if result.empty:
            return "No rows returned"
        return result.head(3).to_dict(orient="records").__repr__()
    if isinstance(result, (list, tuple)):
        return ", ".join(str(item) for item in result[:5])
    return str(result)


def _build_base_audit(
    df: Optional[pd.DataFrame],
    stats: Dict[str, Any],
    question: str,
    question_type: str,
) -> Dict[str, Any]:
    return {
        "question": question,
        "question_type": question_type,
        "dataset_scope": {
            "rows": int(len(df)) if df is not None else int(stats.get("row_count", 0) or 0),
            "columns": list(df.columns)[:12] if df is not None else [],
        },
        "metric": stats.get("metric_name", ""),
        "dimensions": [
            value
            for value in [stats.get("cat1_name"), stats.get("cat2_label")]
            if isinstance(value, str) and value
        ],
        "columns_used": [],
        "generated_query": "",
        "result_preview": "",
        "evidence": [],
    }


def _answer_data_question(
    df: pd.DataFrame,
    question: str,
    stats: Dict[str, Any],
) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Answer a data question by generating and executing a pandas query dynamically.
    Uses LLM to generate the pandas code instead of hardcoded rules.
    """
    audit = _build_base_audit(df, stats, question, "DATA")

    # Ensure date column is datetime if it exists
    if 'date' in df.columns:
        df = df.copy()
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
    
    logger.info(f"Processing data question: '{question}'")
    
    # Generate pandas query using LLM
    pandas_code = generate_pandas_query(df, question)
    
    if not pandas_code:
        logger.warning(f"Failed to generate pandas query for: {question}")
        audit["evidence"].append("No executable pandas query could be generated from the question.")
        return None, audit
    
    # Execute the query
    success, result, error_msg = execute_pandas_query(df, pandas_code)
    audit["generated_query"] = pandas_code
    audit["columns_used"] = _extract_columns_from_code(pandas_code)
    
    if not success:
        logger.error(f"Query execution failed: {error_msg}")
        audit["evidence"].append(error_msg)
        return None, audit
    
    # Format the result into a readable response
    response = _format_query_result(result, question)
    audit["result_preview"] = _summarize_result_for_audit(result)
    audit["evidence"] = [
        f"Query executed against {len(df):,} rows.",
        f"Primary metric in scope: {stats.get('metric_name', 'detected dynamically')}.",
    ]
    if audit["columns_used"]:
        audit["evidence"].append(f"Columns used: {', '.join(audit['columns_used'])}.")
    logger.info(f"Final response: {response}")
    
    return response, audit


def build_insight_chain():
    """
    Construct a chain that takes structured stats plus an optional user question
    and returns a business-friendly, well-structured analysis.
    """
    template = """
You are a senior business intelligence analyst.

CRITICAL INSTRUCTION: If a user question is provided and is NOT empty, you MUST answer ONLY that question directly and concisely in 1-3 sentences using the stats provided. Do NOT provide any report structure. Do NOT include DATASET SUMMARY, KEY INSIGHTS, or any other sections. Just answer the question.

If NO user question is provided (empty string), then write a concise but insightful report with these exact section headings:

DATASET SUMMARY
<2-4 sentences summarizing the dataset, volume, and overall performance.>

KEY INSIGHTS
<Bulleted list of the most important insights about products, regions, trends, and anomalies.>

ADVANCED ANALYSIS
<Bulleted list clearly explaining growth trends, correlation between variables, statistical forecasts, and variability insights in simple business terminology without heavy jargon.>

VISUAL ANALYSIS
<Bulleted list explaining what a revenue trend chart, product performance chart, and region comparison chart reveal.>

BUSINESS RECOMMENDATIONS
<Bulleted list of specific, actionable recommendations to improve revenue or efficiency.>

ACTION PLAN
<Numbered list of next actions over the next 30 days.>

---

Dataset summary:
{dataset_summary}

Stats snapshot:
{stats_snapshot}

User question (may be empty): {user_question}

Remember: If user_question is not empty, answer ONLY the question in 1-3 sentences. No report structure.
"""
    prompt = ChatPromptTemplate.from_template(template)
    llm = get_llm()
    return prompt | llm


def _classify_question(question: str, df: Optional[pd.DataFrame] = None) -> str:
    """Classify the user's intent semantically using an LLM to completely avoid hardcoded keywords."""
    if not question:
        return "GENERAL"
    
    # Fast path for obvious chart requests
    q_lower = question.lower()
    chart_keywords = ['chart', 'plot', 'graph', 'visualize', 'pie chart', 'bar chart', 'line chart', 'scatter']
    if any(keyword in q_lower for keyword in chart_keywords):
        return "CHART"
        
    schema = ""
    if df is not None:
        schema = f"The dataset has {len(df)} rows and columns: {list(df.columns)}."
    
    template = """You are a classification router for an AI business assistant.
Classify the following user query EXCLUSIVELY into one of these three categories:

1. "DATA": The user is asking a quantitative or factual question that must be answered by querying the dataset (e.g., finding the highest, lowest, average, totals, count, or specific records).
2. "BUSINESS_ANALYSIS": The user is asking for strategic advice, qualitative opinions, business recommendations, or asking "what should we do?"
3. "GENERAL": The user is just saying hello, asking who you are, or making a non-business statement.

User Query: "{question}"
Dataset Information: {schema}

Return ONLY the exact category name (DATA, BUSINESS_ANALYSIS, or GENERAL) without quotes, markdown, or explanation.
"""
    try:
        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | get_llm()
        msg = chain.invoke({"schema": schema, "question": question})
        content = getattr(msg, "content", str(msg)).strip().upper()
        
        # Fast path for advanced analytics features
        q_lower = question.lower()
        if "trend" in q_lower or "growth" in q_lower:
            return "ADV_TREND"
        if "correlation" in q_lower or "relationship" in q_lower:
            return "ADV_CORRELATION"
        if "prediction" in q_lower or "forecast" in q_lower:
            return "ADV_FORECAST"
        if "distribution" in q_lower or "spread" in q_lower:
            return "ADV_DISTRIBUTION"
        if "compare" in q_lower or "comparison" in q_lower:
            return "ADV_COMPARE"
        if "outlier" in q_lower or "anomaly" in q_lower:
            return "ADV_OUTLIERS"
            
        # Valid category matching
        for valid in ["DATA", "BUSINESS_ANALYSIS", "GENERAL", "CHART"]:
            if valid in content:
                return valid
                
        return "DATA"  # Safest fallback for a BI agent
    except Exception as e:
        logger.error(f"Semantic classification failed, falling back: {e}")
        return "DATA"


def build_business_analysis_chain():
    """Chain for business analysis questions requiring recommendations."""
    template = """
You are a senior business intelligence analyst providing strategic recommendations.

Based on the following dataset insights, answer the user's business question with specific, actionable recommendations.

Dataset Insights:
{insights}

User Question: {user_question}

IMPORTANT: Answer the specific question asked. Provide structured response with:

Answer
<Direct answer to the question based on data insights>

Key Reasoning  
<Bullet points explaining the analysis and data supporting your answer>

Recommendation
<Specific, actionable business recommendations based on the data>

Keep the response concise, focused on the data, and business-value driven.
Be direct and answer what the user asked.
"""
    prompt = ChatPromptTemplate.from_template(template)
    llm = get_llm()
    return prompt | llm


def build_general_business_chain():
    """Chain for general business questions (including hybrid data+strategy questions)."""
    template = """
You are a versatile business intelligence analyst and strategic advisor.

You have access to dataset insights and can provide both data-driven answers and strategic business advice.

Dataset Insights (use if relevant):
{insights}

User Question: {user_question}

IMPORTANT: 
- If the question asks about the data, analyze the insights provided and answer directly
- If the question is strategic/business advice, provide professional guidance
- Always be specific and use the data when applicable
- If you cannot answer based on the data, say so explicitly

Provide a structured response with:

Answer
<Direct answer to the question>

Analysis/Reasoning
<Bullet points with data evidence or business logic>

Recommendations (if applicable)
<Specific, actionable next steps>

Keep the response professional, direct, and actionable.
"""
    prompt = ChatPromptTemplate.from_template(template)
    llm = get_llm()
    return prompt | llm


def _get_key_insights(df: pd.DataFrame, stats: Dict[str, Any]) -> str:
    """
    Extract comprehensive key insights from dataframe and stats for business analysis.
    Works with flexible CSV datasets.
    """
    insights = []
    
    # Pre-computed stats (Legacy backward compatibility)
    if 'top_product' in stats:
        insights.append(f"Top product: {stats['top_product']}")
    if 'weakest_product' in stats:
        insights.append(f"Weakest product: {stats['weakest_product']}")
    
    # Dynamic Stats
    if 'top_cat1' in stats:
        insights.append(f"Top {stats.get('cat1_name', 'Category')}: {stats['top_cat1']}")
    if 'weakest_cat1' in stats:
        insights.append(f"Weakest {stats.get('cat1_name', 'Category')}: {stats['weakest_cat1']}")
    if 'strongest_cat2' in stats:
        insights.append(f"Strongest {stats.get('cat2_label', 'Segment')}: {stats['strongest_cat2']}")
    if 'weakest_cat2' in stats:
        insights.append(f"Weakest {stats.get('cat2_label', 'Segment')}: {stats['weakest_cat2']}")
    
    if df is not None and len(df) > 0:
        # Auto-detect numeric columns for flexible CSV support
        numeric_cols = find_numeric_columns(df)
        categorical_cols = find_categorical_columns(df)
        
        # Get revenue or first numeric column
        metric_col = next((c for c in numeric_cols if 'revenue' in c.lower()), numeric_cols[0] if numeric_cols else None)
        
        if metric_col and categorical_cols:
            # Revenue/metric by first categorical dimension
            primary_cat = categorical_cols[0]
            try:
                cat_breakdown = df.groupby(primary_cat)[metric_col].sum().sort_values(ascending=False)
                insights.append(f"{metric_col.title()} by {primary_cat.title()}: {', '.join([f'{c}: ${v:,.0f}' if metric_col.lower() in ['revenue', 'sales', 'spend'] else f'{c}: {v:,.0f}' for c, v in cat_breakdown.head(5).items()])}")
            except:
                pass
        
        # If there's a second categorical column
        if len(categorical_cols) > 1 and metric_col:
            secondary_cat = categorical_cols[1]
            try:
                cat_breakdown_2 = df.groupby(secondary_cat)[metric_col].sum().sort_values(ascending=False)
                insights.append(f"{metric_col.title()} by {secondary_cat.title()}: {', '.join([f'{c}: ${v:,.0f}' if metric_col.lower() in ['revenue', 'sales', 'spend'] else f'{c}: {v:,.0f}' for c, v in cat_breakdown_2.head(5).items()])}")
            except:
                pass
        
        # Total metric
        if metric_col:
            try:
                total_metric = df[metric_col].sum()
                insights.append(f"Total {metric_col.lower()}: ${total_metric:,.0f}" if metric_col.lower() in ['revenue', 'sales', 'spend'] else f"Total {metric_col.lower()}: {total_metric:,.0f}")
            except:
                pass
        
        # Row count and date range
        insights.append(f"Dataset size: {len(df)} records")
        datetime_cols = find_datetime_columns(df)
        if datetime_cols:
            try:
                date_col = datetime_cols[0]
                min_date = df[date_col].min()
                max_date = df[date_col].max()
                insights.append(f"Date range: {min_date.date()} to {max_date.date()}")
            except:
                pass
    
    return "\n".join(insights)


def generate_structured_ai_response(
    df: Optional[pd.DataFrame] = None,
    dataset_summary: str = "",
    stats_snapshot: Dict[str, Any] = None,
    user_question: Optional[str] = "",
) -> Tuple[str, Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Intelligent business analyst that handles data queries, business analysis, general business questions, and chart generation.
    Returns (text_response, chart_object_or_none, answer_audit)
    
    Features:
    - Chart generation for "show this in chart" requests
    - Dynamic pandas queries for data questions
    - Business analysis with recommendations
    - General business advice
    - Comprehensive fallback mechanisms for safety
    """
    if stats_snapshot is None:
        stats_snapshot = {}
    
    question = (user_question or "").strip()
    
    # Classify the question
    question_type = _classify_question(question, df) if question else "NONE"
    answer_audit = _build_base_audit(df, stats_snapshot, question, question_type if question else "FULL_REPORT")
    
    # Get key insights for context
    key_insights = _get_key_insights(df, stats_snapshot)
    
    # Handle Advanced Analytics Intents
    if question_type.startswith("ADV_"):
        try:
            adv_response, adv_chart = run_advanced_analytics(df, question_type, question)
            if adv_response:
                answer_audit["evidence"] = [
                    "Advanced analytics mode was selected for this request.",
                    f"Detected metric: {stats_snapshot.get('metric_name', 'dynamic metric')}.",
                ]
                if adv_chart and isinstance(adv_chart, dict):
                    answer_audit["columns_used"] = list(df.columns[:6]) if df is not None else []
                    answer_audit["result_preview"] = "Advanced analytic chart returned."
                return adv_response, adv_chart, answer_audit
        except Exception as e:
            logger.warning(f"Advanced analytics failed (falling back): {e}")

    # Handle chart requests
    if question_type == "CHART":
        try:
            if df is not None:
                chart_obj = generate_dynamic_chart(df, question)
                if chart_obj:
                    response_text = f"I've created a chart for your query: {question}"
                    answer_audit["question_type"] = "CHART"
                    answer_audit["generated_query"] = chart_obj.get("generated_code", "")
                    answer_audit["columns_used"] = _extract_columns_from_code(answer_audit["generated_query"])
                    answer_audit["result_preview"] = "Dynamic chart created from the dataset."
                    answer_audit["evidence"] = [
                        f"Chart generated over {len(df):,} dataset rows.",
                        f"Primary metric in scope: {stats_snapshot.get('metric_name', 'dynamic metric')}.",
                    ]
                    logger.info(f"Chart generated for question: {question}")
                    return response_text, chart_obj, answer_audit
        except Exception as e:
            logger.warning(f"Chart generation failed (will fallback): {e}")
        
        # Fallback if chart generation fails - return data analysis instead
        if df is not None:
            try:
                data_answer, data_audit = _answer_data_question(df, question, stats_snapshot)
                if data_answer:
                    data_audit["question_type"] = "CHART_FALLBACK"
                    return f"Chart generation encountered an issue. Here's the data instead:\n{data_answer}", None, data_audit
            except:
                pass
        
        answer_audit["evidence"] = ["Chart generation failed before a valid figure could be produced."]
        return "I couldn't generate a chart for that request. Try asking for a pie chart, bar chart, or line chart with specific data.", None, answer_audit
    
    # No question - return full report
    if not question:
        try:
            report = _generate_full_report(dataset_summary, stats_snapshot)
            answer_audit["evidence"] = [
                "Full report generated from the dataset summary and stats snapshot.",
                f"Rows analyzed: {answer_audit['dataset_scope']['rows']:,}.",
            ]
            answer_audit["columns_used"] = answer_audit["dataset_scope"]["columns"]
            return report, None, answer_audit
        except Exception as e:
            logger.warning(f"Full report generation failed: {e}")
            answer_audit["evidence"] = [f"Full report generation failed: {e}"]
            return "Unable to generate full report. Please ask specific questions about the data.", None, answer_audit
    
    if question_type == "DATA":
        # Direct data queries
        if df is not None:
            try:
                data_answer, data_audit = _answer_data_question(df, question, stats_snapshot)
                if data_answer:
                    return data_answer, None, data_audit
            except Exception as e:
                logger.warning(f"Data question failed: {e}")
        
        # Fallback: try business analysis on the same question
        try:
            chain = build_general_business_chain()
            msg = chain.invoke({
                "insights": key_insights,
                "user_question": question,
            })
            content = getattr(msg, "content", None)
            if isinstance(content, str):
                answer_audit["evidence"] = [
                    "Direct data query fallback used business reasoning over existing insights.",
                    "The requested query could not be executed deterministically.",
                ]
                return f"[Data analysis fallback] {content.strip()}", None, answer_audit
        except Exception as e:
            logger.warning(f"Data fallback also failed: {e}")
        
        answer_audit["evidence"] = ["No reliable direct data answer was produced, so the response fell back to dataset insights."]
        return f"I couldn't directly query the data. Based on available insights:\n{key_insights}", None, answer_audit
    

    elif question_type == "BUSINESS_ANALYSIS":
        # Business analysis requiring recommendations
        try:
            chain = build_business_analysis_chain()
            msg = chain.invoke({
                "insights": key_insights,
                "user_question": question,
            })
            content = getattr(msg, "content", None)
            if isinstance(content, str):
                answer_audit["evidence"] = [
                    "Business analysis chain used dataset insights as context.",
                    f"Primary metric: {stats_snapshot.get('metric_name', 'dynamic metric')}.",
                ]
                return content.strip(), None, answer_audit
        except Exception as e:
            logger.warning(f"Business analysis LLM failed: {e}")
        
        # Fallback: return summary insights with question context
        fallback_response = f"Based on the data analysis:\n\n{key_insights}\n\nFor more specific recommendations on '{question}', please rephrase your question more clearly."
        answer_audit["evidence"] = ["Business analysis model failed, so the response fell back to deterministic insight summaries."]
        return fallback_response, None, answer_audit
    
    else:  # GENERAL
        # General business questions - with comprehensive error handling
        try:
            chain = build_general_business_chain()
            msg = chain.invoke({
                "insights": key_insights,
                "user_question": question,
            })
            content = getattr(msg, "content", None)
            if isinstance(content, str):
                answer_audit["evidence"] = ["General business reasoning used the detected dataset insights as supporting context."]
                return content.strip(), None, answer_audit
        except Exception as e:
            logger.warning(f"General business LLM failed: {e}")
        
        # Multi-level fallback for general questions
        try:
            # Try as business analysis
            chain = build_business_analysis_chain()
            msg = chain.invoke({
                "insights": key_insights,
                "user_question": question,
            })
            content = getattr(msg, "content", None)
            if isinstance(content, str):
                answer_audit["evidence"] = ["General response fell back to the business analysis chain."]
                return content.strip(), None, answer_audit
        except:
            pass
        
        # Final fallback: use insights
        answer_audit["evidence"] = ["All model-based fallbacks failed, so the answer returned the available dataset insights directly."]
        return f"General query: {question}\n\nAvailable insights:\n{key_insights}", None, answer_audit


def generate_structured_ai_response_legacy(
    df: Optional[pd.DataFrame] = None,
    dataset_summary: str = "",
    stats_snapshot: Dict[str, Any] = None,
    user_question: Optional[str] = "",
) -> str:
    """
    Legacy wrapper for backward compatibility.
    Returns only the text response (ignores chart data).
    """
    text_response, _, _ = generate_structured_ai_response(
        df=df,
        dataset_summary=dataset_summary,
        stats_snapshot=stats_snapshot,
        user_question=user_question,
    )
    return text_response


def _generate_full_report(dataset_summary: str, stats_snapshot: Dict[str, Any]) -> str:
    """Generate the full business intelligence report when no specific question is asked."""
    stats_str_parts: List[str] = []
    for k, v in stats_snapshot.items():
        stats_str_parts.append(f"{k}: {v}")
    stats_str = "\n".join(stats_str_parts)

    try:
        chain = build_insight_chain()
        msg = chain.invoke({
            "dataset_summary": dataset_summary,
            "stats_snapshot": stats_str,
            "user_question": "",
        })
        content = getattr(msg, "content", None)
        if isinstance(content, str):
            return content.strip()
    except Exception as e:
        logger.warning(f"Full report LLM failed: {e}")
    
    # Fallback deterministic report
    top_product = stats_snapshot.get("top_product", "N/A")
    weakest_product = stats_snapshot.get("weakest_product", "N/A")
    strongest_region = stats_snapshot.get("strongest_region", "N/A")
    weakest_region = stats_snapshot.get("weakest_region", "N/A")
    trend_summary = stats_snapshot.get("trend_summary", "")
    anomaly_summary = stats_snapshot.get("anomaly_summary", "")

    return "\n".join([
        "DATASET SUMMARY",
        dataset_summary,
        "",
        "KEY INSIGHTS",
        f"- Top product: {top_product}",
        f"- Weakest product: {weakest_product}",
        f"- Strongest region: {strongest_region}",
        f"- Weakest region: {weakest_region}",
        f"- Trend: {trend_summary}".strip(),
        f"- Anomalies: {anomaly_summary}".strip(),
        "",
        "VISUAL ANALYSIS",
        "- Revenue trend chart: highlights overall direction and volatility over time.",
        "- Product performance chart: shows which products drive most revenue.",
        "- Region comparison chart: reveals regional strengths and weak spots.",
        "",
        "BUSINESS RECOMMENDATIONS",
        "- Reallocate budget toward high-performing product/region combinations while testing messaging in weaker regions.",
        "- Create targeted campaigns for the weakest region and validate pricing/positioning assumptions.",
        "- Increase weekend-focused promotions if weekend uplift is present.",
        "",
        "ACTION PLAN",
        "3. Monitor weekly trends and anomalies; operationalize learnings into a monthly playbook.",
    ]).strip()

def run_advanced_analytics(df: pd.DataFrame, intent: str, question: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """Execute specialized quantitative analysis matching requested advanced intents."""
    import plotly.express as px  # lazy import — only loaded when advanced analytics are requested
    import plotly.graph_objects as go  # lazy import
    if df is None or len(df) == 0:
        return "Not enough data for advanced analytics.", None

    numeric_cols = find_numeric_columns(df)
    date_cols = find_datetime_columns(df)
    
    if intent == "ADV_TREND":
        if not date_cols or not numeric_cols:
            return "Trend analysis requires both date and numeric columns in the dataset.", None
            
        date_col = date_cols[0]
        val_col = next((c for c in numeric_cols if 'revenue' in c.lower() or 'sales' in c.lower()), numeric_cols[0])
        
        # Convert to datetime and sort
        df_copy = df.copy()
        df_copy[date_col] = pd.to_datetime(df_copy[date_col], errors="coerce")
        df_sorted = df_copy.dropna(subset=[date_col]).sort_values(date_col)
        
        # Group by Period (Monthly)
        df_group = df_sorted.set_index(date_col).resample('ME')[val_col].sum().reset_index()
        
        if len(df_group) < 2:
            return "Not enough date variance to compute a meaningful trend.", None
            
        df_group['growth'] = df_group[val_col].pct_change() * 100
        df_group['moving_avg'] = df_group[val_col].rolling(window=min(3, len(df_group))).mean()
        
        avg_growth = df_group['growth'].mean()
        
        fig = px.line(df_group, x=date_col, y=[val_col, 'moving_avg'], 
                      title=f"{val_col.title()} Trend Analysis",
                      labels={"value": val_col.title(), "variable": "Line Type"},
                      template="plotly_dark")
        fig.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        
        direction = "upward trend" if avg_growth > 0 else "downward trend"
        explanation = f"**Trend Analysis**\n\n{val_col.title()} shows a {direction} with an average growth rate of {avg_growth:.1f}% per period. "
        explanation += f"The latest period recorded {df_group[val_col].iloc[-1]:,.2f}."
        
        return explanation, json.loads(fig.to_json())
        
    elif intent == "ADV_CORRELATION":
        if len(numeric_cols) < 2:
            return "Correlation analysis requires at least two numeric columns.", None
            
        corr_matrix = df[numeric_cols].corr()
        
        # Find strongest correlation ignoring self-correlation (diagonal)
        mask = np.ones(corr_matrix.shape, dtype=bool)
        np.fill_diagonal(mask, 0)
        
        max_corr_idx = corr_matrix.where(mask).abs().unstack().idxmax()
        if pd.isna(max_corr_idx).any():
            return "No valid correlation could be computed between numerical fields.", None
            
        col1, col2 = max_corr_idx
        score = corr_matrix.loc[col1, col2]
        
        fig = px.scatter(df, x=col1, y=col2, trendline="ols",
                         title=f"Correlation: {col1.title()} vs {col2.title()}",
                         template="plotly_dark")
        fig.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        
        strength = "strong" if abs(score) > 0.7 else "moderate" if abs(score) > 0.4 else "weak"
        rel_type = "positive" if score > 0 else "negative"
        
        explanation = f"**Correlation Analysis**\n\n{col1.title()} and {col2.title()} have a {strength} {rel_type} correlation (score: {score:.2f})."
        return explanation, json.loads(fig.to_json())
        
    elif intent == "ADV_FORECAST":
        if not date_cols or not numeric_cols:
            return "Forecasting requires a timeseries dataset (both date and numeric columns).", None
            
        date_col = date_cols[0]
        val_col = next((c for c in numeric_cols if 'revenue' in c.lower() or 'sales' in c.lower()), numeric_cols[0])
        
        df_copy = df.copy()
        df_copy[date_col] = pd.to_datetime(df_copy[date_col], errors="coerce")
        df_sorted = df_copy.dropna(subset=[date_col]).sort_values(date_col)
        df_group = df_sorted.set_index(date_col).resample('ME')[val_col].sum().reset_index()
        
        if len(df_group) < 3:
            return "Not enough historical data points for reliable forecasting.", None
            
        x = np.arange(len(df_group))
        y = df_group[val_col].values
        
        # Simple Linear Regression fit
        z = np.polyfit(x, y, 1)
        p = np.poly1d(z)
        
        next_x = len(df_group)
        next_y = p(next_x)
        
        df_group['Trend'] = p(x)
        
        # Determine next interval date roughly
        next_date = df_group[date_col].iloc[-1] + pd.DateOffset(months=1)
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=df_group[date_col], y=df_group[val_col], name='Actual', mode='lines+markers'))
        fig.add_trace(go.Scatter(x=df_group[date_col], y=df_group['Trend'], name='Trend', line=dict(dash='dash')))
        fig.add_trace(go.Scatter(x=[next_date], y=[next_y], name='Forecast', mode='markers', marker=dict(size=12, symbol='star', color='yellow')))
        
        fig.update_layout(title=f"Forecast Projection: {val_col.title()}", template="plotly_dark",
                          paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        
        explanation = f"**Forecasting Analysis**\n\nBased on linear regression of historical data, the forecast suggests the next period ends around {next_date.strftime('%B %Y')} reaching approximately **${next_y:,.2f}**."
        return explanation, json.loads(fig.to_json())
        
    elif intent == "ADV_DISTRIBUTION" or intent == "ADV_OUTLIERS":
        if not numeric_cols:
            return "Distribution/Outlier analysis requires numeric columns.", None
            
        val_col = next((c for c in numeric_cols if 'revenue' in c.lower() or 'sales' in c.lower()), numeric_cols[0])
        
        mean_val = df[val_col].mean()
        median_val = df[val_col].median()
        std_val = df[val_col].std()
        
        # Extreme Outlier detection (Z-score > 2.5)
        outliers = df[np.abs(df[val_col] - mean_val) > (2.5 * std_val)]
        
        fig = px.histogram(df, x=val_col, marginal="box", title=f"Distribution Profile of {val_col.title()}", template="plotly_dark")
        fig.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        
        explanation = f"**Distribution & Outlier Analysis**\n\nThe {val_col.title()} variable demonstrates a mean of {mean_val:,.2f} and a median of {median_val:,.2f}, with a standard deviation indicating spread of {std_val:,.2f}. "
        
        if len(outliers) > 0:
            explanation += f"\n\n🚨 **{len(outliers)} statistical outliers** were detected operating at extreme variance from the mean distribution."
        else:
            explanation += "\n\nNo extreme statistical outliers were detected in the distribution spread."
            
        return explanation, json.loads(fig.to_json())
        
    elif intent == "ADV_COMPARE":
        cat_cols = find_categorical_columns(df)
        if not cat_cols or not numeric_cols:
            return "Segment comparison requires both categorical and numeric dimensions in your data.", None
            
        cat_col = cat_cols[0]
        val_col = numeric_cols[0]
        
        df_group = df.groupby(cat_col)[val_col].mean().reset_index().sort_values(val_col, ascending=False).head(10)
        
        fig = px.bar(df_group, x=cat_col, y=val_col, title=f"Comparison: Average {val_col.title()} by {cat_col.title()}", template="plotly_dark")
        fig.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
        
        if len(df_group) > 1:
            top_cat = df_group.iloc[0][cat_col]
            bottom_cat = df_group.iloc[-1][cat_col]
            explanation = f"**Comparison Analysis**\n\nComparing segments by average {val_col.title()} reveals that **{top_cat}** is the strongest performer, separating heavily from **{bottom_cat}** which is the weakest among the top subset."
        else:
            explanation = "**Comparison Analysis**\n\nNot enough unique comparative segments exist in this category to establish bounds."
            
        return explanation, json.loads(fig.to_json())
        
    return None, None
