import { useState } from "react";
import { fetchDistinctValues } from "../services/api";
import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import TagInput from "./TagInput";
import CustomFieldSelectorModal from "./CustomFieldSelectorModal";

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
  { field: "品番",              label: "品番",                type: "select", group: "Basic",                  operators: ["equals", "in"] },
  { field: "背番号",            label: "背番号",              type: "select", group: "Basic",                  operators: ["equals", "not_equals", "in", "exists", "not_exists"] },
  { field: "モデル",            label: "モデル",              type: "select", group: "Basic",                  operators: ["equals", "not_equals", "in", "exists", "not_exists"] },
  { field: "製造ロット",        label: "製造ロット",          type: "text",   group: "Basic",                  operators: ["equals", "not_equals", "contains", "exists", "not_exists"] },
  { field: "Date",              label: "Date",                type: "date",   group: "Basic",                  operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  // Quantity & Performance
  { field: "Total",             label: "Total",               type: "number", group: "Quantity & Performance", operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  { field: "Total_NG",          label: "Total NG",            type: "number", group: "Quantity & Performance", operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  { field: "Process_Quantity",  label: "Process Quantity",    type: "number", group: "Quantity & Performance", operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  { field: "Remaining_Quantity",label: "Remaining Quantity",  type: "number", group: "Quantity & Performance", operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  { field: "Cycle_Time",        label: "Cycle Time",          type: "number", group: "Quantity & Performance", operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  { field: "Spare",             label: "Spare",               type: "number", group: "Quantity & Performance", operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  // Time
  { field: "Time_start",        label: "Time Start",          type: "time",   group: "Time",                   operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  { field: "Time_end",          label: "Time End",            type: "time",   group: "Time",                   operators: ["equals", "not_equals", "greater_than", "less_than", "exists", "not_exists"] },
  // Worker & Equipment
  { field: "Worker_Name",       label: "Worker Name",         type: "select", group: "Worker & Equipment",     operators: ["equals", "not_equals", "in", "exists", "not_exists"] },
  { field: "設備",              label: "設備",                type: "select", group: "Worker & Equipment",     operators: ["equals", "not_equals", "in", "exists", "not_exists"] },
  // Status
  { field: "approvalStatus",    label: "Approval Status",     type: "select", group: "Status",                 operators: ["equals", "not_equals", "in", "exists", "not_exists"], options: APPROVAL_STATUS_VALUES },
];

const OPERATOR_LABELS = {
  equals:       "= equals",
  not_equals:   "≠ is not",
  contains:     "contains",
  in:           "in",
  exists:       "exists",
  not_exists:   "does not exist",
  greater_than: "> greater than",
  less_than:    "< less than",
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
  defaultPartNumbers = [],
  defaultSerialNumbers = [],
  defaultAdvancedFilters = [],
  loading         = false,
  onApply,
  onReset,
  onLotFinderOpen,
  children,
}) {
  const [dateFrom,      setDateFrom]      = useState(defaultDateFrom);
  const [dateTo,        setDateTo]        = useState(defaultDateTo);
  const [partNumbers,   setPartNumbers]   = useState(defaultPartNumbers);
  const [serialNumbers, setSerialNumbers] = useState(defaultSerialNumbers);
  const [filterRows,    setFilterRows]    = useState(() => {
    if (defaultAdvancedFilters && defaultAdvancedFilters.length > 0) {
      return defaultAdvancedFilters.map(f => ({ ...f, id: ++_rowId }));
    }
    return [newRow()];
  });

  const [customFields, setCustomFields] = useState([]);
  const [activeCustomRowId, setActiveCustomRowId] = useState(null);

  const handleAddRow    = () => setFilterRows((r) => [...r, newRow()]);
  const handleRemoveRow = (id) => setFilterRows((r) => r.filter((x) => x.id !== id));
  const handleClearRows = () => setFilterRows([newRow()]);
  
  const handleUpdateRow = (id, patch) =>
    setFilterRows((r) => r.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...patch };
      if ("field" in patch && patch.field !== x.field) {
        const def = [...FILTER_SCHEMA, ...customFields].find((s) => s.field === patch.field);
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

  const handleCustomFieldClick = (rowId) => {
    setActiveCustomRowId(rowId);
  };

  const handleSelectCustomField = (fieldPath, type) => {
    const newSchema = {
      field: fieldPath,
      label: fieldPath,
      type: type,
      group: "Custom",
      operators: type === "number" || type === "date" || type === "time"
        ? ["equals", "greater_than", "less_than"]
        : ["equals", "contains", "in"]
    };
    
    if (!customFields.find(f => f.field === fieldPath)) {
      setCustomFields(prev => [...prev, newSchema]);
    }
    
    handleUpdateRow(activeCustomRowId, {
      field: fieldPath,
      operator: "equals",
      value: ""
    });

    setActiveCustomRowId(null);
  };

  const handleApply = () => {
    const advancedFilters = filterRows.filter(hasFilterValue).map(row => {
      const def = [...FILTER_SCHEMA, ...customFields].find(s => s.field === row.field);
      return { ...row, type: def?.type || "text" };
    });
    onApply?.({ dateFrom, dateTo, partNumbers, serialNumbers, advancedFilters });
  };

  const hasActiveFilters = 
    dateFrom !== todayStr() ||
    dateTo !== todayStr() ||
    partNumbers.length > 0 ||
    serialNumbers.length > 0 ||
    filterRows.some(hasFilterValue);

  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-separator/30 mb-6">
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

        {children}
      </div>

      <div className="mt-4 pt-4 border-t border-separator/30">
        <AdvancedFilterSection
          rows={filterRows}
          fieldDefinitions={[...FILTER_SCHEMA, ...customFields]}
          onUpdateRow={handleUpdateRow}
          onAddRow={handleAddRow}
          onRemoveRow={handleRemoveRow}
          onClearRows={handleClearRows}
          loadDistinctOptions={(field) => fetchDistinctValues(factoryName, field)}
          shouldLoadOptions={(fieldDefinition) => fieldDefinition.type === "select"}
          operatorLabels={OPERATOR_LABELS}
          useOperatorLabelsInSelect
          optionsCacheKey={factoryName}
          onCustomFieldClick={handleCustomFieldClick}
          title="Advanced Filters"
          addRowLabel="Add Filter"
          showActiveSummary={false}
          variant="compact"
          framed={false}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={loading}
          onClick={handleApply}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold
                     hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
          {loading ? "Loading…" : "Apply Filters"}
        </button>

        {onReset && hasActiveFilters && (
          <button
            disabled={loading}
            onClick={() => {
              setDateFrom(todayStr());
              setDateTo(todayStr());
              setPartNumbers([]);
              setSerialNumbers([]);
              setFilterRows([newRow()]);
              onReset?.();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-error/20 bg-error/10 text-error text-sm font-semibold
                       hover:bg-error/15 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt_off</span>
            Reset Filters
          </button>
        )}

        {onLotFinderOpen && (
          <button
            onClick={onLotFinderOpen}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card border border-separator/40 text-sm font-semibold
                       text-on-surface hover:border-primary/30 hover:scale-[1.02] transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>manage_search</span>
            Manufacturing Lot Finder
          </button>
        )}
      </div>

      {activeCustomRowId && (
        <CustomFieldSelectorModal 
          onClose={() => setActiveCustomRowId(null)}
          onSelectField={handleSelectCustomField}
        />
      )}
    </div>
  );
}
