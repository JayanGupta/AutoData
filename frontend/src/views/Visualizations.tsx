import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Sparkles } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { ChartCard } from "../components/charts/ChartCard";
import { ChartModal } from "../components/charts/ChartModal";
import { EmptyState } from "../components/ui/EmptyState";
import { onChartFocus } from "../lib/chartFocus";
import { cn } from "./landing/primitives";
import type { ChartSpec } from "../types";

const TYPES = ["all", "bar", "line", "histogram", "scatter", "pie", "heatmap"];

export function VisualizationsPage() {
  const { charts } = useDataset();
  const [filter, setFilter] = useState<string>("all");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [modalChart, setModalChart] = useState<ChartSpec | null>(null);
  const focusRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-violet-300" /> Visualizations
          </h2>
          <p className="text-sm text-slate-500">Auto-generated charts based on column types — click any chart to focus it.</p>
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
    </div>
  );
}
