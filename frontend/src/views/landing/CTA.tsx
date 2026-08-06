"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, UploadCloud } from "lucide-react";
import { AuroraBackground, ConicBorder, Magnetic, Particles } from "./primitives";
import { UploadButton } from "@/components/UploadButton";

export function CTA({
  onSample,
  loadingSample,
}: {
  onSample: () => void;
  loadingSample: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const rise = (delay: number) => ({
    initial: prefersReduced ? false : ({ opacity: 0, y: 24, filter: "blur(6px)" } as const),
    whileInView: prefersReduced ? undefined : ({ opacity: 1, y: 0, filter: "blur(0px)" } as const),
    viewport: { once: true } as const,
    transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  });

  return (
    <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <ConicBorder
        radius="rounded-[2.5rem]"
        className="overflow-hidden"
        innerClassName="rounded-[calc(2.5rem-1px)]"
      >
        <div className="relative overflow-hidden px-6 py-20 text-center sm:px-12 sm:py-24">
          <AuroraBackground variant="cta" />
          <Particles count={20} />
          <div aria-hidden className="absolute inset-0 bg-grid opacity-40" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-night-950/60 to-transparent" />

          <div className="relative mx-auto max-w-3xl">
            <motion.div {...rise(0.1)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                Free forever · Local-first
              </span>
            </motion.div>

            <motion.h2
              {...rise(0.2)}
              className="mt-8 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl"
            >
              Your data is waiting
              <br />
              to be <span className="text-gradient-animated">understood.</span>
            </motion.h2>

            <motion.p {...rise(0.3)} className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Upload a CSV or Excel file and see profiling, quality scoring, charts and AI answers in under ten seconds.
              No account, no upload to the cloud.
            </motion.p>

            <motion.div {...rise(0.4)} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Magnetic strength={0.22}>
                <UploadButton className="btn-primary px-8 py-4 text-[15px] font-semibold">
                  <UploadCloud className="h-4 w-4" />
                  Upload your data
                </UploadButton>
              </Magnetic>
              <Magnetic strength={0.22}>
                <button
                  type="button"
                  onClick={onSample}
                  disabled={loadingSample}
                  className="btn-ghost px-8 py-4 text-[15px] font-semibold"
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
            </motion.div>

            <motion.div {...rise(0.5)} className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-400" /> CSV · TSV · XLSX · XLS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-violet-400" /> Files up to 50 MB
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-cyan-400" /> Works without an API key
              </span>
            </motion.div>
          </div>
        </div>
      </ConicBorder>
    </section>
  );
}
