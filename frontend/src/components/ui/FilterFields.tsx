import type { RowFilter, RowOperator } from "../../types";

export function FilterFields({ columns, filter, onChange }: {
  columns: string[];
  filter: RowFilter;
  onChange: (next: RowFilter) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label><span className="field-label">Column</span>
        <select className="field" value={filter.column} onChange={e => onChange({ ...filter, column: e.target.value })}>
          {columns.map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label><span className="field-label">Condition</span>
        <select className="field" value={filter.operator} onChange={e => onChange({ ...filter, operator: e.target.value as RowOperator })}>
          <option value="equals">Equals</option><option value="contains">Contains text</option>
          <option value="gt">Greater than</option><option value="lt">Less than</option><option value="blank">Is blank</option>
        </select>
      </label>
      {filter.operator !== "blank" && <label><span className="field-label">Value</span>
        <input className="field" required type={["gt", "lt"].includes(filter.operator) ? "number" : "text"} step="any"
          value={filter.value} onChange={e => onChange({ ...filter, value: e.target.value })} />
      </label>}
    </div>
  );
}
