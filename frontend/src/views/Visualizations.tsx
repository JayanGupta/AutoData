"use client";

import { useEffect, useRef, useState } from "react";
import { useDataset } from "../store/DatasetContext";
import { getAdvancedCharts, getDashboardMetrics } from "../api/client";
import { ChartFields, chartTitle, initialChart, WorksheetChart } from "../components/charts/WorksheetChart";
import { AdvancedChartCard } from "../components/charts/AdvancedChartCard";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FilterFields } from "../components/ui/FilterFields";
import type { AdvancedChartsPayload, AnalysisSnapshot, ChartSpec, DashboardWidget, RowFilter } from "../types";

export function VisualizationsPage({ onPin }: { onPin: (w: DashboardWidget) => void }) {
  const { snapshot } = useDataset();
  return snapshot && <ChartBuilder snapshot={snapshot} onPin={onPin} />;
}

function ChartBuilder({ snapshot, onPin }: { snapshot: AnalysisSnapshot; onPin: (w: DashboardWidget) => void }) {
  const [draft, setDraft] = useState(() => initialChart(snapshot.columns));
  const [filter, setFilter] = useState<RowFilter>({column:snapshot.columns[0].name, operator:"equals", value:""});
  const [filterOn, setFilterOn] = useState(false);
  const [result, setResult] = useState<{widget:DashboardWidget; data:{name:string;value:number}[]; rows:number} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function edit(next: DashboardWidget) {setDraft(next); setResult(null); setError("");}
  function suggest(spec: ChartSpec) {
    const x = spec.source_x || draft.x;
    edit({...initialChart(snapshot.columns), chart_type:spec.chart_type as DashboardWidget["chart_type"], x,
      y:spec.source_y || "", aggregation:spec.aggregation === "avg" ? "avg" : "sum", date_axis:snapshot.columns.some(c => c.name === x && c.inferred_type === "datetime")});
  }
  async function draw() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const widget = {...draft, row_filter:filterOn ? filter : undefined};
    setBusy(true); setError(""); setResult(null);
    try {
      const metrics = await getDashboardMetrics(snapshot.dataset.id, {
        widgets:[{...widget, row_filter:undefined}], search:"", category_column:"", category_value:"", row_filter:widget.row_filter,
      }, abort.signal);
      if (!abort.signal.aborted) setResult({widget, data:metrics.charts[widget.id] || [], rows:metrics.matched_rows});
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not create chart.");
    } finally {if (!abort.signal.aborted) setBusy(false);}
  }
  return <div className="space-y-5">
    <Card title="Chart builder">
      <form onSubmit={e => {e.preventDefault(); void draw();}}>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          {snapshot.charts.length > 0 && <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-400">Suggested for this dataset</span>
            {snapshot.charts.slice(0,2).map(s => <Button type="button" variant="outline" size="sm" key={s.id} onClick={() => suggest(s)}>{s.title}</Button>)}
          </div>}
          <ChartFields columns={snapshot.columns} widget={draft} onChange={edit} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-violet-500" checked={filterOn}
            onChange={e => {setFilterOn(e.target.checked); setResult(null);}} />Filter chart data</label>
          {filterOn && <FilterFields columns={snapshot.columns.map(c=>c.name)} filter={filter} onChange={f=>{setFilter(f);setResult(null);}} />}
          <Button type="submit" loading={busy}>Create chart</Button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    </Card>
    {result && <Card title={chartTitle(result.widget)} subtitle={result.rows.toLocaleString()+" matching rows"}
      action={result.data.length > 0 && <Button variant="outline" onClick={() => onPin(result.widget)}>Add to dashboard</Button>}>
      <WorksheetChart widget={result.widget} data={result.data} />
    </Card>}
    <AdvancedViews id={snapshot.dataset.id} />
  </div>;
}

function AdvancedViews({id}: {id:string}) {
  const [data,setData]=useState<AdvancedChartsPayload | null>(null);
  const [index,setIndex]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function open() {
    setBusy(true); setError("");
    try {setData(await getAdvancedCharts(id));}
    catch(cause) {setError(cause instanceof Error ? cause.message : "Could not load advanced charts.");}
    finally {setBusy(false);}
  }
  return <details className="panel p-5"><summary className="cursor-pointer font-medium">Advanced analysis</summary>
    <div className="mt-4 space-y-3">{!data ? <Button variant="secondary" loading={busy} onClick={() => void open()}>Load advanced views</Button>
      : !data.charts.length ? <p>No advanced views are available for these columns.</p> : <>
        <label><span className="field-label">Analysis</span><select className="field" value={index} onChange={e=>setIndex(Number(e.target.value))}>
          {data.charts.map((c,i)=><option key={i} value={i}>{c.title}</option>)}</select></label>
        <AdvancedChartCard chart={data.charts[index]} />
      </>}
      {error && <p role="alert" className="text-rose-300">{error}</p>}
    </div>
  </details>;
}
