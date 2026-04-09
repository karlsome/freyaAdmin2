import { useEffect, useState } from "react";
import {
  APPROVAL_STATUS_OPTIONS,
  getActiveApprovalAdvancedFilters,
} from "../utils/approvals";

function RowValueInput({ row, fieldDefinition, options, loading, onChange }) {
  if (!fieldDefinition) {
    return (
      <input
        type="text"
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        disabled
        className="h-10 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none opacity-40 dark:bg-surface-container"
      />
    );
  }

  if (row.operator === "range") {
    const inputType = fieldDefinition.type === "number"
      ? "number"
      : fieldDefinition.type === "time"
        ? "time"
        : fieldDefinition.type === "date"
          ? "date"
          : "text";

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type={inputType}
          value={row.valueFrom}
          onChange={(event) => onChange({ valueFrom: event.target.value })}
          className="h-10 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          placeholder="From"
        />
        <input
          type={inputType}
          value={row.valueTo}
          onChange={(event) => onChange({ valueTo: event.target.value })}
          className="h-10 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          placeholder="To"
        />
      </div>
    );
  }

  if (fieldDefinition.type === "select") {
    const isMultiSelect = row.operator === "in";
    const selectedValue = isMultiSelect
      ? (Array.isArray(row.value) ? row.value : row.value ? [row.value] : [])
      : Array.isArray(row.value)
        ? row.value[0] || ""
        : row.value;
    const placeholder = loading
      ? `Loading ${fieldDefinition.label}...`
      : options.length
        ? `Select ${fieldDefinition.label}...`
        : `No ${fieldDefinition.label} values`;

    return (
      <select
        value={selectedValue}
        multiple={isMultiSelect}
        size={isMultiSelect ? Math.min(Math.max(options.length, 4), 8) : undefined}
        onChange={(event) => {
          if (isMultiSelect) {
            onChange({ value: Array.from(event.target.selectedOptions, (option) => option.value) });
            return;
          }

          onChange({ value: event.target.value });
        }}
        className={`w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container ${isMultiSelect ? "min-h-32 py-2" : "h-10"}`}
      >
        {!isMultiSelect ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (row.operator === "in") {
    return (
      <input
        type="text"
        value={Array.isArray(row.value) ? row.value.join(", ") : row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        className="h-10 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
        placeholder="Comma separated values"
      />
    );
  }

  const inputType = fieldDefinition.type === "number"
    ? "number"
    : fieldDefinition.type === "date"
      ? "date"
      : fieldDefinition.type === "time"
        ? "time"
        : "text";

  return (
    <input
      type={inputType}
      value={row.value}
      onChange={(event) => onChange({ value: event.target.value })}
      className="h-10 w-full rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
      placeholder="Enter value"
    />
  );
}

export default function ApprovalsFilterPanel({
  filters,
  factories,
  searchInput,
  fieldDefinitions,
  advancedRows,
  advancedApplying = false,
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [optionsByField, setOptionsByField] = useState({});
  const [loadingFields, setLoadingFields] = useState({});

  useEffect(() => {
    advancedRows.forEach((row) => {
      const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
      const hasStaticOptions = Array.isArray(fieldDefinition?.options) && fieldDefinition.options.length > 0;
      if (!row.field || !fieldDefinition || fieldDefinition.type !== "select" || hasStaticOptions) return;
      if (optionsByField[row.field] || loadingFields[row.field]) return;

      setLoadingFields((current) => ({ ...current, [row.field]: true }));
      loadDistinctOptions(row.field)
        .then((values) => {
          setOptionsByField((current) => ({ ...current, [row.field]: Array.isArray(values) ? values : [] }));
        })
        .catch(() => {
          setOptionsByField((current) => ({ ...current, [row.field]: [] }));
        })
        .finally(() => {
          setLoadingFields((current) => ({ ...current, [row.field]: false }));
        });
    });
  }, [advancedRows, fieldDefinitions, loadDistinctOptions, loadingFields, optionsByField]);

  const fieldGroups = [...new Set(fieldDefinitions.map((field) => field.group))];
  const activeFilters = getActiveApprovalAdvancedFilters(advancedRows, fieldDefinitions);

  return (
    <div className="glass-card mb-6 rounded-[28px] p-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[180px_180px_180px_minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Factory</label>
          <select
            value={filters.factory}
            onChange={(event) => onFilterChange("factory", event.target.value)}
            className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          >
            <option value="">All Factories</option>
            {factories.map((factory) => (
              <option key={factory} value={factory}>{factory}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Status</label>
          <select
            value={filters.status}
            onChange={(event) => onFilterChange("status", event.target.value)}
            className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          >
            {APPROVAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Date</label>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange("date", event.target.value)}
            className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Search</label>
          <input
            type="text"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Part no., serial no., worker..."
            className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onClearFilters}
            className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-outline-variant/15 bg-surface-container-low/30">
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-bold text-outline transition-colors hover:text-on-surface"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
            <span className="uppercase tracking-wider">Advanced Filters</span>
            {activeFilters.length ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-primary">
                {activeFilters.length} active
              </span>
            ) : null}
          </div>

          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>
            {advancedOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
        </button>

        {advancedOpen ? (
          <div className="border-t border-outline-variant/15 px-4 py-4">
            <div className="space-y-3">
              {advancedRows.map((row) => {
                const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
                const operators = fieldDefinition?.operators || [];
                const options = Array.isArray(fieldDefinition?.options)
                  ? fieldDefinition.options
                  : (optionsByField[row.field] || []);

                return (
                  <div key={row.id} className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.field}
                      onChange={(event) => {
                        const nextField = event.target.value;
                        const nextDefinition = fieldDefinitions.find((field) => field.field === nextField);
                        onUpdateAdvancedRow(row.id, {
                          field: nextField,
                          operator: nextDefinition?.operators?.[0] || "",
                          value: "",
                          valueFrom: "",
                          valueTo: "",
                        });
                      }}
                      className="h-10 min-w-[190px] flex-1 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    >
                      <option value="">Select field</option>
                      {fieldGroups.map((group) => (
                        <optgroup key={group} label={group}>
                          {fieldDefinitions.filter((field) => field.group === group).map((field) => (
                            <option key={field.field} value={field.field}>{field.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <select
                      value={row.operator}
                      onChange={(event) => onUpdateAdvancedRow(row.id, {
                        operator: event.target.value,
                        value: "",
                        valueFrom: "",
                        valueTo: "",
                      })}
                      disabled={!fieldDefinition}
                      className="h-10 min-w-[160px] flex-1 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-surface-container"
                    >
                      <option value="">Select operator</option>
                      {operators.map((operator) => (
                        <option key={operator} value={operator}>{operator}</option>
                      ))}
                    </select>

                    <div className="min-w-[220px] flex-[2]">
                      <RowValueInput
                        row={row}
                        fieldDefinition={fieldDefinition}
                        options={options}
                        loading={loadingFields[row.field]}
                        onChange={(patch) => onUpdateAdvancedRow(row.id, patch)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveAdvancedRow(row.id)}
                      className="rounded-2xl p-2 text-outline transition hover:bg-error/10 hover:text-error"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={onAddAdvancedRow}
                className="mt-1 flex items-center gap-1.5 rounded-2xl border border-dashed border-outline-variant/30 px-3 py-2 text-xs font-bold text-outline transition hover:border-primary/40 hover:text-on-surface"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                Add Filter Row
              </button>

              {activeFilters.length ? (
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Active Filters</div>
                      <div className="mt-1 text-xs text-on-surface-variant">Draft advanced conditions ready to apply.</div>
                    </div>
                    <button
                      type="button"
                      onClick={onClearAdvancedFilters}
                      className="text-[10px] font-bold uppercase tracking-[0.18em] text-error"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeFilters.map((filter) => (
                      <span key={filter.id} className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">
                        <span>{filter.label}</span>
                        <span className="text-primary/60">{filter.operator}</span>
                        <span>{filter.value}</span>
                        <button type="button" onClick={() => onRemoveAdvancedRow(filter.id)} className="leading-none hover:opacity-60">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/15 pt-4">
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
                  className="flex items-center gap-2 rounded-2xl border border-outline-variant/20 bg-white px-5 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                  Reset Advanced Filters
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}