"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Download,
  FileText,
  FolderUp,
  Lightbulb,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getExportUrl, getReportPdfUrl } from "@/api/client";
import { formatTimestamp } from "@/lib/format";
import { useDataset } from "@/store/DatasetContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { OverviewPage } from "./Overview";
import { DataQualityPage } from "./DataQuality";
import { VisualizationsPage } from "./Visualizations";
import { AnalystPage } from "./Analyst";
import { InsightsPage } from "./Insights";
import { ReportPage } from "./Report";

type Section = "overview" | "quality" | "viz" | "analyst" | "insights" | "report";

const NAV: Array<{ key: Section; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "quality", label: "Quality", icon: ShieldCheck },
  { key: "viz", label: "Visualizations", icon: BarChart3 },
  { key: "analyst", label: "AI Analyst", icon: MessagesSquare },
  { key: "insights", label: "Insights", icon: Lightbulb },
  { key: "report", label: "Report", icon: FileText },
];

export function Dashboard() {
  const { snapshot, clear } = useDataset();
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);

  if (!snapshot) return null;
  const ds = snapshot.dataset;
  const qualityScore = snapshot.quality.summary.quality_score;

  const handleNew = () => {
    clear();
    router.push("/");
  };

  const handleAsk = (question: string) => {
    setPendingQuestion(question);
    setSection("analyst");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-brand-600/10 px-4 py-2 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                <Sparkles className="h-4 w-4" />
                Analytics workspace ready
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Active dataset</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{ds.name}</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {ds.rows.toLocaleString()} rows · {ds.columns} columns · {snapshot.quality.summary.quality_score} quality score
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" size="md" onClick={() => setSection("insights")}>View insights</Button>
                  <Button variant="outline" size="md" onClick={handleNew}><FolderUp className="h-4 w-4" /> New dataset</Button>
                </div>              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="rounded-3xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Rows</p>
                <p className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">{ds.rows.toLocaleString()}</p>
              </Card>
              <Card className="rounded-3xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Columns</p>
                <p className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">{ds.columns}</p>
              </Card>
              <Card className="rounded-3xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Quality score</p>
                <p className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">{qualityScore}</p>
              </Card>
            </div>
          </div>

          <nav className="grid gap-2 overflow-x-auto px-1 pb-1 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-6">
            {NAV.map((item) => {
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={`inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "border-brand-600 bg-brand-600/10 text-brand-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-600">Dashboard</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">Your analytics workspace</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Navigate your data with confidence, explore the latest quality signals, and ask the analyst anything.
                  </p>
                </div>
                <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-4 py-3 text-sm text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                  <Sparkles className="h-5 w-5 text-brand-600" />
                  Ready for the next insight.
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {section === "overview" && <OverviewPage />}
              {section === "quality" && <DataQualityPage />}
              {section === "viz" && <VisualizationsPage />}
              {section === "analyst" && <AnalystPage pendingQuestion={pendingQuestion} onConsumed={() => setPendingQuestion(null)} />}
              {section === "insights" && <InsightsPage onAsk={handleAsk} />}
              {section === "report" && <ReportPage />}
            </div>
          </section>

          <aside className="space-y-6">
            <Card title="Quick actions" className="rounded-[1.75rem] border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95">
              <div className="space-y-3">
                <Button variant="primary" size="md" onClick={() => setSection("analyst")}>Ask the AI analyst</Button>
                <Button variant="outline" size="md" onClick={() => setSection("report")}>Review report</Button>
              </div>
            </Card>

            <Card title="Export" className="rounded-[1.75rem] border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
              <p className="mb-3 text-xs text-slate-500">Download the current (cleaned) dataset or a shareable PDF report.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button size="sm" variant="outline" onClick={() => { window.open(getExportUrl(ds.id, "csv"), "_blank"); }}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => { window.open(getExportUrl(ds.id, "xlsx"), "_blank"); }}>
                  <Download className="h-4 w-4" /> XLSX
                </Button>
                <Button size="sm" variant="outline" className="col-span-2" onClick={() => { window.open(getReportPdfUrl(ds.id), "_blank"); }}>
                  <FileText className="h-4 w-4" /> Download PDF report
                </Button>
              </div>
            </Card>

            <Card title="Dataset details" className="rounded-[1.75rem] border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
              <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Uploaded</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatTimestamp(ds.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Format</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{(ds.name.split(".").pop() ?? "").toUpperCase() || "CSV"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Analysis</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Complete</span>
                </div>
              </div>
            </Card>

            <Card title="Analysis status" className="rounded-[1.75rem] border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/95">
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
                  <span>Quality score</span>
                  <span className="font-semibold">{qualityScore}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
                  <span>Columns</span>
                  <span className="font-semibold">{ds.columns}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950">
                  <span>Rows</span>
                  <span className="font-semibold">{ds.rows.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
