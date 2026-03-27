export interface ColumnInfo {
  name: string;
  dtype: string;
  sample_values: unknown[];
}

export interface UploadResponse {
  session_id: string;
  table_name: string;
  columns: ColumnInfo[];
  row_count: number;
  sample_rows: Record<string, unknown>[];
}

export interface QueryResponse {
  question: string;
  sql: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  error?: string | null;
}
