"use client";

import { ChartFields, chartTitle, initialChart, numericColumn, WorksheetChart } from "../components/charts/WorksheetChart";
import { motion } from "framer-motion";
import {
  BarChart3,
  Copy,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getDashboardLayout, getDashboardMetrics, saveDashboardLayout } from "@/api/client";
import { useDataset } from "@/store/DatasetContext";
import type { ColumnProfile, DashboardMetrics, DashboardWidget, WidgetType } from "@/types";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#ec4899", "#84cc16"];

function defaultWidgets(columns: ColumnProfile[]): DashboardWidget[] {
    const base: DashboardWidget[] = [{
      id: "records", type: "kpi", title: "Total records", column: "_rows", aggregation: "count", span: 1,
    }];
    const metric = columns.find(numericColumn);
    if (metric) base.push({ id: "total", type: "kpi", title: "Total " + metric.name,
      column: metric.name, aggregation: "sum", color: "#34d399", span: 1 });
    if (columns.length) {
      const chart = initialChart(columns);
      base.push({ ...chart, id: "breakdown", title: chartTitle(chart) });
    }
    return base;
}

export function CustomDashboard({preset, onDismissPreset}: {preset?: DashboardWidget; onDismissPreset: () => void}) {
  const { snapshot } = useDataset();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(Boolean(preset));
  const [printView, setPrintView] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const closeModal = () => {setAddModalOpen(false); onDismissPreset();};
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCategoryCol, setSelectedCategoryCol] = useState<string>("");
  const [selectedCategoryVal, setSelectedCategoryVal] = useState<string>("");

  const columns = snapshot?.columns ?? [];
  const numericCols = columns.filter(numericColumn);
  const categoricalCols = columns.filter((c) => c.inferred_type === "categorical" || c.inferred_type === "text");

  // Load saved dashboard or initialize default template
  useEffect(() => {
    if (!snapshot) return;
    let mounted = true;
    (async () => {
      try {
        const res = await getDashboardLayout(snapshot.dataset.id);
        if (!mounted) return;
        if (res.layout?.widgets) setWidgets(res.layout.widgets);
        else setWidgets(defaultWidgets(columns));
        setReady(true);
        setLoadError("");
      } catch {
        if (mounted) setLoadError("Could not open the saved dashboard.");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.dataset.id, reload]);

  // Auto-save dashboard to backend SQLite
  const saveLayout = async (nextWidgets: DashboardWidget[]) => {
    if (!snapshot) return;
    setIsSaving(true);
    setSaveError("");
    try {
      await saveDashboardLayout(snapshot.dataset.id, {
        title: `${snapshot.dataset.name} Dashboard`,
        widgets: nextWidgets,
        updated_at: Date.now(),
      });
    } catch {
      setSaveError("Your dashboard changes have not been saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeWidget = (id: string) => {
    const next = widgets.filter((w) => w.id !== id);
    setWidgets(next);
    saveLayout(next);
  };

  const toggleSpan = (id: string) => {
    const next = widgets.map((w) => {
      if (w.id === id) {
        return { ...w, span: (w.span === 2 ? 4 : w.span === 4 ? 1 : 2) as 1 | 2 | 4 };
      }
      return w;
    });
    setWidgets(next);
    saveLayout(next);
  };

  const duplicateWidget = (id: string) => {
    const original = widgets.find((w) => w.id === id);
    if (!original) return;
    const dup: DashboardWidget = { ...original, id: `${original.id}_dup_${Date.now()}`, title: `${original.title} (copy)` };
    const next = [...widgets, dup];
    setWidgets(next);
    saveLayout(next);
  };

  const addWidget = (w: DashboardWidget) => {
    const next = [...widgets, w];
    setWidgets(next);
    saveLayout(next);
    closeModal();
  };

  const datasetId = snapshot?.dataset.id;
  const revision = snapshot?.revision;
  useEffect(() => {
    setMetrics(null);
    setMetricsError(null);
    if (!datasetId || widgets.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      getDashboardMetrics(datasetId, {
        widgets,
        search: searchFilter,
        category_column: selectedCategoryCol,
        category_value: selectedCategoryVal,
      }, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setMetrics(result);
        })
        .catch((error: Error) => {
          if (!controller.signal.aborted) setMetricsError(error.message);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [datasetId, revision, widgets, searchFilter, selectedCategoryCol, selectedCategoryVal]);

  if (!snapshot) return null;

  const kpiWidgets = widgets.filter((w) => w.type === "kpi");
  const chartWidgets = widgets.filter((w) => w.type !== "kpi");

  return (
    <fieldset disabled={isSaving} className={`dashboard-sheet min-w-0 space-y-5 ${printView ? "dashboard-readonly" : ""}`}>
      {loadError && <p role="alert">{loadError} <button className="underline" onClick={() => setReload(n => n + 1)}>Retry</button></p>}
      {saveError && <p role="alert">{saveError} <button className="underline" onClick={() => void saveLayout(widgets)}>Retry save</button></p>}
      {/* Dashboard Topbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">Dashboard Studio</h2>
            {isSaving && (
              <span className="text-[10px] font-medium text-slate-500 animate-pulse">
                Saving…
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {snapshot.dataset.name}{metrics && ` · ${metrics.matched_rows.toLocaleString()} matching rows`}{searchFilter && ` · Search “${searchFilter}”`}{selectedCategoryVal && ` · ${selectedCategoryCol} = ${selectedCategoryVal}`}
          </p>
        </div>

        <div className="dashboard-actions flex flex-wrap items-center gap-2">
          <button
            disabled={!ready} hidden={printView} onClick={() => setAddModalOpen(true)}
            className="btn-gradient px-3.5 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Widget
          </button>
          <button
            disabled={!ready} hidden={printView} onClick={() => { const defaults = defaultWidgets(columns); setWidgets(defaults); void saveLayout(defaults); }}
            className="btn-ghost px-3 py-2 text-xs"
            title="Reset to default template"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            disabled={!metrics || !widgets.length} onClick={() => setPrintView(v => !v)}
            className="btn-ghost px-3 py-2 text-xs"
            title="Print or Export Dashboard to PDF"
          >
            <Printer className="h-3.5 w-3.5" /> {printView ? "Back to editing" : "Print preview"}
          </button>
          {printView && <button className="btn-gradient px-3.5 py-2 text-sm" onClick={() => window.print()}>Print / Save PDF</button>}
        </div>
      </div>

      {/* Live Interactive Filters Bar */}
      <div className="dashboard-tools grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
        {/* Search Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search within live dashboard…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500/50 focus:outline-none"
          />
        </div>

        {/* Category Filter Column */}
        <div>
          <select
            aria-label="Filter by column" value={selectedCategoryCol}
            onChange={(e) => {
              setSelectedCategoryCol(e.target.value);
              setSelectedCategoryVal("");
            }}
            className="w-full rounded-xl border border-white/10 bg-night-900 px-3 py-2 text-xs text-slate-200 focus:border-violet-500/50 focus:outline-none"
          >
            <option value="">Filter by column (All)</option>
            {categoricalCols.map((c) => (
              <option key={c.name} value={c.name}>
                Column: {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Value Dropdown */}
        <div>
          <input className="field" list="dashboard-values" aria-label="Filter value" placeholder="All values" disabled={!selectedCategoryCol}
            value={selectedCategoryVal} onChange={e => setSelectedCategoryVal(e.target.value)} />
          <datalist id="dashboard-values">{columns.find(c => c.name === selectedCategoryCol)?.top_k.map(item =>
            <option key={item.value} value={item.value} />)}</datalist>
        </div>
      </div>

      {metricsError && <p role="alert" className="text-sm text-rose-300">{metricsError}</p>}
      {!metrics && !metricsError && widgets.length > 0 && (
        <p role="status" className="text-sm text-slate-400">Calculating dashboard metrics…</p>
      )}

      {/* KPI Cards Row */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiWidgets.map((w) => (
            <KpiCard
              key={w.id}
              widget={w}
              value={metrics?.kpis[w.id] ?? null}
              matchedRows={metrics?.matched_rows}
              totalRows={snapshot.summary.row_count}
              onRemove={() => removeWidget(w.id)}
              onDuplicate={() => duplicateWidget(w.id)}
            />
          ))}
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {chartWidgets.map((w) => (
          <ChartCard
            key={w.id}
            widget={w}
            chartData={metrics?.charts[w.id] ?? []}
            loading={!metrics && !metricsError}
            onRemove={() => removeWidget(w.id)}
            onToggleSpan={() => toggleSpan(w.id)}
            onDuplicate={() => duplicateWidget(w.id)}
          />
        ))}

        {ready && widgets.length === 0 && (
          <div className="col-span-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
            <LayoutDashboard className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-300">Your dashboard is empty</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Click &quot;Add Widget&quot; to pin KPI metric cards and charts, or reset to the auto-generated template.
            </p>
            <button
              onClick={() => { const defaults = defaultWidgets(columns); setWidgets(defaults); void saveLayout(defaults); }}
              className="mt-4 btn-gradient px-4 py-2 text-xs font-semibold"
            >
              Load Default Template
            </button>
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {ready && addModalOpen && (
        <AddWidgetModal
          columns={columns}
          numericCols={numericCols}
          preset={preset}
          onClose={closeModal}
          onAdd={addWidget}
        />
      )}
    </fieldset>
  );
}

// KPI Card Component
function KpiCard({
  widget,
  value,
  matchedRows,
  totalRows,
  onRemove,
  onDuplicate,
}: {
  widget: DashboardWidget;
  value: number | null;
  matchedRows?: number;
  totalRows: number;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  let formattedValue = "—";
  if (value !== null) {
    formattedValue = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-night-900/80 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-white/20" style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px -4px ${widget.color || '#8b5cf6'}22` }}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{widget.title}</p>
        <div className="widget-tools flex items-center gap-1 opacity-75 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onDuplicate} title="Duplicate widget" className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-violet-400 transition-all">
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={onRemove} title="Remove widget" className="rounded-lg p-1 text-slate-500 hover:bg-white/10 hover:text-rose-400 transition-all">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        {widget.prefix && <span className="text-xl font-bold text-slate-400">{widget.prefix}</span>}
        <span
          className="text-3xl font-extrabold tracking-tight"
          style={{ color: widget.color || "#ffffff" }}
        >
          {formattedValue}
        </span>
        {widget.suffix && <span className="text-xs text-slate-500 ml-1">{widget.suffix}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span className="capitalize">{widget.aggregation} of {widget.column === "_rows" ? "records" : widget.column}</span>
        <span className="text-slate-400">
          {matchedRows !== undefined && (matchedRows < totalRows
            ? `${matchedRows.toLocaleString()} / ${totalRows.toLocaleString()} rows`
            : `${totalRows.toLocaleString()} rows`)}
        </span>
      </div>
    </div>
  );
}

// Chart Card Component
function ChartCard({
  widget,
  chartData,
  loading,
  onRemove,
  onToggleSpan,
  onDuplicate,
}: {
  widget: DashboardWidget;
  chartData: Array<{ name: string; value: number }>;
  loading: boolean;
  onRemove: () => void;
  onToggleSpan: () => void;
  onDuplicate: () => void;
}) {
  const spanClass = widget.span === 4 ? "lg:col-span-4" : widget.span === 1 ? "lg:col-span-1" : "lg:col-span-2";

  return (
    <div className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-night-900/80 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-white/20 ${spanClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-white tracking-tight">{widget.title}</h4>

        </div>
        <div className="widget-tools flex items-center gap-1 opacity-75 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onToggleSpan} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white" title="Toggle width">
            {widget.span === 4 ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onDuplicate} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-violet-400" title="Duplicate widget">
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={onRemove} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-rose-400" title="Delete widget">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading ? <p role="status">Calculating chart…</p> : <WorksheetChart widget={widget} data={chartData} />}
    </div>
  );
}

// Modal to Add Custom Widget
function AddWidgetModal({
  columns,
  numericCols,
  preset,
  onClose,
  onAdd,
}: {
  columns: ColumnProfile[];
  numericCols: ColumnProfile[];
  preset?: DashboardWidget;
  onClose: () => void;
  onAdd: (widget: DashboardWidget) => void;
}) {
  const [type, setType] = useState<WidgetType>(preset ? "chart" : "kpi");
  const [title, setTitle] = useState(preset ? chartTitle(preset) : "");
  const [column, setColumn] = useState("_rows");
  const [aggregation, setAggregation] = useState<"sum" | "avg" | "min" | "max" | "count" | "unique">("count");
  const [chart, setChart] = useState(() => preset || initialChart(columns));
  const [color, setColor] = useState("#8b5cf6");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `w_${Date.now()}`;
    if (type === "kpi") {
      onAdd({
        id,
        type: "kpi",
        title: title.trim() || `${aggregation.toUpperCase()} of ${column}`,
        column,
        aggregation,
        color,
        span: 1,
      });
    } else {
      onAdd({
        ...chart, id, type: "chart", title: title.trim() || chartTitle(chart), span: 2,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        role="dialog" aria-label="Add dashboard widget" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-night-900 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h3 className="text-base font-semibold text-white">Add Dashboard Widget</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Widget Type Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">Widget Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("kpi")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                  type === "kpi"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" /> KPI Metric Card
              </button>
              <button
                type="button"
                onClick={() => setType("chart")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                  type === "chart"
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
                    : "border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> Interactive Chart
              </button>
            </div>
          </div>

          {/* Widget Title */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Widget Title</label>
            <input
              type="text"
              placeholder="e.g. Total Revenue or Orders by Region"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-xs text-white focus:border-violet-500/50 focus:outline-none"
            />
          </div>

          {type === "kpi" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Column</label>
                  <select
                    value={column}
                    onChange={e => { setColumn(e.target.value); setAggregation(numericCols.some(c => c.name === e.target.value) ? "sum" : "count"); }}
                    className="w-full rounded-xl border border-white/10 bg-night-800 p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="_rows">Record Count</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.inferred_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Aggregation</label>
                  <select
                    value={aggregation}
                    onChange={(e: any) => setAggregation(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-night-800 p-2.5 text-xs text-white focus:outline-none"
                  >
                    {columns.some(c => c.name === column && numericColumn(c)) && <><option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option></>}
                    <option value="count">Count</option>
                    {column !== "_rows" && <option value="unique">Unique Count</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Accent Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-white" : "opacity-80"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <ChartFields columns={columns} widget={chart} onChange={setChart} />
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-gradient px-4 py-2 text-xs font-semibold">
              Add to Dashboard
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
