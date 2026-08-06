import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eraser,
  History,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { useToast } from "../store/ToastContext";
import { Card } from "../components/ui/Card";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EmptyState } from "../components/ui/EmptyState";
import { Button, Spinner } from "../components/ui/Button";
import { categoryLabel } from "../lib/format";
import type { ColumnProfile, QualityIssue } from "../types";

type Filter = "all" | "high" | "medium" | "low";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50/60",
  medium: "border-amber-200 bg-amber-50/60",
  low: "border-emerald-200 bg-emerald-50/60",
};

interface ColumnOp {
  value: string;
  label: string;
  needsValue: boolean;
  extraValue?: string;
}

const NUMERIC_OPS: ColumnOp[] = [
  { value: "fill_missing_numeric", label: "Fill missing with mean", needsValue: false, extraValue: "mean" },
  { value: "fill_missing_numeric", label: "Fill missing with median", needsValue: false, extraValue: "median" },
  { value: "convert_numeric", label: "Convert to numbers", needsValue: false },
];

const GENERIC_OPS: ColumnOp[] = [
  { value: "fill_missing", label: "Fill missing with value…", needsValue: true },
  { value: "drop_missing_in_column", label: "Drop rows missing this column", needsValue: false },
  { value: "trim_whitespace", label: "Trim whitespace", needsValue: false },
  { value: "lowercase_column", label: "Lowercase values", needsValue: false },
  { value: "standardize_dates", label: "Parse as dates", needsValue: false },
  { value: "rename_column", label: "Rename column to…", needsValue: true },
  { value: "drop_column", label: "Drop column", needsValue: false },
];

const QUICK_FIXES = [
  { key: "dups", action: "drop_duplicates", label: "Remove duplicates" },
  { key: "missing", action: "drop_missing_rows", label: "Drop rows with missing values" },
];

