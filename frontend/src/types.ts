export type ColumnType =
  | "integer"
  | "float"
  | "datetime"
  | "boolean"
  | "categorical"
  | "text";

export interface NumericStats {
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  sum?: number | null;
  q1?: number | null;
  q3?: number | null;
  p05?: number | null;
  p95?: number | null;
  skewness?: number | null;
  kurtosis?: number | null;
}

export interface DatetimeStats {
  min?: string;
  max?: string;
  span_days?: number;
}

export interface ColumnProfile {
  name: string;
  inferred_type: ColumnType;
  confidence: number;
  semantic?: string | null;
  sensitive?: boolean;
  null_count: number;
  null_pct: number;
  distinct_count: number;
  cardinality: "low" | "medium" | "high";
  stats: NumericStats | DatetimeStats;
  top_k: Array<{ value: string; count: number }>;
  histogram: Array<{ bin_start: number; bin_end: number; count: number }>;
  sample_values: Array<string | number | null>;
}

export interface Summary {
  row_count: number;
  column_count: number;
  numeric_columns: number;
  categorical_columns: number;
  datetime_columns: number;
  text_columns: number;
  duplicate_count: number;
  total_cells: number;
  missing_cells: number;
  missing_pct: number;
}

export interface QualityIssue {
  id: string;
  severity: "high" | "medium" | "low";
  category: string;
  column: string;
  title: string;
  detail: string;
  count: number;
}

export interface QualityReport {
  issues: QualityIssue[];
  summary: {
    total_issues: number;
    high: number;
    medium: number;
    low: number;
    quality_score: number;
    categories: Record<string, number>;
  };
}

export interface DatasetInfo {
  id: string;
  name: string;
  rows: number;
  columns: number;
  created_at: number;
  quality_score?: number;
  preview?: Array<Record<string, string | number | boolean | null>>;
}

export interface ChartSpec {
  id: string;
  chart_type: "bar" | "line" | "histogram" | "scatter" | "heatmap" | "pie";
  title: string;
  x: string;
  y: string;
  data: Array<Record<string, unknown>>;
  aggregation?: string;
  columns?: string[];
  matrix?: Array<Array<number | null>>;
}

export interface Insight {
  id: string;
  category: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  numbers: Array<{ label: string; value: string }>;
  evidence: {
    chart_id?: string | null;
    columns?: string[];
  };
  query_hint?: string | null;
}

export interface AnalystResponse {
  answer: string;
  numbers: Array<{ label: string; value: string }>;
  explanation: string;
  intent?: string;
  mode: "llm" | "local" | "error";
  sql?: string | null;
  chart?: ChartSpec | null;
  query_result?: { columns: string[]; rows: Array<Array<unknown>>; row_count: number };
  related_insights?: Array<{ id: string; title: string; query_hint?: string | null }>;
}

export interface ReportResult {
  format: string;
  content: string;
  markdown: string;
}

export interface RowPage {
  offset: number;
  limit: number;
  total: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface CleaningResult {
  description: string;
  history_length: number;
  undone?: boolean;
}

export interface CleaningResponse extends AnalysisSnapshot {
  cleaning?: CleaningResult;
}

export interface AnalysisSnapshot {
  dataset: DatasetInfo;
  summary: Summary;
  columns: ColumnProfile[];
  quality: QualityReport;
  charts: ChartSpec[];
}

export interface AnalysisJob {
  id: string;
  name: string;
  status: "queued" | "running" | "done" | "error";
  stage: string;
  progress: number;
  message: string;
  error: string | null;
  session_id: string | null;
}

export interface CleaningStep {
  step: number;
  description: string;
}

export interface CleaningHistory {
  steps: CleaningStep[];
  length: number;
}
