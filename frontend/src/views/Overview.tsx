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
import { ProgressBar } from "../components/ui/ProgressBar";
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

  const typeTotal = Math.max(
    summary.numeric_columns + summary.categorical_columns + summary.datetime_columns + summary.text_columns,
    1,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Rows" value={formatNumber(summary.row_count)} icon={<Rows3 className="h-4 w-4" />} />
        <StatCard
          label="Columns"
          value={summary.column_count}
          icon={<Columns3 className="h-4 w-4" />}
          accent="bg-gradient-to-br from-sky-500/25 to-sky-500/10 text-sky-200"
        />
        <StatCard
          label="Missing cells"
          value={formatNumber(summary.missing_cells)}
          sub={`${summary.missing_pct}% of all cells`}
          icon={<Database className="h-4 w-4" />}
          accent="bg-gradient-to-br from-amber-500/25 to-amber-500/10 text-amber-200"
        />
        <StatCard
          label="Duplicates"
          value={formatNumber(summary.duplicate_count)}
          icon={<Tags className="h-4 w-4" />}
          accent="bg-gradient-to-br from-fuchsia-500/25 to-fuchsia-500/10 text-fuchsia-200"
        />
        <StatCard
          label="Quality score"
          value={snapshot.quality.summary.quality_score}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 text-emerald-200"
        />
        <StatCard
          label="Date range"
          value={dateRangeSummary(columns)}
          icon={<CalendarRange className="h-4 w-4" />}
          accent="bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-200"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Structure" subtitle="Column type breakdown">
          <div className="space-y-3">
            <TypeRow label="Numeric" value={summary.numeric_columns} color="bg-sky-400" pct={(summary.numeric_columns / typeTotal) * 100} />
            <TypeRow label="Categorical" value={summary.categorical_columns} color="bg-amber-400" pct={(summary.categorical_columns / typeTotal) * 100} />
            <TypeRow label="Date / time" value={summary.datetime_columns} color="bg-violet-400" pct={(summary.datetime_columns / typeTotal) * 100} />
            <TypeRow label="Text / free-form" value={summary.text_columns} color="bg-slate-400" pct={(summary.text_columns / typeTotal) * 100} />
          </div>
          <div className="mt-5 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <span className="h-full bg-sky-400" style={{ width: `${(summary.numeric_columns / typeTotal) * 100}%` }} />
            <span className="h-full bg-amber-400" style={{ width: `${(summary.categorical_columns / typeTotal) * 100}%` }} />
            <span className="h-full bg-violet-400" style={{ width: `${(summary.datetime_columns / typeTotal) * 100}%` }} />
            <span className="h-full bg-slate-400" style={{ width: `${(summary.text_columns / typeTotal) * 100}%` }} />
          </div>
        </Card>

        <Card title="Completeness" subtitle="Missing data by volume" className="lg:col-span-2">
          <div className="flex items-end gap-6">
            <div className="text-center">
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 shadow-glow-violet">
                <span className="font-display text-xl font-bold text-white">{summary.missing_pct}%</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">missing cells</p>
            </div>
            <div className="flex-1 pb-1">
              <p className="text-sm leading-relaxed text-slate-400">
                <strong className="text-white">{formatNumber(summary.total_cells)}</strong> total cells across{" "}
                <strong className="text-white">{summary.row_count.toLocaleString()}</strong> rows.
              </p>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Completeness</span>
                  <span className="font-mono text-emerald-300">{formatNumber(100 - summary.missing_pct)}%</span>
                </div>
                <ProgressBar value={100 - summary.missing_pct} color="bg-gradient-to-r from-emerald-500 to-cyan-400" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
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
        <div className="divide-y divide-white/[0.05]">
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

function TypeRow({ label, value, color, pct }: { label: string; value: number; color: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-slate-400">
          <span className={`h-2 w-2 rounded-full ${color} shadow-[0_0_8px_currentColor]`} />
          {label}
        </span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <div className={`h-full rounded-full ${color} opacity-80`} style={{ width: `${pct}%` }} />
      </div>
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
    <div className="px-5 py-4 transition-colors hover:bg-white/[0.025]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-white">{col.name}</span>
        <Badge className={TYPE_COLORS[col.inferred_type]}>{TYPE_LABELS[col.inferred_type] ?? col.inferred_type}</Badge>
        {col.semantic && <Badge className="border-white/10 bg-white/[0.04] text-slate-400">{categoryLabel(col.semantic)}</Badge>}
        <span className="ml-auto font-mono text-[11px] text-slate-500">{Math.round(col.confidence * 100)}% confidence</span>
      </div>
      <div className="mt-2.5 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        <span>
          Missing: <strong className="text-slate-300">{col.null_pct}%</strong>
        </span>
        <span>
          Unique: <strong className="text-slate-300">{formatNumber(col.distinct_count)}</strong>
        </span>
        {col.inferred_type === "float" || col.inferred_type === "integer" ? (
          <>
            <span>
              Mean: <strong className="text-slate-300">{formatNumber(numeric.mean)}</strong>
            </span>
            <span>
              Median: <strong className="text-slate-300">{formatNumber(numeric.median)}</strong>
            </span>
            <span>
              Range: <strong className="text-slate-300">{formatNumber(numeric.min)} → {formatNumber(numeric.max)}</strong>
            </span>
            <span>
              Skew: <strong className="text-slate-300">{formatNumber(numeric.skewness)}</strong>
            </span>
            <span>
              Std dev: <strong className="text-slate-300">{formatNumber(numeric.std)}</strong>
            </span>
            <span>
              P05 / P95: <strong className="text-slate-300">{formatNumber(numeric.p05)} / {formatNumber(numeric.p95)}</strong>
            </span>
          </>
        ) : col.inferred_type === "datetime" ? (
          <span className="sm:col-span-2">
            Range: <strong className="text-slate-300">{formatDateRange(dt.min, dt.max)}</strong>
          </span>
        ) : (
          <span className="sm:col-span-2 truncate">
            Top:{" "}
            <strong className="text-slate-300">
              {col.top_k.slice(0, 3).map((t) => t.value).join(", ") || "—"}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
