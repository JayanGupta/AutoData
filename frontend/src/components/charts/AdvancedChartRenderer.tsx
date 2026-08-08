"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { AdvancedChartSpec } from "../../types";
import { formatNumber } from "../../lib/format";
import { PALETTE } from "./ChartRenderer";

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

interface Props {
  chart: AdvancedChartSpec;
  height: number;
}

export function AdvancedChartRenderer({ chart, height = 300 }: Props) {
  switch (chart.chart_type) {
    case "box":
      return <BoxPlot chart={chart} height={height} />;
    case "distribution":
      return <Distribution chart={chart} height={height} />;
    case "area":
      return <AreaChartView chart={chart} height={height} />;
    case "stacked_bar":
      return <StackedBar chart={chart} height={height} />;
    case "multi_line":
      return <MultiLine chart={chart} height={height} />;
    case "radar":
      return <RadarView chart={chart} height={height} />;
    case "bubble":
      return <BubbleView chart={chart} height={height} />;
    case "treemap":
      return <TreemapView chart={chart} height={height} />;
    case "sunburst":
      return <SunburstView chart={chart} height={height} />;
    case "pair_plot":
      return <PairPlot chart={chart} height={height} />;
    case "correlation":
      return <CorrelationMatrix chart={chart} height={height} />;
    default:
      return <p className="text-sm text-slate-500">Chart type not supported.</p>;
  }
}

function DataTooltip({ active, payload, label, nameKey }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      {label !== undefined && label !== null && (
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", paddingBottom: 4 }}>{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, lineHeight: 1.7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color ?? p.payload?.fill ?? PALETTE[i % PALETTE.length], display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#94a3b8" }}>{p.name ?? nameKey ?? "value"}:</span>
          <strong style={{ color: "#e2e8f0", fontFamily: "monospace" }}>{formatNumber(Number(p.value))}</strong>
        </p>
      ))}
    </div>
  );
}

function YTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y} dy={3} textAnchor="end" fontSize={10} fill="#64748b">
      {formatNumber(payload.value)}
    </text>
  );
}

function XTick(props: any) {
  const { x, y, payload } = props;
  const text = String(payload.value);
  return (
    <text x={x} y={y} dy={10} textAnchor="middle" fontSize={10} fill="#64748b">
      {text.length > 16 ? `${text.slice(0, 15)}…` : text}
    </text>
  );
}

/* ----------------------------- Box plot ----------------------------- */

