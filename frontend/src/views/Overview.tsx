import { useState } from "react";
import { useDataset } from "../store/DatasetContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PaginatedDataTable } from "../components/ui/PaginatedDataTable";
import { Badge } from "../components/ui/Badge";
import { ExecutiveSummaryPanel } from "../components/ExecutiveSummaryPanel";
import { TYPE_COLORS, TYPE_LABELS, categoryLabel, formatDateRange, formatNumber } from "../lib/format";
import type { ColumnProfile } from "../types";

export function OverviewPage({ onClean }: { onClean: () => void }) {
  const { snapshot } = useDataset();
  const [summaryOpen, setSummaryOpen] = useState(false);
  if (!snapshot) return null;
  const { dataset, columns, summary } = snapshot;
  const disclosure = "cursor-pointer px-5 py-4 font-display text-base font-semibold text-slate-200";

  return (
    <div className="space-y-4">
      <Card title="Data preview" subtitle={`${formatNumber(summary.missing_cells)} missing cell${summary.missing_cells === 1 ? "" : "s"} · ${formatNumber(summary.duplicate_count)} exact duplicate row${summary.duplicate_count === 1 ? "" : "s"}`}
        action={<Button onClick={onClean} className="shrink-0">Clean data</Button>} bodyClassName="p-4">
        <PaginatedDataTable sessionId={dataset.id} columns={columns.map((col) => col.name)} />
      </Card>
      <details className="panel" onToggle={(event) => setSummaryOpen(event.currentTarget.open)}>
        <summary className={disclosure}>Summary and relationships</summary>
        {summaryOpen && <div className="p-3 pt-0"><ExecutiveSummaryPanel /></div>}
      </details>
      <details className="panel">
        <summary className={disclosure}>Column profiles ({columns.length})</summary>
        <div className="divide-y divide-white/[0.05]">{columns.map(col => <ColumnRow key={col.name} col={col} />)}</div>
      </details>
    </div>
  );
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
        <span className="ml-auto text-xs text-slate-400">{Math.round(col.confidence * 100)}% confidence</span>
      </div>
      <div className="mt-2.5 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
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
