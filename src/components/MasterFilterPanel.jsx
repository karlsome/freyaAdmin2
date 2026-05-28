import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import TagInput from "./TagInput";

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
  processLabel = "Equipment",
  processAllLabel = "All Equipment",
  optionsCacheKey = "master",
}) {
  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="grid items-end gap-3 lg:grid-cols-2 xl:grid-cols-6">
        <FormField label="Factory / 工場" className="xl:col-span-1">
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
        </FormField>

        <FormField label="R/L" className="xl:col-span-1">
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
        </FormField>

        <FormField label="Color" className="xl:col-span-1">
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
        </FormField>

        <FormField label={processLabel} className="xl:col-span-1">
          <select
            value={simpleFilters.process}
            onChange={(event) => onSimpleFilterChange("process", event.target.value)}
            className="h-10 w-full rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">{processAllLabel}</option>
            {filterOptions.processes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

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
            tagClassName="bg-amber-400 text-amber-950"
          />
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
        shouldLoadOptions={(fieldDefinition) => ["text", "textarea"].includes(fieldDefinition.type)}
        operatorLabels={{
          equals: "Equals",
          contains: "Contains",
          in: "In",
          greater: "Greater than",
          less: "Less than",
          range: "Range",
        }}
        optionsCacheKey={optionsCacheKey}
        activeSummaryDescription="Current advanced query conditions before execution."
        chipTone="amber"
        variant="compact"
        framed
        enableTextSuggestions
        inputIdPrefix="master-filter-options"
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

            {canBatchEdit ? (
              <button
                type="button"
                onClick={onOpenBatchEdit}
                className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-400/15"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_square</span>
                Batch Edit {batchCount} Records
              </button>
            ) : null}
          </>
        )}
      />
    </div>
  );
}