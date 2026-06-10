import { useEffect, useMemo, useState } from "react";

function getTextInputType(type) {
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "time") return "time";
  return "text";
}

function buildActiveFilters(rows = [], fieldDefinitions = [], operatorLabels = {}) {
  const fieldMap = Object.fromEntries(fieldDefinitions.map((field) => [field.field, field]));

  return rows.flatMap((row) => {
    if (!row?.field || !row?.operator) return [];

    const fieldDefinition = fieldMap[row.field];
    if (!fieldDefinition) return [];

    let renderedValue = "";

    if (row.operator === "range") {
      if (row.valueFrom === "" || row.valueTo === "") return [];
      renderedValue = `${row.valueFrom} - ${row.valueTo}`;
    } else if (row.operator === "in") {
      const values = Array.isArray(row.value)
        ? row.value.filter(Boolean)
        : String(row.value || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      if (!values.length) return [];
      renderedValue = values.join(", ");
    } else {
      if (row.value === "" || row.value == null) return [];
      renderedValue = String(row.value);
    }

    return [{
      id: row.id,
      label: fieldDefinition.label,
      operator: operatorLabels[row.operator] || row.operator,
      value: renderedValue,
    }];
  });
}

function RowValueInput({
  row,
  fieldDefinition,
  options,
  loading,
  onChange,
  styles,
  enableTextSuggestions,
  inputIdPrefix,
}) {
  const datalistId = `${inputIdPrefix}-${row.id}`;

  if (!fieldDefinition) {
    return (
      <input
        type="text"
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        disabled
        className={`${styles.controlBase} opacity-40`}
      />
    );
  }

  if (row.operator === "range") {
    const inputType = getTextInputType(fieldDefinition.type);

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type={inputType}
          value={row.valueFrom}
          onChange={(event) => onChange({ valueFrom: event.target.value })}
          className={styles.controlBase}
          placeholder="From"
        />
        <input
          type={inputType}
          value={row.valueTo}
          onChange={(event) => onChange({ valueTo: event.target.value })}
          className={styles.controlBase}
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
        className={`${styles.controlBase} ${isMultiSelect ? styles.multiSelect : ""}`.trim()}
      >
        {!isMultiSelect ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  if (row.operator === "in") {
    const inputValue = Array.isArray(row.value) ? row.value.join(", ") : row.value;
    const inputSupportsSuggestions = enableTextSuggestions && options.length > 0;

    return (
      <>
        <input
          type="text"
          value={inputValue}
          onChange={(event) => onChange({ value: event.target.value })}
          className={styles.controlBase}
          placeholder="Comma separated values"
          list={inputSupportsSuggestions ? datalistId : undefined}
        />
        {inputSupportsSuggestions ? (
          <datalist id={datalistId}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }

  const inputType = getTextInputType(fieldDefinition.type);
  const inputSupportsSuggestions = enableTextSuggestions && inputType === "text" && options.length > 0;
  const placeholder = loading && inputSupportsSuggestions ? "Loading known values..." : "Enter value";

  return (
    <>
      <input
        type={inputType}
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        className={styles.controlBase}
        placeholder={placeholder}
        list={inputSupportsSuggestions ? datalistId : undefined}
      />
      {inputSupportsSuggestions ? (
        <datalist id={datalistId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}

function getStylePreset(variant, framed) {
  if (variant === "roomy") {
    return {
      wrapper: framed ? "mt-4 overflow-hidden rounded-[24px] border border-outline-variant/15 bg-surface-container-low/30" : "",
      toggle: framed
        ? "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-outline transition-colors hover:text-on-surface"
        : "flex items-center gap-1.5 text-xs font-semibold text-outline transition-colors hover:text-on-surface mb-3",
      content: framed ? "border-t border-outline-variant/15 px-4 py-4" : "mb-4",
      stack: "space-y-3",
      controlBase: "w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container",
      fieldControl: "h-10 min-w-[190px] flex-1",
      operatorControl: "h-10 min-w-[160px] flex-1 disabled:cursor-not-allowed disabled:opacity-40",
      valueWrap: "min-w-[220px] flex-[2]",
      deleteButton: "rounded-2xl p-2 text-outline transition hover:bg-error/10 hover:text-error",
      addButton: "mt-1 flex items-center gap-1.5 rounded-2xl border border-dashed border-outline-variant/30 px-3 py-2 text-xs font-semibold text-outline transition hover:border-primary/40 hover:text-on-surface",
      summaryPanel: "rounded-2xl border border-outline-variant/15 bg-surface-container/40 px-4 py-3",
      summaryTitle: "text-[10px] font-semibold uppercase tracking-[0.18em] text-outline",
      summaryDescription: "mt-1 text-xs text-on-surface-variant",
      clearButton: "text-[10px] font-semibold uppercase tracking-[0.18em] text-error",
      footer: `flex flex-wrap items-center gap-3${framed ? " border-t border-outline-variant/15 pt-4" : " pt-4"}`,
      multiSelect: "min-h-32 py-2",
    };
  }

  return {
    wrapper: framed ? "mt-4 rounded-xl border border-separator/35 bg-surface-container/30 overflow-hidden" : "",
    toggle: framed
      ? "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-outline transition-colors hover:text-on-surface"
      : "flex items-center gap-1.5 text-xs font-semibold text-outline transition-colors hover:text-on-surface mb-3",
    content: framed ? "border-t border-separator/30 px-4 py-4" : "mb-4",
    stack: framed ? "space-y-3" : "space-y-2",
    controlBase: "w-full rounded-xl border border-separator/40 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40",
    fieldControl: "h-9 min-w-[180px] flex-1",
    operatorControl: "h-9 min-w-[150px] flex-1 disabled:opacity-40 disabled:cursor-not-allowed",
    valueWrap: "min-w-[200px] flex-[2]",
    deleteButton: "rounded-xl p-2 text-outline transition-colors hover:bg-error/10 hover:text-error",
    addButton: "mt-1 flex items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-1.5 text-xs font-semibold text-outline transition-colors hover:border-primary/40 hover:text-on-surface",
    summaryPanel: "rounded-xl border border-separator/35 bg-surface-container/40 px-4 py-3",
    summaryTitle: "text-[10px] font-semibold uppercase tracking-wider text-outline",
    summaryDescription: "mt-1 text-xs text-on-surface-variant",
    clearButton: "text-[10px] font-semibold uppercase tracking-wider text-error",
    footer: `flex flex-wrap items-center gap-3${framed ? " border-t border-separator/30 pt-4" : " pt-4"}`,
    multiSelect: "min-h-28 py-2",
  };
}

function getChipClassName(tone) {
  if (tone === "amber") {
    return "inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950";
  }

  return "inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary";
}

export default function AdvancedFilterSection({
  rows,
  fieldDefinitions,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onClearRows,
  loadDistinctOptions,
  shouldLoadOptions = () => false,
  optionsCacheKey = "default",
  operatorLabels = {},
  useOperatorLabelsInSelect = false,
  title = "Advanced Filters",
  addRowLabel = "Add Filter Row",
  activeSummaryTitle = "Active Filters",
  activeSummaryDescription = "",
  showActiveSummary = true,
  chipTone = "primary",
  variant = "compact",
  framed = true,
  enableTextSuggestions = false,
  inputIdPrefix = "advanced-filter-options",
  footer,
}) {
  const styles = getStylePreset(variant, framed);
  const [open, setOpen] = useState(false);
  const [optionsByField, setOptionsByField] = useState({});
  const [loadingFields, setLoadingFields] = useState({});

  useEffect(() => {
    setOptionsByField({});
    setLoadingFields({});
  }, [optionsCacheKey]);

  useEffect(() => {
    if (typeof loadDistinctOptions !== "function") return;

    rows.forEach((row) => {
      const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
      const hasStaticOptions = Array.isArray(fieldDefinition?.options) && fieldDefinition.options.length > 0;

      if (!row.field || !fieldDefinition || hasStaticOptions || !shouldLoadOptions(fieldDefinition)) return;
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
  }, [rows, fieldDefinitions, loadDistinctOptions, loadingFields, optionsByField, shouldLoadOptions]);

  const fieldGroups = useMemo(
    () => [...new Set(fieldDefinitions.map((field) => field.group))],
    [fieldDefinitions]
  );
  const activeFilters = useMemo(
    () => buildActiveFilters(rows, fieldDefinitions, operatorLabels),
    [rows, fieldDefinitions, operatorLabels]
  );
  const chipClassName = getChipClassName(chipTone);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={styles.toggle}
      >
        {framed ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
              <span className="uppercase tracking-wider">{title}</span>
              {activeFilters.length ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-primary">
                  {activeFilters.length} active
                </span>
              ) : null}
            </div>

            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>
              {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {open ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
            {title}
            {activeFilters.length ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-primary">
                {activeFilters.length} active
              </span>
            ) : null}
          </>
        )}
      </button>

      {open ? (
        <div className={styles.content}>
          <div className={styles.stack}>
            {rows.map((row) => {
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
                      onUpdateRow(row.id, {
                        field: nextField,
                        operator: nextDefinition?.operators?.[0] || "",
                        value: "",
                        valueFrom: "",
                        valueTo: "",
                      });
                    }}
                    className={`${styles.controlBase} ${styles.fieldControl}`}
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
                    onChange={(event) => onUpdateRow(row.id, {
                      operator: event.target.value,
                      value: "",
                      valueFrom: "",
                      valueTo: "",
                    })}
                    disabled={!fieldDefinition}
                    className={`${styles.controlBase} ${styles.operatorControl}`}
                  >
                    <option value="">Select operator</option>
                    {operators.map((operator) => (
                      <option key={operator} value={operator}>
                        {useOperatorLabelsInSelect ? (operatorLabels[operator] || operator) : operator}
                      </option>
                    ))}
                  </select>

                  <div className={styles.valueWrap}>
                    <RowValueInput
                      row={row}
                      fieldDefinition={fieldDefinition}
                      options={options}
                      loading={loadingFields[row.field]}
                      onChange={(patch) => onUpdateRow(row.id, patch)}
                      styles={styles}
                      enableTextSuggestions={enableTextSuggestions}
                      inputIdPrefix={inputIdPrefix}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.id)}
                    className={styles.deleteButton}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: variant === "roomy" ? 18 : 16 }}>delete</span>
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={onAddRow}
              className={styles.addButton}
            >
              <span className="material-symbols-outlined" style={{ fontSize: variant === "roomy" ? 16 : 14 }}>add</span>
              {addRowLabel}
            </button>

            {showActiveSummary && activeFilters.length ? (
              <div className={styles.summaryPanel}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={styles.summaryTitle}>{activeSummaryTitle}</div>
                    {activeSummaryDescription ? (
                      <div className={styles.summaryDescription}>{activeSummaryDescription}</div>
                    ) : null}
                  </div>
                  {typeof onClearRows === "function" ? (
                    <button type="button" onClick={onClearRows} className={styles.clearButton}>
                      Clear All
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {activeFilters.map((filter) => (
                    <span key={filter.id} className={chipClassName}>
                      <span>{filter.label}</span>
                      <span className={chipTone === "amber" ? "text-amber-950/50" : "text-primary/60"}>{filter.operator}</span>
                      <span>{filter.value}</span>
                      <button type="button" onClick={() => onRemoveRow(filter.id)} className="leading-none hover:opacity-60">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {footer ? (
              <div className={styles.footer}>
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}