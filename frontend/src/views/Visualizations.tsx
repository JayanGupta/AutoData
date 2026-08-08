"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Lightbulb, Sparkles } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { getAdvancedCharts } from "../api/client";
import { ChartCard } from "../components/charts/ChartCard";
import { ChartModal } from "../components/charts/ChartModal";
import { AdvancedChartCard } from "../components/charts/AdvancedChartCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Button";
import { onChartFocus } from "../lib/chartFocus";
import { cn } from "./landing/primitives";
import type { AdvancedChartType, AdvancedChartsPayload, ChartSpec } from "../types";

const TYPES = ["all", "bar", "line", "histogram", "scatter", "pie", "heatmap"];

const ADVANCED_TYPE_LABEL: Record<string, string> = {
  box: "Box",
  distribution: "Distribution",
  area: "Area",
  stacked_bar: "Stacked",
  multi_line: "Multi-line",
  radar: "Radar",
  bubble: "Bubble",
  treemap: "Treemap",
  sunburst: "Sunburst",
  pair_plot: "Pair plot",
  correlation: "Correlation",
};

const ADVANCED_TYPES = Object.keys(ADVANCED_TYPE_LABEL);

export function VisualizationsPage() {
  const { charts, snapshot } = useDataset();
  const [filter, setFilter] = useState<string>("all");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [modalChart, setModalChart] = useState<ChartSpec | null>(null);
  const [advanced, setAdvanced] = useState<AdvancedChartsPayload | null>(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advFilter, setAdvFilter] = useState<string>("all");
  const focusRef = useRef<HTMLDivElement>(null);

  const sessionId = snapshot?.dataset.id ?? null;

  useEffect(() => {
    const off = onChartFocus((id) => {
      setFilter("all");
      setFocusedId(id);
      setTimeout(() => {
        document.getElementById(`chart-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    });
    return off;
  }, []);

  useEffect(() => {
    let active = true;
    if (!sessionId) return;
    setAdvancedLoading(true);
    setAdvanced(null);
    getAdvancedCharts(sessionId)
      .then((payload) => active && setAdvanced(payload))
      .catch(() => active && setAdvanced(null))
      .finally(() => active && setAdvancedLoading(false));
    return () => {
      active = false;
    };
  }, [sessionId]);

  const visible = useMemo(() => {
    const sorted = [...charts];
    if (focusedId) {
      const target = sorted.find((c) => c.id === focusedId);
      if (target) {
        return [target, ...sorted.filter((c) => c.id !== focusedId)];
      }
    }
    return sorted;
  }, [charts, focusedId]);

  const filtered = filter === "all" ? visible : visible.filter((c) => c.chart_type === filter);

  const advancedCharts = advanced?.charts ?? [];
  const advancedRecs = useMemo(
    () => (advanced?.recommendations ?? []).filter((r) => advancedCharts.some((c) => c.chart_type === r.chart_type)),
    [advanced, advancedCharts],
  );
  const advancedVisible =
    advFilter === "all"
      ? advancedCharts
      : advFilter === "recommended"
        ? advancedCharts.filter((c) => advancedRecs.some((r) => r.chart_type === c.chart_type))
        : advancedCharts.filter((c) => c.chart_type === advFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-violet-300" /> Visualizations
          </h2>
          <p className="text-sm text-slate-500">
            Auto-generated charts based on column types — plus a library of advanced analytical views.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all",
                filter === t ? "bg-gradient-to-r from-violet-500/30 to-indigo-500/20 text-white" : "text-slate-500 hover:text-slate-200",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-10 w-10" />}
          title="No charts yet"
          description="Charts are generated automatically after you upload a dataset."
        />
      ) : (
        <div ref={focusRef} className="grid gap-5 lg:grid-cols-2">
          {filtered.map((chart: ChartSpec) => (
            <div
              key={chart.id}
              id={`chart-${chart.id}`}
              className={cn(
                "rounded-3xl transition-all duration-300",
                focusedId === chart.id && "ring-2 ring-violet-400/60 ring-offset-4 ring-offset-night-950 shadow-glow-violet",
              )}
            >
              <ChartCard chart={chart} onFocus={(id) => setModalChart(charts.find((c) => c.id === id) ?? null)} />
            </div>
          ))}
        </div>
      )}

      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      <div className="pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Lightbulb className="h-5 w-5 text-cyan-300" /> Advanced analytics
            </h2>
            <p className="text-sm text-slate-500">
              Deeper views computed from your schema — distributions, relationships, composition and more.
            </p>
          </div>
          <div className="flex max-w-full flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
            {advanced && (
              <button
                onClick={() => setAdvFilter("recommended")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition-all",
                  advFilter === "recommended" ? "bg-gradient-to-r from-cyan-500/30 to-emerald-500/20 text-white" : "text-slate-500 hover:text-slate-200",
                )}
              >
                Recommended
              </button>
            )}
            <button
              onClick={() => setAdvFilter("all")}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-all",
                advFilter === "all" ? "bg-gradient-to-r from-violet-500/30 to-indigo-500/20 text-white" : "text-slate-500 hover:text-slate-200",
              )}
            >
              All
            </button>
            {ADVANCED_TYPES.filter((t) => advancedCharts.some((c) => c.chart_type === t)).map((t) => (
              <button
                key={t}
                onClick={() => setAdvFilter(t)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition-all",
                  advFilter === t ? "bg-gradient-to-r from-violet-500/30 to-indigo-500/20 text-white" : "text-slate-500 hover:text-slate-200",
                )}
              >
                {ADVANCED_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {advanced && advancedRecs.length > 0 && advFilter === "recommended" && (
          <div className="mt-5 space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-violet-300" /> Recommended for your data
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {advancedRecs.map((rec) => (
                <div
                  key={`${rec.chart_type}-${rec.title}`}
                  className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-transparent p-4 transition-all duration-300 hover:border-cyan-400/40 hover:from-cyan-500/[0.1]"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 to-emerald-500/10 text-cyan-300 ring-1 ring-white/10">
                      <Lightbulb className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{rec.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{rec.reason}</p>
                      <Badge className="mt-2 border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
                        {ADVANCED_TYPE_LABEL[rec.chart_type] ?? rec.chart_type}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {advancedLoading ? (
          <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-14 text-slate-500">
            <Spinner className="mb-3 h-7 w-7 text-violet-400" />
            <p className="text-sm">Computing advanced charts…</p>
          </div>
        ) : advancedVisible.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<Lightbulb className="h-10 w-10" />}
              title="Nothing here yet"
              description="This dataset may not have enough numeric or categorical columns for these views."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {advancedVisible.map((chart) => (
              <AdvancedChartCard key={`${chart.chart_type}-${chart.title}-${advancedVisible.indexOf(chart)}`} chart={chart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { AdvancedChartType };
