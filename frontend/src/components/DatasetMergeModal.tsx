"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GitMerge, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useDataset } from "@/store/DatasetContext";

interface DatasetMergeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DatasetMergeModal({ open, onClose, onSuccess }: DatasetMergeModalProps) {
  const { snapshot, sessions, mergeDatasets, loading } = useDataset();
  const [leftId, setLeftId] = useState<string>(snapshot?.dataset.id || (sessions[0]?.id ?? ""));
  const [rightId, setRightId] = useState<string>(
    sessions.find((s) => s.id !== (snapshot?.dataset.id || sessions[0]?.id))?.id || ""
  );
  const [how, setHow] = useState<"inner" | "left" | "right" | "outer" | "concat">("inner");
  const [leftOn, setLeftOn] = useState<string>("");
  const [rightOn, setRightOn] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Derive column list from current active dataset snapshot if selected
  const leftCols = snapshot && snapshot.dataset.id === leftId ? snapshot.columns.map((c) => c.name) : [];

  const handleMerge = async () => {
    setError(null);
    if (!leftId || !rightId) {
      setError("Please select both datasets to merge.");
      return;
    }
    if (leftId === rightId && how !== "concat") {
      setError("Please select two different datasets to join.");
      return;
    }
    if (how !== "concat" && (!leftOn.trim() || !rightOn.trim())) {
      setError("Please specify key columns for both datasets to perform the join.");
      return;
    }

    try {
      await mergeDatasets(
        leftId,
        rightId,
        how,
        how === "concat" ? undefined : leftOn.trim(),
        how === "concat" ? undefined : rightOn.trim(),
        customName.trim() || undefined
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Merge failed.");
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
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-inner">
                <GitMerge className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white tracking-tight">Merge &amp; Join Datasets</h3>
                <p className="text-xs text-slate-400">Combine multiple sheets or datasets by common key column</p>
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
            {/* Datasets Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Primary Dataset (Left)
                </label>
                <select
                  value={leftId}
                  onChange={(e) => setLeftId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-night-900 text-white">
                      {s.name} ({s.rows.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Second Dataset (Right)
                </label>
                <select
                  value={rightId}
                  onChange={(e) => setRightId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-night-900 text-white">
                      {s.name} ({s.rows.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Join Type */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                Join Method
              </label>
              <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
                {(["inner", "left", "right", "outer", "concat"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setHow(type)}
                    className={`rounded-xl py-2 text-xs font-medium capitalize transition-all ${
                      how === type
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {type === "concat" ? "Stack (Union)" : `${type} Join`}
                  </button>
                ))}
              </div>
            </div>

            {/* Keys if join */}
            {how !== "concat" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Left Key Column
                  </label>
                  {leftCols.length > 0 ? (
                    <select
                      value={leftOn}
                      onChange={(e) => setLeftOn(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="">Select column...</option>
                      {leftCols.map((c) => (
                        <option key={c} value={c} className="bg-night-900 text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. user_id or email"
                      value={leftOn}
                      onChange={(e) => setLeftOn(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Right Key Column
                  </label>
                  <input
                    type="text"
                    placeholder={leftOn || "e.g. user_id or email"}
                    value={rightOn}
                    onChange={(e) => setRightOn(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Custom Name */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                New Dataset Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Joined Orders & Customers"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none"
              />
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
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm" disabled={loading}>
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Merging Datasets…</span>
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4" />
                  <span>Execute Merge</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
