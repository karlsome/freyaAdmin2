import { useEffect, useMemo, useState } from "react";
import AdvancedFilterSection from "../AdvancedFilterSection";
import EmptyState from "../EmptyState";
import PlannerModalShell from "../planner/PlannerModalShell";
import {
  batchResetInventory,
  fetchInventoryBatchResetItems,
  fetchInventoryFilterOptions,
  fetchInventoryModels,
} from "../../services/inventoryApi";
import {
  buildInventoryBatchResetFilters,
  createInventoryBatchResetRow,
  formatInventoryNumber,
  INVENTORY_BATCH_FILTER_FIELDS,
  INVENTORY_FILTER_GROUP_LABEL_KEYS,
  INVENTORY_OPERATOR_LABEL_KEYS,
} from "../../utils/inventory";
import { useLanguage } from "../../contexts/LanguageContext";

function InlineBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-error/20 bg-error/10 text-error"
    : flash.type === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{flash.message}</p>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

function isZeroInventoryItem(item) {
  return Number(item?.physicalQuantity || 0) === 0
    && Number(item?.reservedQuantity || 0) === 0
    && Number(item?.availableQuantity || 0) === 0;
}

export default function InventoryBatchResetModal({
  open,
  authUser,
  actorName,
  onClose,
  onCompleted,
}) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(() => [createInventoryBatchResetRow()]);
  const [results, setResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [flash, setFlash] = useState(null);
  const [optionSets, setOptionSets] = useState({ partNumbers: [], backNumbers: [], models: [] });

  const factoryOptions = useMemo(() => (
    [...new Set(results.map((item) => item?.工場).filter(Boolean))].sort()
  ), [results]);

  const fieldDefinitions = useMemo(() => (
    INVENTORY_BATCH_FILTER_FIELDS.map((field) => ({
      ...field,
      label: t(field.labelKey),
      group: t(INVENTORY_FILTER_GROUP_LABEL_KEYS[field.group] || field.group),
      options: field.field === "品番"
        ? optionSets.partNumbers
        : field.field === "背番号"
          ? optionSets.backNumbers
          : field.field === "モデル"
            ? optionSets.models
            : field.field === "工場"
              ? factoryOptions
              : [],
    }))
  ), [factoryOptions, optionSets.backNumbers, optionSets.models, optionSets.partNumbers, t]);

  const operatorLabels = useMemo(() => (
    Object.fromEntries(Object.entries(INVENTORY_OPERATOR_LABEL_KEYS).map(([key, labelKey]) => [key, t(labelKey)]))
  ), [t]);

  const selectedItems = useMemo(() => (
    results.filter((item) => selectedIds.includes(item.背番号))
  ), [results, selectedIds]);

  const selectableResults = useMemo(() => (
    results.filter((item) => !isZeroInventoryItem(item))
  ), [results]);

  useEffect(() => {
    if (!open) return;

    setRows([createInventoryBatchResetRow()]);
    setSelectedIds([]);
    setFlash(null);
    setLoading(true);

    async function bootstrap() {
      try {
        const [filterOptions, models, items] = await Promise.all([
          fetchInventoryFilterOptions(),
          fetchInventoryModels(),
          fetchInventoryBatchResetItems([]),
        ]);

        setOptionSets({
          partNumbers: filterOptions.partNumbers,
          backNumbers: filterOptions.backNumbers,
          models,
        });
        setResults(items);
      } catch (loadError) {
        setFlash({ type: "error", message: loadError.message || t("failedLoadBatchResetDataMessage") });
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, [open]);

  function updateRow(rowId, patch) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function removeRow(rowId) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createInventoryBatchResetRow()];
    });
  }

  async function loadResults(filters) {
    setLoading(true);
    setFlash(null);
    setSelectedIds([]);

    try {
      const items = await fetchInventoryBatchResetItems(filters);
      setResults(items);
    } catch (loadError) {
      setResults([]);
      setFlash({ type: "error", message: loadError.message || t("failedLoadBatchResultsMessage") });
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyFilters() {
    await loadResults(buildInventoryBatchResetFilters(rows));
  }

  async function handleClearFilters() {
    const freshRows = [createInventoryBatchResetRow()];
    setRows(freshRows);
    await loadResults([]);
  }

  function toggleSelected(backNumber) {
    setSelectedIds((current) => (
      current.includes(backNumber)
        ? current.filter((item) => item !== backNumber)
        : [...current, backNumber]
    ));
  }

  function handleToggleAll(checked) {
    setSelectedIds(checked ? selectableResults.map((item) => item.背番号) : []);
  }

  async function handleBatchReset() {
    if (!selectedItems.length) return;

    const preview = selectedItems
      .slice(0, 5)
      .map((item) => `${item.背番号} (${item.品番}) - ${t("physicalLabel")} ${item.physicalQuantity}, ${t("reservedColumnLabel")} ${item.reservedQuantity}, ${t("availableLabel")} ${item.availableQuantity}`)
      .join("\n");
    const more = selectedItems.length > 5 ? t("andMoreItemsMessage", { count: selectedItems.length - 5 }) : "";

    const firstConfirm = window.confirm(
      t("batchResetConfirm", { count: selectedItems.length, plural: selectedItems.length === 1 ? "" : "s", preview, more })
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(t("batchResetActionConfirm"));
    if (!secondConfirm) return;

    setExecuting(true);
    setFlash(null);

    try {
      const result = await batchResetInventory(
        selectedItems,
        authUser?.username || "admin",
        actorName || authUser?.username || "admin"
      );

      const completedCount = result?.successCount || selectedItems.length;
      onCompleted?.({
        type: "success",
        message: t("batchResetCompletedMessage", { count: completedCount, plural: completedCount === 1 ? "" : "s" }),
      });
    } catch (resetError) {
      setFlash({ type: "error", message: resetError.message || t("failedCompleteBatchResetMessage") });
    } finally {
      setExecuting(false);
    }
  }

  const allSelected = selectableResults.length > 0 && selectableResults.every((item) => selectedIds.includes(item.背番号));

  return (
    <PlannerModalShell
      open={open}
      title={t("batchResetInventoryTitle")}
      subtitle={t("batchResetSubtitle")}
      onClose={onClose}
      maxWidthClassName="max-w-7xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-on-surface-variant">
            {t("itemsSelectedMessage", { count: selectedItems.length, plural: selectedItems.length === 1 ? "" : "s" })}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-separator/40 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
            >
              {t("close")}
            </button>
            <button
              type="button"
              disabled={executing || selectedItems.length === 0}
              onClick={handleBatchReset}
              className="rounded-2xl bg-error px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {executing ? t("resettingLabel") : t("resetSelectedButton")}
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        <InlineBanner flash={flash} onClose={() => setFlash(null)} />

        <AdvancedFilterSection
          rows={rows}
          fieldDefinitions={fieldDefinitions}
          onUpdateRow={updateRow}
          onAddRow={() => setRows((current) => [...current, createInventoryBatchResetRow()])}
          onRemoveRow={removeRow}
          onClearRows={() => {
            void handleClearFilters();
          }}
          operatorLabels={operatorLabels}
          useOperatorLabelsInSelect
          title={t("batchResetFiltersTitle")}
          addRowLabel={t("addFilterLabel")}
          activeSummaryTitle={t("activeResetFiltersTitle")}
          activeSummaryDescription={t("filterPreviewDescription")}
          variant="roomy"
          framed
          enableTextSuggestions
          inputIdPrefix="inventory-batch-reset"
          footer={(
            <div className="ml-auto flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleClearFilters();
                }}
                className="rounded-2xl border border-separator/40 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {t("clearFiltersButton")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void handleApplyFilters();
                }}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t("findingItemsLabel") : t("findItemsButton")}
              </button>
            </div>
          )}
        />

        <div className="glass-card rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("resultsLabel")}</div>
              <h3 className="mt-1 text-base font-semibold text-on-surface">{t("inventoryItemsLabel")}</h3>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={selectableResults.length === 0}
                onChange={(event) => handleToggleAll(event.target.checked)}
                className="h-4 w-4 rounded border-outline-variant/30 text-primary"
              />
              {t("selectAllNonZeroLabel")}
            </label>
          </div>

          {loading ? (
            <EmptyState variant="filled" className="mt-4">{t("loadingInventoryItemsMessage")}</EmptyState>
          ) : results.length === 0 ? (
            <EmptyState variant="filled" className="mt-4">{t("noInventoryItemsMatchedMessage")}</EmptyState>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-outline-variant/15">
              <table className="ui-table-data min-w-full">
                <thead className="border-b border-outline-variant/15 bg-surface-container-low">
                  <tr>
                    {[
                      t("selectLabel"),
                      t("partNumberLabel"),
                      t("serialNumberLabel"),
                      t("physicalLabel"),
                      t("reservedColumnLabel"),
                      t("availableLabel"),
                      t("factory"),
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-outline">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((item) => {
                    const itemId = item.背番号;
                    const disabled = isZeroInventoryItem(item);
                    const checked = selectedIds.includes(itemId);

                    return (
                      <tr
                        key={itemId}
                        className={`border-b border-outline-variant/10 ${disabled ? "bg-surface-container-low/30 text-outline" : "hover:bg-primary/5"}`.trim()}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleSelected(itemId)}
                            className="h-4 w-4 rounded border-outline-variant/30 text-primary"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-on-surface">{item.品番 || "—"}</td>
                        <td className="px-4 py-3 text-sm text-on-surface">{item.背番号 || "—"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatInventoryNumber(item.physicalQuantity)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">{formatInventoryNumber(item.reservedQuantity)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-sky-700 dark:text-sky-300">{formatInventoryNumber(item.availableQuantity)}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{item.工場 || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PlannerModalShell>
  );
}