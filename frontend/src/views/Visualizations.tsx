import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { ChartCard } from "../components/charts/ChartCard";
import { ChartModal } from "../components/charts/ChartModal";
import { EmptyState } from "../components/ui/EmptyState";
import { onChartFocus } from "../lib/chartFocus";
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
          <h2 className="text-lg font-bold text-slate-900">Visualizations</h2>
          <p className="text-sm text-slate-500">Auto-generated charts based on column types — click any chart to focus it.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
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
            <div key={chart.id} id={`chart-${chart.id}`} className={focusedId === chart.id ? "ring-2 ring-brand-500 ring-offset-2 rounded-xl" : ""}>
              <ChartCard chart={chart} onFocus={(id) => setModalChart(charts.find((c) => c.id === id) ?? null)} />
            </div>
          ))}
        </div>
      )}

      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}
    </div>
  );
}
