"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Copy,
  FileSpreadsheet,
  FileType2,
  FolderUp,
  Pencil,
  Search,
  Sparkles,
  Star,
  Table2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/api/client";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";
import { Badge } from "@/components/ui/Badge";
import { Button, Spinner } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBytes, formatTimestamp } from "@/lib/format";
import { cn } from "./landing/primitives";
import type { DatasetInfo } from "@/types";

const ACCEPTED = [".csv", ".tsv", ".xlsx", ".xls"];
const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

type SortKey = "recent" | "name" | "size" | "quality";
type FilterKey = "all" | "favorites";

const FILE_META: Record<string, { icon: typeof FileType2; color: string; label: string }> = {
  ".csv": { icon: FileType2, color: "from-emerald-500/30 to-teal-500/10 text-emerald-300", label: "CSV" },
  ".tsv": { icon: Table2, color: "from-sky-500/30 to-blue-500/10 text-sky-300", label: "TSV" },
  ".xlsx": { icon: FileSpreadsheet, color: "from-emerald-500/30 to-lime-500/10 text-emerald-300", label: "XLSX" },
  ".xls": { icon: FileSpreadsheet, color: "from-amber-500/30 to-orange-500/10 text-amber-300", label: "XLS" },
};

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "recent", label: "Recently accessed" },
  { key: "name", label: "Name (A–Z)" },
  { key: "size", label: "File size" },
  { key: "quality", label: "Quality score" },
];

