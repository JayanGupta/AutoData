import type { ChartSpec } from "../../types";
import { Card } from "../ui/Card";
import { ChartRenderer } from "./ChartRenderer";

interface ChartCardProps {
  chart: ChartSpec;
  height?: number;
  onFocus?: (id: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  bar: "Bar",
  line: "Line",
  histogram: "Histogram",
  scatter: "Scatter",
  heatmap: "Heatmap",
  pie: "Pie",
};

export function ChartCard({ chart, height = 280, onFocus }: ChartCardProps) {
  return (
    <Card
      className="group/chart transition-all duration-300 hover:border-white/[0.16] hover:bg-white/[0.045]"
      title={chart.title}
      subtitle={
        chart.chart_type === "heatmap"
          ? undefined
          : `${TYPE_ICON[chart.chart_type] ?? chart.chart_type} chart · ${chart.x} / ${chart.y}`
      }
      action={
        onFocus ? (
          <button
            onClick={() => onFocus(chart.id)}
            aria-label={`Focus ${chart.title}`}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all hover:border-violet-400/40 hover:text-white hover:shadow-[0_0_16px_rgba(139,92,246,0.25)]"
          >
            Focus
          </button>
        ) : undefined
      }
      bodyClassName="pt-2"
    >
      <ChartRenderer chart={chart} height={height} />
    </Card>
  );
}
