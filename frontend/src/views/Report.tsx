import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Download, FileText, Loader2, Sparkles } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { downloadReportPdf, getReport } from "../api/client";
import { useToast } from "../store/ToastContext";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { cn } from "./landing/primitives";
import type { ReportResult } from "../types";

type Tab = "preview" | "markdown";

const SECTIONS: Record<string, string> = {
  summary: "Executive summary", quality: "Data quality", charts: "Charts",
  overview: "Dataset overview", columns: "Column profiles", insights: "Key insights", correlations: "Correlations",
};

export function ReportPage() {
  const { snapshot } = useDataset();
  const [report, setReport] = useState<ReportResult | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [order, setOrder] = useState(Object.keys(SECTIONS));
  const [selected, setSelected] = useState(["summary", "quality", "charts"]);
  const { error: toastError } = useToast();

  const sessionId = snapshot?.dataset.id ?? null;
  const baseName = snapshot?.dataset.name.replace(/\.[^.]+$/, "") || "report";

  const outline = order.filter(key => selected.includes(key));
  const generate = async () => {
    if (!snapshot || !outline.length) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      setReport(await getReport(snapshot.dataset.id, "html", undefined, outline, snapshot.revision));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build the preview.");
    } finally {
      setLoading(false);
    }
  };

  function move(index: number, offset: number) {
    const next = [...order];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setOrder(next);
    setReport(null);
  }

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPdf = async () => {
    if (!sessionId || !report || pdfLoading) return;
    setPdfLoading(true);
    try {
      const pdf = await downloadReportPdf(sessionId, report.revision, outline);
      download(pdf, `${baseName}-report.pdf`);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not download the PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-violet-300" /> Analysis report
          </h2>
          <p className="text-sm text-slate-500">
            Choose what to include, arrange the sections, then preview your report.
          </p>
        </div>
        {report && <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={!report}
            onClick={() => report && download(new Blob([report.markdown], { type: "text/markdown" }), `${baseName}-report.md`)}
          >
            <Download className="h-4 w-4" /> Markdown
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!report}
            onClick={() => report && download(new Blob([report.content], { type: "text/html" }), `${baseName}-report.html`)}
          >
            <Download className="h-4 w-4" /> HTML
          </Button>
          <Button size="sm" onClick={() => void exportPdf()} disabled={!report || loading} loading={pdfLoading}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>}
      </div>
      <fieldset disabled={loading || pdfLoading} className="panel space-y-3 p-5">
        <legend className="sr-only">Report outline</legend>
        <h3 className="panel-title">Report outline</h3>
        <p className="text-sm text-slate-400">{outline.length ? outline.map(key => SECTIONS[key]).join(" → ") : "Select a section to start."}</p>
        <ol className="divide-y divide-white/10">{order.map((key, index) => (
          <li key={key} className="flex items-center gap-2 py-2">
            <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={selected.includes(key)} className="accent-violet-500" onChange={e => {
                setSelected(e.target.checked ? [...selected, key] : selected.filter(item => item !== key));
                setReport(null); setError(null);
              }} />{SECTIONS[key]}
            </label>
            <Button variant="ghost" size="sm" aria-label={`Move ${SECTIONS[key]} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></Button>
            <Button variant="ghost" size="sm" aria-label={`Move ${SECTIONS[key]} down`} disabled={index === order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></Button>
          </li>
        ))}</ol>
        <Button onClick={() => void generate()} disabled={!outline.length} loading={loading}>Generate preview</Button>
      </fieldset>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-slate-500">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm">Assembling your report…</p>
        </div>
      ) : error ? (
        <EmptyState title="Could not generate the report" description={error} actionLabel="Retry" onAction={() => void generate()} />
      ) : report ? (
        <>
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
            {(["preview", "markdown"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 rounded-xl px-4 py-2 text-sm font-medium capitalize transition-all",
                  tab === t
                    ? "bg-gradient-to-r from-violet-500/25 to-cyan-500/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {t === "preview" ? "Preview" : "Markdown"}
              </button>
            ))}
          </div>

          {tab === "preview" ? (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <FileText className="h-3.5 w-3.5" /> Report preview
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                  {outline.length} sections
                </span>
              </div>
              <iframe title="Report preview" sandbox="" srcDoc={report.content} className="h-[72vh] w-full" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/80">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <FileText className="h-3.5 w-3.5" /> report.md
                </span>
                <button
                  onClick={copyMarkdown}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-violet-400/40 hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="max-h-[72vh] overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-xs leading-relaxed text-slate-300">
                {report.markdown}
              </pre>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
