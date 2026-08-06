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
      <div className="flex items-center justify-center rounded-lg bg-slate-50 py-10 text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-500">#</th>
              {columns.map((c) => (
                <th key={c} className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-white even:bg-slate-50/60 hover:bg-brand-50">
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-400">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c} className="max-w-[260px] truncate border-b border-slate-100 px-3 py-1.5 text-slate-700">
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
  if (value === null || value === undefined || value === "") return <span className="text-slate-300">∅</span>;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}
