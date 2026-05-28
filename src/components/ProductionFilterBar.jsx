import { useState } from "react";
import { fetchDistinctValues } from "../services/api";
import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import TagInput from "./TagInput";

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
  const [filterRows,    setFilterRows]    = useState([newRow()]);

  const addRow    = () => setFilterRows((r) => [...r, newRow()]);
  const removeRow = (id) => setFilterRows((r) => r.filter((x) => x.id !== id));
  const clearAdvancedRows = () => setFilterRows([newRow()]);
  const updateRow = (id, patch) =>
    setFilterRows((r) => r.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...patch };
      if ("field" in patch && patch.field !== x.field) {
        const def = FILTER_SCHEMA.find((s) => s.field === patch.field);
        next.operator = def?.operators?.[0] || "equals";
        next.value = next.operator === "in" ? [] : "";
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
        <FormField label="From">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 px-3 rounded-xl bg-white border border-separator/40 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
          />
        </FormField>
        <FormField label="To">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 px-3 rounded-xl bg-white border border-separator/40 text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
          />
        </FormField>
        <FormField label="品番 (Part No.)">
          <TagInput
            tags={partNumbers}
            onAdd={(t) => setPartNumbers((v) => [...v, t])}
            onRemove={(t) => setPartNumbers((v) => v.filter((x) => x !== t))}
            placeholder="Enter to add…"
            uppercase
          />
        </FormField>
        <FormField label="背番号 (Serial No.)">
          <TagInput
            tags={serialNumbers}
            onAdd={(t) => setSerialNumbers((v) => [...v, t])}
            onRemove={(t) => setSerialNumbers((v) => v.filter((x) => x !== t))}
            placeholder="Enter to add…"
            uppercase
          />
        </FormField>

        {/* Extra filters injected by the parent page */}
        {children}
      </div>

      {/* Advanced filters — dynamic rows */}
      <AdvancedFilterSection
        rows={filterRows}
        fieldDefinitions={FILTER_SCHEMA}
        onUpdateRow={updateRow}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onClearRows={clearAdvancedRows}
        loadDistinctOptions={(field) => fetchDistinctValues(factoryName, field)}
        shouldLoadOptions={(fieldDefinition) => fieldDefinition.type === "select"}
        operatorLabels={OPERATOR_LABELS}
        useOperatorLabelsInSelect
        optionsCacheKey={factoryName}
        addRowLabel="Add Filter"
        showActiveSummary={false}
        variant="compact"
        framed={false}
      />

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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card border border-separator/35 text-sm font-bold
                       text-on-surface hover:border-primary/30 hover:scale-[1.02] transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_search</span>
            Manufacturing Lot Finder
          </button>
        )}
      </div>
    </div>
  );
}
