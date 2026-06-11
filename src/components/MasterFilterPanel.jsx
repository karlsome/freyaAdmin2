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
  showRL = true,
  showColor = true,
  showSearchTags = true,
  showAdvancedFilters = true,
  equipmentVariant = "select",
  equipmentOptions = [],
  selectedEquipment = [],
  onToggleEquipment,
  onSelectAllEquipment,
  onClearEquipmentSelection,
  // groupSelect variant props
  selectedGroups = [],
  onToggleGroup,
  onSelectAllGroups,
  onClearGroups,
}) {
  const isMultiSelectEquipment = equipmentVariant === "multiSelect";
  const isGroupSelectEquipment = equipmentVariant === "groupSelect";
  const equipmentNeedsFactory = (isMultiSelectEquipment || isGroupSelectEquipment) && !String(simpleFilters.factory || "").trim();
  const equipmentAllNames = isMultiSelectEquipment
    ? equipmentOptions.flatMap((group) => group.options.map((option) => option.key))
    : [];
  const allGroupKeys = isGroupSelectEquipment
    ? equipmentOptions.filter((g) => g.key !== "__ungrouped").map((g) => g.key)
    : [];
  const equipmentSpanClass = (isMultiSelectEquipment || isGroupSelectEquipment) && !showRL && !showColor
    ? (showSearchTags ? "xl:col-span-3" : "xl:col-span-5")
    : "xl:col-span-1";

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-6">
        <FormField label="Factory / 工場" className="xl:col-span-1">
          <select
            value={simpleFilters.factory}
            onChange={(event) => onSimpleFilterChange("factory", event.target.value)}
            className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
          >
            <option value="">All Factory</option>
            {filterOptions.factories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        {showRL && (
          <FormField label="R/L" className="xl:col-span-1">
            <select
              value={simpleFilters.rl}
              onChange={(event) => onSimpleFilterChange("rl", event.target.value)}
              className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            >
              <option value="">All R/L</option>
              {filterOptions.rl.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FormField>
        )}

        {showColor && (
          <FormField label="Color" className="xl:col-span-1">
            <select
              value={simpleFilters.color}
              onChange={(event) => onSimpleFilterChange("color", event.target.value)}
              className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            >
              <option value="">All Color</option>
              {filterOptions.colors.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label={processLabel} className={equipmentSpanClass}>
          {isGroupSelectEquipment ? (
            <div
              className={[
                "w-full rounded-xl border px-3 py-2 transition-colors",
                equipmentNeedsFactory || !equipmentOptions.length ? "flex min-h-[2.5rem] items-center" : "min-h-[2.5rem]",
                equipmentNeedsFactory
                  ? "border-separator/40 bg-surface-container/50 cursor-not-allowed"
                  : "border-separator/40 bg-white",
              ].join(" ")}
            >
              {equipmentNeedsFactory ? (
                <p className="text-[11px] text-on-surface-variant">Select a factory first</p>
              ) : equipmentOptions.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-x-6 gap-y-3 overflow-x-auto pb-1">
                    {equipmentOptions.filter((g) => g.key !== "__ungrouped").map((group) => (
                      <div key={group.key} className="flex flex-shrink-0 flex-col gap-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-outline cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedGroups.includes(group.key)}
                            onChange={() => onToggleGroup?.(group.key)}
                            className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                          />
                          {group.heading}
                        </label>
                        <div className="flex flex-col gap-0.5 pl-5">
                          {group.options.map((option) => (
                            <span key={option.key} className="text-xs text-on-surface-variant truncate">{option.label}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-on-surface-variant">No equipment found for this factory</p>
              )}
            </div>
          ) : isMultiSelectEquipment ? (
            <div
              className={[
                "w-full rounded-xl border px-3 py-2 transition-colors",
                equipmentNeedsFactory || !equipmentOptions.length ? "flex min-h-[2.5rem] items-center" : "min-h-[2.5rem]",
                equipmentNeedsFactory
                  ? "border-separator/40 bg-surface-container/50 cursor-not-allowed"
                  : "border-separator/40 bg-white",
              ].join(" ")}
            >
              {equipmentNeedsFactory ? (
                <p className="text-[11px] text-on-surface-variant">Select a factory first</p>
              ) : equipmentOptions.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface cursor-pointer">
                      <input
                        type="checkbox"
                        checked={equipmentAllNames.length > 0 && equipmentAllNames.every((name) => selectedEquipment.includes(name))}
                        onChange={() => onSelectAllEquipment?.(equipmentAllNames)}
                        className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                      />
                      Select All
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface cursor-pointer">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => onClearEquipmentSelection?.()}
                        className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                      />
                      Clear Selection
                    </label>
                  </div>

                  <div className="flex items-start gap-x-6 gap-y-3 overflow-x-auto pb-1">
                    {equipmentOptions.map((group) => (
                      <div key={group.key} className="flex flex-shrink-0 flex-col gap-1">
                        {group.heading && (
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-outline">{group.heading}</p>
                        )}
                        <div className="grid grid-flow-col grid-rows-6 auto-cols-[minmax(110px,1fr)] gap-x-3 gap-y-1">
                          {group.options.map((option) => (
                            <label key={option.key} className="flex items-center gap-1.5 text-xs text-on-surface cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEquipment.includes(option.key)}
                                onChange={() => onToggleEquipment?.(option.key)}
                                className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                              />
                              <span className="truncate">{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-on-surface-variant">No equipment found for this factory</p>
              )}
            </div>
          ) : (
            <select
              value={simpleFilters.process}
              onChange={(event) => onSimpleFilterChange("process", event.target.value)}
              className="h-10 w-full rounded-xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            >
              <option value="">{processAllLabel}</option>
              {filterOptions.processes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
        </FormField>

        {showSearchTags && (
          <div className="lg:col-span-2 xl:col-span-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-outline">Search Tags</label>
              <select
                value={searchLogicMode}
                onChange={(event) => onSearchLogicModeChange(event.target.value)}
                className="h-7 rounded-lg border border-separator/40 bg-white px-2 text-[10px] font-semibold text-on-surface outline-none transition-colors focus:border-primary/40"
              >
                <option value="OR">Match Any</option>
                <option value="AND">Match All</option>
              </select>
              {!!searchTags.length && (
                <button type="button" onClick={onClearSearchTags} className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-error">
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
        )}
      </div>

      {showAdvancedFilters && (
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
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
                Apply Advanced Filters
              </button>

              <button
                type="button"
                onClick={onClearAdvancedFilters}
                className="flex items-center gap-2 rounded-xl border border-separator/40 glass-card px-5 py-2.5 text-sm font-semibold text-on-surface transition-all hover:border-primary/30"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                Reset Advanced Filters
              </button>

              {canBatchEdit ? (
                <button
                  type="button"
                  onClick={onOpenBatchEdit}
                  className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-400/15"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_square</span>
                  Batch Edit {batchCount} Records
                </button>
              ) : null}
            </>
          )}
        />
      )}
    </div>
  );
}