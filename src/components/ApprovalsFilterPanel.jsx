import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { APPROVAL_STATUS_OPTIONS } from "../utils/approvals";
import { useLanguage } from "../contexts/LanguageContext";

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
  const { language } = useLanguage();
  const isJa = language === "ja";

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 relative z-20 shadow-sm">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[180px_180px_180px_minmax(0,1fr)_auto]">
        <FormField label={isJa ? "工場" : "Factory"}>
          <select
            value={filters.factory}
            onChange={(event) => onFilterChange("factory", event.target.value)}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
          >
            <option value="">{isJa ? "全工場" : "All Factories"}</option>
            {factories.map((factory) => (
              <option key={factory} value={factory}>{factory}</option>
            ))}
          </select>
        </FormField>

        <FormField label={isJa ? "ステータス" : "Status"}>
          <select
            value={filters.status}
            onChange={(event) => onFilterChange("status", event.target.value)}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
          >
            {APPROVAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {isJa ? (option.labelJa || option.label) : option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label={isJa ? "日付" : "Date"}>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange("date", event.target.value)}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)] font-mono"
          />
        </FormField>

        <FormField label={isJa ? "検索" : "Search"}>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={isJa ? "品番、背番号、作業者名..." : "Part no., serial no., worker..."}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--freya-blue)]"
          />
        </FormField>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onClearFilters}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
          >
            {isJa ? "フィルター解除" : "Reset Filters"}
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
        operatorLabels={isJa ? {
          equals: "等しい",
          contains: "含む",
          in: "いずれかを含む",
          greater: "より大きい",
          less: "より小さい",
          range: "範囲",
        } : {
          equals: "Equals",
          contains: "Contains",
          in: "In",
          greater: "Greater than",
          less: "Less than",
          range: "Range",
        }}
        optionsCacheKey={optionsCacheKey}
        title={isJa ? "高度なフィルター" : "Advanced Filters"}
        addRowLabel={isJa ? "条件を追加" : "Add Filter Row"}
        activeSummaryTitle={isJa ? "適用中の条件" : "Active Filters"}
        activeSummaryDescription={isJa ? "適用待ちの詳細検索条件" : "Draft advanced conditions ready to apply."}
        selectFieldLabel={isJa ? "項目を選択" : "Select field"}
        selectOperatorLabel={isJa ? "条件を選択" : "Select operator"}
        chipTone="primary"
        variant="roomy"
        framed
        footer={(
          <>
            <button
              type="button"
              onClick={onApplyAdvancedFilters}
              disabled={advancedApplying}
              className="flex items-center gap-2 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
              {advancedApplying
                ? (isJa ? "適用中..." : "Applying...")
                : (isJa ? "詳細フィルターを適用" : "Apply Advanced Filters")}
            </button>

            <button
              type="button"
              onClick={onClearAdvancedFilters}
              className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              {isJa ? "詳細条件をリセット" : "Reset Advanced Filters"}
            </button>
          </>
        )}
      />
    </div>
  );
}