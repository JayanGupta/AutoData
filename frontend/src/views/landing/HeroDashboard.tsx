"use client";

import { Activity, BarChart3, Bot, LayoutDashboard, Settings, Sparkles, Table2, Users } from "lucide-react";
import { AnimatedCounter } from "./primitives";
import { AreaChart, BarChart, DonutChart } from "./charts";

const AREA_DATA = [
  { x: 0, y: 22 }, { x: 1, y: 34 }, { x: 2, y: 28 }, { x: 3, y: 48 }, { x: 4, y: 42 },
  { x: 5, y: 58 }, { x: 6, y: 52 }, { x: 7, y: 71 }, { x: 8, y: 64 }, { x: 9, y: 78 },
  { x: 10, y: 74 }, { x: 11, y: 92 }, { x: 12, y: 84 },
];

const BARS = [42, 58, 47, 66, 54, 78, 61, 88, 72];

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
    </div>
  );
}

export function HeroDashboard() {
  return (
    <div className="relative rounded-[1.6rem] border border-white/10 bg-night-900/90 shadow-card-3d backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
        <TrafficLights />
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          autodata.local / sales_q4.csv
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-violet-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 animate-ping-soft" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
          </span>
          Live
        </span>
      </div>

      <div className="flex">
        <div className="hidden flex-col items-center gap-1 border-r border-white/[0.07] px-2.5 py-4 sm:flex">
          {[LayoutDashboard, Activity, Table2, BarChart3, Users, Bot, Settings].map((Icon, i) => (
            <span
              key={i}
              className={
                i === 0
                  ? "mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/20 text-violet-300 ring-1 ring-violet-400/30"
                  : "flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:text-slate-300"
              }
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </div>

        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sales overview</p>
              <p className="mt-1 font-display text-lg font-semibold text-white">Q4 performance</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-400">
              <Sparkles className="h-3 w-3 text-violet-300" />
              AI profiled in 1.4s
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              {
                label: "Revenue",
                value: <AnimatedCounter value={1.24} decimals={2} prefix="$" suffix="M" />,
                delta: "+18.2%",
                up: true,
              },
              {
                label: "Orders",
                value: <AnimatedCounter value={8431} />,
                delta: "+9.4%",
                up: true,
              },
              {
                label: "Conversion",
                value: <AnimatedCounter value={3.8} decimals={1} suffix="%" />,
                delta: "-0.6%",
                up: false,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{kpi.label}</p>
                <p className="mt-1 font-display text-base font-semibold text-white sm:text-lg">{kpi.value}</p>
                <p className={`mt-0.5 text-[10px] font-semibold ${kpi.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {kpi.delta}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Revenue by month</p>
                <span className="chip">+18.2%</span>
              </div>
              <AreaChart data={AREA_DATA} width={420} height={150} className="w-full" stroke="#a78bfa" fillTo="#60a5fa" />
              <div className="mt-1 flex justify-between px-1 text-[9px] text-slate-600">
                <span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Nov</span><span>Dec</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                <DonutChart value={92} size={74} stroke={8} color="#34d399">
                  <div className="text-center">
                    <p className="font-display text-sm font-bold text-white">92</p>
                  </div>
                </DonutChart>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quality score</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                    Missing values<br />and duplicates fixed
                  </p>
                </div>
              </div>
              <div className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top regions</p>
                <BarChart values={BARS} width={260} height={64} from="#22d3ee" to="#6366f1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
