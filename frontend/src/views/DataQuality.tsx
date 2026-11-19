import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { CleaningStudio } from "../components/CleaningStudio";
import { Card } from "../components/ui/Card";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EmptyState } from "../components/ui/EmptyState";
import { categoryLabel } from "../lib/format";
import { cn } from "./landing/primitives";
import type { QualityIssue } from "../types";

type Filter = "all" | "high" | "medium" | "low";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-rose-500/25 bg-rose-500/[0.06]",
  medium: "border-amber-500/25 bg-amber-500/[0.05]",
  low: "border-emerald-500/25 bg-emerald-500/[0.05]",
};

export function DataQualityPage() {
  const { snapshot } = useDataset();
  const [filter, setFilter] = useState<Filter>("all");
  const quality = snapshot?.quality;
  const issues = useMemo(() => {
    if (!quality) return [];
    return filter === "all" ? quality.issues : quality.issues.filter((i) => i.severity === filter);
  }, [quality, filter]);

  if (!quality) return null;
  const s = quality.summary;
  const scoreColor = s.quality_score >= 80 ? "#34d399" : s.quality_score >= 60 ? "#fbbf24" : "#fb7185";

  return (
    <div className="space-y-6">
      {snapshot && <CleaningStudio key={snapshot.revision} snapshot={snapshot} />}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Data quality score" className="md:col-span-1">
          <div className="flex flex-col items-center py-2">
            <div className="relative">
              <div
                className="flex h-28 w-28 items-center justify-center rounded-full font-display text-3xl font-extrabold text-white"
                style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18), transparent 60%), ${scoreColor}22`, border: `3px solid ${scoreColor}`, boxShadow: `0 0 40px -6px ${scoreColor}88` }}
              >
                {s.quality_score}
              </div>
              <span
                className="absolute inset-0 -z-10 rounded-full animate-ping-soft"
                style={{ background: `${scoreColor}22` }}
              />
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">out of 100</p>
            <p className="mt-3 max-w-xs text-sm text-slate-400">Each high finding deducts 25 points, medium 10 and low 3. Findings include outliers and distribution patterns.</p>
          </div>
        </Card>

        <Card title="Issue summary" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryPill label="Total issues" value={s.total_issues} tone="text-slate-100" />
            <SummaryPill label="High" value={s.high} tone="text-rose-300" />
            <SummaryPill label="Medium" value={s.medium} tone="text-amber-300" />
            <SummaryPill label="Low" value={s.low} tone="text-emerald-300" />
          </div>
          <div className="mt-6">
            <div className="mb-1.5 flex items-center justify-between text-sm text-slate-400">
              <span>Breakdown by category</span>
              <span>{Object.values(s.categories).reduce((a, b) => a + b, 0)} flagged</span>
            </div>
            <div className="space-y-2.5">
              {Object.entries(s.categories).map(([key, count]) =>
                count === 0 ? null : (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-slate-400">{categoryLabel(key)}</span>
                    <ProgressBar
                      value={count}
                      max={Math.max(...Object.values(s.categories), 1)}
                      className="flex-1"
                      color="bg-gradient-to-r from-violet-500 to-cyan-400"
                    />
                    <span className="w-6 text-right font-mono text-xs font-semibold text-slate-200">{count}</span>
                  </div>
                ),
              )}
              {Object.values(s.categories).every((c) => c === 0) && (
                <p className="text-sm text-slate-400">No structural issues detected.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Issues"
        subtitle={`${issues.length} of ${s.total_issues} issues shown`}
        action={
          <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
            {(["all", "high", "medium", "low"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all",
                  filter === f ? "bg-gradient-to-r from-violet-500/30 to-indigo-500/20 text-white" : "text-slate-500 hover:text-slate-200",
                )}
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
            description="You can review the other severity levels or return to the data preview."
          />
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
      <p className={cn("font-display text-2xl font-bold", tone)}>{value}</p>
      <p className="mt-0.5 text-sm text-slate-400">{label}</p>
    </div>
  );
}

function IssueRow({ issue }: { issue: QualityIssue }) {
  return (
    <li className={cn("rounded-xl border p-4 backdrop-blur-sm", SEVERITY_STYLES[issue.severity])}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={issue.severity} />
        <Badge className="border-white/10 bg-white/[0.05] text-slate-300">{categoryLabel(issue.category)}</Badge>
        {issue.column && <Badge className="border-violet-500/30 bg-violet-500/15 font-mono text-violet-200">{issue.column}</Badge>}
        <span className="ml-auto flex items-center gap-1 text-sm text-slate-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {issue.count.toLocaleString()} affected
        </span>
      </div>
      <h4 className="mt-2.5 text-sm font-semibold text-white">{issue.title}</h4>
      <p className="mt-1 text-sm text-slate-400">{issue.detail}</p>
    </li>
  );
}
