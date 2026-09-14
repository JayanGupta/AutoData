"use client";

import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDashboardLayout, saveDashboardLayout } from "@/api/client";
import { useDataset } from "@/store/DatasetContext";
import type { DashboardWidget, WidgetType } from "@/types";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#ec4899", "#84cc16"];

export function CustomDashboard() {
  const { snapshot } = useDataset();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCategoryCol, setSelectedCategoryCol] = useState<string>("");
  const [selectedCategoryVal, setSelectedCategoryVal] = useState<string>("");

  const columns = snapshot?.columns ?? [];
  const numericCols = columns.filter((c) => c.inferred_type === "integer" || c.inferred_type === "float");
  const categoricalCols = columns.filter((c) => c.inferred_type === "categorical" || c.inferred_type === "text");

  // Load saved dashboard or initialize default template
  useEffect(() => {
    if (!snapshot) return;
    let mounted = true;
    (async () => {
      try {
        const res = await getDashboardLayout(snapshot.dataset.id);
        if (mounted && res.layout?.widgets && res.layout.widgets.length > 0) {
          setWidgets(res.layout.widgets);
          return;
        }
      } catch {
        /* fallback to defaults */
      }
      if (mounted) {
        initDefaultWidgets();
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.dataset.id]);

  const initDefaultWidgets = useCallback(() => {
    if (!snapshot) return;
    const num1 = numericCols[0]?.name;
    const num2 = numericCols[1]?.name;
    const cat1 = categoricalCols[0]?.name;
    const cat2 = categoricalCols[1]?.name;

    const initial: DashboardWidget[] = [
      {
        id: "w_kpi_total_rows",
        type: "kpi",
        title: "Total Records",
        span: 1,
        column: "_rows",
        aggregation: "count",
        color: "#8b5cf6",
        suffix: " rows",
      },
    ];

    if (num1) {
      initial.push({
        id: `w_kpi_sum_${num1}`,
        type: "kpi",
        title: `Total ${num1}`,
        span: 1,
        column: num1,
        aggregation: "sum",
        color: "#10b981",
        prefix: num1.toLowerCase().includes("rev") || num1.toLowerCase().includes("price") ? "$" : "",
      });
      initial.push({
        id: `w_kpi_avg_${num1}`,
        type: "kpi",
        title: `Average ${num1}`,
        span: 1,
        column: num1,
        aggregation: "avg",
        color: "#06b6d4",
        prefix: num1.toLowerCase().includes("rev") || num1.toLowerCase().includes("price") ? "$" : "",
      });
    }

    if (num2) {
      initial.push({
        id: `w_kpi_max_${num2}`,
        type: "kpi",
        title: `Peak ${num2}`,
        span: 1,
        column: num2,
        aggregation: "max",
        color: "#f59e0b",
      });
    } else if (cat1) {
      initial.push({
        id: `w_kpi_uniq_${cat1}`,
        type: "kpi",
        title: `Unique ${cat1}`,
        span: 1,
        column: cat1,
        aggregation: "unique",
        color: "#f43f5e",
        suffix: " categories",
      });
    }

    // Default charts
    if (cat1 && num1) {
      initial.push({
        id: `w_chart_bar_${cat1}_${num1}`,
        type: "chart",
        title: `${num1} by ${cat1}`,
        chart_type: "bar",
        span: 2,
        x: cat1,
        y: num1,
      });
    }

    if (cat2 && num1) {
      initial.push({
        id: `w_chart_pie_${cat2}`,
        type: "chart",
        title: `Distribution of ${cat2}`,
        chart_type: "pie",
        span: 2,
        x: cat2,
        y: num1,
      });
    } else if (num1 && num2) {
      initial.push({
        id: `w_chart_area_${num1}`,
        type: "chart",
        title: `${num1} Trend & Spread`,
        chart_type: "area",
        span: 2,
        x: cat1 || "index",
        y: num1,
      });
    }

    setWidgets(initial);
  }, [snapshot, numericCols, categoricalCols]);

  // Auto-save dashboard to backend SQLite
  const saveLayout = async (nextWidgets: DashboardWidget[]) => {
    if (!snapshot) return;
    setIsSaving(true);
    try {
      await saveDashboardLayout(snapshot.dataset.id, {
        title: `${snapshot.dataset.name} Dashboard`,
        widgets: nextWidgets,
        updated_at: Date.now(),
      });
    } catch {
      /* ignore save error */
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
    setAddModalOpen(false);
  };

  // Filtered raw preview rows for live calculations
  const previewRows = useMemo(() => {
    if (!snapshot?.dataset.preview) return [];
    let rows = snapshot.dataset.preview;
    if (selectedCategoryCol && selectedCategoryVal) {
      rows = rows.filter((r) => String(r[selectedCategoryCol] ?? "") === selectedCategoryVal);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
    }
    return rows;
  }, [snapshot, selectedCategoryCol, selectedCategoryVal, searchFilter]);

  if (!snapshot) return null;

  const kpiWidgets = widgets.filter((w) => w.type === "kpi");
  const chartWidgets = widgets.filter((w) => w.type !== "kpi");

  return (
    <div className="space-y-6">
      {/* Dashboard Topbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">Dashboard Studio</h2>
            <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
              Interactive
            </span>
            {isSaving && (
              <span className="text-[10px] font-medium text-slate-500 animate-pulse">
                Saving…
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Build, customize, and filter live KPI metrics and charts for {snapshot.dataset.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="btn-gradient px-3.5 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Widget
          </button>
          <button
            onClick={() => initDefaultWidgets()}
            className="btn-ghost px-3 py-2 text-xs"
            title="Reset to default template"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            onClick={() => window.print()}
            className="btn-ghost px-3 py-2 text-xs"
            title="Print or Export Dashboard to PDF"
          >
            <Printer className="h-3.5 w-3.5" /> Print View
          </button>
        </div>
      </div>

      {/* Live Interactive Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
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
            value={selectedCategoryCol}
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
          <select
            disabled={!selectedCategoryCol}
            value={selectedCategoryVal}
            onChange={(e) => setSelectedCategoryVal(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-night-900 px-3 py-2 text-xs text-slate-200 focus:border-violet-500/50 focus:outline-none disabled:opacity-40"
          >
            <option value="">All Values</option>
            {selectedCategoryCol &&
              columns
                .find((c) => c.name === selectedCategoryCol)
                ?.top_k?.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value} ({item.count})
                  </option>
                ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Row */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiWidgets.map((w) => (
            <KpiCard
              key={w.id}
              widget={w}
              rows={previewRows}
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
            rows={previewRows}
            onRemove={() => removeWidget(w.id)}
            onToggleSpan={() => toggleSpan(w.id)}
            onDuplicate={() => duplicateWidget(w.id)}
          />
        ))}

        {widgets.length === 0 && (
          <div className="col-span-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-16 text-center">
            <LayoutDashboard className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-300">Your dashboard is empty</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Click &quot;Add Widget&quot; to pin KPI metric cards and charts, or reset to the auto-generated template.
            </p>
            <button
              onClick={initDefaultWidgets}
              className="mt-4 btn-gradient px-4 py-2 text-xs font-semibold"
            >
              Load Default Template
            </button>
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {addModalOpen && (
        <AddWidgetModal
          columns={columns}
          numericCols={numericCols}
          categoricalCols={categoricalCols}
          onClose={() => setAddModalOpen(false)}
          onAdd={addWidget}
        />
      )}
    </div>
  );
}

// KPI Card Component with Live Calculation
function KpiCard({
  widget,
  rows,
  totalRows,
  onRemove,
  onDuplicate,
}: {
  widget: DashboardWidget;
  rows: Array<Record<string, any>>;
  totalRows: number;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const calculatedValue = useMemo(() => {
    if (widget.column === "_rows") {
      return rows.length;
    }
    if (!widget.column) return 0;

    const values = rows
      .map((r) => r[widget.column!])
      .filter((v) => v !== null && v !== undefined && v !== "");

    if (widget.aggregation === "unique") {
      return new Set(values).size;
    }

    if (widget.aggregation === "count") {
      return values.length;
    }

    const nums = values.map(Number).filter((n) => !isNaN(n));
    if (nums.length === 0) return 0;

    if (widget.aggregation === "sum") {
      return nums.reduce((a, b) => a + b, 0);
    }
    if (widget.aggregation === "avg") {
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    if (widget.aggregation === "min") {
      return Math.min(...nums);
    }
    if (widget.aggregation === "max") {
      return Math.max(...nums);
    }
    return nums[0] ?? 0;
  }, [rows, widget]);

  const formattedValue = useMemo(() => {
    const v = calculatedValue;
    if (typeof v === "number") {
      return v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(2)}M`
        : v >= 1_000
        ? `${(v / 1_000).toFixed(1)}k`
        : Number.isInteger(v)
        ? v.toLocaleString()
        : v.toFixed(2);
    }
    return String(v);
  }, [calculatedValue]);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-night-900/80 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-white/20" style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px -4px ${widget.color || '#8b5cf6'}22` }}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{widget.title}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          {rows.length < totalRows
            ? `${rows.length.toLocaleString()} / ${totalRows.toLocaleString()}`
            : `${totalRows.toLocaleString()} rows`}
        </span>
      </div>
    </div>
  );
}

// Chart Card Component
function ChartCard({
  widget,
  rows,
  onRemove,
  onToggleSpan,
  onDuplicate,
}: {
  widget: DashboardWidget;
  rows: Array<Record<string, any>>;
  onRemove: () => void;
  onToggleSpan: () => void;
  onDuplicate: () => void;
}) {
  const spanClass = widget.span === 4 ? "lg:col-span-4" : widget.span === 1 ? "lg:col-span-1" : "lg:col-span-2";

  // Aggregate rows by widget.x and widget.y
  const chartData = useMemo(() => {
    if (!widget.x) return [];
    const xCol = widget.x;
    const yCol = widget.y;

    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r[xCol] ?? "Unknown");
      const val = yCol ? Number(r[yCol]) || 0 : 1;
      map.set(key, (map.get(key) || 0) + val);
    }

    return Array.from(map.entries())
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [rows, widget.x, widget.y]);

  return (
    <div className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-night-900/80 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-white/20 ${spanClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-white tracking-tight">{widget.title}</h4>
          <p className="text-[11px] text-slate-500 capitalize">
            {widget.chart_type} chart · {widget.x} {widget.y ? `vs ${widget.y}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No chart data available for selected filter
          </div>
        ) : widget.chart_type === "pie" ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={4}
              >
                {chartData.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f8fafc" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        ) : widget.chart_type === "area" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`area-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f8fafc" }}
              />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill={`url(#area-${widget.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : widget.chart_type === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f8fafc" }}
              />
              <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f8fafc" }}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={`bar-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Modal to Add Custom Widget
function AddWidgetModal({
  columns,
  numericCols,
  categoricalCols,
  onClose,
  onAdd,
}: {
  columns: any[];
  numericCols: any[];
  categoricalCols: any[];
  onClose: () => void;
  onAdd: (widget: DashboardWidget) => void;
}) {
  const [type, setType] = useState<WidgetType>("kpi");
  const [title, setTitle] = useState("");
  const [column, setColumn] = useState(numericCols[0]?.name || columns[0]?.name || "");
  const [aggregation, setAggregation] = useState<"sum" | "avg" | "min" | "max" | "count" | "unique">("sum");
  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie">("bar");
  const [xCol, setXCol] = useState(categoricalCols[0]?.name || columns[0]?.name || "");
  const [yCol, setYCol] = useState(numericCols[0]?.name || "");
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
        id,
        type: "chart",
        title: title.trim() || `${chartType.toUpperCase()}: ${yCol || "Count"} by ${xCol}`,
        chart_type: chartType,
        x: xCol,
        y: yCol,
        span: 2,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-night-900 p-6 shadow-2xl"
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
                    onChange={(e) => setColumn(e.target.value)}
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
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                    <option value="count">Count</option>
                    <option value="unique">Unique Count</option>
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
            <>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Chart Type</label>
                  <select
                    value={chartType}
                    onChange={(e: any) => setChartType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-night-800 p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="area">Area</option>
                    <option value="pie">Pie</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">X Axis / Category</label>
                  <select
                    value={xCol}
                    onChange={(e) => setXCol(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-night-800 p-2.5 text-xs text-white focus:outline-none"
                  >
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Y Axis (Metric)</label>
                  <select
                    value={yCol}
                    onChange={(e) => setYCol(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-night-800 p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">Row Count</option>
                    {numericCols.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
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
