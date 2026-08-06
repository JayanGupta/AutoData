"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode, MouseEvent } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ */
/*  Scroll reveal                                                      */
/* ------------------------------------------------------------------ */

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  blur?: boolean;
}

export function Reveal({ children, className, delay = 0, y = 28, once = true, blur = true }: RevealProps) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: blur ? "blur(8px)" : "none" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, margin: "-70px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className, delay = 0, gap = 0.09 }: { children: ReactNode; className?: string; delay?: number; gap?: number }) {
  const prefersReduced = useReducedMotion();
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, y = 26 }: { children: ReactNode; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y, filter: "blur(6px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mouse-reactive helpers                                             */
/* ------------------------------------------------------------------ */

export function Magnetic({ children, className, strength = 0.28 }: { children: ReactNode; className?: string; strength?: number }) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.12 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.12 });

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div ref={ref} style={{ x: sx, y: sy }} onMouseMove={onMove} onMouseLeave={onLeave} className={className}>
      {children}
    </motion.div>
  );
}

export function TiltCard({
  children,
  className,
  max = 6,
  scale = 1.01,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  scale?: number;
}) {
  const prefersReduced = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 160, damping: 20 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 160, damping: 20 });

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };

  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d", scale }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}

/** Soft radial glow that follows the cursor inside its container. */
export function MouseGlow({
  children,
  className,
  glowClassName,
  color = "rgba(139, 92, 246, 0.16)",
  size = 640,
}: {
  children: ReactNode;
  className?: string;
  glowClassName?: string;
  color?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(-800);
  const my = useMotionValue(-800);
  const sx = useSpring(mx, { stiffness: 90, damping: 22 });
  const sy = useSpring(my, { stiffness: 90, damping: 22 });
  const glow = useTransform(
    [sx, sy],
    ([x, y]) => `radial-gradient(${size}px circle at ${x}px ${y}px, ${color}, transparent 70%)`,
  );

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  return (
    <div ref={ref} onMouseMove={onMove} className={cn("relative", className)}>
      <motion.div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0", glowClassName)}
        style={{ background: glow }}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ambient background                                                */
/* ------------------------------------------------------------------ */

export function AuroraBackground({ className, variant = "hero" }: { className?: string; variant?: "hero" | "cta" | "section" }) {
  const palette =
    variant === "cta"
      ? {
          a: "bg-violet-600/30",
          b: "bg-cyan-500/25",
          c: "bg-fuchsia-600/25",
        }
      : {
          a: "bg-violet-600/25",
          b: "bg-blue-600/20",
          c: "bg-cyan-500/20",
        };
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className={cn("absolute -left-[10%] top-[-18%] h-[46rem] w-[46rem] rounded-full blur-[130px] animate-blob", palette.a)} />
      <div className={cn("absolute right-[-8%] top-[4%] h-[38rem] w-[38rem] rounded-full blur-[120px] animate-blob-alt", palette.b)} />
      <div className={cn("absolute bottom-[-22%] left-[22%] h-[40rem] w-[40rem] rounded-full blur-[140px] animate-blob", palette.c)} style={{ animationDelay: "-6s" }} />
    </div>
  );
}

/** Deterministic twinkling particle field (seeded so SSR/CSR stay in sync). */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function Particles({ count = 26, className }: { count?: number; className?: string }) {
  const prefersReduced = useReducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: round(seeded(i, 1) * 100),
        top: round(seeded(i, 2) * 100),
        size: round(1.5 + seeded(i, 3) * 2.5),
        delay: round(seeded(i, 4) * 5),
        duration: round(4 + seeded(i, 5) * 5),
        opacity: round(0.25 + seeded(i, 6) * 0.5),
        hue: ["#a78bfa", "#60a5fa", "#22d3ee", "#f472b6", "#ffffff"][i % 5],
      })),
    [count],
  );

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {particles.map((p, i) =>
        prefersReduced ? null : (
          <span
            key={i}
            className="absolute rounded-full animate-pulse-glow"
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                background: p.hue,
                opacity: p.opacity,
                boxShadow: `0 0 ${round(p.size * 4)}px ${p.hue}`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              } as CSSProperties
            }
          />
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Counters & marquee                                                */
/* ------------------------------------------------------------------ */

export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  duration = 1.8,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(prefersReduced ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, prefersReduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function Marquee({ children, className, duration = 45 }: { children: ReactNode; className?: string; duration?: number }) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      <div
        className="flex w-max motion-reduce:animate-none group-hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${duration}s linear infinite` }}
      >
        <div className="flex shrink-0 items-center gap-14 pr-14">{children}</div>
        <div className="flex shrink-0 items-center gap-14 pr-14" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section typography                                                */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300 backdrop-blur-md",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" />
      {children}
    </span>
  );
}

export function SectionHeading({
  label,
  title,
  sub,
  align = "center",
  className,
}: {
  label: string;
  title: ReactNode;
  sub?: string;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={cn(centered && "flex flex-col items-center text-center", className)}>
      <Reveal>
        <SectionLabel>{label}</SectionLabel>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">{title}</h2>
      </Reveal>
      {sub ? (
        <Reveal delay={0.16}>
          <p className={cn("mt-5 max-w-2xl text-lg leading-relaxed text-slate-400", centered && "mx-auto")}>{sub}</p>
        </Reveal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated gradient border                                           */
/* ------------------------------------------------------------------ */

export function ConicBorder({
  children,
  className,
  innerClassName,
  from = "rgba(139, 92, 246, 0.55)",
  to = "rgba(34, 211, 238, 0.55)",
  radius = "rounded-[1.75rem]",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  from?: string;
  to?: string;
  radius?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", radius, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500%] aspect-square -translate-x-1/2 -translate-y-1/2 animate-border-spin"
        style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${from} 90deg, ${to} 180deg, transparent 270deg)` }}
      />
      <div className={cn("relative m-px bg-night-950/90 backdrop-blur-xl", radius, innerClassName)}>{children}</div>
    </div>
  );
}
