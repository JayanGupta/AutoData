import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eraser, RotateCcw, Trash2 } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { useToast } from "../store/ToastContext";
import { Card } from "../components/ui/Card";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EmptyState } from "../components/ui/EmptyState";
import { Button, Spinner } from "../components/ui/Button";
import { categoryLabel } from "../lib/format";
import type { QualityIssue } from "../types";

type Filter = "all" | "high" | "medium" | "low";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-200 bg-red-50/60",
  medium: "border-amber-200 bg-amber-50/60",
  low: "border-emerald-200 bg-emerald-50/60",
};

export function DataQualityPage() {
  const { snapshot, applyClean, undoClean } = useDataset();
  const { success: toastSuccess, error: toastError } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const quality = snapshot?.quality;
  const issues = useMemo(() => {
    if (!quality) return [];
    return filter === "all" ? quality.issues : quality.issues.filter((i) => i.severity === filter);
  }, [quality, filter]);

  if (!quality) return null;
  const s = quality.summary;
  const dataSummary = snapshot?.summary;
  const scoreColor = s.quality_score >= 80 ? "bg-emerald-500" : s.quality_score >= 60 ? "bg-amber-500" : "bg-red-500";

  const runClean = async (key: string, action: string, params?: { column?: string }) => {
    setBusy(key);
    try {
      const next = await applyClean(action, params);
      setCanUndo((next?.cleaning?.history_length ?? 0) > 0);
      toastSuccess(next?.cleaning?.description ?? "Cleaning step applied.");
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
      setCanUndo((next?.cleaning?.history_length ?? 0) > 0);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Undo failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Clean the dataset" subtitle="One-click fixes are applied to your data and can be undone">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null || (dataSummary?.duplicate_count ?? 0) === 0}
            onClick={() => void runClean("dups", "drop_duplicates")}
          >
            {busy === "dups" ? <Spinner className="h-4 w-4" /> : <Eraser className="h-4 w-4" />}
            Remove duplicates
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null || (dataSummary?.missing_cells ?? 0) === 0}
            onClick={() => void runClean("missing", "drop_missing_rows")}
          >
            {busy === "missing" ? <Spinner className="h-4 w-4" /> : <Eraser className="h-4 w-4" />}
            Drop rows with missing values
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs ${canUndo ? "text-slate-500" : "text-slate-300"}`}>
              {canUndo ? "A step can be undone" : "Nothing to undo yet"}
            </span>
            <Button size="sm" variant="secondary" disabled={busy !== null || !canUndo} onClick={() => void runUndo()}>
              {busy === "undo" ? <Spinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              Undo
            </Button>
          </div>
        </div>
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
                onDropColumn={() => void runClean(`drop-${issue.column}`, "drop_column", { column: issue.column })}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
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
  onDropColumn,
}: {
  issue: QualityIssue;
  busy: boolean;
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
          <button
            onClick={onDropColumn}
            disabled={busy}
            aria-label={`Drop column ${issue.column}`}
            title={`Drop column ${issue.column}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Drop column
          </button>
        )}
      </div>
      <h4 className="mt-2 text-sm font-semibold text-slate-900">{issue.title}</h4>
      <p className="mt-1 text-sm text-slate-600">{issue.detail}</p>
    </li>
  );
}
