import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { CHECKLIST_SUBMISSION_OPERATOR_LABELS } from "../utils/checklistSubmissions";

export default function ChecklistSubmissionsFilterPanel({
  className = "",
  startDate,
  endDate,
  rangeLabel,
  scopeLabel,
  appliedAdvancedFilterCount = 0,
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
  const appliedFilterLabel = appliedAdvancedFilterCount
    ? `${appliedAdvancedFilterCount} advanced filter${appliedAdvancedFilterCount === 1 ? "" : "s"} applied`
    : "No advanced filters applied";

  return (
    <div className={`glass-card rounded-2xl p-5 ${className}`.trim()}>
      <div className="grid items-end gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <FormField label="From Date">
          <input
            type="date"
            value={startDate}
            onChange={(event) => onDateChange("startDate", event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </FormField>

        <FormField label="To Date">
          <input
            type="date"
            value={endDate}
            onChange={(event) => onDateChange("endDate", event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </FormField>

        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-outline">Current Scope</span>
            <button
              type="button"
              onClick={onResetDateRange}
              className="text-[10px] font-semibold uppercase tracking-wider text-primary transition hover:opacity-70"
            >
              Reset Default 30d
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>calendar_month</span>
              {rangeLabel}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>tune</span>
              {scopeLabel}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
              {appliedFilterLabel}
            </span>
          </div>
          <p className="text-xs leading-5 text-outline">
            Use the date range for the timeline window. Advanced filters now cover machine scope, checklist form, schedule, operator, NG state, submission activity, counts, dates, and keyword search.
          </p>
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
              className="flex items-center gap-2 rounded-xl kinetic-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-opacity hover:opacity-90"
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