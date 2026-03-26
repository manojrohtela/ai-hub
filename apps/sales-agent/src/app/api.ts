export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BACKEND_WARMUP_TTL_MS = 10 * 60 * 1000;

let warmupPromise: Promise<void> | null = null;
let lastWarmupAt = 0;

export interface AlertItem {
  id: string;
  severity: string;
  title: string;
  message: string;
  cadence: string;
}

export interface WhatIfDriver {
  name: string;
  label: string;
  elasticity: number;
  correlation: number;
  base_value: number;
  default_change_pct: number;
  projected_total: number;
  impact_summary: string;
}

export interface WhatIfModel {
  enabled?: boolean;
  target_metric?: string;
  base_total?: number;
  base_average?: number;
  drivers?: WhatIfDriver[];
  assumptions?: string[];
}

export interface ForecastPoint {
  name: string;
  actual: number | null;
  trend: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
  bandBase: number | null;
  bandSize: number | null;
}

export interface ForecastModel {
  enabled?: boolean;
  summary?: string;
  metric?: string;
  period_label?: string;
  confidence_level?: string;
  data?: ForecastPoint[];
}

export interface AnswerAudit {
  question?: string;
  question_type?: string;
  metric?: string;
  dimensions?: string[];
  columns_used?: string[];
  generated_query?: string;
  result_preview?: string;
  evidence?: string[];
  dataset_scope?: {
    rows?: number;
    columns?: string[];
  };
}

export interface AnalysisResponse {
  structured_report: string;
  charts: Record<string, any>;
  follow_up_questions: string[];
  dataset_summary: string;
  key_insights: string[];
  visual_analysis: string[];
  business_recommendations: string[];
  action_plan: string[];
  stats_snapshot: Record<string, string | number>;
  forecast: ForecastModel;
  what_if: WhatIfModel;
  alerts: AlertItem[];
  answer_audit: AnswerAudit;
}

export interface ComparisonCard {
  label: string;
  baseline_value: string;
  comparison_value: string;
  delta: number;
}

export interface ComparisonResponse {
  comparison_summary: string;
  highlights: string[];
  shared_columns: string[];
  cards: ComparisonCard[];
  charts: Record<string, any>;
  baseline_label: string;
  comparison_label: string;
  primary_metric?: string | null;
}

export const warmBackend = async (force = false): Promise<void> => {
  const now = Date.now();
  if (!force && lastWarmupAt && now - lastWarmupAt < BACKEND_WARMUP_TTL_MS) {
    return;
  }

  if (warmupPromise) {
    return warmupPromise;
  }

  warmupPromise = fetch(`${API_URL}/health`, {
    method: 'GET',
    cache: 'no-store',
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Warmup failed with status ${response.status}`);
      }
      lastWarmupAt = Date.now();
    })
    .catch((error) => {
      console.warn('Backend warmup request failed:', error);
    })
    .finally(() => {
      warmupPromise = null;
    });

  return warmupPromise;
};

export const analyzeDataset = async (
  useDemo: boolean,
  question: string,
  file?: File,
  demoDatasetName?: string
): Promise<AnalysisResponse> => {
  await warmBackend();

  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else {
    formData.append('use_demo', String(useDemo));
    if (demoDatasetName) {
      formData.append('demo_dataset_name', demoDatasetName);
    }
  }
  if (question) {
    formData.append('question', question);
  }

  const response = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  return response.json();
};

export const compareDatasets = async ({
  primaryUseDemo,
  primaryFile,
  primaryDemoDatasetName,
  comparisonFile,
  comparisonDemoDatasetName,
}: {
  primaryUseDemo: boolean;
  primaryFile?: File;
  primaryDemoDatasetName?: string;
  comparisonFile?: File;
  comparisonDemoDatasetName?: string;
}): Promise<ComparisonResponse> => {
  const formData = new FormData();

  formData.append('primary_use_demo', String(primaryUseDemo));

  if (primaryFile) {
    formData.append('primary_file', primaryFile);
  } else if (primaryDemoDatasetName) {
    formData.append('primary_demo_dataset_name', primaryDemoDatasetName);
  }

  if (comparisonFile) {
    formData.append('comparison_file', comparisonFile);
  } else if (comparisonDemoDatasetName) {
    formData.append('comparison_demo_dataset_name', comparisonDemoDatasetName);
  }

  const response = await fetch(`${API_URL}/compare`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Comparison failed');
  }

  return response.json();
};
