import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { APPROVAL_STATUS_OPTIONS } from "../utils/approvals";

export default function ApprovalsFilterPanel({
  filters,
  factories,
  searchInput,
  fieldDefinitions,
  advancedRows,
  advancedApplying = false,
  optionsCacheKey,
  onFilterChange,
  onSearchChange,
  onClearFilters,
  onAddAdvancedRow,
  onUpdateAdvancedRow,
  onRemoveAdvancedRow,
  onApplyAdvancedFilters,
  onClearAdvancedFilters,
  loadDistinctOptions,
}) {
  return (
    <div className="glass-card mb-6 rounded-[28px] p-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[180px_180px_180px_minmax(0,1fr)_auto]">
        <FormField label="Factory">
          <select
            value={filters.factory}
            onChange={(event) => onFilterChange("factory", event.target.value)}
            className="h-11 rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          >
            <option value="">All Factories</option>
            {factories.map((factory) => (
              <option key={factory} value={factory}>{factory}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Status">
          <select
            value={filters.status}
            onChange={(event) => onFilterChange("status", event.target.value)}
            className="h-11 rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          >
            {APPROVAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Date">
          <input
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange("date", event.target.value)}
            className="h-11 rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          />
        </FormField>

        <FormField label="Search">
          <input
            type="text"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Part no., serial no., worker..."
            className="h-11 rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          />
        </FormField>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onClearFilters}
            className="h-11 rounded-2xl border border-separator/40 bg-white px-4 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <AdvancedFilterSection
        rows={advancedRows}
        fieldDefinitions={fieldDefinitions}
        onUpdateRow={onUpdateAdvancedRow}
        onAddRow={onAddAdvancedRow}
        onRemoveRow={onRemoveAdvancedRow}
        onClearRows={onClearAdvancedFilters}
        loadDistinctOptions={loadDistinctOptions}
        shouldLoadOptions={(fieldDefinition) => fieldDefinition.type === "select"}
        operatorLabels={{
          equals: "Equals",
          contains: "Contains",
          in: "In",
          greater: "Greater than",
          less: "Less than",
          range: "Range",
        }}
        optionsCacheKey={optionsCacheKey}
        activeSummaryDescription="Draft advanced conditions ready to apply."
        chipTone="primary"
        variant="roomy"
        framed
        footer={(
          <>
            <button
              type="button"
              onClick={onApplyAdvancedFilters}
              disabled={advancedApplying}
              className="flex items-center gap-2 rounded-2xl kinetic-gradient px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.25)] transition hover:opacity-90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
              {advancedApplying ? "Applying..." : "Apply Advanced Filters"}
            </button>

            <button
              type="button"
              onClick={onClearAdvancedFilters}
              className="flex items-center gap-2 rounded-2xl border border-separator/40 bg-white px-5 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
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