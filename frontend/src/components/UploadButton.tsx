"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { useDataset } from "@/store/DatasetContext";
import { useToast } from "@/store/ToastContext";
import { formatBytes } from "@/lib/format";

const ACCEPTED = [".csv", ".tsv", ".xlsx", ".xls"];
const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

interface UploadButtonProps {
  className?: string;
  children?: ReactNode;
}

export function UploadButton({ className = "", children }: UploadButtonProps) {
  const { uploadViaJob, loading } = useDataset();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      toastError(`Unsupported file type. Please upload ${ACCEPTED.join(", ")}.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toastError(`File is too large (${formatBytes(file.size)}). Maximum allowed size is ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    try {
      await uploadViaJob(file);
      toastSuccess(`Analyzed "${file.name}" — ready to explore.`);
      router.push("/dashboard");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const isBusy = loading || busy;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => !isBusy && inputRef.current?.click()}
        disabled={isBusy}
        aria-label="Upload your own dataset"
        className={className}
      >
        {isBusy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Analyzing…
          </>
        ) : (
          children ?? (
            <>
              <UploadCloud className="h-4 w-4" />
              Upload your data
            </>
          )
        )}
      </button>
    </>
  );
}
