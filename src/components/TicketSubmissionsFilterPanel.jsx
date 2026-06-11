import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { TICKET_SUBMISSION_OPERATOR_LABELS } from "../utils/ticketSubmissions";

export default function TicketSubmissionsFilterPanel({
  className = "",
  keyword,
  factory,
  status,
  startDate,
  endDate,
  rangeLabel,
  scopeLabel,
  paginationLabel,
  appliedAdvancedFilterCount = 0,
  factoryOptions = [],
  statusOptions = [],
  fieldDefinitions,
  advancedRows,
  onKeywordChange,
  onFactoryChange,
  onStatusChange,
  onDateChange,
  onResetBasicFilters,
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
      <div className="grid items-end gap-3 lg:grid-cols-2 xl:grid-cols-6">
        <FormField label="Search Tickets" className="xl:col-span-2">
          <input
            type="search"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="Search by factory, machine, form, field, reason, operator, record ID..."
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </FormField>

        <FormField label="Factory">
          <select
            value={factory}
            onChange={(event) => onFactoryChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All factories</option>
            {factoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Ticket Status">
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>

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
      </div>

      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>calendar_month</span>
            {rangeLabel}
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>confirmation_number</span>
            {scopeLabel}
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>database</span>
            {paginationLabel}
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
            {appliedFilterLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={onResetBasicFilters}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-separator/40 bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          Reset Basic Filters
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-outline">
        Results are paged on the server so large ticket volumes stay responsive. Use quick filters for the common cuts, then refine the result set with advanced filters.
      </p>

      <div className="mt-5">
        <AdvancedFilterSection
          rows={advancedRows}
          fieldDefinitions={fieldDefinitions}
          onUpdateRow={onUpdateAdvancedRow}
          onAddRow={onAddAdvancedRow}
          onRemoveRow={onRemoveAdvancedRow}
          onClearRows={onClearAdvancedFilters}
          operatorLabels={TICKET_SUBMISSION_OPERATOR_LABELS}
          useOperatorLabelsInSelect
          title="Advanced Filters"
          activeSummaryDescription="Draft ticket conditions ready to apply."
          chipTone="amber"
          variant="compact"
          framed
          inputIdPrefix="ticket-submissions-filter-options"
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
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                Reset Advanced Filters
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
}