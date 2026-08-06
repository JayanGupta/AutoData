"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import type { ReactNode } from "react";
import { AuroraBackground, Magnetic, MouseGlow, Particles, cn } from "./primitives";
import { HeroDashboard } from "./HeroDashboard";
import { UploadButton } from "@/components/UploadButton";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function FloatingCard({
  children,
  className,
  delay = "0s",
}: {
  children: ReactNode;
  className?: string;
  delay?: string;
}) {
  return (
    <div
      className={cn("absolute z-20 hidden animate-float lg:block", className)}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

export function Hero({
  onSample,
  onResume,
  loadingSample,
}: {
  onSample: () => void;
  onResume: () => void;
  loadingSample: boolean;
}) {
  const prefersReduced = useReducedMotion();

  const fadeUp = {
    initial: { opacity: 0, y: 30, filter: "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.9, ease: EASE },
  };

  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade" />
      <AuroraBackground variant="hero" className="opacity-90" />
      <Particles count={30} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-night-950 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night-950 to-transparent" />

      <MouseGlow color="rgba(139, 92, 246, 0.13)" size={760} className="relative z-10 flex flex-1 flex-col items-center px-5 sm:px-8">
        <div className="flex flex-1 flex-col items-center justify-center pt-32 pb-10 text-center">
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }}>
            <a
              href="#analyst"
              className="group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 text-xs font-medium text-slate-300 backdrop-blur-md transition hover:border-violet-400/40 hover:bg-white/[0.07]"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <Sparkles className="h-3 w-3" />
                New
              </span>
              Local-first AI data analyst
              <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
            </a>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.4 }}
            className="mx-auto mt-8 max-w-5xl font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            Your data, finally
            <br />
            <span className="text-gradient-animated">understood.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.55 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            AutoData turns raw CSV and Excel files into clean datasets, honest quality scores, beautiful charts and
            answers you can act on — <span className="text-slate-200">entirely on your own machine.</span>
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.7 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Magnetic strength={0.2}>
              <UploadButton className="btn-primary px-7 py-3.5 text-sm font-semibold">
                <UploadCloud className="h-4 w-4" />
                Upload your data
              </UploadButton>
            </Magnetic>
            <Magnetic strength={0.2}>
              <button
                type="button"
                onClick={onSample}
                disabled={loadingSample}
                className="btn-gradient px-7 py-3.5 text-sm font-semibold"
              >
                {loadingSample ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Loading sample…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Try the sample dataset
                  </>
                )}
              </button>
            </Magnetic>
            <button type="button" onClick={onResume} className="text-xs font-medium text-slate-500 transition hover:text-white">
              or resume your last analysis →
            </button>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.82 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600"
          >
            <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-emerald-400" /> Free &amp; open source</span>
            <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-violet-400" /> No account needed</span>
            <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-cyan-400" /> CSV · Excel · TSV</span>
          </motion.div>
        </div>

        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 80, scale: 0.96 }}
          animate={prefersReduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.9, ease: EASE }}
          className="relative z-10 w-full max-w-5xl pb-16"
          style={{ perspective: 1400 }}
        >
          <div aria-hidden className="absolute -inset-x-16 -top-10 bottom-6 z-0 rounded-full bg-gradient-to-r from-violet-600/25 via-cyan-500/20 to-fuchsia-600/25 blur-3xl" />

          <FloatingCard className="right-[-14%] top-6 w-60" delay="-1.5s">
            <div className="glass rounded-2xl p-4 shadow-card-3d">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/40 to-fuchsia-500/20 text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs font-semibold text-white">AI Insight</p>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
                Q4 revenue is <span className="font-semibold text-emerald-400">+18.2%</span> vs forecast, driven by the
                West region.
              </p>
              <div className="mt-2.5 flex gap-1">
                {[35, 55, 45, 70, 60, 85].map((h, i) => (
                  <span key={i} className="w-1.5 rounded-full bg-gradient-to-t from-violet-500/40 to-cyan-400/70" style={{ height: `${h * 0.4}px` }} />
                ))}
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="left-[-13%] top-1/3 w-64" delay="-3s">
            <div className="glass-strong rounded-2xl p-4 shadow-card-3d">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/40 to-sky-500/20 text-cyan-300">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs font-semibold text-white">Analyst</p>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
                “Which region outperformed last quarter?”
              </p>
              <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-pulse-glow"
                    style={{ animationDelay: `${i * 0.25}s` }}
                  />
                ))}
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="bottom-4 right-[4%] w-56" delay="-2s">
            <div className="glass rounded-2xl p-4 shadow-card-3d">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/40 to-teal-500/20 text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">Quality</p>
                    <p className="text-[11px] font-bold text-emerald-400">92 / 100</p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{ width: "92%" }}
                      transition={{ duration: 1.2, delay: 1.6, ease: EASE }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </FloatingCard>

          <HeroDashboard />
        </motion.div>
      </MouseGlow>

      <motion.div
        aria-hidden
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={prefersReduced ? undefined : { opacity: 1 }}
        transition={{ delay: 2 }}
        className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2"
      >
        <div className="flex h-9 w-6 items-start justify-center rounded-full border border-white/15 p-1.5">
          <motion.span
            className="h-2 w-1 rounded-full bg-white/50"
            animate={prefersReduced ? undefined : { y: [0, 12, 0], opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
