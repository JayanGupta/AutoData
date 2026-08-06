export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1e15) return value.toExponential(2);
  const isWhole = Number.isInteger(value);
  return isWhole
    ? new Intl.NumberFormat("en-US").format(value)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export const TYPE_LABELS: Record<string, string> = {
  integer: "Number",
  float: "Decimal",
  datetime: "Date",
  boolean: "Boolean",
  categorical: "Category",
  text: "Text",
};

export const TYPE_COLORS: Record<string, string> = {
  integer: "bg-sky-100 text-sky-700 border-sky-200",
  float: "bg-cyan-100 text-cyan-700 border-cyan-200",
  datetime: "bg-violet-100 text-violet-700 border-violet-200",
  boolean: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  categorical: "bg-amber-100 text-amber-700 border-amber-200",
  text: "bg-slate-100 text-slate-600 border-slate-200",
};

export const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export const CATEGORY_LABELS: Record<string, string> = {
  missing_values: "Missing values",
  duplicates: "Duplicates",
  outliers: "Outliers",
  type_anomaly: "Type anomaly",
  constant_column: "Constant column",
  high_cardinality: "High cardinality",
  empty_column: "Empty column",
  skew: "Skewed distribution",
  correlation: "Correlation",
  trend: "Trend",
  distribution: "Distribution",
  comparison: "Comparison",
  outlier: "Outliers",
  quality: "Data quality",
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, " ");
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function formatDateRange(min?: string, max?: string): string {
  if (!min || !max) return "—";
  return `${min.slice(0, 10)} → ${max.slice(0, 10)}`;
}
