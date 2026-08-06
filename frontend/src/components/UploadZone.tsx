import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";
import { Spinner } from "./ui/Button";

const ACCEPTED = [".csv", ".tsv", ".xlsx", ".xls"];

export function UploadZone({ compact = false }: { compact?: boolean }) {
  const { upload, loading, error, clearError } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        toastError(`Unsupported file type. Please upload ${ACCEPTED.join(", ")}.`);
        return;
      }
      setFileName(file.name);
      try {
        await upload(file);
        toastSuccess(`Analyzed "${file.name}" — ${file.size ? Math.round(file.size / 1024) : 0} KB processed.`);
        router.push("/dashboard");
      } catch {
        /* error surfaced via context + toast below */
      }
    },
    [upload, router, toastError, toastSuccess],
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
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
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
        <p className="text-sm font-semibold text-slate-800">
          {fileName ? `Uploading ${fileName}…` : "Drop your dataset here"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          or <span className="font-medium text-brand-600">browse files</span> — CSV or Excel
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <FileSpreadsheet className="h-4 w-4" />
          <span>CSV, TSV, XLSX · up to 50 MB · processed locally &amp; privacy-first</span>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={clearError} className="ml-3 font-semibold text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
