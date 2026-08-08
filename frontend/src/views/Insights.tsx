import { useEffect } from "react";
import { ArrowRight, LineChart as LineChartIcon, RefreshCw, Sparkles } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { Button, Spinner } from "../components/ui/Button";
import { Badge, SeverityBadge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { requestChartFocus } from "../lib/chartFocus";
import { categoryLabel } from "../lib/format";
import type { Insight } from "../types";

export function InsightsPage({ onAsk }: { onAsk: (question: string) => void }) {
  const { snapshot, insights, insightsLoading, generateInsights } = useDataset();

  useEffect(() => {
    if (snapshot && insights.length === 0 && !insightsLoading) {
      void generateInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.dataset.id]);

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

      {insightsLoading && insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-16 text-slate-500">
          <Spinner className="mb-3 h-8 w-8 text-violet-400" />
          <p className="text-sm">Scanning the dataset for meaningful patterns…</p>
        </div>
      ) : insights.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title="No insights generated yet"
          description="Click regenerate to have the AI analyst scan your dataset for patterns, trends and anomalies."
          actionLabel="Generate insights"
          onAction={() => void generateInsights()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onAsk={onAsk} />
          ))}
        </div>
      )}
    </div>
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
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-xs"
            >
              <span className="text-slate-500">{n.label}:</span>
              <strong className="text-cyan-200">{n.value}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
        {insight.evidence.chart_id && (
          <button
            onClick={() => requestChartFocus(insight.evidence.chart_id!)}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 transition-colors hover:text-violet-200"
          >
            <LineChartIcon className="h-3.5 w-3.5" /> View chart evidence
          </button>
        )}
        {insight.query_hint && (
          <button
            onClick={() => onAsk(insight.query_hint!)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-white"
          >
            Ask about this <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
