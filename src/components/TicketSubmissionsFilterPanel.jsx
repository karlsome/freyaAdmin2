import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import { TICKET_SUBMISSION_OPERATOR_LABELS } from "../utils/ticketSubmissions";
import { useLanguage } from "../contexts/LanguageContext";

export default function TicketSubmissionsFilterPanel({
  className = "",
  keyword,
  factory,
  machine = "",
  status,
  startDate,
  endDate,
  rangeLabel,
  scopeLabel,
  appliedAdvancedFilterCount = 0,
  factoryOptions = [],
  machineOptions = [],
  statusOptions = [],
  fieldDefinitions,
  advancedRows,
  onKeywordChange,
  onFactoryChange,
  onMachineChange,
  onStatusChange,
  onDateChange,
  onResetBasicFilters,
  onAddAdvancedRow,
  onUpdateAdvancedRow,
  onRemoveAdvancedRow,
  onApplyAdvancedFilters,
  onClearAdvancedFilters,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const appliedFilterLabel = appliedAdvancedFilterCount
    ? (isJa ? `${appliedAdvancedFilterCount} 件の詳細条件を適用中` : `${appliedAdvancedFilterCount} advanced filter${appliedAdvancedFilterCount === 1 ? "" : "s"} applied`)
    : (isJa ? "詳細フィルターなし" : "No advanced filters applied");

  return (
    <div className={`glass-card rounded-2xl p-5 relative z-20 ${className}`.trim()}>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FormField label={isJa ? "チケット検索" : "Search Tickets"} className="xl:col-span-2">
          <input
            type="search"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder={isJa ? "点検項目、設備名、理由、作業者で検索..." : "Search by check item, machine, reason, operator..."}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </FormField>

        <FormField label={isJa ? "工場" : "Factory"}>
          <select
            value={factory}
            onChange={(event) => onFactoryChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">{isJa ? "すべての工場" : "All factories"}</option>
            {factoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField label={isJa ? "設備" : "Machine"}>
          <select
            value={machine}
            onChange={(event) => onMachineChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">{isJa ? "すべての設備" : "All machines"}</option>
            {machineOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField label={isJa ? "対応ステータス" : "Ticket Status"}>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">{isJa ? "すべてのステータス" : "All statuses"}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label={isJa ? "開始日" : "From Date"}>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onDateChange("startDate", event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          />
        </FormField>

        <FormField label={isJa ? "終了日" : "To Date"}>
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
          <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>calendar_month</span>
            {rangeLabel}
          </span>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-separator/40 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>confirmation_number</span>
            {scopeLabel}
          </span>
          {appliedAdvancedFilterCount > 0 && (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt</span>
              {appliedFilterLabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onResetBasicFilters}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-separator/40 bg-surface px-4 py-2 text-xs font-semibold text-on-surface transition hover:border-primary/30 hover:text-primary"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span>
          {isJa ? "フィルターをリセット" : "Reset Filters"}
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-outline">
        {isJa
          ? "大量のチケットでも快適に動作するようサーバーページングされています。クイックフィルターや詳細フィルターで絞り込みを行ってください。"
          : "Results are paged on the server so large ticket volumes stay responsive. Use quick filters for the common cuts, then refine the result set with advanced filters."}
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
          title={isJa ? "詳細フィルター" : "Advanced Filters"}
          addRowLabel={isJa ? "フィルター条件を追加" : "Add Filter Row"}
          activeSummaryTitle={isJa ? "適用中のフィルター" : "Active Filters"}
          activeSummaryDescription={isJa ? "適用待ちのチケット条件" : "Draft ticket conditions ready to apply."}
          chipTone="amber"
          variant="compact"
          framed
          inputIdPrefix="ticket-submissions-filter-options"
          footer={(
            <>
              <button
                type="button"
                onClick={onApplyAdvancedFilters}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
                {isJa ? "詳細フィルターを適用" : "Apply Advanced Filters"}
              </button>

              <button
                type="button"
                onClick={onClearAdvancedFilters}
                className="flex items-center gap-2 rounded-xl border border-separator/40 glass-card px-5 py-2.5 text-sm font-semibold text-on-surface transition-all hover:border-primary/30"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                {isJa ? "フィルターをリセット" : "Reset Advanced Filters"}
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
}