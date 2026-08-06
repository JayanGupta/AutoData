import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as api from "../../api/client";
import { DataTable } from "./DataTable";
import { cn } from "@/views/landing/primitives";

interface PaginatedDataTableProps {
  sessionId: string;
  columns: string[];
  pageSize?: number;
}

const PAGE_SIZES = [50, 100, 200];

export function PaginatedDataTable({ sessionId, columns, pageSize = 100 }: PaginatedDataTableProps) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [size, sessionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getRows(sessionId, offset, size)
      .then((page) => {
        if (cancelled) return;
        setRows(page.rows);
        setTotal(page.total);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load the dataset rows.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, offset, size]);

  const clamp = useCallback((next: number) => Math.max(0, Math.min(total - 1, next)), [total]);

  const lastPageStart = Math.max(0, Math.floor((total - 1) / size) * size);

  const pageBtn = "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:hover:bg-white/[0.03]";

  return (
    <div>
      {error ? (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-300">{error}</div>
      ) : (
        <>
          <DataTable columns={columns} rows={rows} maxHeight="420px" emptyMessage={loading ? "Loading rows…" : "No rows"} />
          {total > size && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + size, total)} of {total.toLocaleString()} rows
                </span>
                <select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  aria-label="Rows per page"
                  className={cn("field !w-auto !py-1.5 text-xs")}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} / page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setOffset(0)} disabled={offset === 0} aria-label="First page" className={pageBtn}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setOffset(clamp(offset - size))} disabled={offset === 0} aria-label="Previous page" className={pageBtn}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-medium text-slate-400">
                  Page {Math.floor(offset / size) + 1} of {Math.max(1, Math.ceil(total / size))}
                </span>
                <button onClick={() => setOffset(clamp(offset + size))} disabled={offset >= lastPageStart} aria-label="Next page" className={pageBtn}>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={() => setOffset(lastPageStart)} disabled={offset >= lastPageStart} aria-label="Last page" className={pageBtn}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
