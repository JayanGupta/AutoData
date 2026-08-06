import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useDataset } from "../store/DatasetContext";
import { getReport } from "../api/client";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import jsPDF from "jspdf";

export function ReportPage() {
  const { snapshot } = useDataset();
  const [html, setHtml] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const sessionId = snapshot?.dataset.id ?? null;
  const fileName = (snapshot?.dataset.name ?? "dataset").replace(/\.[^.]+$/, "");

  useEffect(() => {
    let active = true;
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    getReport(sessionId, "html")
      .then((res) => {
        if (!active) return;
        setHtml(res.content);
        setMarkdown(res.markdown);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load report"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [sessionId]);

  const downloadPdf = () => {
    if (!markdown) return;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const lines = markdown.split("\n");
    let y = 40;
    doc.setFontSize(11);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 520);
      wrapped.forEach((text: string) => {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        doc.text(text, 40, y);
        y += 16;
      });
    });
    doc.save(`${fileName}-report.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileText className="h-5 w-5 text-brand-600" /> Analysis report
          </h2>
          <p className="text-sm text-slate-500">
            A complete write-up of the overview, quality, insights and correlations — ready to share.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={downloadPdf} disabled={!markdown}>
            <FileText className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 text-slate-500">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-brand-600" />
          <p className="text-sm">Assembling your report…</p>
        </div>
      ) : error ? (
        <EmptyState title="Could not generate the report" description={error} />
      ) : html ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <iframe title="Report preview" sandbox="" srcDoc={html} className="h-[70vh] w-full" />
        </div>
      ) : null}
    </div>
  );
}
