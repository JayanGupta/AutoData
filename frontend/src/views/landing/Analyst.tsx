"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, Check, Cpu, Database, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionLabel, cn } from "./primitives";
import { ANALYST_SUGGESTIONS } from "./constants";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
  chart?: number[];
  sources?: string[];
}

const SCRIPT: Message[] = [
  {
    id: 1,
    role: "user",
    text: "What drove the revenue spike in March?",
  },
  {
    id: 2,
    role: "ai",
    text: "A March promotion lifted premium conversions by 34%, mostly in the West region. Here’s the weekly lift:",
    chart: [38, 52, 47, 66, 74, 88],
  },
  {
    id: 3,
    role: "user",
    text: "Should I trust these numbers?",
  },
  {
    id: 4,
    role: "ai",
    text: "Yes — this answer is computed from 100% of your 8,431 rows, not sampled or invented.",
    sources: ["orders.csv · 8,431 rows", "promotions_q1 · 4 rows"],
  },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-violet-300/70 animate-pulse-glow"
          style={{ animationDelay: `${i * 0.22}s` }}
        />
      ))}
    </div>
  );
}

function MessageRow({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[86%] rounded-2xl px-4 py-3 text-[12.5px] leading-relaxed",
          isUser
            ? "rounded-br-md border border-white/10 bg-white/[0.08] text-slate-200"
            : "rounded-bl-md border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-cyan-500/[0.07] text-slate-200",
        )}
      >
        {!isUser ? (
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
            AutoData · grounded in your data
          </p>
        ) : null}
        <p>{msg.text}</p>
        {msg.chart ? (
          <div className="mt-3 flex items-end gap-1.5 rounded-xl bg-night-950/50 p-3">
            {msg.chart.map((h, i) => (
              <motion.span
                key={i}
                className="w-2.5 rounded-t bg-gradient-to-t from-violet-500/60 to-cyan-400/90"
                initial={{ height: 0 }}
                animate={{ height: `${h * 0.5}px` }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: EASE }}
              />
            ))}
          </div>
        ) : null}
        {msg.sources ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {msg.sources.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-lg border border-white/10 bg-night-950/50 px-2 py-1 text-[10px] text-slate-400">
                <Database className="h-3 w-3 text-emerald-400" />
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export function Analyst() {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(2);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (prefersReduced) {
      setVisible(SCRIPT.length);
      return;
    }
    setVisible(2);
    let alive = true;
    let i = 2;
    const tick = () => {
      if (!alive) return;
      setTyping(true);
      setTimeout(() => {
        if (!alive) return;
        setTyping(false);
        i += 2;
        if (i > SCRIPT.length) i = 2;
        setVisible(i);
        setTimeout(tick, 3200);
      }, 1400);
    };
    const t = setTimeout(tick, 4200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [prefersReduced]);

  const suggestions = useMemo(() => ANALYST_SUGGESTIONS, []);
  const shown = SCRIPT.slice(0, visible);

  return (
    <section id="analyst" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/10 blur-[130px]" />

      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionLabel>AI Analyst</SectionLabel>
          <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Ask anything.
            <br />
            Get answers that <span className="text-gradient-animated">actually check out.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-slate-400">
            Chat with your dataset in plain English. Every answer is computed from your real rows and linked to the
            evidence behind it.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              {
                icon: MessageSquare,
                title: "Grounded answers",
                desc: "Statistics are computed from 100% of your rows — never sampled, never invented.",
                color: "text-cyan-300",
              },
              {
                icon: Cpu,
                title: "Works offline, by default",
                desc: "A deterministic local engine answers questions without any API key or cloud call.",
                color: "text-violet-300",
              },
              {
                icon: Bot,
                title: "Optional LLM enhancement",
                desc: "Plug in your own key for richer interpretation — your credentials, your data.",
                color: "text-fuchsia-300",
              },
            ].map((f) => (
              <motion.li
                key={f.title}
                initial={{ opacity: 0, x: -18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: EASE }}
                className="group flex gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition-colors group-hover:border-white/25">
                  <f.icon className={cn("h-5 w-5", f.color)} />
                </span>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a href="#report" className="btn-gradient px-6 py-3 text-sm font-semibold">
              Explore your own data
              <ArrowRight className="h-4 w-4" />
            </a>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Check className="h-4 w-4 text-emerald-400" />
              No credit card. No sign-up.
            </div>
          </div>
        </div>

        <div className="relative">
          <div aria-hidden className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-500/20 blur-2xl" />

          <div className="relative glass rounded-[1.75rem] p-5 shadow-card-3d sm:p-6">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-night-900" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Analyst</p>
                  <p className="text-[11px] text-slate-500">Local mode · deterministic</p>
                </div>
              </div>
              <span className="chip">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping-soft" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                online
              </span>
            </div>

            <div className="flex min-h-[20rem] flex-col gap-3 py-4">
              {shown.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
              {typing ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="rounded-2xl rounded-bl-md border border-violet-400/20 bg-white/[0.05] px-4 py-3">
                    <TypingDots />
                  </div>
                </motion.div>
              ) : null}
            </div>

            <div className="border-t border-white/[0.07] pt-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Suggested questions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((q, i) => (
                  <motion.button
                    key={q}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -right-4 -top-5 hidden rotate-3 rounded-xl border border-white/10 bg-night-800/90 px-4 py-2.5 shadow-card-3d backdrop-blur-xl md:block">
            <p className="text-[10px] font-semibold text-slate-400">Answer grounded in</p>
            <p className="font-display text-sm font-bold text-emerald-400">8,431 rows · 0 hallucinated</p>
          </div>
        </div>
      </div>
    </section>
  );
}
