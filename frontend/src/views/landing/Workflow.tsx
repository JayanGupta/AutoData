"use client";

import { ArrowRight } from "lucide-react";
import { SectionLabel, Stagger, StaggerItem, cn } from "./primitives";
import { WORKFLOW_STEPS } from "./constants";

export function Workflow() {
  return (
    <section id="workflow" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionLabel>Workflow</SectionLabel>
          <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
            From raw dataset
            <br />
            to <span className="text-gradient-animated">real decision</span>
            <br />
            in minutes.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-400">
            No formulas, no training, no spreadsheet gymnastics. A calm, guided pipeline that turns messy files into
            confident answers.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping-soft" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-white">Typical flow:</span> 4 minutes from upload to exported report
            </p>
          </div>
        </div>

        <Stagger className="relative" gap={0.14}>
          <div aria-hidden className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/60 via-cyan-500/40 to-rose-500/40" />
          <div className="space-y-5">
            {WORKFLOW_STEPS.map((step) => (
              <StaggerItem key={step.n}>
                <div className="group relative flex gap-5 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur-md transition-all duration-500 hover:border-white/[0.16] hover:bg-white/[0.05]">
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center">
                    <span className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-80 blur-[6px] transition-opacity duration-500 group-hover:opacity-100", step.color)} />
                    <span className={cn("relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", step.color)}>
                      <step.icon className="h-6 w-6" />
                    </span>
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-night-950 text-[10px] font-bold text-white ring-1 ring-white/20">
                      {step.n}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold tracking-tight text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
                  </div>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-2 bottom-0 select-none font-display text-[5.5rem] font-bold leading-none text-white/[0.03] transition-colors duration-500 group-hover:text-white/[0.06]"
                  >
                    {step.n}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      </div>

      <div className="mt-16 flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/[0.08] bg-gradient-to-r from-violet-500/10 via-white/[0.03] to-cyan-500/10 px-6 py-8 text-center sm:flex-row sm:text-left">
        <p className="font-display text-lg font-semibold text-white">
          Ready to watch it happen with your own numbers?
        </p>
        <a
          href="#report"
          className="btn-ghost ml-0 shrink-0 px-5 py-2.5 text-sm font-semibold sm:ml-4"
        >
          Explore the report pipeline
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
