import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";
import { Spinner } from "./ui/Button";
import { formatBytes } from "@/lib/format";

const ACCEPTED = [".csv", ".tsv", ".xlsx", ".xls"];
const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const STAGE_LABELS: Record<string, string> = {
  validating: "Validating",
  loading: "Reading file",
  analyzing: "Profiling columns",
  building: "Building charts & insights",
  done: "Complete",
};

export function UploadZone({ compact = false }: { compact?: boolean }) {
  const { uploadViaJob, loading, error, clearError } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("validating");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        toastError(`Unsupported file type. Please upload ${ACCEPTED.join(", ")}.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        toastError(
          `File is too large (${formatBytes(file.size)}). Maximum allowed size is ${MAX_MB} MB.`,
        );
        return;
      }
      setUploadError(null);
      setFileName(file.name);
      setProgress(0);
      setStage("validating");
      try {
        await uploadViaJob(file, (p) => {
          setProgress(p.progress);
          setStage(p.stage);
        });
        toastSuccess(`Analyzed "${file.name}" — ready to explore.`);
        router.push("/dashboard");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        setUploadError(msg);
        toastError(msg);
      }
    },
    [uploadViaJob, router, toastError, toastSuccess],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !loading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
          dragging
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/50"
        } ${compact ? "py-8" : "py-14"}`}
      >
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
          className={`mb-4 flex items-center justify-center rounded-2xl text-brand-500 transition-transform group-hover:scale-105 ${
            compact ? "h-12 w-12" : "h-16 w-16"
          } bg-brand-100`}
        >
          {loading ? <Spinner className="h-8 w-8" /> : <UploadCloud className={compact ? "h-6 w-6" : "h-8 w-8"} />}
        </div>
        {loading ? (
          <div className="w-full max-w-sm space-y-3 px-4">
            <p className="text-sm font-semibold text-slate-800">
              {STAGE_LABELS[stage] ?? "Analyzing"}… {fileName ? `(${fileName})` : ""}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{Math.round(progress)}% · {STAGE_LABELS[stage] ?? stage}</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-800">
              {fileName ? `${fileName} ready` : "Drop your dataset here"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              or <span className="font-medium text-brand-600">browse files</span> — CSV or Excel
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <FileSpreadsheet className="h-4 w-4" />
              <span>CSV, TSV, XLSX · up to 50 MB · processed locally &amp; privacy-first</span>
            </div>
          </>
        )}
      </div>

      {(error || uploadError) && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="inline-flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{uploadError ?? error}</span>
          </span>
          <button
            onClick={() => {
              setUploadError(null);
              clearError();
            }}
            className="ml-3 shrink-0 font-semibold text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
