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
      className="min-h-10 cursor-text rounded-xl border border-outline-variant/20 bg-white px-3 py-1.5 transition-colors focus-within:border-primary/40"
      onClick={(event) => event.currentTarget.querySelector("input")?.focus()}
    >
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-amber-950 shrink-0">
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="leading-none hover:text-error">×</button>
          </span>
        ))}

        <input
          type="text"
          value={value}
          placeholder={tags.length ? "" : placeholder}
          className="min-w-24 flex-1 bg-transparent text-xs text-on-surface outline-none placeholder:text-outline"
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
        className="h-9 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none opacity-40"
      />
    );
  }

  if (row.operator === "range") {
    const inputType = fieldDefinition.type === "number" ? "number" : "date";
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type={inputType}
          value={row.valueFrom}
          onChange={(event) => onChange({ valueFrom: event.target.value })}
          className="h-9 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40"
          placeholder="From"
        />
        <input
          type={inputType}
          value={row.valueTo}
          onChange={(event) => onChange({ valueTo: event.target.value })}
          className="h-9 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40"
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
          className="h-9 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40"
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
        className="h-9 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40"
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
      <div className="grid items-end gap-3 lg:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">Factory / 工場</label>
          <select
            value={simpleFilters.factory}
            onChange={(event) => onSimpleFilterChange("factory", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All Factory</option>
            {filterOptions.factories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">R/L</label>
          <select
            value={simpleFilters.rl}
            onChange={(event) => onSimpleFilterChange("rl", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All R/L</option>
            {filterOptions.rl.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">Color</label>
          <select
            value={simpleFilters.color}
            onChange={(event) => onSimpleFilterChange("color", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All Color</option>
            {filterOptions.colors.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-outline">Equipment</label>
          <select
            value={simpleFilters.process}
            onChange={(event) => onSimpleFilterChange("process", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All Equipment</option>
            {filterOptions.processes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 xl:col-span-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-outline">Search Tags</label>
            <select
              value={searchLogicMode}
              onChange={(event) => onSearchLogicModeChange(event.target.value)}
              className="h-7 rounded-lg border border-outline-variant/20 bg-white px-2 text-[10px] font-bold text-on-surface outline-none transition-colors focus:border-primary/40"
            >
              <option value="OR">Match Any</option>
              <option value="AND">Match All</option>
            </select>
            {!!searchTags.length && (
              <button type="button" onClick={onClearSearchTags} className="ml-auto text-[10px] font-bold uppercase tracking-wider text-error">
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

      <div className="mt-4 rounded-xl border border-white/10 bg-surface-container/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-bold text-outline transition-colors hover:text-on-surface"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>filter_alt</span>
            <span className="uppercase tracking-wider">Advanced Filters</span>
            {!!activeFilters.length && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-primary">
                {activeFilters.length} active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>
              {advancedOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
            </span>
          </div>
        </button>

        {advancedOpen && (
          <div className="border-t border-white/10 px-4 py-4">
            <div className="space-y-3">
              {advancedRows.map((row) => {
                const fieldDefinition = fieldDefinitions.find((field) => field.field === row.field);
                const operators = fieldDefinition?.operators || [];
                const options = optionsByField[row.field] || [];

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
                        className="h-9 min-w-[180px] flex-1 rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40"
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
                        className="h-9 min-w-[150px] flex-1 rounded-xl border border-outline-variant/20 bg-white px-3 text-xs text-on-surface outline-none transition-colors focus:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">Select operator</option>
                        {operators.map((operator) => (
                          <option key={operator} value={operator}>{operator}</option>
                        ))}
                      </select>

                      <div className="min-w-[200px] flex-[2]">
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
                        className="flex-shrink-0 rounded-xl p-2 text-outline transition-colors hover:bg-error/10 hover:text-error"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={onAddAdvancedRow}
                className="mt-1 flex items-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-1.5 text-xs font-bold text-outline transition-colors hover:border-primary/40 hover:text-on-surface"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                Add Filter Row
              </button>

              {!!activeFilters.length && (
                <div className="rounded-xl border border-white/10 bg-surface-container/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-outline">Active Filters</div>
                      <div className="mt-1 text-xs text-on-surface-variant">Current advanced query conditions before execution.</div>
                    </div>
                    <button type="button" onClick={onClearAdvancedFilters} className="text-[10px] font-bold uppercase tracking-wider text-error">
                      Clear All
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeFilters.map((filter) => (
                      <span key={filter.id} className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950">
                        <span>{filter.label}</span>
                        <span className="text-amber-950/50">{filter.operator}</span>
                        <span>{filter.value}</span>
                        <button type="button" onClick={() => onRemoveAdvancedRow(filter.id)} className="leading-none hover:opacity-60">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
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

                {canBatchEdit && (
                  <button
                    type="button"
                    onClick={onOpenBatchEdit}
                    className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-400/15"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_square</span>
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