import { cn } from "@/views/landing/primitives";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  showGlow?: boolean;
}

export function ProgressBar({ value, max = 100, color = "bg-gradient-to-r from-violet-500 to-cyan-400", className = "", showGlow = true }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", color, showGlow && "shadow-[0_0_10px_rgba(139,92,246,0.4)]")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
