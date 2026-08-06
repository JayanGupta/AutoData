"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, BarChart3, Download, FileText, FolderUp, Lightbulb, MessagesSquare, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getExportUrl, getReportPdfUrl } from "@/api/client";
import { useDataset } from "@/store/DatasetContext";
import { BrandMark } from "./landing/Navbar";
import { cn } from "./landing/primitives";
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
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!snapshot) return null;
  const ds = snapshot.dataset;
  const qualityScore = snapshot.quality.summary.quality_score;
  const qTone = qualityScore >= 80 ? "text-emerald-300" : qualityScore >= 60 ? "text-amber-300" : "text-rose-300";

  const handleNew = () => {
    clear();
    router.push("/");
  };

  const handleAsk = (question: string) => {
    setPendingQuestion(question);
    setSection("analyst");
  };

  return (
    <div className="relative min-h-screen bg-night-950 text-slate-100 antialiased">
      <Ambient />
      <div className="relative lg:flex">
        <Sidebar
          section={section}
          onSection={setSection}
          onNew={handleNew}
          onExportCsv={() => window.open(getExportUrl(ds.id, "csv"), "_blank")}
          onExportXlsx={() => window.open(getExportUrl(ds.id, "xlsx"), "_blank")}
          onExportPdf={() => window.open(getReportPdfUrl(ds.id), "_blank")}
        />
        <main className="min-w-0 flex-1">
          <Topbar
            datasetName={ds.name}
            rows={ds.rows}
            columns={ds.columns}
            quality={qualityScore}
            qTone={qTone}
            onNew={handleNew}
            onExportCsv={() => window.open(getExportUrl(ds.id, "csv"), "_blank")}
            onExportXlsx={() => window.open(getExportUrl(ds.id, "xlsx"), "_blank")}
            onExportPdf={() => window.open(getReportPdfUrl(ds.id), "_blank")}
            exportOpen={exportOpen}
            setExportOpen={setExportOpen}
            exportRef={exportRef}
          />
          <MobileNav section={section} onSection={setSection} />

          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-[72rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
            >
              {section === "overview" && <OverviewPage />}
              {section === "quality" && <DataQualityPage />}
              {section === "viz" && <VisualizationsPage />}
              {section === "analyst" && <AnalystPage pendingQuestion={pendingQuestion} onConsumed={() => setPendingQuestion(null)} />}
              {section === "insights" && <InsightsPage onAsk={handleAsk} />}
              {section === "report" && <ReportPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="absolute -top-40 left-1/4 h-[30rem] w-[30rem] rounded-full bg-violet-600/20 blur-[130px] animate-blob" />
      <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-cyan-500/15 blur-[120px] animate-blob-alt" />
      <div className="absolute bottom-0 left-0 h-[22rem] w-[22rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
    </div>
  );
}

function Sidebar({
  section,
  onSection,
  onNew,
  onExportCsv,
  onExportXlsx,
  onExportPdf,
}: {
  section: Section;
  onSection: (s: Section) => void;
  onNew: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
}) {
  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-night-950/60 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <BrandMark />
        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-semibold tracking-tight text-white">AutoData</span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Analytics</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
        {NAV.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSection(item.key)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                active
                  ? "bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
              )}
            >
              {active && (
                <motion.span
                  layoutId="dash-nav-glow"
                  className="absolute inset-0 -z-0 rounded-2xl bg-gradient-to-r from-violet-500/20 to-cyan-500/10"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <item.icon className={cn("relative z-10 h-[18px] w-[18px] transition-colors", active ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300")} />
              <span className="relative z-10">{item.label}</span>
              {active && <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Export dataset</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ExportLink label="CSV" onClick={onExportCsv} />
            <ExportLink label="XLSX" onClick={onExportXlsx} />
          </div>
          <button
            onClick={onExportPdf}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-violet-400/40 hover:bg-white/[0.08] hover:text-white"
          >
            <FileText className="h-3.5 w-3.5" /> PDF report
          </button>
        </div>
        <button
          onClick={onNew}
          className="btn-gradient w-full px-4 py-2.5 text-sm font-semibold"
        >
          <FolderUp className="h-4 w-4" />
          New dataset
        </button>
      </div>
    </aside>
  );
}

function ExportLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-violet-400/40 hover:bg-white/[0.08] hover:text-white"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Topbar({
  datasetName,
  rows,
  columns,
  quality,
  qTone,
  onNew,
  onExportCsv,
  onExportXlsx,
  onExportPdf,
  exportOpen,
  setExportOpen,
  exportRef,
}: {
  datasetName: string;
  rows: number;
  columns: number;
  quality: number;
  qTone: string;
  onNew: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  exportRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-night-950/70 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight text-white">{datasetName}</h1>
            <span className={cn("rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider", qTone)}>
              {quality}/100
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {rows.toLocaleString()} rows · {columns} columns · uploaded via AutoData
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="btn-ghost px-3.5 py-2 text-sm"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <AnimatePresence>
              {exportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-night-800 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
                >
                  <MenuItem label="Download CSV" icon={Download} onClick={onExportCsv} />
                  <MenuItem label="Download XLSX" icon={Download} onClick={onExportXlsx} />
                  <MenuItem label="Download PDF report" icon={FileText} onClick={onExportPdf} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={onNew} className="btn-gradient px-3.5 py-2 text-sm font-semibold">
            <FolderUp className="h-4 w-4" /> New dataset
          </button>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ label, icon: Icon, onClick }: { label: string; icon: typeof Download; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <Icon className="h-4 w-4 text-slate-500" /> {label}
    </button>
  );
}

function MobileNav({ section, onSection }: { section: Section; onSection: (s: Section) => void }) {
  return (
    <nav className="sticky top-[61px] z-20 flex gap-1.5 overflow-x-auto border-b border-white/[0.05] bg-night-950/70 px-4 py-2.5 backdrop-blur-xl lg:hidden">
      {NAV.map((item) => {
        const active = section === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onSection(item.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              active ? "bg-gradient-to-r from-violet-500/30 to-cyan-500/20 text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
