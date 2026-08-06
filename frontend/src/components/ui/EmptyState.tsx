import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction} variant="secondary">
          <Sparkles className="h-4 w-4" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-rose-400" />
      <h3 className="text-sm font-semibold text-rose-200">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-rose-300/80">{message}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry} variant="secondary">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}
