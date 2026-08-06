"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  FileDown,
  FileSpreadsheet,
  FileText,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedCounter, SectionHeading, Stagger, StaggerItem, cn } from "./primitives";
import { FEATURE_CELLS } from "./constants";
import { BarChart, DonutChart } from "./charts";

/* ------------------------------------------------------------------ */
/*  Mini illustrations per cell                                        */
/* ------------------------------------------------------------------ */

function ChatMini() {
  return (
    <div className="mt-6 space-y-2.5">
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="flex justify-start"
      >
        <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-300">
          How does weekday vs weekend traffic compare?
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.45 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-violet-400/25 bg-gradient-to-br from-violet-500/20 to-cyan-500/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-200">
          Weekend conversion runs <span className="font-semibold text-cyan-300">22% higher</span>, driven by mobile
          sessions in the West region. Here’s the split:
          <div className="mt-2 flex items-end gap-1.5">
            {[46, 58, 44, 72, 64, 88].map((h, i) => (
              <span key={i} className="w-2 rounded-t bg-gradient-to-t from-violet-500/50 to-cyan-400/80" style={{ height: `${h * 0.55}px` }} />
            ))}
          </div>
        </div>
      </motion.div>
      <div className="flex justify-start">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse-glow" style={{ animationDelay: `${i * 0.28}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityMini() {
  return (
    <div className="mt-6 flex items-center gap-5">
      <DonutChart value={82} size={96} stroke={9} color="#34d399" delay={0.25}>
        <div className="text-center">
          <p className="font-display text-lg font-bold text-white">82</p>
          <p className="text-[8px] uppercase tracking-widest text-slate-500">score</p>
        </div>
      </DonutChart>
      <div className="flex-1 space-y-2.5">
        {[
          { label: "Missing values filled", sub: "4 columns", show: true },
          { label: "Duplicates merged", sub: "2 rows", show: true },
          { label: "Outliers flagged", sub: "3 rows", show: false },
        ].map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, x: 14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 + i * 0.12 }}
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                row.show ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/15 text-amber-400",
              )}
            >
              {row.show ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-slate-200">{row.label}</p>
              <p className="text-[9px] text-slate-500">{row.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProfilingMini() {
  const rows = [
    { col: "order_id", type: "id", cls: "bg-violet-500/15 text-violet-300" },
    { col: "order_date", type: "date", cls: "bg-sky-500/15 text-sky-300" },
    { col: "revenue", type: "number", cls: "bg-emerald-500/15 text-emerald-300" },
    { col: "customer_email", type: "PII", cls: "bg-rose-500/15 text-rose-300" },
  ];
  return (
    <div className="mt-6 space-y-1.5">
      {rows.map((row, i) => (
        <motion.div
          key={row.col}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.09 }}
          className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
        >
          <span className="font-mono text-[10px] text-slate-300">{row.col}</span>
          <span className={cn("rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", row.cls)}>
            {row.type}
          </span>
        </motion.div>
      ))}
      <div className="pt-1 text-[10px] text-slate-500">
        Typed &amp; profiled in <span className="font-semibold text-slate-300">1.2s</span>
      </div>
    </div>
  );
}

function VizMini() {
  return (
    <div className="mt-6">
      <BarChart values={[40, 62, 48, 74, 56, 82, 68]} width={300} height={86} from="#22d3ee" to="#6366f1" delay={0.2} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Histogram", "Time series", "Heatmap", "Scatter"].map((t) => (
          <span key={t} className="chip text-slate-400">{t}</span>
        ))}
      </div>
    </div>
  );
}

function PrivacyMini() {
  return (
    <div className="relative mt-6 flex flex-col items-center py-2">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/30 blur-xl animate-pulse-glow" />
        <span className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-spin-slow" />
        <span className="absolute -inset-3 rounded-full border border-white/[0.06]" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 text-violet-200 ring-1 ring-white/10">
          <Lock className="h-6 w-6" />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {["No cloud", "Local SQLite", "PII redacted", "No account"].map((t) => (
          <span key={t} className="chip">
            {t === "PII redacted" ? <ShieldCheck className="h-3 w-3 text-emerald-400" /> : null}
            <span className="text-slate-300">{t}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportMini() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        <div className="flex -space-x-2">
          {[FileSpreadsheet, FileText, FileText, FileDown].map((Icon, i) => (
            <span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-night-800 text-slate-300"
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Export anything</p>
          <p className="text-[11px] text-slate-500">CSV · XLSX · Markdown · HTML · PDF</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500/80" />
            <span className="h-2 w-2 rounded-full bg-amber-500/80" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[9px] font-medium uppercase tracking-widest text-slate-500">report.pdf</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2 w-3/4 rounded-full bg-white/20" />
          <div className="h-1.5 w-1/2 rounded-full bg-white/10" />
          <div className="mt-2 flex items-end gap-1">
            {[30, 52, 40, 62, 48, 74].map((h, i) => (
              <span key={i} className="w-2.5 rounded-t bg-gradient-to-t from-violet-500/50 to-cyan-400/80" style={{ height: `${h * 0.5}px` }} />
            ))}
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <Check className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] text-slate-500">PII auto-redacted · quality summary included</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const ILLUSTRATIONS: Record<string, () => ReactNode> = {
  analyst: ChatMini,
  quality: QualityMini,
  profiling: ProfilingMini,
  viz: VizMini,
  privacy: PrivacyMini,
  report: ReportMini,
};

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
      <SectionHeading
        label="Features"
        title={
          <>
            Everything your data needs,
            <br />
            <span className="text-gradient-animated">one beautiful workspace.</span>
          </>
        }
        sub="Profiling, quality scoring, guided cleaning, visual exploration and an AI analyst — a complete pipeline that feels effortless."
      />

      <Stagger className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-12" gap={0.08}>
        {FEATURE_CELLS.map((cell) => {
          const Illustration = ILLUSTRATIONS[cell.id];
          return (
            <StaggerItem key={cell.id} className={cell.span}>
              <div className="group card-glow glass relative h-full overflow-hidden rounded-3xl p-6 transition-all duration-500 hover:-translate-y-1.5 sm:p-7">
                <div aria-hidden className={cn("pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br", cell.accent)} />
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/[0.05] blur-2xl transition-transform duration-700 group-hover:scale-150" />

                <div className="relative flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                    <cell.icon className={cn("h-5 w-5", cell.iconColor)} />
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-500 opacity-0 transition-all duration-300 group-hover:border-violet-400/40 group-hover:text-violet-300 group-hover:opacity-100">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>

                <h3 className="relative mt-5 font-display text-xl font-semibold tracking-tight text-white">{cell.title}</h3>
                <p className="relative mt-2.5 text-sm leading-relaxed text-slate-400">{cell.desc}</p>

                <div className="relative">{Illustration ? <Illustration /> : null}</div>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>

      <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { value: 50, suffix: " MB", label: "max file upload" },
          { value: 11, suffix: "", label: "cleaning operations" },
          { value: 6, suffix: "", label: "chart types" },
          { value: 100, suffix: "%", label: "local & private" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl px-5 py-6 text-center">
            <p className="font-display text-3xl font-bold text-white">
              <AnimatedCounter value={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
