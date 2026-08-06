import { useCallback, useEffect, useRef } from "react";
import { Download, X } from "lucide-react";
import type { ChartSpec } from "../../types";
import { exportSvgToPng } from "../../lib/exportPng";
import { ChartRenderer } from "./ChartRenderer";

interface ChartModalProps {
  chart: ChartSpec;
  onClose: () => void;
}

const TYPE_ICON: Record<string, string> = {
  bar: "Bar",
  line: "Line",
  histogram: "Histogram",
  scatter: "Scatter",
  heatmap: "Heatmap",
  pie: "Pie",
};

export function ChartModal({ chart, onClose }: ChartModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = modalRef.current;
      if (!node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);

  const handleExport = useCallback(() => {
    if (!chartAreaRef.current) return;
    try {
      exportSvgToPng(chartAreaRef.current, `${chart.id || "chart"}.png`);
    } catch {
      /* ignored: nothing rendered to export */
    }
  }, [chart.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={chart.title}
    >
      <div
        ref={modalRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-modal-in"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">{chart.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {TYPE_ICON[chart.chart_type] ?? chart.chart_type} chart · {chart.x} / {chart.y}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Download className="h-3.5 w-3.5" /> Export PNG
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close chart view"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div ref={chartAreaRef} className="overflow-auto p-6">
          <ChartRenderer chart={chart} height={400} />
        </div>
      </div>
    </div>
  );
}
