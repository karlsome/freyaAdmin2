import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { getChecklistSubmissionOperatorLabels } from "../utils/checklistSubmissions";
import { useLanguage } from "../contexts/LanguageContext";

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
  const { language } = useLanguage();
  const isJa = language === "ja";

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
    <div className={`freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm relative z-20 ${className}`.trim()}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={isJa ? "開始日" : "From Date"}>
            <input
              type="date"
              value={startDate}
              onChange={(event) => onDateChange("startDate", event.target.value)}
              className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
            />
          </FormField>

          <FormField label={isJa ? "終了日" : "To Date"}>
            <input
              type="date"
              value={endDate}
              onChange={(event) => onDateChange("endDate", event.target.value)}
              className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
            />
          </FormField>

          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => handlePresetRange(7)}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {isJa ? "7日間" : "7 Days"}
            </button>
            <button
              type="button"
              onClick={() => handlePresetRange(30)}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {isJa ? "30日間" : "30 Days"}
            </button>
            <button
              type="button"
              onClick={handleThisMonth}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {isJa ? "今月" : "This Month"}
            </button>
            <button
              type="button"
              onClick={onResetDateRange}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
              {isJa ? "リセット" : "Reset"}
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
        operatorLabels={getChecklistSubmissionOperatorLabels(isJa)}
        useOperatorLabelsInSelect
        selectFieldLabel={isJa ? "項目を選択" : "Select field"}
        selectOperatorLabel={isJa ? "条件を選択" : "Select operator"}
        title={isJa ? "詳細フィルター" : "Advanced Filters"}
        addRowLabel={isJa ? "フィルター条件を追加" : "Add Filter Row"}
        activeSummaryTitle={isJa ? "適用中のフィルター" : "Active Filters"}
        activeSummaryDescription={isJa ? "適用待ちの詳細フィルター条件" : "Draft timeline conditions ready to apply."}
        chipTone="amber"
        variant="compact"
        framed
        inputIdPrefix="checklist-submissions-filter-options"
        footer={(
          <>
            <button
              type="button"
              onClick={onApplyAdvancedFilters}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>filter_alt</span>
              {isJa ? "詳細フィルターを適用" : "Apply Advanced Filters"}
            </button>

            <button
              type="button"
              onClick={onClearAdvancedFilters}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
              {isJa ? "フィルターをリセット" : "Reset Advanced Filters"}
            </button>
          </>
        )}
      />
    </div>
  );
}