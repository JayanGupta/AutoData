"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getExecutiveSummary } from "../api/client";
import { useDataset } from "../store/DatasetContext";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Button";
import { cn } from "../views/landing/primitives";
import type { ExecutiveSummary } from "../types";

const TONE_COLORS: Record<string, { ring: string; text: string; chip: string }> = {
  good: { ring: "border-emerald-500/30", text: "text-emerald-300", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" },
  warn: { ring: "border-amber-500/30", text: "text-amber-300", chip: "border-amber-500/25 bg-amber-500/10 text-amber-200" },
  bad: { ring: "border-rose-500/30", text: "text-rose-300", chip: "border-rose-500/25 bg-rose-500/10 text-rose-200" },
  neutral: { ring: "border-white/15", text: "text-slate-200", chip: "border-white/10 bg-white/[0.05] text-slate-200" },
};

export function ExecutiveSummaryPanel() {
  const { snapshot } = useDataset();
  const [data, setData] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionId = snapshot?.dataset.id ?? null;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    getExecutiveSummary(sessionId)
      .then((res) => mounted.current && setData(res))
      .catch((e) => mounted.current && setError(e instanceof Error ? e.message : "Could not generate executive summary"))
      .finally(() => mounted.current && setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <Card title="Executive summary" subtitle="Decision-ready analytics for this dataset">
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Spinner className="mb-3 h-7 w-7 text-violet-400" />
          <p className="text-sm">Reading the data like an executive…</p>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card title="Executive summary">
        <p className="text-sm text-rose-300">{error ?? "Could not generate the executive summary."}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" /> Executive summary
          </span>
        }
        subtitle="A decision-ready read of what's in this dataset"
      >
        <p className="text-sm leading-relaxed text-slate-300">{data.overview}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {data.kpis.map((kpi, i) => {
            const tone = TONE_COLORS[kpi.tone] ?? TONE_COLORS.neutral;
            return (
              <div
                key={i}
                className={cn("rounded-2xl border bg-white/[0.03] p-3.5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.05]", tone.ring)}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
                <p className={cn("mt-1.5 font-display text-2xl font-bold tracking-tight", tone.text)}>
                  {kpi.value}
                  {kpi.suffix && <span className="text-sm font-medium opacity-80">{kpi.suffix}</span>}
                </p>
                <p className="mt-1 truncate text-[10px] text-slate-500" title={kpi.hint}>
                  {kpi.hint}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {(data.key_takeaways?.length > 0 || data.correlation_highlights?.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.key_takeaways?.length > 0 && (
            <Card title="Key takeaways" subtitle="What the patterns say at a glance">
              <ul className="space-y-3">
                {data.key_takeaways.slice(0, 4).map((t, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 font-mono text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{t.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.correlation_highlights?.length > 0 && (
            <Card title="Strong relationships" subtitle="Statistically meaningful correlations">
              <ul className="space-y-3">
                {data.correlation_highlights.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                        c.correlation > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
                      )}
                    >
                      {c.correlation > 0 ? "↗" : "↘"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{c.message}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge className="border-white/10 bg-white/[0.05] font-mono text-slate-300">{c.col_a}</Badge>
                        <Badge className="border-white/10 bg-white/[0.05] font-mono text-slate-300">{c.col_b}</Badge>
                        <span className="ml-auto font-mono text-xs text-cyan-200">{c.correlation >= 0 ? "+" : ""}{c.correlation.toFixed(2)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.anomaly_flags?.length > 0 && (
          <Card title="Needs attention" subtitle="High & medium priority flags">
            <ul className="space-y-2.5">
              {data.anomaly_flags.slice(0, 4).map((flag, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3",
                    flag.severity === "high" ? "border-rose-500/25 bg-rose-500/[0.06]" : "border-amber-500/25 bg-amber-500/[0.05]",
                  )}
                >
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", flag.severity === "high" ? "text-rose-400" : "text-amber-400")} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn(flag.severity === "high" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200", "uppercase tracking-wide")}>
                        {flag.severity_label}
                      </Badge>
                      {flag.column && <Badge className="border-white/10 bg-white/[0.05] font-mono text-slate-300">{flag.column}</Badge>}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{flag.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {data.recommendations?.length > 0 && (
          <Card title="Recommended next steps" subtitle="Actions derived from the data">
            <ul className="space-y-2.5">
              {data.recommendations.slice(0, 4).map((rec, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 font-mono text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {rec.action}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{rec.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {data.suggested_next?.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-300" /> Suggested next analyses
            </span>
          }
          subtitle="Where to dig in next"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {data.suggested_next.slice(0, 4).map((s, i) => (
              <div key={i} className="group flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all duration-300 hover:border-violet-400/30 hover:bg-white/[0.05]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-300 ring-1 ring-white/10">
                  <Lightbulb className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{s.description}</p>
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium capitalize text-violet-300">
                    {s.chart} chart <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
