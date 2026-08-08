import type { ReactNode } from "react";
import { cn } from "@/views/landing/primitives";

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({ title, subtitle, action, children, className = "", bodyClassName = "" }: CardProps) {
  return (
    <section className={cn("panel", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            {title && <h3 className={cn("panel-title")}>{title}</h3>}
            {subtitle && <p className={cn("panel-sub")}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
