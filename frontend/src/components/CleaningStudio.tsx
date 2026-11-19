import { useRef, useState } from "react";
import { ApiError, previewClean } from "../api/client";
import { useDataset } from "../store/DatasetContext";
import { useToast } from "../store/ToastContext";
import type { AnalysisSnapshot, CleanParams, CleanReview, RowFilter } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { FilterFields } from "./ui/FilterFields";

const COMMON = [
  ["drop_duplicates", "Remove duplicates"],
  ["fill", "Fill blanks"],
  ["trim_whitespace", "Trim spaces"],
  ["convert", "Change column type"],
];
const MORE = [
  ["keep_matching_rows", "Keep matching rows"],
  ["rename_column", "Rename column"],
  ["lowercase_column", "Convert text to lowercase"],
  ["drop_missing_in_column", "Remove rows blank in a column"],
  ["drop_column", "Remove column"],
  ["trim_all_whitespace", "Trim all text columns"],
  ["fill_all_numeric_median", "Fill blanks in all numeric columns with their median"],
  ["drop_missing_rows", "Remove rows with any blank"],
  ["drop_empty_columns", "Remove columns with at least 90% missing values"],
  ["drop_constant_columns", "Remove constant columns"],
];
const COLUMN_ACTIONS = ["fill", "trim_whitespace", "convert", "rename_column", "lowercase_column", "drop_missing_in_column", "drop_column"];

