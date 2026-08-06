"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` Q ${cx} ${y0} ${x1} ${y1}`;
  }
  return d;
}

export interface SeriesPoint {
  x: number;
  y: number;
}

function buildPath(data: SeriesPoint[], w: number, h: number, pad = 6): Array<[number, number]> {
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;
  return data.map((d) => [pad + ((d.x - minX) / xSpan) * (w - pad * 2), h - pad - ((d.y - minY) / ySpan) * (h - pad * 2)]);
}

/** Smooth animated area chart with gradient fill. */
export function AreaChart({
  data,
  width = 420,
  height = 150,
  stroke = "#a78bfa",
  fillTo = "#60a5fa",
  className,
  delay = 0.2,
}: {
  data: SeriesPoint[];
  width?: number;
  height?: number;
  stroke?: string;
  fillTo?: string;
  className?: string;
  delay?: number;
}) {
  const id = useId();
  const prefersReduced = useReducedMotion();
  const pts = buildPath(data, width, height);
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`;

  if (prefersReduced) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillTo} stopOpacity="0.4" />
            <stop offset="100%" stopColor={fillTo} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTo} stopOpacity="0.4" />
          <stop offset="100%" stopColor={fillTo} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${id})`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: delay + 0.35 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, delay, ease: EASE }}
      />
      <motion.circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={4}
        fill={stroke}
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: delay + 1.2, duration: 0.3 }}
      />
    </svg>
  );
}

/** Staggered vertical bars. */
export function BarChart({
  values,
  width = 300,
  height = 130,
  className,
  from = "#8b5cf6",
  to = "#22d3ee",
  delay = 0.15,
  labels,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  from?: string;
  to?: string;
  delay?: number;
  labels?: string[];
}) {
  const prefersReduced = useReducedMotion();
  const max = Math.max(...values);
  const gap = width / values.length;
  const barW = gap * 0.52;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const h = (v / max) * (height - 14);
        const x = i * gap + gap / 2 - barW / 2;
        const y = height - h;
        if (prefersReduced) {
          return <rect key={i} x={x} y={y} width={barW} height={h} rx={barW / 2} fill="url(#bar-grad)" opacity={0.85} />;
        }
        return (
          <motion.rect
            key={i}
            x={x}
            y={height}
            width={barW}
            height={0}
            rx={barW / 2}
            fill="url(#bar-grad)"
            opacity={0.85}
            initial={{ y: height, height: 0 }}
            whileInView={{ y, height: h }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: delay + i * 0.07, ease: EASE }}
          />
        );
      })}
      {labels
        ? labels.map((l, i) => (
            <text key={l} x={i * gap + gap / 2} y={height - 2} textAnchor="middle" fontSize={9} fill="#64748b">
              {l}
            </text>
          ))
        : null}
    </svg>
  );
}

/** Animated donut / progress ring. */
export function DonutChart({
  value,
  size = 96,
  stroke = 10,
  color = "#22d3ee",
  track = "rgba(255,255,255,0.08)",
  children,
  delay = 0.3,
  className,
}: {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const prefersReduced = useReducedMotion();
  const offset = prefersReduced ? (1 - value / 100) * c : c;

  return (
    <div className={cnMaybe(className, "relative")} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: offset }}
          whileInView={{ strokeDashoffset: prefersReduced ? (1 - value / 100) * c : 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay, ease: EASE }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function cnMaybe(className?: string, fallback = ""): string {
  return className ?? fallback;
}
