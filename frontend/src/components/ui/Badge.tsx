import type { ReactNode } from "react";
import { cn } from "@/views/landing/primitives";

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const colors: Record<string, string> = {
    high: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };
  return <Badge className={cn(colors[severity], "uppercase tracking-wide")}>{severity}</Badge>;
}
