"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.props.onReset?.();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-night-950 px-4 text-slate-100 antialiased">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-night-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-lg font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {this.state.message || "An unexpected error occurred while rendering this page."}
          </p>
          <button
            onClick={this.handleReset}
            className="btn-gradient mt-6 px-5 py-2.5 text-sm font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