export function DatasetsPage() {
  const { load, uploadViaJob, uploadSample } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [renaming, setRenaming] = useState<DatasetInfo | null>(null);
  const [deleting, setDeleting] = useState<DatasetInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.listDatasets();
      setDatasets(res.datasets);
    } catch {
      /* list failures are non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpen = async (id: string) => {
    try {
      await load(id);
      router.push("/dashboard");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not open this dataset");
    }
  };

  const handleFavorite = async (d: DatasetInfo) => {
    setBusy(`fav-${d.id}`);
    try {
      await api.updateDataset(d.id, { favorite: !d.favorite });
      toastSuccess(d.favorite ? "Removed from favorites." : "Added to favorites.");
      await refresh();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not update favorite");
    } finally {
      setBusy(null);
    }
  };

  const handleDuplicate = async (d: DatasetInfo) => {
    setBusy(`dup-${d.id}`);
    try {
      await api.duplicateDataset(d.id);
      toastSuccess(`Duplicated "${d.name}".`);
      await refresh();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not duplicate dataset");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (d: DatasetInfo) => {
    setDeleting(null);
    setBusy(`del-${d.id}`);
    try {
      await api.deleteDataset(d.id);
      toastSuccess(`Deleted "${d.name}".`);
      await refresh();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not delete dataset");
    } finally {
      setBusy(null);
    }
  };

  const visible = datasets
    .filter((d) => (filter === "favorites" ? d.favorite : true))
    .filter((d) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return d.name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "size":
          return (b.file_size ?? 0) - (a.file_size ?? 0);
        case "quality":
          return (b.quality_score ?? 0) - (a.quality_score ?? 0);
        default:
          return (b.last_access ?? b.created_at) - (a.last_access ?? a.created_at);
      }
    });

  return (
    <div className="min-h-screen bg-night-950 text-slate-100 antialiased">
      <Ambient />
      <div className="relative mx-auto max-w-[76rem] px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" />
              Dataset library
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Your analyses, in one place
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Every dataset you upload is saved on this machine. Open one to jump straight back into the
              analytics workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="md" onClick={() => void openSample(uploadSample, toastError, toastSuccess, router)}>
              <Sparkles className="h-4 w-4 text-violet-300" /> Sample dataset
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloud className="h-4 w-4" /> Upload new
            </Button>
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search datasets…"
              aria-label="Search datasets"
              className="field !pl-10"
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
            {(
              [
                { key: "all", label: "All" },
                { key: "favorites", label: "Favorites" },
              ] as Array<{ key: FilterKey; label: string }>
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all",
                  filter === f.key
                    ? "bg-gradient-to-r from-violet-500/30 to-indigo-500/20 text-white"
                    : "text-slate-500 hover:text-slate-200",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort datasets"
              className="field !w-auto !py-1.5 text-xs"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} delay={i} />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<FolderUp className="h-7 w-7" />}
              title="No datasets yet"
              description="Upload a CSV, TSV or Excel file to create your first analysis — or load the bundled sample dataset."
              actionLabel="Upload your first dataset"
              onAction={() => setUploadOpen(true)}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<Search className="h-7 w-7" />}
              title="No matching datasets"
              description="Try a different search term or clear the current filters."
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {visible.map((d) => (
                <DatasetCard
                  key={d.id}
                  dataset={d}
                  busy={busy}
                  onOpen={() => void handleOpen(d.id)}
                  onFavorite={() => void handleFavorite(d)}
                  onDuplicate={() => void handleDuplicate(d)}
                  onRename={() => setRenaming(d)}
                  onDelete={() => setDeleting(d)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        <footer className="mt-12 border-t border-white/[0.05] pt-6 text-center text-xs text-slate-600">
          {datasets.length} dataset{datasets.length === 1 ? "" : "s"} stored locally · nothing leaves this machine
        </footer>
      </div>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={(id) => void handleOpen(id)}
          uploadViaJob={uploadViaJob}
        />
      )}
      {renaming && (
        <RenameModal
          dataset={renaming}
          onClose={() => setRenaming(null)}
          onSaved={async () => {
            await refresh();
            toastSuccess("Dataset renamed.");
          }}
        />
      )}
      {deleting && (
        <DeleteModal dataset={deleting} onClose={() => setDeleting(null)} onConfirm={() => void handleDelete(deleting)} />
      )}
    </div>
  );
}

async function openSample(
  uploadSample: () => Promise<unknown>,
  toastError: (m: string) => void,
  toastSuccess: (m: string) => void,
  router: ReturnType<typeof useRouter>,
) {
  try {
    await uploadSample();
    toastSuccess("Sample dataset loaded — ready to explore.");
    router.push("/dashboard");
  } catch (e) {
    toastError(e instanceof Error ? e.message : "Sample dataset failed to load");
  }
}

function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="absolute -top-40 left-1/4 h-[30rem] w-[30rem] rounded-full bg-violet-600/20 blur-[130px] animate-blob" />
      <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-cyan-500/15 blur-[120px] animate-blob-alt" />
    </div>
  );
}

function fileMeta(ext: string) {
  return FILE_META[ext.toLowerCase()] ?? { icon: FileType2, color: "from-slate-500/30 to-slate-500/10 text-slate-300", label: "FILE" };
}

function QualityRing({ score }: { score: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#fb7185";
  return (
    <div className="relative h-11 w-11 shrink-0" title={`Quality score: ${pct}/100`}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold" style={{ color }}>
        {pct}
      </span>
    </div>
  );
}

function DatasetCard({
  dataset,
  busy,
  onOpen,
  onFavorite,
  onDuplicate,
  onRename,
  onDelete,
}: {
  dataset: DatasetInfo;
  busy: string | null;
  onOpen: () => void;
  onFavorite: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const meta = fileMeta(dataset.file_type);
  const Icon = meta.icon;
  const ext = (dataset.file_type || ".csv").toUpperCase();
  const isBusy = busy === `fav-${dataset.id}` || busy === `dup-${dataset.id}` || busy === `del-${dataset.id}`;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-night-900/70 p-5 shadow-inner-light backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.16] hover:shadow-glow-violet"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.08] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex items-start gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-white/10", meta.color)}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={onOpen}
              className="min-w-0 truncate text-left font-display text-[15px] font-semibold text-white transition-colors hover:text-violet-200"
              title={`Open ${dataset.name}`}
            >
              {dataset.name}
            </button>
            <button
              onClick={onFavorite}
              disabled={isBusy}
              aria-label={dataset.favorite ? "Remove from favorites" : "Add to favorites"}
              className={cn(
                "shrink-0 rounded-lg p-1.5 transition-colors",
                dataset.favorite
                  ? "text-amber-300 hover:bg-amber-500/15"
                  : "text-slate-600 hover:bg-white/[0.06] hover:text-amber-300",
              )}
            >
              <Star className={cn("h-4 w-4", dataset.favorite && "fill-current")} />
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className="border-white/10 bg-white/[0.04] font-mono text-slate-400">{ext}</Badge>
            <span className="text-[11px] text-slate-500">
              {dataset.rows.toLocaleString()} rows · {dataset.columns} cols
            </span>
          </div>
        </div>
        <QualityRing score={dataset.quality_score ?? 0} />
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="font-mono">{formatBytes(dataset.file_size ?? 0)}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTimestamp(dataset.last_access ?? dataset.created_at)}
        </span>
      </div>

      <div className="relative mt-4 flex items-center gap-1.5 border-t border-white/[0.06] pt-3.5">
        <button
          onClick={onOpen}
          className="btn-gradient inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
        >
          Open <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <IconButton label="Rename" title="Rename" onClick={onRename} disabled={isBusy}>
          <Pencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Duplicate" title="Duplicate" onClick={onDuplicate} disabled={isBusy}>
          <Copy className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Delete" title="Delete" onClick={onDelete} disabled={isBusy} danger>
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </motion.article>
  );
}

function IconButton({
  label,
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition-colors disabled:opacity-40",
        danger
          ? "text-slate-500 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
          : "text-slate-500 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-200",
      )}
    >
      {children}
    </button>
  );
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5"
      style={{ animation: `pulse-glow 1.8s ease-in-out ${delay * 0.08}s infinite` }}
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-white/[0.06]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
          <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
        </div>
        <div className="h-11 w-11 rounded-full bg-white/[0.05]" />
      </div>
      <div className="mt-4 h-3 w-1/3 rounded bg-white/[0.04]" />
      <div className="mt-4 flex gap-2 border-t border-white/[0.05] pt-3.5">
        <div className="h-8 flex-1 rounded-xl bg-white/[0.05]" />
        <div className="h-8 w-8 rounded-lg bg-white/[0.05]" />
        <div className="h-8 w-8 rounded-lg bg-white/[0.05]" />
        <div className="h-8 w-8 rounded-lg bg-white/[0.05]" />
      </div>
    </div>
  );
}

function UploadModal({
  onClose,
  onUploaded,
  uploadViaJob,
}: {
  onClose: () => void;
  onUploaded: (id: string) => void;
  uploadViaJob: (file: File, onProgress?: (p: { progress: number; stage: string; message: string }) => void) => Promise<{ dataset: { id: string } }>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("validating");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = fileName !== null;

  const STAGE_LABELS: Record<string, string> = {
    validating: "Validating file",
    loading: "Reading rows",
    analyzing: "Profiling columns",
    building: "Building charts & insights",
    done: "Complete",
  };

  const handleFile = async (file: File) => {
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type "${ext}". Please upload ${ACCEPTED.join(", ")}.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${formatBytes(file.size)}). Maximum allowed size is ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFileName(file.name);
    setProgress(0);
    setStage("validating");
    try {
      const snap = await uploadViaJob(file, (p) => {
        setProgress(p.progress);
        setStage(p.stage);
      });
      onUploaded(snap.dataset.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setFileName(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Upload a new dataset"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-night-800 shadow-2xl backdrop-blur-xl animate-modal-in">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-white">Upload a dataset</h3>
            <p className="mt-0.5 text-xs text-slate-500">CSV, TSV, XLSX or XLS · up to {MAX_MB} MB · processed locally</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close upload dialog"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
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
          <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !busy && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              const isFile = e.dataTransfer.types?.includes("Files");
              setDragging(true);
              setRejected(!isFile);
            }}
            onDragLeave={() => {
              setDragging(false);
              setRejected(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              setRejected(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "group relative flex min-h-[11rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300",
              rejected
                ? "border-rose-500/60 bg-rose-500/[0.06]"
                : dragging
                  ? "border-violet-400/70 bg-violet-500/[0.08] scale-[1.01]"
                  : "border-white/12 bg-white/[0.02] hover:border-violet-400/40 hover:bg-white/[0.04]",
            )}
          >
            {busy ? (
              <div className="w-full max-w-sm space-y-4">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/10 ring-1 ring-white/10">
                  <Spinner className="h-6 w-6 text-violet-300" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{STAGE_LABELS[stage] ?? "Analyzing"}…</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{fileName}</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.max(4, progress)}%` }}
                  />
                </div>
                <p className="text-center text-[11px] font-mono text-slate-500">{Math.round(progress)}%</p>
              </div>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/10 text-violet-200 ring-1 ring-white/10 shadow-glow-violet transition-transform duration-300 group-hover:scale-105">
                  <UploadCloud className="h-7 w-7" />
                </span>
                <p className="mt-4 text-base font-semibold text-white">
                  {rejected ? "Only files work here" : "Drop your file, or browse"}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {["CSV", "TSV", "XLSX", "XLS"].map((f) => (
                    <span key={f} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-300">
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          {error && (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-200">
              <span className="inline-flex items-start gap-2">
                <span>{error}</span>
              </span>
              <button onClick={() => setError(null)} aria-label="Dismiss error" className="shrink-0 rounded-lg p-1 text-rose-300 transition hover:bg-rose-500/20 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RenameModal({
  dataset,
  onClose,
  onSaved,
}: {
  dataset: DatasetInfo;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { error: toastError } = useToast();
  const [name, setName] = useState(dataset.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api.updateDataset(dataset.id, { name: trimmed });
      await onSaved();
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not rename dataset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Rename ${dataset.name}`}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-night-800 shadow-2xl backdrop-blur-xl animate-modal-in">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h3 className="font-display text-base font-bold text-white">Rename dataset</h3>
          <button onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="field-label" htmlFor="rename-input">
              Dataset name
            </label>
            <input
              ref={inputRef}
              id="rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
              placeholder="My dataset"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} disabled={!name.trim()}>
                Save name
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  dataset,
  onClose,
  onConfirm,
}: {
  dataset: DatasetInfo;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${dataset.name}`}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-500/20 bg-night-800 shadow-2xl backdrop-blur-xl animate-modal-in">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
            <Trash2 className="h-4 w-4 text-rose-400" /> Delete dataset
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-slate-400">
            Delete <strong className="text-white">{dataset.name}</strong>? This removes the analysis, cleaning
            history and conversation from this machine. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              <Trash2 className="h-4 w-4" /> Delete permanently
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
