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

const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

interface ChartRendererProps {
  chart: ChartSpec;
  height?: number;
}

export function ChartRenderer({ chart, height = 280 }: ChartRendererProps) {
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
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#64748b" }}
          interval="preserveStartEnd"
          angle={-35}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => formatNumber(v)} width={44} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          formatter={(value) => [formatNumber(Number(value)), "count"]}
        />
        <Bar dataKey="count" fill={PALETTE[0]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ group: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="group" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" angle={-20} textAnchor="end" height={46} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => formatNumber(v)} width={52} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          formatter={(value) => [formatNumber(Number(value)), chart.y]}
        />
        <Bar dataKey="value" fill={PALETTE[1]} radius={[3, 3, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ date: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" minTickGap={32} />
        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => formatNumber(v)} width={52} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          formatter={(value) => [formatNumber(Number(value)), chart.y]}
        />
        <Line type="monotone" dataKey="value" stroke={PALETTE[2]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
          label={(p: { group?: string; percent?: number }) =>
            p.percent && p.percent > 0.04 ? `${Math.round(p.percent * 100)}%` : ""
          }
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} formatter={(v) => [formatNumber(Number(v)), "count"]} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis
          type="number"
          dataKey={xKey}
          name={xKey}
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickFormatter={(v) => formatNumber(v)}
          width={56}
          height={36}
        />
        <YAxis
          type="number"
          dataKey={yKey}
          name={yKey}
          tick={{ fontSize: 10, fill: "#64748b" }}
          tickFormatter={(v) => formatNumber(v)}
          width={56}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(value, name) => [formatNumber(Number(value)), name as string]}
        />
        <Scatter data={data} fill={PALETTE[4]} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function Heatmap({ chart }: { chart: ChartSpec }) {
  const columns = chart.columns ?? [];
  const matrix = chart.matrix ?? [];
  const values = matrix.flat().filter((v): v is number => v !== null);
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);

  return (
    <div className="overflow-auto">
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
                    color: v !== null && Math.abs(v) > 0.5 * max ? "#fff" : "#334155",
                    borderRadius: 4,
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
  if (v === null) return "#f8fafc";
  const strength = Math.min(1, Math.abs(v) / max);
  if (v > 0) return `rgba(16, 185, 129, ${0.15 + strength * 0.65})`;
  if (v < 0) return `rgba(244, 63, 94, ${0.15 + strength * 0.65})`;
  return "#f8fafc";
}