export function DataQualityPage() {
  const { snapshot, applyClean, undoClean, cleaningSteps } = useDataset();
  const { success: toastSuccess, error: toastError } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [column, setColumn] = useState<string>("");
  const [op, setOp] = useState<string>("");
  const [value, setValue] = useState<string>("");

  const quality = snapshot?.quality;
  const columns = snapshot?.columns ?? [];

  useEffect(() => {
    if (!column && columns.length > 0) setColumn(columns[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, snapshot?.dataset.id]);

  const selectedColumn: ColumnProfile | undefined = columns.find((c) => c.name === column);
  const numericOps = selectedColumn && (selectedColumn.inferred_type === "integer" || selectedColumn.inferred_type === "float");
  const availableOps = numericOps ? [...NUMERIC_OPS, ...GENERIC_OPS] : GENERIC_OPS;

  const issues = useMemo(() => {
    if (!quality) return [];
    return filter === "all" ? quality.issues : quality.issues.filter((i) => i.severity === filter);
  }, [quality, filter]);

  if (!quality) return null;
  const s = quality.summary;
  const dataSummary = snapshot?.summary;
  const scoreColor = s.quality_score >= 80 ? "bg-emerald-500" : s.quality_score >= 60 ? "bg-amber-500" : "bg-red-500";

  const runQuick = async (key: string, action: string) => {
    setBusy(key);
    try {
      const next = await applyClean(action);
      toastSuccess(next?.cleaning?.description ?? "Cleaning step applied.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Cleaning step failed.");
    } finally {
      setBusy(null);
    }
  };

  const runColumnOp = async () => {
    if (!op || !column) return;
    setBusy("col");
    const params: { column?: string; value?: string | number } = { column };
    const selected = availableOps.find((o) => o.value === op);
    const fillMethod = selected?.extraValue ?? value;
    if (selected?.needsValue && !fillMethod) {
      toastError("Please provide a value for this operation.");
      setBusy(null);
      return;
    }
    if (selected?.needsValue) {
      if (op === "rename_column") {
        params.value = String(fillMethod).trim();
      } else {
        const num = Number(fillMethod);
        params.value = Number.isNaN(num) ? String(fillMethod) : num;
      }
    }
    try {
      const next = await applyClean(op, params);
      toastSuccess(next?.cleaning?.description ?? "Cleaning step applied.");
      setValue("");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Cleaning step failed.");
    } finally {
      setBusy(null);
    }
  };

  const runUndo = async () => {
    setBusy("undo");
    try {
      const next = await undoClean();
      if (next?.cleaning?.undone) toastSuccess("Cleaning step undone.");
      else toastSuccess("Nothing to undo.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Undo failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Cleaning studio" subtitle="One-click fixes and guided column operations — every step is tracked and reversible">
        <div className="flex flex-wrap items-center gap-3">
          {QUICK_FIXES.map((fix) => (
            <Button
              key={fix.key}
              size="sm"
              variant="outline"
              disabled={busy !== null || (fix.key === "dups" ? (dataSummary?.duplicate_count ?? 0) === 0 : (dataSummary?.missing_cells ?? 0) === 0)}
              onClick={() => void runQuick(fix.key, fix.action)}
            >
              {busy === fix.key ? <Spinner className="h-4 w-4" /> : <Eraser className="h-4 w-4" />}
              {fix.label}
            </Button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Wand2 className="h-3.5 w-3.5" /> Guided column operation
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr_0.8fr_auto]">
            <select
              value={column}
              onChange={(e) => {
                setColumn(e.target.value);
                setOp("");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.inferred_type})
                </option>
              ))}
            </select>
            <select
              value={op}
              onChange={(e) => setOp(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">Choose an operation…</option>
              {availableOps.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsValue(availableOps, op) && (
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={op === "rename_column" ? "new column name" : "fill value (e.g. 0)"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            )}
            <Button size="sm" disabled={busy !== null || !op || !column} onClick={() => void runColumnOp()}>
              {busy === "col" ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
              Apply
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <History className="h-4 w-4" />
            <span>{cleaningSteps.length === 0 ? "No cleaning steps applied yet" : `${cleaningSteps.length} step${cleaningSteps.length > 1 ? "s" : ""} applied`}</span>
          </div>
          <Button size="sm" variant="secondary" disabled={busy !== null || cleaningSteps.length === 0} onClick={() => void runUndo()}>
            {busy === "undo" ? <Spinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            Undo last step
          </Button>
        </div>

        {cleaningSteps.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {cleaningSteps.map((step) => (
              <li key={step.step} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {step.step + 1}
                </span>
                {step.description}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Data quality score" className="md:col-span-1">
          <div className="flex flex-col items-center py-2">
            <div
              className={`flex h-28 w-28 items-center justify-center rounded-full border-8 text-3xl font-extrabold text-white shadow-sm ${scoreColor}`}
              style={{ borderColor: `${scoreColor}` }}
            >
              {s.quality_score}
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">out of 100</p>
          </div>
        </Card>

        <Card title="Issue summary" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryPill label="Total issues" value={s.total_issues} tone="text-slate-900" />
            <SummaryPill label="High" value={s.high} tone="text-red-600" />
            <SummaryPill label="Medium" value={s.medium} tone="text-amber-600" />
            <SummaryPill label="Low" value={s.low} tone="text-emerald-600" />
          </div>
          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>Breakdown by category</span>
              <span>{Object.values(s.categories).reduce((a, b) => a + b, 0)} flagged</span>
            </div>
            <div className="space-y-2">
              {Object.entries(s.categories).map(([key, count]) =>
                count === 0 ? null : (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-slate-600">{categoryLabel(key)}</span>
                    <ProgressBar value={count} max={Math.max(...Object.values(s.categories), 1)} className="flex-1" />
                    <span className="w-6 text-right text-xs font-semibold text-slate-700">{count}</span>
                  </div>
                ),
              )}
              {Object.values(s.categories).every((c) => c === 0) && (
                <p className="text-xs text-slate-400">No structural issues detected.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Issues"
        subtitle={`${issues.length} of ${s.total_issues} issues shown`}
        action={
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["all", "high", "medium", "low"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      >
        {issues.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
            title={filter === "all" ? "No quality issues found" : `No ${filter} severity issues`}
            description="This dataset looks clean. Run the AI analyst to surface patterns and trends."
          />
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                busy={busy !== null}
                onSelectColumn={() => {
                  if (issue.column && columns.some((c) => c.name === issue.column)) {
                    setColumn(issue.column);
                  }
                }}
                onDropColumn={() => void runQuick(`drop-${issue.column}`, "drop_column")}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function needsValue(ops: ColumnOp[], op: string): boolean {
  if (!op) return false;
  return ops.some((o) => o.value === op && o.needsValue);
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function IssueRow({
  issue,
  busy,
  onSelectColumn,
  onDropColumn,
}: {
  issue: QualityIssue;
  busy: boolean;
  onSelectColumn: () => void;
  onDropColumn: () => void;
}) {
  return (
    <li className={`rounded-lg border p-4 ${SEVERITY_STYLES[issue.severity]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <Badge className="bg-white text-slate-600 border-slate-200">{categoryLabel(issue.category)}</Badge>
        {issue.column && <Badge className="bg-slate-800 text-white border-slate-800">{issue.column}</Badge>}
        <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5" /> {issue.count.toLocaleString()} affected
        </span>
        {issue.column && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onSelectColumn}
              disabled={busy}
              aria-label={`Open cleaning tools for ${issue.column}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" /> Fix column
            </button>
            <button
              onClick={onDropColumn}
              disabled={busy}
              aria-label={`Drop column ${issue.column}`}
              title={`Drop column ${issue.column}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> Drop column
            </button>
          </div>
        )}
      </div>
      <h4 className="mt-2 text-sm font-semibold text-slate-900">{issue.title}</h4>
      <p className="mt-1 text-sm text-slate-600">{issue.detail}</p>
    </li>
  );
}
