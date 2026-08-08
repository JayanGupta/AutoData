"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Sparkles, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { NAV_LINKS, ROUTE_LINKS } from "./constants";
import { cn } from "./primitives";
import { UploadButton } from "@/components/UploadButton";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-9 w-9 items-center justify-center rounded-xl", className)}>
      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 opacity-90 shadow-glow-violet" />
      <span className="absolute inset-[1.5px] rounded-[10px] bg-night-950" />
      <Sparkles className="relative h-4 w-4 text-violet-300" />
    </span>
  );
}

export function Navbar({
  onSample,
  onResume,
  loadingSample,
}: {
  onSample: () => void;
  onResume: () => void;
  loadingSample: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
        <div
          className={cn(
            "flex w-full items-center justify-between gap-6 rounded-2xl border px-4 py-2.5 transition-all duration-500",
            scrolled
              ? "border-white/10 bg-night-950/70 shadow-lg shadow-black/20 backdrop-blur-xl"
              : "border-transparent bg-transparent",
          )}
        >
          <a href="#top" className="group flex items-center gap-3">
            <BrandMark className="transition-transform duration-300 group-hover:scale-105" />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[15px] font-semibold tracking-tight text-white">AutoData</span>
              <span className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 sm:block">
                AI analytics workspace
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {ROUTE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <span aria-hidden className="mx-1 h-4 w-px bg-white/10" />
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <UploadButton className="btn-ghost hidden px-3.5 py-2 text-sm sm:inline-flex">
              <UploadCloud className="h-4 w-4" />
              Upload data
            </UploadButton>
            <button
              type="button"
              onClick={onResume}
              className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-slate-400 transition hover:text-white lg:block"
            >
              Resume last dataset
            </button>
            <button
              type="button"
              onClick={onSample}
              disabled={loadingSample}
              className="btn-gradient px-4 py-2 text-sm font-semibold"
            >
              {loadingSample ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Loading
                </span>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Try sample
                </>
              )}
            </button>
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="mx-4 mt-2 rounded-2xl border border-white/10 bg-night-900/95 p-3 backdrop-blur-xl md:hidden"
          >
            {ROUTE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <div aria-hidden className="my-1 h-px bg-white/[0.06]" />
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onResume();
              }}
              className="mt-1 block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Resume last dataset
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}

export function NavShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
