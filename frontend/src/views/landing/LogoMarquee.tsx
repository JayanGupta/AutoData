"use client";

import { Aperture, Box, Compass, Database, Gem, Hexagon, Layers, Orbit } from "lucide-react";
import { Marquee, Reveal } from "./primitives";
import { TRUSTED_WORDS } from "./constants";

const ICONS = [Aperture, Database, Compass, Hexagon, Gem, Orbit, Layers, Box];

export function LogoMarquee() {
  return (
    <section className="relative border-y border-white/[0.06] bg-white/[0.015] py-14">
      <Reveal>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Trusted by teams who stopped wrestling with spreadsheets
        </p>
      </Reveal>
      <div className="relative mt-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-night-950 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-night-950 to-transparent" />
        <Marquee duration={38}>
          {TRUSTED_WORDS.map((word, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <span key={word} className="flex shrink-0 items-center gap-2.5 text-slate-600 transition hover:text-slate-300">
                <Icon className="h-5 w-5" />
                <span className="whitespace-nowrap font-display text-lg font-semibold tracking-tight">{word}</span>
              </span>
            );
          })}
        </Marquee>
      </div>
    </section>
  );
}
