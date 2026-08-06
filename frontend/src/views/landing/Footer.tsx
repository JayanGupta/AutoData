"use client";

import { Github, Globe, Heart, Twitter, Youtube } from "lucide-react";
import { BrandMark } from "./Navbar";
import { FOOTER_LINKS } from "./constants";

const SOCIALS = [Twitter, Github, Globe, Youtube];

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-night-950">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <a href="#top" className="flex items-center gap-3">
              <BrandMark />
              <span className="flex flex-col leading-none">
                <span className="font-display text-[15px] font-semibold tracking-tight text-white">AutoData</span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  AI analytics workspace
                </span>
              </span>
            </a>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-500">
              Turn raw spreadsheets into clean datasets, honest quality scores and answers you can act on — entirely on
              your own machine.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping-soft" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              All systems local · no data leaves your machine
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER_LINKS.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{col.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#top"
                        className="text-sm text-slate-400 transition hover:text-white"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-5 border-t border-white/[0.06] pt-8 sm:flex-row">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} AutoData · Open source, local-first, private by design.
          </p>
          <div className="flex items-center gap-2">
            {SOCIALS.map((Icon, i) => (
              <a
                key={i}
                href="#top"
                aria-label="Social link"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-500 transition hover:border-white/20 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            Built with <Heart className="h-3.5 w-3.5 fill-rose-500/80 text-rose-500" /> and zero spreadsheets harmed
          </p>
        </div>
      </div>
    </footer>
  );
}
