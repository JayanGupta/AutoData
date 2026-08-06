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
  const { snapshot, insights, insightsLoading, refreshInsights } = useDataset();

  useEffect(() => {
    if (snapshot && insights.length === 0 && !insightsLoading) {
      void refreshInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.dataset.id]);

  if (!snapshot) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-brand-600" /> AI Insights
          </h2>
          <p className="text-sm text-slate-500">
            Patterns detected automatically from the actual data — every insight links to its evidence.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshInsights()} loading={insightsLoading}>
          {!insightsLoading && <RefreshCw className="h-4 w-4" />}
          Regenerate
        </Button>
      </div>

      {insightsLoading && insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
          <Spinner className="mb-3 h-8 w-8 text-brand-600" />
          <p className="text-sm">Scanning the dataset for meaningful patterns…</p>
        </div>
      ) : insights.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" />}
          title="No insights generated yet"
          description="Click regenerate to have the AI analyst scan your dataset for patterns, trends and anomalies."
          actionLabel="Generate insights"
          onAction={() => void refreshInsights()}
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
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={insight.severity} />
        <Badge className="bg-slate-100 text-slate-600 border-slate-200">{categoryLabel(insight.category)}</Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{insight.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{insight.detail}</p>

      {insight.numbers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {insight.numbers.map((n, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
            >
              <span className="text-slate-500">{n.label}:</span>
              <strong className="text-slate-900">{n.value}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        {insight.evidence.chart_id && (
          <button
            onClick={() => requestChartFocus(insight.evidence.chart_id!)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <LineChartIcon className="h-3.5 w-3.5" /> View chart evidence
          </button>
        )}
        {insight.query_hint && (
          <button
            onClick={() => onAsk(insight.query_hint!)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-700"
          >
            Ask about this <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
