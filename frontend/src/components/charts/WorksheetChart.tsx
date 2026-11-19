import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { ColumnProfile, DashboardWidget } from "../../types";
import { DataTooltip } from "./ChartRenderer";

const PALETTE = ["#a78bfa", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#e879f9", "#a3e635"];
const KINDS = { bar: "Bar", line: "Line", area: "Area", histogram: "Histogram", scatter: "Scatter", pie: "Donut", table: "Summary table" };
const AGGS = { none: "None (show individual rows)", sum: "Sum", avg: "Average", min: "Minimum", max: "Maximum", count: "Count", unique: "Distinct count" };
export const numericColumn = (c: ColumnProfile) => c.inferred_type === "integer" || c.inferred_type === "float";

export function initialChart(columns: ColumnProfile[]): DashboardWidget {
  const x = columns.find(c => c.inferred_type === "categorical" && c.distinct_count > 1 && c.distinct_count < 50) ?? columns[0];
  const y = columns.find(c => numericColumn(c) && c.name !== x.name);
  return { type: "chart", id: "preview", title: "", span: 2, chart_type: "bar", x: x.name, y: y?.name || "", aggregation: "sum", scale: "linear", date_axis: x.inferred_type === "datetime" };
}

export function axisNames(w: DashboardWidget) {
  const x = w.x || "Category";
  const y = (w.chart_type === "scatter" || w.aggregation === "none") && w.y ? w.y || "Value" : w.chart_type === "histogram" || !w.y ? "Row count" : (AGGS[w.aggregation || "sum"] + " of " + w.y);
  return { x, y };
}

export function chartTitle(w: DashboardWidget) {
  const { x, y } = axisNames(w);
  return w.title.trim() || (w.chart_type === "histogram" ? "Distribution of " + x : y + " by " + x);
}

export function ChartFields({ columns, widget, onChange }: {
  columns: ColumnProfile[]; widget: DashboardWidget; onChange: (next: DashboardWidget) => void;
}) {
  const numbers = columns.filter(numericColumn);
  const kind = widget.chart_type || "bar";
  const raw = kind === "scatter", histogram = kind === "histogram";
  function chooseKind(next: DashboardWidget["chart_type"]) {
    const numericX = next === "scatter" || next === "histogram";
    const x = numericX && !numbers.some(c => c.name === widget.x) ? numbers[0]?.name : widget.x;
    let y = widget.y;
    if (next === "scatter" && (!y || x === y)) y = numbers.find(c => c.name !== x)?.name;
    if (next === "histogram") y = "";
    onChange({ ...widget, aggregation: widget.aggregation === "none" && (numericX || next === "pie") ? "sum" : widget.aggregation, chart_type: next, x, y, date_axis: columns.find(c => c.name === x)?.inferred_type === "datetime", scale: "linear" });
  }
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label><span className="field-label">Chart type</span><select className="field" value={kind}
      onChange={e => chooseKind(e.target.value as DashboardWidget["chart_type"])}>
      {Object.entries(KINDS).filter(([k]) => !(k === "scatter" && numbers.length < 2 || k === "histogram" && !numbers.length))
        .map(([k,v]) => <option key={k} value={k}>{v}</option>)}
    </select></label>
    <label><span className="field-label">{kind === "pie" || kind === "table" ? "Group by" : "X axis"}</span><select className="field" value={widget.x} onChange={e => onChange({
      ...widget, x: e.target.value, date_axis: columns.find(c => c.name === e.target.value)?.inferred_type === "datetime",
    })}>{(raw || histogram ? numbers : columns).map(c => <option key={c.name}>{c.name}</option>)}</select></label>
    {!histogram && <label><span className="field-label">{kind === "pie" || kind === "table" ? "Measure" : "Y axis"}</span><select className="field" value={widget.y || ""} onChange={e => onChange({ ...widget, aggregation: !e.target.value && widget.aggregation === "none" ? "sum" : widget.aggregation, y: e.target.value })}>
      {!raw && <option value="">Row count</option>}{numbers.map(c => <option key={c.name}>{c.name}</option>)}
    </select></label>}
    {widget.y && !raw && !histogram && <label><span className="field-label">Summarize by</span><select className="field" value={widget.aggregation || "sum"}
      onChange={e => onChange({ ...widget, aggregation: e.target.value as DashboardWidget["aggregation"] })}>
      {Object.entries(AGGS).filter(([key]) => key !== "none" || kind !== "pie").map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
    {kind !== "pie" && kind !== "table" && <label><span className="field-label">Y axis scale</span>
      <select className="field" value={widget.scale || "linear"} onChange={e => onChange({ ...widget, scale: e.target.value as DashboardWidget["scale"] })}>
        <option value="linear">Linear</option><option value="log">Logarithmic (positive values)</option>
      </select></label>}
  </div>;
}

export function WorksheetChart({ widget, data }: { widget: DashboardWidget; data: { name: string; value: number }[] }) {
  const kind = widget.chart_type || "bar";
  const { x, y } = axisNames(widget);
  if (!data.length) return <p className="p-5 text-sm text-slate-400">No plottable values for these columns and filters.</p>;
  if (widget.scale === "log" && data.some(d => d.value <= 0)) return <p className="p-5 text-sm text-amber-200">This result includes zero or negative values. Choose a linear scale or filter to positive values.</p>;
  if (kind === "pie" && (data.some(d => d.value < 0) || data.every(d => d.value === 0))) return <p className="p-5 text-sm text-amber-200">A donut needs nonnegative values and a positive total. Choose a bar chart to show this result.</p>;
  if (kind === "table") return <><p className="text-sm text-slate-400">{widget.aggregation === "none" && "First 400 valid rows at most"}</p><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm">
    <thead><tr><th className="p-2">{x}</th><th className="p-2 text-right">{y}</th></tr></thead>
    <tbody>{data.map((d,i) => <tr className="border-t border-white/10" key={i}><td className="p-2">{d.name}</td><td className="p-2 text-right">{d.value.toLocaleString()}</td></tr>)}</tbody></table></div></>;
  const log = widget.scale === "log";
  const yAxis = <YAxis name={y} dataKey={kind === "scatter" ? "value" : undefined} type="number" scale={log ? "log" : "linear"}
    domain={log ? ["auto", "auto"] : [Math.min(0, ...data.map(p => p.value)), "auto"]} allowDecimals stroke="#94a3b8" fontSize={12} width={62}
    tickFormatter={n => Intl.NumberFormat(undefined,{notation:"compact"}).format(n)} />;
  const grid = <CartesianGrid strokeDasharray="3 4" stroke="#334155" vertical={false} />;
  return <figure aria-label={chartTitle(widget)} className="min-w-0">
    <figcaption className="mb-2 text-sm text-slate-300">{y}{log ? " · log scale" : ""}</figcaption>
    <div className="h-64 min-w-0"><ResponsiveContainer width="100%" height="100%">
      {kind === "pie" ? <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="38%" outerRadius="74%" isAnimationActive={false}>
        {data.map((_,i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
      </Pie><Legend wrapperStyle={{fontSize:12}} /><Tooltip content={<DataTooltip />} /></PieChart>
      : kind === "scatter" ? <ScatterChart>{grid}<XAxis type="number" dataKey="x" name={x} domain={["auto","auto"]} stroke="#94a3b8" fontSize={12} />{yAxis}
        <Tooltip content={<DataTooltip />} /><Scatter data={data.map(d => ({x:Number(d.name),value:d.value}))} fill="#a78bfa" isAnimationActive={false} /></ScatterChart>
      : <ComposedChart data={data} margin={{top:5,right:20,left:0,bottom:8}}>{grid}
        <XAxis dataKey="name" minTickGap={26} tickFormatter={s => String(s).length > 16 ? String(s).slice(0,15)+"…" : String(s)} stroke="#94a3b8" fontSize={12} />
        {yAxis}<Tooltip content={<DataTooltip />} />
        {kind === "line" ? <Line dataKey="value" name={y} stroke="#a78bfa" strokeWidth={2} isAnimationActive={false} /> :
          kind === "area" ? <Area dataKey="value" name={y} fill="#8b5cf6" fillOpacity={0.28} stroke="#a78bfa" isAnimationActive={false} /> :
          <Bar dataKey="value" name={y} fill="#a78bfa" radius={[3,3,0,0]} isAnimationActive={false} />}
      </ComposedChart>}
    </ResponsiveContainer></div>
    <p className="text-center text-sm text-slate-300">{x}</p>
    <p className="mt-2 text-sm text-slate-400">{widget.aggregation === "none" ? "Individual values · first 400 valid rows at most" : kind === "histogram" ? "Counts by interval" : kind === "scatter" ? "Up to 400 valid pairs" :
      kind === "line" || kind === "area" ? "Up to 30 groups in X order" : "Up to 10 groups ranked by measure"}{widget.row_filter && " · Filter: " + [widget.row_filter.column, widget.row_filter.operator, widget.row_filter.value].join(" ")}</p>
  </figure>;
}
