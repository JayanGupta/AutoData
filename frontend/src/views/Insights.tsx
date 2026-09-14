import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Filter, LineChart as LineChartIcon, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { Button, Spinner } from "../components/ui/Button";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { requestChartFocus } from "../lib/chartFocus";
import { categoryLabel } from "../lib/format";
import { cn } from "./landing/primitives";
import type { Insight } from "../types";

type SeverityFilter = "all" | "high" | "medium" | "low";

export function InsightsPage({ onAsk }: { onAsk: (question: string) => void }) {
  const { snapshot, insights, insightsLoading, generateInsights } = useDataset();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (snapshot && insights.length === 0 && !insightsLoading) {
      void generateInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.dataset.id]);

  const categories = useMemo(() => {
    const cats = new Set(insights.map((i) => i.category));
    return Array.from(cats);
  }, [insights]);

  const filtered = useMemo(() => {
    return insights.filter((i) => {
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      return true;
    });
  }, [insights, severityFilter, categoryFilter]);

  const counts = useMemo(() => ({
    high: insights.filter((i) => i.severity === "high").length,
    medium: insights.filter((i) => i.severity === "medium").length,
    low: insights.filter((i) => i.severity === "low").length,
  }), [insights]);

  if (!snapshot) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-violet-300" /> AI Insights
          </h2>
          <p className="text-sm text-slate-500">
            Patterns detected automatically from the actual data — every insight links to its evidence.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void generateInsights()} loading={insightsLoading}>
          {!insightsLoading && <RefreshCw className="h-4 w-4" />}
          Regenerate
        </Button>
      </div>

      {/* Severity Summary Pills */}
      {insights.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryPill label="All insights" count={insights.length} active={severityFilter === "all"} tone="from-violet-500/20 to-indigo-500/10 border-violet-500/20 text-violet-200" icon={<TrendingUp className="h-4 w-4" />} onClick={() => setSeverityFilter("all")} />
          <SummaryPill label="High priority" count={counts.high} active={severityFilter === "high"} tone="from-rose-500/20 to-rose-500/10 border-rose-500/20 text-rose-200" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => setSeverityFilter("high")} />
          <SummaryPill label="Medium" count={counts.medium} active={severityFilter === "medium"} tone="from-amber-500/20 to-amber-500/10 border-amber-500/20 text-amber-200" icon={<Filter className="h-4 w-4" />} onClick={() => setSeverityFilter("medium")} />
          <SummaryPill label="Low priority" count={counts.low} active={severityFilter === "low"} tone="from-emerald-500/20 to-emerald-500/10 border-emerald-500/20 text-emerald-200" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setSeverityFilter("low")} />
        </div>
      )}

      {/* Category filter chips */}
      {categories.length > 1 && insights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategoryFilter("all")} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-all", categoryFilter === "all" ? "border-violet-500/40 bg-violet-500/15 text-violet-200" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white")}>All categories</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-all", categoryFilter === cat ? "border-violet-500/40 bg-violet-500/15 text-violet-200" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white")}>
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      {insightsLoading && insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16 text-slate-500">
          <Spinner className="mb-3 h-8 w-8 text-violet-400" />
          <p className="text-sm">Scanning the dataset for meaningful patterns…</p>
        </div>
      ) : insights.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-10 w-10" />} title="No insights generated yet" description="Click regenerate to have the AI analyst scan your dataset for patterns, trends and anomalies." actionLabel="Generate insights" onAction={() => void generateInsights()} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-12 text-slate-500">
          <Filter className="mb-2 h-6 w-6" />
          <p className="text-sm">No insights match this filter.</p>
          <button onClick={() => { setSeverityFilter("all"); setCategoryFilter("all"); }} className="mt-2 text-xs text-violet-400 hover:text-violet-300">Clear filters</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-600">
            Showing {filtered.length} of {insights.length} insight{insights.length !== 1 ? "s" : ""}
            {(severityFilter !== "all" || categoryFilter !== "all") && (
              <button onClick={() => { setSeverityFilter("all"); setCategoryFilter("all"); }} className="ml-2 text-violet-400 hover:text-violet-300">· Clear filters</button>
            )}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onAsk={onAsk} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryPill({ label, count, active, tone, icon, onClick }: { label: string; count: number; active: boolean; tone: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-3.5 text-left transition-all duration-200", tone, active ? "ring-1 ring-white/20 shadow-lg scale-[1.02]" : "opacity-70 hover:opacity-100")}>
      <span className="opacity-70">{icon}</span>
      <div>
        <p className="font-display text-xl font-bold leading-none">{count}</p>
        <p className="mt-0.5 text-[11px] opacity-70">{label}</p>
      </div>
    </button>
  );
}

function InsightCard({ insight, onAsk }: { insight: Insight; onAsk: (q: string) => void }) {
  return (
    <article className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.05] hover:shadow-card-3d">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={insight.severity} />
        <Badge className="border-white/10 bg-white/[0.05] text-slate-300">{categoryLabel(insight.category)}</Badge>
      </div>
      <h3 className="mt-3 font-display text-sm font-semibold text-white">{insight.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{insight.detail}</p>

      {insight.numbers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {insight.numbers.map((n, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-xs">
              <span className="text-slate-500">{n.label}:</span>
              <strong className="text-cyan-200">{n.value}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
        {insight.evidence.chart_id && (
          <button onClick={() => requestChartFocus(insight.evidence.chart_id!)} className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 transition-colors hover:text-violet-200">
            <LineChartIcon className="h-3.5 w-3.5" /> View chart evidence
          </button>
        )}
        {insight.query_hint && (
          <button onClick={() => onAsk(insight.query_hint!)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-white">
            Ask about this <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

