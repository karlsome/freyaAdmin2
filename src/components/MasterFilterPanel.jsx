import AdvancedFilterSection from "./AdvancedFilterSection";
import FormField from "./FormField";
import TagInput from "./TagInput";
import { useLanguage } from "../contexts/LanguageContext";

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
  requireFactoryForEquipment = true,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const isMultiSelectEquipment = equipmentVariant === "multiSelect";
  const isGroupSelectEquipment = equipmentVariant === "groupSelect";
  const equipmentNeedsFactory = requireFactoryForEquipment && (isMultiSelectEquipment || isGroupSelectEquipment) && !String(simpleFilters.factory || "").trim();
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
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 mb-6 relative z-20 shadow-sm">
      <div className="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-6">
        <FormField label={isJa ? "工場" : "Factory / 工場"} className="xl:col-span-1">
          <select
            value={simpleFilters.factory}
            onChange={(event) => onSimpleFilterChange("factory", event.target.value)}
            className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
          >
            <option value="">{isJa ? "すべての工場" : "All Factory"}</option>
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
              className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
            >
              <option value="">{isJa ? "すべてのR/L" : "All R/L"}</option>
              {filterOptions.rl.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FormField>
        )}

        {showColor && (
          <FormField label={isJa ? "色" : "Color"} className="xl:col-span-1">
            <select
              value={simpleFilters.color}
              onChange={(event) => onSimpleFilterChange("color", event.target.value)}
              className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
            >
              <option value="">{isJa ? "すべての色" : "All Color"}</option>
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
                "w-full rounded-[6px] border px-3 py-2 transition-colors",
                equipmentNeedsFactory || !equipmentOptions.length ? "flex min-h-[2.25rem] items-center" : "min-h-[2.25rem]",
                equipmentNeedsFactory
                  ? "border-[var(--border)] bg-[var(--surface-subtle)] cursor-not-allowed"
                  : "border-[var(--border)] bg-[var(--surface)]",
              ].join(" ")}
            >
              {equipmentNeedsFactory ? (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isJa ? "先に工場を選択してください" : "Select a factory first"}
                </p>
              ) : equipmentOptions.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-x-6 gap-y-3 overflow-x-auto pb-1">
                    {equipmentOptions.filter((g) => g.key !== "__ungrouped").map((group) => (
                      <div key={group.key} className="flex flex-shrink-0 flex-col gap-1">
                        <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer">
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
                            <span key={option.key} className="text-xs text-[var(--text-muted)] truncate">{option.label}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isJa ? "この工場の設備が見つかりません" : "No equipment found for this factory"}
                </p>
              )}
            </div>
          ) : isMultiSelectEquipment ? (
            <div
              className={[
                "w-full rounded-[6px] border px-3 py-2 transition-colors",
                equipmentNeedsFactory || !equipmentOptions.length ? "flex min-h-[2.25rem] items-center" : "min-h-[2.25rem]",
                equipmentNeedsFactory
                  ? "border-[var(--border)] bg-[var(--surface-subtle)] cursor-not-allowed"
                  : "border-[var(--border)] bg-[var(--surface)]",
              ].join(" ")}
            >
              {equipmentNeedsFactory ? (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isJa ? "先に工場を選択してください" : "Select a factory first"}
                </p>
              ) : equipmentOptions.length ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={equipmentAllNames.length > 0 && equipmentAllNames.every((name) => selectedEquipment.includes(name))}
                        onChange={() => onSelectAllEquipment?.(equipmentAllNames)}
                        className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                      />
                      {isJa ? "すべて選択" : "Select All"}
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => onClearEquipmentSelection?.()}
                        className="h-3.5 w-3.5 rounded border-outline-variant/40 text-primary focus:ring-primary/30"
                      />
                      {isJa ? "選択解除" : "Clear Selection"}
                    </label>
                  </div>

                  <div className="flex items-start gap-x-6 gap-y-3 overflow-x-auto pb-1">
                    {equipmentOptions.map((group) => (
                      <div key={group.key} className="flex flex-shrink-0 flex-col gap-1">
                        {group.heading && (
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{group.heading}</p>
                        )}
                        <div className="grid grid-flow-col grid-rows-6 auto-cols-[minmax(110px,1fr)] gap-x-3 gap-y-1">
                          {group.options.map((option) => (
                            <label key={option.key} className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer">
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
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isJa ? "この工場の設備が見つかりません" : "No equipment found for this factory"}
                </p>
              )}
            </div>
          ) : (
            <select
              value={typeof simpleFilters.process === 'string' ? simpleFilters.process : ''}
              onChange={(event) => onSimpleFilterChange("process", event.target.value)}
              className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
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
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {isJa ? "検索タグ" : "Search Tags"}
              </label>
              <select
                value={searchLogicMode}
                onChange={(event) => onSearchLogicModeChange(event.target.value)}
                className="h-6 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[10px] font-semibold text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--freya-blue)]"
              >
                <option value="OR">{isJa ? "いずれかに一致 (OR)" : "Match Any"}</option>
                <option value="AND">{isJa ? "すべてに一致 (AND)" : "Match All"}</option>
              </select>
              {!!searchTags.length && (
                <button type="button" onClick={onClearSearchTags} className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-error">
                  {isJa ? "クリア" : "Clear"}
                </button>
              )}
            </div>

            <TagInput
              tags={searchTags}
              onAdd={onAddSearchTag}
              onRemove={onRemoveSearchTag}
              placeholder={isJa ? "Enterキーで検索タグを追加" : "Press Enter to add search terms"}
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
            equals: isJa ? "等しい" : "Equals",
            contains: isJa ? "含む" : "Contains",
            in: isJa ? "リストに含まれる" : "In",
            greater: isJa ? "より大きい" : "Greater than",
            less: isJa ? "より小さい" : "Less than",
            range: isJa ? "範囲指定" : "Range",
          }}
          optionsCacheKey={optionsCacheKey}
          activeSummaryDescription={
            isJa ? "実行前の詳細クエリ条件です。" : "Current advanced query conditions before execution."
          }
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
                className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 shadow-xs"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
                {isJa ? "詳細フィルターを適用" : "Apply Advanced Filters"}
              </button>

              <button
                type="button"
                onClick={onClearAdvancedFilters}
                className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-all hover:bg-[var(--surface-hover)] shadow-2xs"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                {isJa ? "詳細フィルターをリセット" : "Reset Advanced Filters"}
              </button>

              {canBatchEdit ? (
                <button
                  type="button"
                  onClick={onOpenBatchEdit}
                  className="flex items-center gap-1.5 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/20"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_square</span>
                  {isJa ? `${batchCount} 件を一括編集` : `Batch Edit ${batchCount} Records`}
                </button>
              ) : null}
            </>
          )}
        />
      )}
    </div>
  );
}