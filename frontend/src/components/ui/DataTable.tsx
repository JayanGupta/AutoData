import type { ReactNode } from "react";

interface DataTableProps {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  maxHeight?: string;
  emptyMessage?: string;
}

export function DataTable({ columns, rows, maxHeight = "420px", emptyMessage = "No data to display" }: DataTableProps) {
  if (!rows.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border-b border-white/[0.08] bg-night-900 px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                #
              </th>
              {columns.map((c) => (
                <th key={c} className="border-b border-white/[0.08] bg-night-900 px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="transition-colors hover:bg-violet-500/[0.06]">
                <td className="border-b border-white/[0.04] px-3 py-1.5 text-slate-600">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c} className="max-w-[260px] truncate border-b border-white/[0.04] px-3 py-1.5 text-slate-300">
                    {renderCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-slate-600">∅</span>;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return (
      <span className="font-mono text-cyan-200/90">
        {Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 })}
      </span>
    );
  }
  return String(value);
}