function cell(value: unknown): string {
  if (value == null) return "(blank)";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function Impact({ review }: { review: CleanReview }) {
  const columnChanges = [
    review.columns_removed.length ? "Removed columns · " + review.columns_removed.join(", ") : "",
    review.columns_added.length ? "New columns · " + review.columns_added.join(", ") : "",
  ].filter(Boolean);
  return (
    <div aria-live="polite" className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-500/[0.06] p-4 text-sm">
      <h4 className="font-semibold text-white">{review.changed ? "Review changes" : "No changes needed"}</h4>
      {review.changed && <p>{review.rows_removed > 0
        ? `Applying this step will remove ${review.rows_removed.toLocaleString()} ${review.rows_removed === 1 ? "row" : "rows"}.`
        : review.cells_changed === 0 && !columnChanges.length ? "This step changes the stored column type." : "These changes will take effect when you apply this step."}</p>}
      <p className="text-slate-300">
        {review.rows_before.toLocaleString()} rows before · {review.rows_after.toLocaleString()} after
        {review.cells_changed > 0 && ` · ${review.cells_changed.toLocaleString()} changed cells across ${review.rows_edited.toLocaleString()} rows`}
      </p>
      {review.new_blanks > 0 && <p className="text-amber-200">{review.new_blanks.toLocaleString()} {review.new_blanks === 1 ? "value will" : "values will"} become blank.</p>}
      {columnChanges.map(text => <p key={text}>{text}</p>)}
      {review.examples.length > 0 && <div>
        <p className="mb-2 font-medium">Examples from the current dataset</p>
        <ul className="space-y-2">
          {review.examples.map((example, index) => {
            if (example.column && example.after) return <li key={index} className="break-words text-slate-300">
              Row {example.row}, {example.column} · {cell(example.before[example.column])} → {cell(example.after[example.column])}
            </li>;
            const differences = example.kept && Object.keys(example.before).filter(key => example.before[key] !== example.kept?.[key]);
            return <li key={index} className="break-words rounded-lg bg-black/20 p-2 text-slate-300">
              Remove row {example.row}{example.kept_row && ` · Keep row ${example.kept_row}`}
              {differences?.length ? <ul>{differences.map(key => <li key={key}>
                {key} · {cell(example.before[key])} → {cell(example.kept?.[key])}
              </li>)}</ul> : <div className="text-slate-400">{Object.entries(example.before).slice(0, 3).map(([k, v]) => k + " " + cell(v)).join(" · ")}</div>}
            </li>;
          })}
        </ul>
      </div>}
    </div>
  );
}

export function CleaningStudio({ snapshot }: { snapshot: AnalysisSnapshot }) {
  const { applyClean, undoClean, cleaningSteps, load } = useDataset();
  const toast = useToast();
  const columns = snapshot.columns.map(item => item.name);
  const menu = useRef<HTMLDetailsElement>(null);
  const [action, setAction] = useState("drop_duplicates");
  const [column, setColumn] = useState(columns[0]);
  const [byKey, setByKey] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [keep, setKeep] = useState<"first" | "last">("first");
  const [fill, setFill] = useState("value");
  const [newType, setNewType] = useState("convert_numeric");
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState<RowFilter>({ column: columns[0], operator: "equals", value: "" });
  const [review, setReview] = useState<CleanReview | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | "undo" | null>(null);
  const [error, setError] = useState("");
  const profile = snapshot.columns.find(item => item.name === column);
  const numeric = ["integer", "float"].includes(profile?.inferred_type ?? "");
  const needsValue = action === "rename_column" || (action === "fill" && fill === "value");
  const ready = (!needsValue || Boolean(value.trim())) && (action !== "drop_duplicates" || !byKey || keys.length > 0)
    && (action !== "keep_matching_rows" || filter.operator === "blank" || Boolean(filter.value.trim()));

  function operation(): [string, CleanParams] {
    if (action === "drop_duplicates") return [action, byKey ? { columns: keys, keep } : { keep }];
    if (action === "keep_matching_rows") return [action, filter];
    if (action === "fill") {
      if (fill !== "value") return ["fill_missing_numeric", { column, value: fill }];
      return ["fill_missing", { column, value }];
    }
    if (action === "convert") return [newType, { column }];
    if (action === "rename_column") return [action, { column, value }];
    return [action, COLUMN_ACTIONS.includes(action) ? { column } : {}];
  }

  async function run(mode: "preview" | "apply" | "undo") {
    setBusy(mode);
    setError("");
    const [name, params] = operation();
    try {
      if (mode === "preview") {
        const result = await previewClean(snapshot.dataset.id, name, params);
        if (result.revision !== snapshot.revision) throw new ApiError("The dataset changed. Review the current data and try again.", 409);
        setReview(result);
      } else if (mode === "apply" && review) {
        const next = await applyClean(name, { ...params, expected_revision: review.revision });
        if (next) toast.success(next.cleaning?.description ?? "Changes applied.");
      } else if (mode === "undo") {
        const next = await undoClean();
        if (next) toast.success("Undid the last cleaning step.");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not complete this operation.";
      setReview(null);
      setError(message);
      if (cause instanceof ApiError && cause.status === 409) {
        toast.error(message);
        try { await load(snapshot.dataset.id); } catch { setError("Reload the workspace to get the latest data."); }
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Cleaning Studio" subtitle="Choose an operation and review its effect on your dataset.">
      <div className="space-y-4">
        <fieldset disabled={busy !== null} className="min-w-0 space-y-4" onChange={() => { setReview(null); setError(""); }}>
          <div>
            <span className="field-label">Operation</span>
            <details ref={menu} onKeyDown={e => {
              if (e.key === "Escape" && menu.current) {
                menu.current.open = false;
                menu.current.querySelector("summary")?.focus();
              }
            }}>
              <summary className="field cursor-pointer" aria-label="Choose cleaning operation">{[...COMMON, ...MORE].find(([id]) => id === action)?.[1]}</summary>
              <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-violet-400/25 bg-night-900 p-2">
                {([{label: "Common operations", items: COMMON}, {label: "More operations", items: MORE}]).map(({label: group, items: options}) => (
                  <fieldset key={group} className="mb-2 px-1">
                    <legend className="px-2 py-1 text-sm font-semibold text-violet-300">{group}</legend>
                    {options.map(([id, label]) => <button key={id} type="button" aria-pressed={action === id}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10 aria-pressed:bg-violet-500/20"
                      onClick={() => {
                        setAction(id); setValue(""); setReview(null); setError("");
                        if (menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); }
                      }}>{label}</button>)}
                  </fieldset>
                ))}
              </div>
            </details>
          </div>
          {action === "drop_duplicates" && <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="field-label">Find duplicates by</span>
                <select className="field" value={byKey ? "key" : "all"} onChange={e => setByKey(e.target.value === "key")}>
                  <option value="all">All columns (identical rows)</option><option value="key">Selected columns</option>
                </select>
              </label>
              <label><span className="field-label">Row to keep</span>
                <select className="field" value={keep} onChange={e => setKeep(e.target.value as typeof keep)}>
                  <option value="first">First in current row order</option><option value="last">Last in current row order</option>
                </select>
              </label>
            </div>
            {byKey && <fieldset className="rounded-xl border border-white/10 p-3">
              <legend className="px-1 text-sm font-medium">Matching columns</legend>
              <div className="grid max-h-44 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
                {columns.map(col => <label key={col} className="flex items-center gap-2 break-all text-sm">
                  <input type="checkbox" className="accent-violet-500" checked={keys.includes(col)}
                    onChange={e => setKeys(e.target.checked ? [...keys, col] : keys.filter(k => k !== col))} />{col}
                </label>)}
              </div>
              <p className="mt-3 text-sm text-slate-400">Values must match exactly in every selected column, including letter case. Rows with a blank key are kept.</p>
            </fieldset>}
          </div>}
          {COLUMN_ACTIONS.includes(action) && <label className="block"><span className="field-label">Column</span>
            <select className="field" value={column} onChange={e => { setColumn(e.target.value); setFill("value"); }}>
              {columns.map(col => <option key={col}>{col}</option>)}
            </select>
          </label>}
          {action === "fill" && <label className="block"><span className="field-label">Fill blanks with</span>
            <select className="field" value={fill} onChange={e => setFill(e.target.value)}>
              <option value="value">A value I enter</option>
              {numeric && <><option value="mean">Column average (mean)</option><option value="median">Column median</option></>}
            </select>
          </label>}
          {action === "convert" && <label className="block"><span className="field-label">Convert to</span>
            <select className="field" value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="convert_numeric">Number</option><option value="standardize_dates">Date</option>
            </select>
            <span className="mt-1 block text-sm text-slate-400">Values that cannot be converted become blank.</span>
          </label>}
          {needsValue && <label className="block"><span className="field-label">{action === "rename_column" ? "New column name" : "Replacement value"}</span>
            <input className="field" value={value} onChange={e => setValue(e.target.value)} />
          </label>}
          {action === "keep_matching_rows" && <><FilterFields columns={columns} filter={filter} onChange={setFilter} />
            <p className="text-sm text-amber-200">Applying this step removes every row outside the match.</p></>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        {review && <Impact review={review} />}
        {!review && <Button loading={busy === "preview"} disabled={!ready || busy !== null} onClick={() => void run("preview")}>Preview changes</Button>}
        {review?.changed && <Button loading={busy === "apply"} disabled={busy !== null} onClick={() => void run("apply")}>Apply changes</Button>}
        {cleaningSteps.length > 0 && <div className="flex flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-4">
          <details className="max-w-full text-sm text-slate-300">
            <summary className="cursor-pointer">Cleaning history ({cleaningSteps.length})</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">{cleaningSteps.map(step => <li key={step.step}>{step.description}</li>)}</ol>
          </details>
          <Button variant="secondary" disabled={busy !== null} loading={busy === "undo"} onClick={() => void run("undo")}>Undo last step</Button>
        </div>}
      </div>
    </Card>
  );
}