function BoxPlot({ chart, height }: Props) {
  const data = chart.data as Array<{
    name: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    p05: number;
    p95: number;
    outliers: number;
  }>;
  if (!data?.length) return <EmptyChart />;
  const all = data.flatMap((d) => [d.p05 ?? d.min, d.p95 ?? d.max]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const pad = span * 0.08;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const scale = (v: number) => ((v - yMin) / (yMax - yMin)) * height;

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 px-6 pt-6">
        <svg width="100%" height={height - 24} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1="0" x2="100" y1={height * t} y2={height * t} stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
          ))}
          {data.map((d, i) => {
            const slot = 100 / data.length;
            const x = i * slot + slot / 2;
            const w = Math.max(slot * 0.3, 6);
            const color = PALETTE[i % PALETTE.length];
            const q1 = scale(d.q1 ?? d.min);
            const q3 = scale(d.q3 ?? d.max);
            const med = scale(d.median ?? d.min);
            const loLine = scale(d.p05 ?? d.min);
            const hiLine = scale(d.p95 ?? d.max);
            return (
              <g key={d.name}>
                <line x1={x} x2={x} y1={loLine} y2={hiLine} stroke={color} strokeWidth={1.2} />
                <line x1={x - w / 2} x2={x + w / 2} y1={loLine} y2={loLine} stroke={color} strokeWidth={1.4} />
                <line x1={x - w / 2} x2={x + w / 2} y1={hiLine} y2={hiLine} stroke={color} strokeWidth={1.4} />
                <rect x={x - w / 2} y={Math.min(q1, q3)} width={w} height={Math.abs(q1 - q3)} rx={2} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.2} />
                <line x1={x - w / 2} x2={x + w / 2} y1={med} y2={med} stroke={color} strokeWidth={2} />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-x-6 top-0 flex justify-between text-[10px] text-slate-500">
          <span>{formatNumber(yMin)}</span>
          <span>{formatNumber(yMax)}</span>
        </div>
      </div>
      <div className="mt-1 flex justify-around border-t border-white/[0.06] px-4 pt-3 text-[10px] text-slate-400">
        {data.map((d) => (
          <span key={d.name} className="max-w-[30%] truncate" title={`${d.name} · outliers: ${d.outliers}`}>
            {d.name}
            {d.outliers > 0 ? ` · ${d.outliers} outlier${d.outliers > 1 ? "s" : ""}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Distribution --------------------------- */

function Distribution({ chart, height }: Props) {
  const data = chart.data as {
    bins: Array<{ bin: string; count: number }>;
    density: Array<{ x: number; y: number }>;
  };
  const bins = data?.bins ?? [];
  const density = data?.density ?? [];
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  return (
    <div className="relative h-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={bins} margin={{ top: 8, right: 14, left: 4, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="bin" tick={XTick} interval="preserveStartEnd" tickFormatter={(v) => String(v).slice(0, 12)} stroke="rgba(255,255,255,0.06)" />
          <YAxis yAxisId="left" tick={YTick} width={46} stroke="rgba(255,255,255,0.06)" />
          <YAxis yAxisId="right" orientation="right" hide />
          <Tooltip content={<DataTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar yAxisId="left" dataKey="count" fill={PALETTE[0]} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={28} />
          {density.length > 2 && (
            <Line
              yAxisId="right"
              type="monotone"
              data={density.map((d) => ({ bin: String(d.x), count: d.y * maxCount * 0.95 }))}
              dataKey="count"
              stroke={PALETTE[3]}
              strokeWidth={2}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="absolute bottom-0 right-2 text-[9px] text-slate-600">{chart.description}</p>
    </div>
  );
}

/* ------------------------------ Area -------------------------------- */

function AreaChartView({ chart, height }: Props) {
  const data = chart.data as Array<Record<string, unknown>>;
  const xKey = chart.x ?? "date";
  const yKey = chart.y ?? "value";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 8 }}>
        <defs>
          <linearGradient id="adv-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE[1]} stopOpacity={0.5} />
            <stop offset="100%" stopColor={PALETTE[1]} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={XTick} interval="preserveStartEnd" minTickGap={40} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={YTick} width={52} stroke="rgba(255,255,255,0.06)" />
        <Tooltip content={<DataTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey={yKey} stroke={PALETTE[1]} strokeWidth={2.2} fill="url(#adv-area)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* --------------------------- Stacked bar ---------------------------- */

function StackedBar({ chart, height }: Props) {
  const data = chart.data as Array<Record<string, number | string>>;
  const series = chart.series ?? [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 8 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="group" tick={XTick} interval="preserveStartEnd" stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={YTick} width={46} stroke="rgba(255,255,255,0.06)" />
        <Tooltip content={<DataTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Bar key={s} dataKey={s} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} maxBarSize={42} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* --------------------------- Multi line ----------------------------- */

function MultiLine({ chart, height }: Props) {
  const data = chart.data as Array<Record<string, unknown>>;
  const series = chart.series ?? [];
  const xKey = chart.x ?? "date";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 14, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={XTick} interval="preserveStartEnd" minTickGap={40} stroke="rgba(255,255,255,0.06)" />
        <YAxis tick={YTick} width={52} stroke="rgba(255,255,255,0.06)" />
        <Tooltip content={<DataTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} />
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Line key={s} type="monotone" dataKey={s} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} activeDot={{ r: 3.5 }} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------ Radar ------------------------------- */

function RadarView({ chart, height }: Props) {
  const data = chart.data as Array<Record<string, unknown>>;
  if (!data?.length) return <EmptyChart />;
  const keys = Object.keys(data[0]);
  const valueKeys = keys.filter((k) => k !== "name" && k !== "category" && k !== "group");
  const labelKey = keys.find((k) => k !== "name" && !valueKeys.includes(k)) ?? "name";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="68%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey={labelKey} tick={{ fontSize: 10, fill: "#94a3b8" }} />
        <PolarRadiusAxis angle={90} domain={[0, "auto"]} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} />
        <Tooltip content={<DataTooltip />} />
        {valueKeys.slice(0, 2).map((k, i) => (
          <Radar key={k} name={k} dataKey={k} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={i === 0 ? 0.25 : 0.08} strokeWidth={2} />
        ))}
        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} iconType="circle" iconSize={8} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------ Bubble ------------------------------ */

function BubbleView({ chart, height }: Props) {
  const data = chart.data as Array<{ x: number; y: number; size: number }>;
  const xKey = chart.x ?? "x";
  const yKey = chart.y ?? "y";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 14, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis type="number" dataKey="x" name={xKey} tick={YTick} tickFormatter={(v) => formatNumber(v)} width={56} height={36} stroke="rgba(255,255,255,0.06)" />
        <YAxis type="number" dataKey="y" name={yKey} tick={YTick} tickFormatter={(v) => formatNumber(v)} width={56} stroke="rgba(255,255,255,0.06)" />
        <ZAxis type="number" dataKey="size" range={[60, 800]} />
        <Tooltip content={<DataTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }} />
        <Scatter data={data} fill={PALETTE[0]} fillOpacity={0.55} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------- Treemap ------------------------------ */

function TreemapView({ chart, height }: Props) {
  const data = chart.data as Array<{ name: string; value: number }>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={data}
        dataKey="value"
        nameKey="name"
        aspectRatio={4 / 3}
        stroke="rgba(11,14,33,0.8)"
        content={<CustomTreemapCell />}
      >
        <Tooltip content={<DataTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}

function CustomTreemapCell({ x, y, width, height, name, value, index }: any) {
  const color = PALETTE[(index ?? 0) % PALETTE.length];
  const showText = width > 36 && height > 24;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={color} fillOpacity={0.85} stroke="rgba(11,14,33,0.8)" strokeWidth={1} />
      {showText && (
        <>
          <text x={x + 6} y={y + 16} fill="#fff" fontSize={11} fontWeight={600} style={{ pointerEvents: "none" }}>
            {String(name).slice(0, 22)}
          </text>
          <text x={x + 6} y={y + 30} fill="rgba(255,255,255,0.85)" fontSize={10} fontFamily="monospace" style={{ pointerEvents: "none" }}>
            {formatNumber(Number(value))}
          </text>
        </>
      )}
    </g>
  );
}

/* ----------------------------- Sunburst ----------------------------- */

interface SunNode {
  name: string;
  value?: number;
  children?: SunNode[];
}

function SunburstView({ chart, height }: Props) {
  const data = chart.data as unknown as SunNode[];
  if (!data?.length) return <EmptyChart />;

  const total = (nodes: SunNode[]): number => nodes.reduce((s, n) => s + (n.value ?? (n.children ? total(n.children) : 0)), 0);
  const grand = total(data) || 1;
  const size = Math.min(height, 420);
  const cx = size / 2;
  const cy = size / 2;
  const R0 = size * 0.22;
  const R1 = size * 0.4;
  const R2 = size * 0.48;

  const arcs: Array<{ r0: number; r1: number; a0: number; a1: number; fill: string; name: string }> = [];
  const TAU = Math.PI * 2;

  let angle = -TAU / 4;
  data.forEach((n, i) => {
    const frac = (n.value ?? 0) / grand;
    if (!frac) return;
    const a0 = angle;
    const a1 = angle + frac * TAU;
    arcs.push({ r0: R0, r1: R1, a0, a1, fill: PALETTE[i % PALETTE.length], name: n.name });
    angle = a1;
  });

  let a2 = -TAU / 4;
  data.forEach((n, i) => {
    const children = n.children ?? [];
    const parentFrac = (n.value ?? total([n])) / grand;
    if (!parentFrac) return;
    let childAngle = a2;
    children.forEach((c, j) => {
      const frac = (c.value ?? 0) / Math.max((n.value ?? total(children)) , 1);
      const a0 = childAngle;
      const a1 = childAngle + frac * parentFrac * TAU;
      arcs.push({ r0: R1, r1: R2, a0, a1, fill: PALETTE[(i * 3 + j + 1) % PALETTE.length], name: `${n.name} / ${c.name}` });
      childAngle = a1;
    });
    a2 += parentFrac * TAU;
  });

  const arcPath = (a0: number, a1: number, r0: number, r1: number) => {
    const p = (a: number, r: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const [x0, y0] = p(a0, r0);
    const [x1, y1] = p(a1, r0);
    const [x2, y2] = p(a1, r1);
    const [x3, y3] = p(a0, r1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${r0},${r0} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r1},${r1} 0 ${large} 0 ${x3},${y3} Z`;
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: height }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={arcPath(a.a0, a.a1, a.r0, a.r1)} fill={a.fill} fillOpacity={0.85} stroke="rgba(11,14,33,0.8)" strokeWidth={1}>
            <title>{`${a.name}`}</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={R0} fill="none" />
      </svg>
      <p className="max-w-full truncate px-4 text-center text-[11px] text-slate-400">{chart.description}</p>
    </div>
  );
}

/* ----------------------------- Pair plot ---------------------------- */

function PairPlot({ chart, height: _height }: Props) {
  const columns = chart.columns ?? [];
  const data = chart.data as Array<Record<string, number>>;
  if (columns.length < 2) return <EmptyChart />;
  const n = columns.length;
  const cell = 150;
  const size = Math.min(n * cell, 620);
  const padding = 40;

  return (
    <div className="flex justify-center overflow-x-auto">
      <div style={{ position: "relative", width: size, height: size }} className="p-2">
        {columns.map((c, i) => (
          <span key={c} className="absolute text-[10px] font-medium text-slate-400" style={{ left: padding + i * ((size - padding * 2) / (n - 1)), top: 6, transform: "translateX(-50%)", maxWidth: 90, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c}
          </span>
        ))}
        {columns.map((c, i) => (
          <span key={c} className="absolute text-[10px] font-medium text-slate-400" style={{ left: 4, top: padding + i * ((size - padding * 2) / (n - 1)) - 5, maxWidth: 90, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c}
          </span>
        ))}
        {columns.map((ci, i) =>
          columns.map((cj, j) => {
            const step = (size - padding * 2) / (n - 1);
            return (
              <div key={`${ci}-${cj}`} style={{ position: "absolute", left: padding + j * step - step / 2, top: padding + i * step - step / 2, width: step, height: step, padding: 4 }}>
                {i === j ? (
                  <MiniHistogram values={data.map((d) => Number(d[ci])).filter((v) => !Number.isNaN(v))} />
                ) : (
                  <MiniScatter x={data.map((d) => Number(d[cj]))} y={data.map((d) => Number(d[ci]))} />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function MiniHistogram({ values }: { values: number[] }) {
  if (!values.length) return <div className="h-full w-full rounded-lg bg-white/[0.03]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const bins = 8;
  const counts = new Array(bins).fill(0);
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    counts[idx]++;
  });
  const maxC = Math.max(...counts, 1);
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" preserveAspectRatio="none">
      {counts.map((c, i) => {
        const h = (c / maxC) * 36;
        return <rect key={i} x={i * 5} y={40 - h} width={4.4} height={h} rx={1} fill={PALETTE[2]} fillOpacity={0.8} />;
      })}
    </svg>
  );
}

function MiniScatter({ x, y }: { x: number[]; y: number[] }) {
  const xMin = Math.min(...x, 1);
  const xMax = Math.max(...x, 1);
  const yMin = Math.min(...y, 1);
  const yMax = Math.max(...y, 1);
  const xs = xMax - xMin || 1;
  const ys = yMax - yMin || 1;
  const pts = x.map((v, i) => `${((v - xMin) / xs) * 38 + 1},${40 - ((y[i] - yMin) / ys) * 38 - 1}`).join(" ");
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 40" preserveAspectRatio="none">
      <rect width="40" height="40" rx={4} fill="rgba(255,255,255,0.03)" />
      <polygon points={pts} fill={PALETTE[4]} fillOpacity={0.4} />
      <line x1="1" y1="39" x2="39" y2="39" stroke="rgba(148,163,184,0.25)" strokeWidth="0.5" />
      <line x1="1" y1="39" x2="1" y2="1" stroke="rgba(148,163,184,0.25)" strokeWidth="0.5" />
    </svg>
  );
}

/* --------------------------- Correlation ---------------------------- */

function CorrelationMatrix({ chart, height: _height }: Props) {
  const columns = chart.columns ?? [];
  const matrix = chart.matrix ?? [];
  const values = matrix.flat().filter((v): v is number => v !== null);
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <div className="overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <table className="mx-auto border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} className="px-1.5 py-1 text-[10px] font-medium text-slate-500">
                <span className="block max-w-[70px] truncate" title={c}>{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="max-w-[70px] truncate px-1.5 py-1 text-[10px] font-medium text-slate-500" title={columns[i]}>
                {columns[i]}
              </td>
              {row.map((v, j) => (
                <td
                  key={j}
                  className="min-w-[48px] text-center text-[10px] font-medium"
                  style={{
                    backgroundColor: cellColor(v, max),
                    color: v !== null && Math.abs(v) > 0.5 * max ? "#fff" : "#94a3b8",
                    borderRadius: 6,
                    padding: "6px 7px",
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
  if (v > 0) return `rgba(16, 185, 129, ${0.16 + strength * 0.6})`;
  if (v < 0) return `rgba(244, 63, 94, ${0.16 + strength * 0.6})`;
  return "rgba(255,255,255,0.03)";
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-sm text-slate-500">No data for this chart.</div>;
}
