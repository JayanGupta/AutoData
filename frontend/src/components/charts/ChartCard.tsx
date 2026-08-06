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
      className="hover:shadow-md transition-shadow"
      title={chart.title}
      subtitle={chart.chart_type === "heatmap" ? undefined : `${TYPE_ICON[chart.chart_type] ?? chart.chart_type} chart · ${chart.x} / ${chart.y}`}
      action={
        onFocus ? (
          <button
            onClick={() => onFocus(chart.id)}
            aria-label={`Focus ${chart.title}`}
            className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
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
