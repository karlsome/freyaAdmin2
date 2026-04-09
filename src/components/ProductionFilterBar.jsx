import { useState, useRef, useCallback } from "react";
import { fetchDistinctValues } from "../services/api";

const APPROVAL_STATUS_VALUES = [
  "pending",
  "hancho_approved",
  "fully_approved",
  "correction_needed",
  "correction_needed_from_kacho",
];

// ─── Filter schema — shared fields across kensaDB / pressDB / SRSDB / slitDB ──
export const FILTER_SCHEMA = [
  // Basic
  { field: "品番",              label: "品番",                type: "text",   group: "Basic",                  operators: ["equals", "contains"] },
  { field: "背番号",            label: "背番号",              type: "text",   group: "Basic",                  operators: ["equals", "contains"] },
  { field: "モデル",            label: "モデル",              type: "select", group: "Basic",                  operators: ["equals", "in"] },
  { field: "製造ロット",        label: "製造ロット",          type: "text",   group: "Basic",                  operators: ["equals", "contains"] },
  { field: "Date",              label: "Date",                type: "date",   group: "Basic",                  operators: ["equals", "greater_than", "less_than"] },
  // Quantity & Performance
  { field: "Total",             label: "Total",               type: "number", group: "Quantity & Performance", operators: ["equals", "greater_than", "less_than"] },
  { field: "Total_NG",          label: "Total NG",            type: "number", group: "Quantity & Performance", operators: ["equals", "greater_than", "less_than"] },
  { field: "Process_Quantity",  label: "Process Quantity",    type: "number", group: "Quantity & Performance", operators: ["equals", "greater_than", "less_than"] },
  { field: "Remaining_Quantity",label: "Remaining Quantity",  type: "number", group: "Quantity & Performance", operators: ["equals", "greater_than", "less_than"] },
  { field: "Cycle_Time",        label: "Cycle Time",          type: "number", group: "Quantity & Performance", operators: ["equals", "greater_than", "less_than"] },
  { field: "Spare",             label: "Spare",               type: "number", group: "Quantity & Performance", operators: ["equals", "greater_than", "less_than"] },
  // Time
  { field: "Time_start",        label: "Time Start",          type: "time",   group: "Time",                   operators: ["equals", "greater_than", "less_than"] },
  { field: "Time_end",          label: "Time End",            type: "time",   group: "Time",                   operators: ["equals", "greater_than", "less_than"] },
  // Worker & Equipment
  { field: "Worker_Name",       label: "Worker Name",         type: "select", group: "Worker & Equipment",     operators: ["equals", "in"] },
  { field: "設備",              label: "設備",                type: "select", group: "Worker & Equipment",     operators: ["equals", "in"] },
  // Status
  { field: "approvalStatus",    label: "Approval Status",     type: "select", group: "Status",                 operators: ["equals", "in"], options: APPROVAL_STATUS_VALUES },
];

const FILTER_GROUPS = [...new Set(FILTER_SCHEMA.map((s) => s.group))];

const OPERATOR_LABELS = {
  equals:       "= Equals",
  contains:     "Contains",
  in:           "In",
  greater_than: "> Greater than",
  less_than:    "< Less than",
};

function hasFilterValue(row) {
  if (!row?.field || !row?.operator) return false;
  if (Array.isArray(row.value)) return row.value.length > 0;
  return row.value !== "";
}

let _rowId = 0;
function newRow() { return { id: ++_rowId, field: "", operator: "equals", value: "" }; }

// ─── TagInput ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onAdd, onRemove, placeholder }) {
  const [val, setVal] = useState("");
  const commit = () => {
    const t = val.trim().toUpperCase();
    if (t && !tags.includes(t)) onAdd(t);
    setVal("");
  };
  return (
    <div
            className="ui-control-surface min-h-10 flex flex-wrap gap-1 items-center px-3 py-1.5 rounded-xl
              border border-outline-variant/20 focus-within:border-primary/40 transition-colors cursor-text"
      onClick={(e) => e.currentTarget.querySelector("input")?.focus()}
    >
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
          {t}
          <button type="button" onClick={() => onRemove(t)} className="hover:text-error leading-none">×</button>
        </span>
      ))}
      <input
        type="text"
        value={val}
        placeholder={tags.length ? "" : placeholder}
        className="flex-1 min-w-24 bg-transparent outline-none text-xs text-on-surface placeholder:text-outline"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ─── ProductionFilterBar ──────────────────────────────────────────────────────
