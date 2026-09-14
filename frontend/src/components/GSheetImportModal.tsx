"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, FileSpreadsheet, Layers, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useDataset } from "@/store/DatasetContext";

interface GSheetImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GSheetImportModal({ open, onClose, onSuccess }: GSheetImportModalProps) {
  const { importGoogleSheets, loading } = useDataset();
  const [urlsText, setUrlsText] = useState("");
  const [combine, setCombine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleSheetUrl = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing";

  const handleUseSample = () => {
    setUrlsText(sampleSheetUrl);
    setError(null);
  };

  const handleImport = async () => {
    setError(null);
    const urls = urlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setError("Please paste at least one Google Sheet link or ID.");
      return;
    }

    try {
      await importGoogleSheets(urls, combine);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to import from Google Sheets.");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-night-900 shadow-2xl p-6 sm:p-7"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Import Google Sheets</h3>
                <p className="text-xs text-slate-400">Connect public Google Spreadsheets directly into AutoData</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between pb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Google Sheet URL(s)
                </label>
                <button
                  type="button"
                  onClick={handleUseSample}
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Paste Public Sample
                </button>
              </div>
              <textarea
                rows={3}
                placeholder={`https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5n.../edit\n(Paste one or multiple URLs, one per line)`}
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
              />
            </div>

            {/* Combine Toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-3">
                <Layers className="h-4 w-4 text-violet-400" />
                <div>
                  <p className="text-sm font-medium text-slate-200">Combine all tabs / sheets</p>
                  <p className="text-xs text-slate-500">Merge multiple tabs into a single consolidated dataset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCombine(!combine)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  combine ? "bg-emerald-500" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    combine ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Sharing Guide Notice */}
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-3.5 text-xs text-emerald-300/90 leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5 text-emerald-300">
                <Check className="h-3.5 w-3.5" /> No Google Cloud account or API keys required:
              </p>
              <p className="mt-1 text-slate-400">
                In your Google Sheet, click <span className="text-slate-200 font-medium">Share</span> in the top right,
                and switch General access to{" "}
                <span className="text-emerald-300 font-medium">&quot;Anyone with the link can view&quot;</span>.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              onClick={onClose}
              className="btn-ghost px-4 py-2 text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting & Parsing…</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Import Sheets</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
