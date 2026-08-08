import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
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

const PALETTE = [
  "#a78bfa",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#818cf8",
  "#38bdf8",
  "#2dd4bf",
  "#c084fc",
  "#fb923c",
  "#a3e635",
  "#f87171",
];

const GRID = "rgba(148, 163, 184, 0.12)";
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(11, 14, 33, 0.96)",
  color: "#e2e8f0",
  boxShadow: "0 12px 40px -8px rgba(0,0,0,0.6)",
  padding: "8px 12px",
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
  switch (chart.chart_type) {
    case "heatmap":
      return <Heatmap chart={chart} />;
    case "line":
      return <LineChartView chart={chart} height={height} />;
    case "scatter":
      return <ScatterChartView chart={chart} height={height} />;
    case "pie":
      return <PieChartView chart={chart} height={height} />;
    case "histogram":
      return <HistogramView chart={chart} height={height} />;
    default:
      return <BarChartView chart={chart} height={height} />;
  }
}

function DataTooltip({ active, payload, label, valueName }: any) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((p: any) => p.value !== undefined && p.value !== null);
  if (!rows.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      {label !== undefined && label !== null && <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", paddingBottom: 4 }}>{label}</p>}
      {rows.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, lineHeight: 1.7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color ?? p.payload?.fill ?? "#a78bfa", display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#94a3b8" }}>{p.name ?? valueName ?? "value"}:</span>
          <strong style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{formatNumber(Number(p.value))}</strong>
        </p>
      ))}
    </div>
  );
}

function YTickLabel({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={3} textAnchor="end" fontSize={10} fill="#64748b">
      {formatNumber(payload.value)}
    </text>
  );
}

function XTickLabel(props: any) {
  const { x, y, payload } = props;
  const text = String(payload.value);
  const truncated = text.length > 14 ? `${text.slice(0, 13)}…` : text;
  return (
    <text x={x} y={y} dy={10} textAnchor="middle" fontSize={10} fill="#64748b">
      {truncated}
    </text>
  );
}

function HistogramView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ label: string; count: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 14, left: 4, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={XTickLabel} interval="preserveStartEnd" angle={-35} textAnchor="end" height={50} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={YTickLabel} width={44} stroke="rgba(255,255,255,0.06)" />
        <Tooltip content={<DataTooltip valueName="count" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={48}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.9} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ group: string; value: number }>;
  const showLabels = data.length <= 14;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: showLabels ? 22 : 8, right: 14, left: 4, bottom: 10 }} barCategoryGap="28%">
        <defs>
          {data.map((_, i) => (
            <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={1} />
              <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.35} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="group" tick={XTickLabel} interval="preserveStartEnd" angle={-20} textAnchor="end" height={46} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={YTickLabel} width={52} stroke="rgba(255,255,255,0.06)" />
        <Tooltip
          content={<DataTooltip valueName={chart.y} />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          labelFormatter={(label: any) => String(label)}
        />
        <Bar
          dataKey="value"
          radius={[7, 7, 0, 0]}
          maxBarSize={46}
          activeBar={{ fillOpacity: 1, stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={`url(#bar-grad-${i})`}
              fillOpacity={0.9}
              stroke="rgba(255,255,255,0.08)"
              style={{ filter: `drop-shadow(0 6px 10px ${PALETTE[i % PALETTE.length]}33)` }}
            />
          ))}
          {showLabels && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: any) => formatNumber(Number(v))}
              style={{ fontSize: 10, fill: "#94a3b8", fontFamily: "monospace" }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ date: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={XTickLabel} interval="preserveStartEnd" minTickGap={40} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={YTickLabel} width={52} stroke="rgba(255,255,255,0.06)" />
        <Tooltip content={<DataTooltip valueName={chart.y} />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={PALETTE[2]}
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: PALETTE[2], strokeWidth: 0 }}
          activeDot={{ r: 5, fill: PALETTE[2], stroke: "#0b0e21", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<{ group: string; value: number }>;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const innerRadius = Math.min(height, 340) / 4.6;
  const outerRadius = Math.min(height, 340) / 2.5;
  const largestIdx = data.reduce((best, d, i, arr) => (d.value > arr[best].value ? i : best), 0);
  const pieData = data.map((d, i) => ({ ...d, index: i }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 24, right: 24, left: 24, bottom: 12 }}>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="group"
            cx="50%"
            cy="50%"
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            paddingAngle={2.5}
            stroke="rgba(11,14,33,0.85)"
            strokeWidth={1.5}
            labelLine={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
            label={({ cx, cy, midAngle, innerR, outerR, percent, value, index }: any) => {
              const pct = percent ?? value / total;
              if (pct < 0.04) return null;
              const RADIAN = Math.PI / 180;
              const radius = (innerR + outerR) / 2 + (index === largestIdx ? 22 : 12);
              const x = cx + Math.cos(-midAngle * RADIAN) * radius;
              const y = cy + Math.sin(-midAngle * RADIAN) * radius;
              return (
                <text
                  x={x}
                  y={y}
                  fill="#cbd5e1"
                  textAnchor={x > cx ? "start" : "end"}
                  dominantBaseline="central"
                  fontSize={10}
                  style={{ fontFamily: "monospace" }}
                >
                  {`${Math.round(pct * 100)}%`}
                </text>
              );
            }}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={i === largestIdx ? 1 : 0.82}
                stroke="rgba(11,14,33,0.85)"
              />
            ))}
          </Pie>
          <Tooltip content={<DataTooltip valueName="count" />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: any, entry: any) => {
              const idx = entry?.payload?.index ?? 0;
              const v = data[idx]?.value ?? 0;
              const label = String(value).length > 18 ? `${String(value).slice(0, 17)}…` : value;
              return (
                <span style={{ color: "#94a3b8", fontSize: 11 }}>
                  {label} <span style={{ color: "#64748b", fontFamily: "monospace" }}>({Math.round((v / total) * 100)}%)</span>
                </span>
              );
            }}
            wrapperStyle={{ paddingTop: 14 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterChartView({ chart, height }: { chart: ChartSpec; height: number }) {
  const data = chart.data as Array<Record<string, number>>;
  const xKey = chart.x;
  const yKey = chart.y;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 14, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis type="number" dataKey={xKey} name={xKey} tick={YTickLabel} width={56} height={36} stroke="rgba(255,255,255,0.06)" />
        <YAxis type="number" dataKey={yKey} name={yKey} tick={YTickLabel} width={56} stroke="rgba(255,255,255,0.06)" />
        <Tooltip content={<DataTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }} />
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

export { PALETTE };
