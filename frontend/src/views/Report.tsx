import { useEffect, useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { getReport, getReportPdfUrl } from "../api/client";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function ReportPage() {
  const { snapshot } = useDataset();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = snapshot?.dataset.id ?? null;

  useEffect(() => {
    let active = true;
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    getReport(sessionId, "html")
      .then((res) => {
        if (!active) return;
        setHtml(res.content);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load report"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [sessionId]);

  const downloadPdf = () => {
    if (!sessionId) return;
    window.open(getReportPdfUrl(sessionId), "_blank");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-violet-300" /> Analysis report
          </h2>
          <p className="text-sm text-slate-500">
            A complete write-up of the overview, quality, insights and correlations — ready to share.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={downloadPdf} disabled={!sessionId}>
            <FileText className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-slate-500">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm">Assembling your report…</p>
        </div>
      ) : error ? (
        <EmptyState title="Could not generate the report" description={error} />
      ) : html ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <FileText className="h-3.5 w-3.5" /> Report preview
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
              A4 · Shareable
            </span>
          </div>
          <iframe title="Report preview" sandbox="" srcDoc={html} className="h-[70vh] w-full" />
        </div>
      ) : null}
    </div>
  );
}
