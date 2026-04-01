import { useEffect, useState } from "react";
import { getActiveMasterAdvancedFilters } from "../utils/masterDB";

function TagInput({ tags, onAdd, onRemove, placeholder }) {
  const [value, setValue] = useState("");

  function commit() {
    const next = value.trim();
    if (!next) return;
    onAdd(next);
    setValue("");
  }

  return (
    <div
      className="min-h-[50px] cursor-text rounded-2xl border border-outline-variant/30 bg-surface px-3 py-2 transition focus-within:border-primary/40"
      onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
    >
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-3 py-1 text-xs font-bold text-primary">
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="leading-none hover:text-error">×</button>
          </span>
        ))}

        <input
          type="text"
          value={value}
          placeholder={tags.length ? "" : placeholder}
          className="min-w-[140px] flex-1 bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-outline"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            }

            if (event.key === "Backspace" && !value && tags.length) {
              onRemove(tags[tags.length - 1]);
            }
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

function RowValueInput({ row, fieldDefinition, options, loading, onChange }) {
  const datalistId = `master-filter-options-${row.id}`;

  if (!fieldDefinition) {
    return (
      <input
        type="text"
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        disabled
        className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none opacity-40"
      />
    );
  }

  if (row.operator === "range") {
    const inputType = fieldDefinition.type === "number" ? "number" : "date";
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <input
          type={inputType}
          value={row.valueFrom}
          onChange={(event) => onChange({ valueFrom: event.target.value })}
          className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          placeholder="From"
        />
        <input
          type={inputType}
          value={row.valueTo}
          onChange={(event) => onChange({ valueTo: event.target.value })}
          className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          placeholder="To"
        />
      </div>
    );
  }

  if (row.operator === "in") {
    return (
      <>
        <input
          type="text"
          value={Array.isArray(row.value) ? row.value.join(", ") : row.value}
          onChange={(event) => onChange({ value: event.target.value })}
          className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          placeholder="Comma separated values"
          list={options.length ? datalistId : undefined}
        />
        {options.length > 0 && (
          <datalist id={datalistId}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        )}
      </>
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
    <>
      <input
        type={inputType}
        value={row.value}
        onChange={(event) => onChange({ value: event.target.value })}
        className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
        placeholder={loading ? "Loading known values…" : "Enter value"}
        list={options.length && inputType === "text" ? datalistId : undefined}
      />
      {options.length > 0 && inputType === "text" && (
        <datalist id={datalistId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </>
  );
}

export default function MasterFilterPanel({
  simpleFilters,
  filterOptions,
  searchTags,
  searchLogicMode,
  fieldDefinitions,
  advancedRows,
  canBatchEdit,
  batchCount,
  onSimpleFilterChange,
  onAddSearchTag,
  onRemoveSearchTag,
  onClearSearchTags,
  onSearchLogicModeChange,
  onUpdateAdvancedRow,
  onAddAdvancedRow,
  onRemoveAdvancedRow,
  onApplyAdvancedFilters,
  onClearAdvancedFilters,
  onOpenBatchEdit,
  loadDistinctOptions,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [optionsByField, setOptionsByField] = useState({});
  const [loadingFields, setLoadingFields] = useState({});

  useEffect(() => {
    advancedRows.forEach((row) => {
      const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
      if (!row.field || !fieldDefinition || !["text", "textarea"].includes(fieldDefinition.type)) return;
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
  const activeFilters = getActiveMasterAdvancedFilters(advancedRows, fieldDefinitions);

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-1">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Factory / 工場</label>
          <select
            value={simpleFilters.factory}
            onChange={(event) => onSimpleFilterChange("factory", event.target.value)}
            className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          >
            <option value="">All Factory</option>
            {filterOptions.factories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">R/L</label>
          <select
            value={simpleFilters.rl}
            onChange={(event) => onSimpleFilterChange("rl", event.target.value)}
            className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          >
            <option value="">All R/L</option>
            {filterOptions.rl.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Color</label>
          <select
            value={simpleFilters.color}
            onChange={(event) => onSimpleFilterChange("color", event.target.value)}
            className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          >
            <option value="">All Color</option>
            {filterOptions.colors.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Equipment</label>
          <select
            value={simpleFilters.process}
            onChange={(event) => onSimpleFilterChange("process", event.target.value)}
            className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
          >
            <option value="">All Equipment</option>
            {filterOptions.processes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 xl:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Search Tags</label>
            <select
              value={searchLogicMode}
              onChange={(event) => onSearchLogicModeChange(event.target.value)}
              className="h-7 rounded-lg border border-outline-variant/30 bg-surface px-2 text-xs font-bold text-on-surface outline-none transition focus:border-primary/40"
            >
              <option value="OR">Match Any</option>
              <option value="AND">Match All</option>
            </select>
            {!!searchTags.length && (
              <button type="button" onClick={onClearSearchTags} className="ml-auto text-xs font-bold uppercase tracking-[0.18em] text-error">
                Clear
              </button>
            )}
          </div>

          <TagInput
            tags={searchTags}
            onAdd={onAddSearchTag}
            onRemove={onRemoveSearchTag}
            placeholder="Press Enter to add search terms"
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">filter_alt</span>
            <div className="text-sm font-black text-on-surface">Advanced Filters</div>
          </div>

          <div className="flex items-center gap-3">
            {!!activeFilters.length && (
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-bold text-primary">
                {activeFilters.length} active
              </span>
            )}
            <span className="material-symbols-outlined text-on-surface-variant">
              {advancedOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
          </div>
        </button>

        {advancedOpen && (
          <div className="border-t border-outline-variant/20 px-5 py-5">
            <div className="space-y-4">
              {advancedRows.map((row) => {
                const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
                const operators = fieldDefinition?.operators || [];
                const options = optionsByField[row.field] || [];

                return (
                  <div key={row.id} className="rounded-xl border border-outline-variant/20 bg-surface p-4">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr),220px,minmax(0,1fr),48px] xl:items-start">
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
                        className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
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
                        className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 disabled:opacity-40"
                      >
                        <option value="">Select operator</option>
                        {operators.map((operator) => (
                          <option key={operator} value={operator}>{operator}</option>
                        ))}
                      </select>

                      <div>
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
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-error/10 text-error transition hover:bg-error/15"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={onAddAdvancedRow}
                className="flex items-center gap-2 rounded-xl border border-dashed border-primary/35 px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary/5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                Add Filter Row
              </button>

              {!!activeFilters.length && (
                  <div className="rounded-xl border border-outline-variant/20 bg-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Active Filters</div>
                      <div className="mt-1 text-sm text-on-surface-variant">Current advanced query conditions before execution.</div>
                    </div>
                    <button type="button" onClick={onClearAdvancedFilters} className="text-xs font-bold uppercase tracking-[0.18em] text-error">
                      Clear All
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeFilters.map((filter) => (
                      <span key={filter.id} className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-1.5 text-xs font-bold text-primary">
                        <span>{filter.label}</span>
                        <span className="text-primary/60">{filter.operator}</span>
                        <span>{filter.value}</span>
                        <button type="button" onClick={() => onRemoveAdvancedRow(filter.id)} className="leading-none hover:text-error">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/20 pt-4">
                <button
                  type="button"
                  onClick={onApplyAdvancedFilters}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_alt</span>
                  Apply Advanced Filters
                </button>

                <button
                  type="button"
                  onClick={onClearAdvancedFilters}
                  className="flex items-center gap-2 rounded-xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
                  Reset Advanced Filters
                </button>

                {canBatchEdit && (
                  <button
                    type="button"
                    onClick={onOpenBatchEdit}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-400"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_square</span>
                    Batch Edit {batchCount} Records
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}