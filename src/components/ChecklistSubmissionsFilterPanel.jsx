import AdvancedFilterSection from "./AdvancedFilterSection";
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
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">From Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onDateChange("startDate", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">To Date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onDateChange("endDate", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </label>

        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-outline">Current Scope</span>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>calendar_month</span>
              {rangeLabel}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>tune</span>
              {scopeLabel}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
              {appliedFilterLabel}
            </span>
          </div>
          <p className="text-xs leading-5 text-outline">
            Use the date range for the timeline window. Use advanced filters to narrow the timeline to specific factories, machines, or checklist forms.
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
              className="flex items-center gap-2 rounded-xl kinetic-gradient px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
              Apply Advanced Filters
            </button>

            <button
              type="button"
              onClick={onClearAdvancedFilters}
              className="flex items-center gap-2 rounded-xl border border-white/10 glass-card px-5 py-2.5 text-sm font-bold text-on-surface transition-all hover:border-primary/30"
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