import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { CHECKLIST_SUBMISSION_OPERATOR_LABELS } from "../utils/checklistSubmissions";

export default function ChecklistSubmissionsFilterPanel({
  className = "",
  startDate,
  endDate,
  fieldDefinitions,
  advancedRows,
  onDateChange,
  onResetDateRange,
  onAddAdvancedRow,
  onUpdateAdvancedRow,
  onRemoveAdvancedRow,
  onApplyAdvancedFilters,
  onClearAdvancedFilters,
}) {
  function handlePresetRange(days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    onDateChange("startDate", formatDate(start));
    onDateChange("endDate", formatDate(today));
  }

  function handleThisMonth() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    onDateChange("startDate", formatDate(start));
    onDateChange("endDate", formatDate(end));
  }

  return (
    <div className={`glass-card rounded-2xl p-5 relative z-20 ${className}`.trim()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="From Date">
            <input
              type="date"
              value={startDate}
              onChange={(event) => onDateChange("startDate", event.target.value)}
              className="h-10 rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            />
          </FormField>

          <FormField label="To Date">
            <input
              type="date"
              value={endDate}
              onChange={(event) => onDateChange("endDate", event.target.value)}
              className="h-10 rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            />
          </FormField>

          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => handlePresetRange(7)}
              className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high active:scale-95"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetRange(30)}
              className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high active:scale-95"
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={handleThisMonth}
              className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high active:scale-95"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={onResetDateRange}
              className="inline-flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-outline transition hover:bg-surface-container-high hover:text-on-surface active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
              Reset
            </button>
          </div>
        </div>
      </div>

      <AdvancedFilterSection
        rows={advancedRows}
        fieldDefinitions={fieldDefinitions}
        onUpdateRow={onUpdateAdvancedRow}
        onAddRow={onAddAdvancedRow}
        onRemoveRow={onRemoveAdvancedRow}
        onClearRows={onClearAdvancedFilters}
        operatorLabels={CHECKLIST_SUBMISSION_OPERATOR_LABELS}
        useOperatorLabelsInSelect
        title="Advanced Filters"
        activeSummaryDescription="Draft timeline conditions ready to apply."
        chipTone="amber"
        variant="compact"
        framed
        inputIdPrefix="checklist-submissions-filter-options"
        footer={(
          <>
            <button
              type="button"
              onClick={onApplyAdvancedFilters}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
              Apply Advanced Filters
            </button>

            <button
              type="button"
              onClick={onClearAdvancedFilters}
              className="flex items-center gap-2 rounded-xl border border-separator/40 glass-card px-5 py-2.5 text-sm font-semibold text-on-surface transition-all hover:border-primary/30"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              Reset Advanced Filters
            </button>
          </>
        )}
      />
    </div>
  );
}