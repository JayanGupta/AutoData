"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  FileSpreadsheet,
  History,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";
import { cn, Reveal, SectionLabel } from "./primitives";
import { formatBytes, formatTimestamp } from "@/lib/format";

const ACCEPTED = [".csv", ".tsv", ".xlsx", ".xls"];
const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const STAGE_LABELS: Record<string, string> = {
  validating: "Validating file",
  loading: "Reading rows",
  analyzing: "Profiling columns",
  building: "Building charts & insights",
  done: "Complete",
};

function validateFile(file: File): string | null {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPTED.includes(ext)) {
    return `Unsupported file type "${ext}". Please upload ${ACCEPTED.join(", ")}.`;
  }
  if (file.size > MAX_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Maximum allowed size is ${MAX_MB} MB.`;
  }
  if (file.size === 0) {
    return "That file appears to be empty. Try a file with at least one row of data.";
  }
  return null;
}

export function UploadSection() {
  const { uploadViaJob, sessions, listSessions, load, uploadSample } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [dragRejected, setDragRejected] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("validating");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  useEffect(() => {
    void listSessions();
  }, [listSessions]);

  const handleFile = useCallback(
    async (file: File) => {
      const problem = validateFile(file);
      if (problem) {
        setError(problem);
        setFileName(null);
        setFileMeta(null);
        return;
      }
      setError(null);
      setFileName(file.name);
      setFileMeta(`${file.name.split(".").pop()?.toUpperCase()} · ${formatBytes(file.size)}`);
      setProgress(0);
      setStage("validating");
      setBusy(true);
      try {
        await uploadViaJob(file, (p) => {
          setProgress(p.progress);
          setStage(p.stage);
        });
        toastSuccess(`Analyzed "${file.name}" — ready to explore.`);
        router.push("/dashboard");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        setError(msg);
        toastError(msg);
      } finally {
        setBusy(false);
      }
    },
    [uploadViaJob, router, toastError, toastSuccess],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      setDragRejected(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const isFile = e.dataTransfer.types?.includes("Files");
    setDragging(true);
    setDragRejected(!isFile);
  }, []);

  const handleSample = async () => {
    setLoadingSample(true);
    try {
      await uploadSample();
      toastSuccess("Sample dataset loaded — explore it in the dashboard.");
      router.push("/dashboard");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Sample dataset failed to load");
    } finally {
      setLoadingSample(false);
    }
  };

  const openRecent = async (id: string) => {
    try {
      await load(id);
      router.push("/dashboard");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not reopen that analysis");
    }
  };

  const recent = [...sessions]
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
    .slice(0, 4);

  return (
    <section id="upload" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[130px]" />

      <Reveal>
        <div className="text-center">
          <SectionLabel>Get started</SectionLabel>
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Drop a file.
            <br />
            Get answers <span className="text-gradient-animated">in seconds.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
            Everything runs locally. Upload a CSV, TSV or Excel workbook and AutoData profiles it, scores its quality
            and opens the full analytics workspace.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-12 grid gap-5 lg:grid-cols-5">
          {/* Dropzone */}
          <div className="relative lg:col-span-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => !busy && inputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={() => {
                setDragging(false);
                setDragRejected(false);
              }}
              onDrop={onDrop}
              aria-label="Upload a CSV or Excel file"
              className={cn(
                "group relative flex min-h-[22rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border-2 border-dashed px-6 py-12 text-center transition-all duration-300",
                dragRejected
                  ? "border-rose-500/60 bg-rose-500/[0.06]"
                  : dragging
                    ? "border-violet-400/70 bg-violet-500/[0.08] scale-[1.01]"
                    : "border-white/12 bg-white/[0.02] hover:border-violet-400/40 hover:bg-white/[0.04]",
              )}
            >
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-violet-600/[0.07] to-transparent" />

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.currentTarget.value = "";
                }}
              />

              {busy ? (
                <div className="w-full max-w-sm space-y-5">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/10 ring-1 ring-white/10">
                    <span className="h-7 w-7 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-300" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-white">{STAGE_LABELS[stage] ?? "Analyzing"}…</p>
                    <p className="mt-1 truncate text-sm text-slate-400">{fileName}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.max(4, progress)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{Math.round(progress)}%</span>
                      <span>{fileMeta}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/10 text-violet-200 ring-1 ring-white/10 shadow-glow-violet transition-transform duration-300 group-hover:scale-105">
                    <UploadCloud className="h-8 w-8" />
                  </span>
                  <p className="mt-5 text-lg font-semibold text-white">
                    {dragRejected ? "Only files work here" : "Drop your dataset here"}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-400">
                    or <span className="font-semibold text-violet-300 transition-colors group-hover:text-violet-200">browse your files</span>
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {["CSV", "TSV", "XLSX", "XLS"].map((f) => (
                      <span
                        key={f}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-300"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="mt-5 flex items-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Processed locally · up to {MAX_MB} MB · no account needed
                  </p>
                </>
              )}
            </div>

            {error ? (
              <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-200">
                <span className="inline-flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="shrink-0 rounded-lg p-1 text-rose-300 transition hover:bg-rose-500/20 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          {/* Recent analyses */}
          <div className="lg:col-span-2">
            <div className="glass flex h-full flex-col rounded-[1.75rem] border border-white/[0.07] p-6">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <History className="h-4 w-4 text-violet-300" /> Recent analyses
                </p>
                <span className="chip">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping-soft" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {sessions.length} on this machine
                </span>
              </div>

              <div className="mt-5 flex-1 space-y-2.5">
                {recent.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center">
                    <FileSpreadsheet className="h-8 w-8 text-slate-600" />
                    <p className="mt-3 text-sm font-medium text-slate-300">No analyses yet</p>
                    <p className="mt-1 max-w-[15rem] text-xs leading-relaxed text-slate-500">
                      Upload a file or load the bundled sample to create your first one.
                    </p>
                  </div>
                ) : (
                  recent.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void openRecent(s.id)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-violet-400/30 hover:bg-white/[0.06]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-300 ring-1 ring-white/10">
                        <FileSpreadsheet className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-200 group-hover:text-white">
                          {s.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                          <span>
                            {s.rows.toLocaleString()} rows · {s.columns} cols
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(s.created_at)}
                          </span>
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                          (s.quality_score ?? 0) >= 80
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : (s.quality_score ?? 0) >= 60
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                        )}
                      >
                        {s.quality_score ?? "—"}/100
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSample()}
                disabled={loadingSample}
                className="btn-gradient mt-5 w-full px-4 py-3 text-sm font-semibold"
              >
                {loadingSample ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Loading sample…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Try the sample dataset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
