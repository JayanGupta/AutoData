import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "../../types";
import { formatNumber } from "../../lib/format";

const PALETTE = ["#a78bfa", "#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#818cf8", "#38bdf8", "#2dd4bf"];

const GRID = "rgba(148, 163, 184, 0.12)";
const TICK = { fontSize: 10, fill: "#64748b" };
const TOOLTIP = {
  fontSize: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "#0b0e21",
  color: "#e2e8f0",
  boxShadow: "0 12px 40px -8px rgba(0,0,0,0.6)",
};

interface ChartRendererProps {
  chart: ChartSpec;
  height?: number;
}

export function ChartRenderer({ chart, height = 280 }: ChartRendererProps) {
  return (
    <>
      <BarGradients />
      {renderChart(chart, height)}
    </>
  );
}

function renderChart(chart: ChartSpec, height: number) {
  if (chart.chart_type === "heatmap") {
    return <Heatmap chart={chart} />;
  }
  if (chart.chart_type === "line") {
    return <LineChartView chart={chart} height={height} />;
  }
  if (chart.chart_type === "scatter") {
    return <ScatterChartView chart={chart} height={height} />;
  }
  if (chart.chart_type === "pie") {
    return <PieChartView chart={chart} height={height} />;
  }
  if (chart.chart_type === "histogram") {
    return <HistogramView chart={chart} height={height} />;
  }
  return <BarChartView chart={chart} height={height} />;
}

function HistogramView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ label: string; count: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={TICK} interval="preserveStartEnd" angle={-35} textAnchor="end" height={50} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={TICK} tickFormatter={(v) => formatNumber(v)} width={44} stroke="rgba(255,255,255,0.06)" />
        <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(value) => [formatNumber(Number(value)), "count"]} />
        <Bar dataKey="count" fill="url(#gbar)" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ group: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="group" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" angle={-20} textAnchor="end" height={46} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={TICK} tickFormatter={(v) => formatNumber(v)} width={52} stroke="rgba(255,255,255,0.06)" />
        <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(value) => [formatNumber(Number(value)), chart.y]} />
        <Bar dataKey="value" fill="url(#gbar)" radius={[5, 5, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ date: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={TICK} interval="preserveStartEnd" minTickGap={32} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={TICK} tickFormatter={(v) => formatNumber(v)} width={52} stroke="rgba(255,255,255,0.06)" />
        <Tooltip contentStyle={TOOLTIP} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} formatter={(value) => [formatNumber(Number(value)), chart.y]} />
        <Line type="monotone" dataKey="value" stroke={PALETTE[2]} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: PALETTE[2] }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ group: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="group"
          cx="50%"
          cy="50%"
          outerRadius={Math.min(height, 320) / 2.4}
          innerRadius={Math.min(height, 320) / 4.4}
          paddingAngle={2}
          stroke="rgba(255,255,255,0.06)"
          label={(p: { group?: string; percent?: number }) =>
            p.percent && p.percent > 0.04 ? `${Math.round(p.percent * 100)}%` : ""
          }
          labelLine={{ stroke: "rgba(255,255,255,0.2)" }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => [formatNumber(Number(v)), "count"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ScatterChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<Record<string, number>>;
  const xKey = chart.x;
  const yKey = chart.y;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis type="number" dataKey={xKey} name={xKey} tick={TICK} tickFormatter={(v) => formatNumber(v)} width={56} height={36} stroke="rgba(255,255,255,0.06)" />
        <YAxis type="number" dataKey={yKey} name={yKey} tick={TICK} tickFormatter={(v) => formatNumber(v)} width={56} stroke="rgba(255,255,255,0.06)" />
        <Tooltip
          contentStyle={TOOLTIP}
          cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }}
          formatter={(value, name) => [formatNumber(Number(value)), name as string]}
        />
        <Scatter data={data} fill={PALETTE[4]} fillOpacity={0.65} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function BarGradients() {
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Heatmap({ chart }: { chart: ChartSpec }) {
  const columns = chart.columns ?? [];
  const matrix = chart.matrix ?? [];
  const values = matrix.flat().filter((v): v is number => v !== null);
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);

  return (
    <div className="overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <table className="mx-auto border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} className="px-2 py-1 text-[10px] font-medium text-slate-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="px-2 py-1 text-[10px] font-medium text-slate-500">{columns[i]}</td>
              {row.map((v, j) => (
                <td
                  key={j}
                  className="min-w-[56px] text-center text-[10px] font-medium"
                  style={{
                    backgroundColor: cellColor(v, max),
                    color: v !== null && Math.abs(v) > 0.5 * max ? "#fff" : "#94a3b8",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                >
                  {v === null ? "·" : v.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellColor(v: number | null, max: number): string {
  if (v === null) return "rgba(255,255,255,0.03)";
  const strength = Math.min(1, Math.abs(v) / max);
  if (v > 0) return `rgba(16, 185, 129, ${0.18 + strength * 0.6})`;
  if (v < 0) return `rgba(244, 63, 94, ${0.18 + strength * 0.6})`;
  return "rgba(255,255,255,0.03)";
}
