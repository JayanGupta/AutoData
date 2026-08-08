"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AdvancedChartSpec } from "../../types";
import { Card } from "../ui/Card";
import { AdvancedChartRenderer } from "./AdvancedChartRenderer";

interface AdvancedChartCardProps {
  chart: AdvancedChartSpec;
  height?: number;
}

const TYPE_LABEL: Record<string, string> = {
  box: "Box plot",
  distribution: "Distribution",
  area: "Area",
  stacked_bar: "Stacked bar",
  multi_line: "Multi-line",
  radar: "Radar",
  bubble: "Bubble",
  treemap: "Treemap",
  sunburst: "Sunburst",
  pair_plot: "Pair plot",
  correlation: "Correlation",
};

export function AdvancedChartCard({ chart, height = 300 }: AdvancedChartCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card
      className="group/chart transition-all duration-300 hover:border-white/[0.16] hover:bg-white/[0.045]"
      title={chart.title}
      subtitle={chart.description ? `${TYPE_LABEL[chart.chart_type] ?? chart.chart_type} chart · ${chart.description}` : undefined}
      action={
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-all hover:border-violet-400/40 hover:text-white"
        >
          Expand
        </button>
      }
      bodyClassName="pt-2"
    >
      <AdvancedChartRenderer chart={chart} height={height} />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={chart.title}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-night-800 shadow-2xl backdrop-blur-xl animate-modal-in">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold text-white">{chart.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{chart.description}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chart view" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto p-6">
              <AdvancedChartRenderer chart={chart} height={520} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