// Props:
//   factoryName      — used to scope distinct-value lookups for enum fields
//   defaultDateFrom  — initial "from" date string (YYYY-MM-DD), defaults to today
//   defaultDateTo    — initial "to" date string (YYYY-MM-DD), defaults to today
//   loading          — bool, disables Apply button while parent is fetching
//   onApply          — callback({ dateFrom, dateTo, partNumbers, serialNumbers, advancedFilters })
//   onLotFinderOpen  — optional callback; when provided, shows Manufacturing Lot Finder button
//   children         — optional extra filter fields rendered inside the same grid
function todayStr() { return new Date().toISOString().split("T")[0]; }

export default function ProductionFilterBar({
  factoryName,
  defaultDateFrom = todayStr(),
  defaultDateTo   = todayStr(),
  loading         = false,
  onApply,
  onLotFinderOpen,
  children,
}) {
  const [dateFrom,      setDateFrom]      = useState(defaultDateFrom);
  const [dateTo,        setDateTo]        = useState(defaultDateTo);
  const [partNumbers,   setPartNumbers]   = useState([]);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [advancedOpen,  setAdvancedOpen]  = useState(false);
  const [filterRows,    setFilterRows]    = useState([newRow()]);
  // Cache: { [field]: string[] | "loading" | "error" }
  const enumCache = useRef({});
  const [, forceUpdate] = useState(0);

  const fetchEnum = useCallback((field) => {
    if (!factoryName || enumCache.current[field]) return;
    enumCache.current[field] = "loading";
    forceUpdate((n) => n + 1);
    fetchDistinctValues(factoryName, field)
      .then((vals) => { enumCache.current[field] = vals; forceUpdate((n) => n + 1); })
      .catch(() => { enumCache.current[field] = "error"; forceUpdate((n) => n + 1); });
  }, [factoryName]);

  const addRow    = () => setFilterRows((r) => [...r, newRow()]);
  const removeRow = (id) => setFilterRows((r) => r.filter((x) => x.id !== id));
  const updateRow = (id, patch) =>
    setFilterRows((r) => r.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...patch };
      // When field changes: reset value, default operator to the first supported one, trigger enum fetch
      if ("field" in patch && patch.field !== x.field) {
        const def = FILTER_SCHEMA.find((s) => s.field === patch.field);
        next.operator = def?.operators?.[0] || "equals";
        next.value = next.operator === "in" ? [] : "";
        if (def?.type === "select" && !def.options) fetchEnum(patch.field);
      }

      if ("operator" in patch && patch.operator !== x.operator) {
        next.value = patch.operator === "in" ? [] : "";
      }

      if ("value" in patch && x.operator === "in" && !Array.isArray(patch.value)) {
        next.value = patch.value ? [patch.value] : [];
      }
      return next;
    }));

  const handleApply = () => {
    const advancedFilters = filterRows.filter(hasFilterValue);
    onApply?.({ dateFrom, dateTo, partNumbers, serialNumbers, advancedFilters });
  };

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      {/* Core filters grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 px-3 rounded-xl bg-white border border-outline-variant/20 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 px-3 rounded-xl bg-white border border-outline-variant/20 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">品番 (Part No.)</label>
          <TagInput
            tags={partNumbers}
            onAdd={(t) => setPartNumbers((v) => [...v, t])}
            onRemove={(t) => setPartNumbers((v) => v.filter((x) => x !== t))}
            placeholder="Enter to add…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">背番号 (Serial No.)</label>
          <TagInput
            tags={serialNumbers}
            onAdd={(t) => setSerialNumbers((v) => [...v, t])}
            onRemove={(t) => setSerialNumbers((v) => v.filter((x) => x !== t))}
            placeholder="Enter to add…"
          />
        </div>

        {/* Extra filters injected by the parent page */}
        {children}
      </div>

      {/* Advanced filters — dynamic rows */}
      <button
        className="flex items-center gap-1.5 text-xs font-bold text-outline hover:text-on-surface transition-colors mb-3"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {advancedOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
        </span>
        Advanced Filters
        {filterRows.some(hasFilterValue) && (
          <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold normal-case tracking-normal">
            {filterRows.filter(hasFilterValue).length} active
          </span>
        )}
      </button>

      {advancedOpen && (
        <div className="mb-4 space-y-2">
          {filterRows.map((row) => {
            const schemaDef  = FILTER_SCHEMA.find((s) => s.field === row.field);
            const operators  = schemaDef?.operators ?? [];
            const inputType  = schemaDef?.type === "number" ? "number" : schemaDef?.type === "time" ? "time" : schemaDef?.type === "date" ? "date" : "text";
            const cached = row.field && schemaDef?.type === "select" && !schemaDef?.options ? enumCache.current[row.field] : null;
            const enumOptions = Array.isArray(schemaDef?.options) ? schemaDef.options : Array.isArray(cached) ? cached : [];
            const enumLoading = cached === "loading";
            const isSelectField = schemaDef?.type === "select";
            const isMultiSelect = row.operator === "in";
            const selectedValue = isMultiSelect
              ? (Array.isArray(row.value) ? row.value : row.value ? [row.value] : [])
              : Array.isArray(row.value)
                ? row.value[0] || ""
                : row.value;

            return (
              <div key={row.id} className="flex items-center gap-2 flex-wrap">
                {/* Field selector — grouped */}
                <select
                  value={row.field}
                  onChange={(e) => updateRow(row.id, { field: e.target.value })}
                  className="h-9 px-3 rounded-xl bg-white border border-outline-variant/20 text-xs text-on-surface
                             outline-none focus:border-primary/40 transition-colors flex-1 min-w-[160px]"
                >
                  <option value="">Select Field</option>
                  {FILTER_GROUPS.map((group) => (
                    <optgroup key={group} label={group}>
                      {FILTER_SCHEMA.filter((s) => s.group === group).map((s) => (
                        <option key={s.field} value={s.field}>{s.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {/* Operator selector */}
                <select
                  value={row.operator}
                  onChange={(e) => updateRow(row.id, { operator: e.target.value })}
                  disabled={!row.field}
                  className="h-9 px-3 rounded-xl bg-white border border-outline-variant/20 text-xs text-on-surface
                             outline-none focus:border-primary/40 transition-colors flex-1 min-w-[140px]
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Select Operator</option>
                  {operators.map((op) => (
                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                  ))}
                </select>

                {/* Value — select or free-text/number/date/time input */}
                {isSelectField ? (
                  <select
                    value={selectedValue}
                    multiple={isMultiSelect}
                    size={isMultiSelect ? Math.min(Math.max(enumOptions.length, 4), 8) : undefined}
                    onChange={(e) => updateRow(row.id, {
                      value: isMultiSelect
                        ? Array.from(e.target.selectedOptions, (option) => option.value)
                        : e.target.value,
                    })}
                    className={`rounded-xl bg-white border border-outline-variant/20 text-xs text-on-surface
                               outline-none focus:border-primary/40 transition-colors flex-[2] min-w-[160px] px-3 ${isMultiSelect ? "min-h-28 py-2" : "h-9"}`}
                  >
                    {!isMultiSelect ? (
                      <option value="">
                        {enumLoading ? `Loading ${schemaDef?.label ?? row.field}...` : `Select ${schemaDef?.label ?? row.field}...`}
                      </option>
                    ) : null}
                    {enumOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={inputType}
                    value={row.value}
                    onChange={(e) => updateRow(row.id, { value: e.target.value })}
                    disabled={!row.operator}
                    placeholder="Enter Value"
                    className="h-9 px-3 rounded-xl bg-white border border-outline-variant/20 text-xs text-on-surface
                               placeholder:text-outline outline-none focus:border-primary/40 transition-colors flex-[2] min-w-[160px]
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                )}

                {/* Remove row */}
                <button
                  onClick={() => removeRow(row.id)}
                  className="p-2 rounded-xl text-outline hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            );
          })}

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-white/20
                       text-xs font-bold text-outline hover:text-on-surface hover:border-primary/40 transition-colors mt-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Add Filter
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={loading}
          onClick={handleApply}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl kinetic-gradient text-white text-sm font-bold
                     hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[0_0_20px_rgba(99,102,241,0.25)]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
          {loading ? "Loading…" : "Apply Filters"}
        </button>

        {onLotFinderOpen && (
          <button
            onClick={onLotFinderOpen}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card border border-white/10 text-sm font-bold
                       text-on-surface hover:border-primary/30 hover:scale-[1.02] transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_search</span>
            Manufacturing Lot Finder
          </button>
        )}
      </div>
    </div>
  );
}
