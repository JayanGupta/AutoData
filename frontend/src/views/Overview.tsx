import {
  CalendarRange,
  Columns3,
  Database,
  Rows3,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedDataTable } from "../components/ui/PaginatedDataTable";
import { Badge } from "../components/ui/Badge";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  categoryLabel,
  formatDateRange,
  formatNumber,
} from "../lib/format";
import type { ColumnProfile } from "../types";

export function OverviewPage() {
  const { snapshot } = useDataset();
  if (!snapshot) return null;
  const { summary, columns, dataset } = snapshot;

  const previewData = dataset.preview ?? [];
  const previewColumns = previewData.length ? Object.keys(previewData[0]) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Rows" value={formatNumber(summary.row_count)} icon={<Rows3 className="h-4 w-4" />} />
        <StatCard label="Columns" value={summary.column_count} icon={<Columns3 className="h-4 w-4" />} accent="bg-sky-50 text-sky-600" />
        <StatCard
          label="Missing cells"
          value={formatNumber(summary.missing_cells)}
          sub={`${summary.missing_pct}% of all cells`}
          icon={<Database className="h-4 w-4" />}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Duplicates"
          value={formatNumber(summary.duplicate_count)}
          icon={<Tags className="h-4 w-4" />}
          accent="bg-fuchsia-50 text-fuchsia-600"
        />
        <StatCard
          label="Quality score"
          value={snapshot.quality.summary.quality_score}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Date range"
          value={dateRangeSummary(columns)}
          icon={<CalendarRange className="h-4 w-4" />}
          accent="bg-violet-50 text-violet-600"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Structure" subtitle="Column type breakdown">
          <div className="space-y-3">
            <TypeRow label="Numeric" value={summary.numeric_columns} color="bg-sky-500" />
            <TypeRow label="Categorical" value={summary.categorical_columns} color="bg-amber-500" />
            <TypeRow label="Date / time" value={summary.datetime_columns} color="bg-violet-500" />
            <TypeRow label="Text / free-form" value={summary.text_columns} color="bg-slate-400" />
          </div>
        </Card>

        <Card title="Completeness" subtitle="Missing data by volume" className="md:col-span-2">
          <div className="flex items-end gap-6">
            <div className="text-center">
              <div
                className="mx-auto flex items-end justify-center rounded-lg bg-gradient-to-t from-brand-600 to-brand-400 text-sm font-bold text-white"
                style={{ height: `${Math.max(8, summary.missing_pct * 6)}px`, minHeight: 24, width: 72 }}
              >
                {summary.missing_pct}%
              </div>
              <p className="mt-2 text-xs text-slate-500">missing cells</p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600">
                <strong className="text-slate-900">{formatNumber(summary.total_cells)}</strong> total cells across{" "}
                <strong className="text-slate-900">{summary.row_count.toLocaleString()}</strong> rows.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {snapshot.quality.summary.quality_score}/100 data quality score
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Column profiles"
        subtitle="Inferred types, completeness and statistics"
        bodyClassName="p-0"
      >
        <div className="divide-y divide-slate-100">
          {columns.map((col) => (
            <ColumnRow key={col.name} col={col} />
          ))}
        </div>
      </Card>

      <Card title="Data preview" subtitle={`Browse all ${summary.row_count.toLocaleString()} rows`} bodyClassName="p-4">
        <PaginatedDataTable sessionId={dataset.id} columns={previewColumns} />
      </Card>
    </div>
  );
}

function TypeRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function dateRangeSummary(columns: ColumnProfile[]): string {
  const dt = columns.find((c) => c.inferred_type === "datetime");
  if (!dt) return "—";
  const s = dt.stats as { min?: string; max?: string };
  return formatDateRange(s.min, s.max);
}

function ColumnRow({ col }: { col: ColumnProfile }) {
  const numeric = col.stats as { mean?: number; median?: number; min?: number; max?: number; sum?: number; std?: number; p05?: number; p95?: number; skewness?: number };
  const dt = col.stats as { min?: string; max?: string };

  return (
    <div className="px-5 py-4 hover:bg-slate-50/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-slate-900">{col.name}</span>
        <Badge className={TYPE_COLORS[col.inferred_type]}>{TYPE_LABELS[col.inferred_type] ?? col.inferred_type}</Badge>
        {col.semantic && <Badge className="bg-slate-100 text-slate-500 border-slate-200">{categoryLabel(col.semantic)}</Badge>}
        <span className="ml-auto text-xs text-slate-400">{Math.round(col.confidence * 100)}% confidence</span>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <span>
          Missing: <strong className="text-slate-900">{col.null_pct}%</strong>
        </span>
        <span>
          Unique: <strong className="text-slate-900">{formatNumber(col.distinct_count)}</strong>
        </span>
        {col.inferred_type === "float" || col.inferred_type === "integer" ? (
          <>
            <span>
              Mean: <strong className="text-slate-900">{formatNumber(numeric.mean)}</strong>
            </span>
            <span>
              Median: <strong className="text-slate-900">{formatNumber(numeric.median)}</strong>
            </span>
            <span>
              Range: <strong className="text-slate-900">{formatNumber(numeric.min)} → {formatNumber(numeric.max)}</strong>
            </span>
            <span>
              Skew: <strong className="text-slate-900">{formatNumber(numeric.skewness)}</strong>
            </span>
            <span>
              Std dev: <strong className="text-slate-900">{formatNumber(numeric.std)}</strong>
            </span>
            <span>
              P05 / P95: <strong className="text-slate-900">{formatNumber(numeric.p05)} / {formatNumber(numeric.p95)}</strong>
            </span>
          </>
        ) : col.inferred_type === "datetime" ? (
          <>
            <span className="sm:col-span-2">
              Range: <strong className="text-slate-900">{formatDateRange(dt.min, dt.max)}</strong>
            </span>
          </>
        ) : (
          <span className="sm:col-span-2 truncate">
            Top:{" "}
            <strong className="text-slate-900">
              {col.top_k.slice(0, 3).map((t) => t.value).join(", ") || "—"}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
