import type { ReactNode } from "react";
import { formatNumber } from "../../lib/format";
import { cn } from "@/views/landing/primitives";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  gradient?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-200 ring-1 ring-white/10",
  gradient,
}: StatCardProps) {
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.05]", gradient)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        {icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", accent)}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

export function StatNumber({ value }: { value: number | null | undefined }) {
  return <>{formatNumber(value)}</>;
}
