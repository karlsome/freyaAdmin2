import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
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
  INVENTORY_OPERATOR_LABELS,
  INVENTORY_OPERATOR_LABELS_JA,
} from "../../utils/inventory";

function InlineBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
    : flash.type === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={`rounded-[6px] border px-3.5 py-2.5 text-xs ${tone}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{flash.message}</p>
        <button type="button" onClick={onClose} className="flex h-5 w-5 items-center justify-center rounded-[4px] text-current/70 transition hover:bg-[var(--surface-hover)] hover:text-current">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
      label: isJa ? (field.labelJa || field.label) : field.label,
      group: isJa ? (field.groupJa || field.group) : field.group,
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
  ), [factoryOptions, isJa, optionSets.backNumbers, optionSets.models, optionSets.partNumbers]);

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
        setFlash({ type: "error", message: loadError.message || (isJa ? "一括リセットデータの読み込みに失敗しました。" : "Failed to load batch reset data.") });
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, [open, isJa]);

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
      setFlash({ type: "error", message: loadError.message || (isJa ? "一括リセット結果の取得に失敗しました。" : "Failed to load batch reset results.") });
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
      .map((item) => isJa
        ? `${item.背番号} (${item.品番}) - 実在庫 ${item.physicalQuantity}、引当 ${item.reservedQuantity}、利用可能 ${item.availableQuantity}`
        : `${item.背番号} (${item.品番}) - Physical ${item.physicalQuantity}, Reserved ${item.reservedQuantity}, Available ${item.availableQuantity}`)
      .join("\n");
    const more = selectedItems.length > 5 ? (isJa ? `\n...他 ${selectedItems.length - 5} 件` : `\n...and ${selectedItems.length - 5} more items`) : "";

    const firstConfirm = window.confirm(
      isJa
        ? `${selectedItems.length} 件の在庫アイテムをゼロにリセットしますか？\n\n${preview}${more}`
        : `Reset ${selectedItems.length} inventory item${selectedItems.length === 1 ? "" : "s"} to zero?\n\n${preview}${more}`
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      isJa
        ? "この操作により、選択したすべてのアイテムに対して一括リセットの監査トランザクションが作成されます。続行しますか？"
        : "This action creates batch reset audit transactions for all selected items. Continue?"
    );
    if (!secondConfirm) return;

    setExecuting(true);
    setFlash(null);

    try {
      const result = await batchResetInventory(
        selectedItems,
        authUser?.username || "admin",
        actorName || authUser?.username || "admin"
      );

      onCompleted?.({
        type: "success",
        message: isJa
          ? `${result?.successCount || selectedItems.length} 件のアイテムの一括リセットが完了しました。`
          : `Batch reset completed for ${result?.successCount || selectedItems.length} item${(result?.successCount || selectedItems.length) === 1 ? "" : "s"}.`,
      });
    } catch (resetError) {
      setFlash({ type: "error", message: resetError.message || (isJa ? "一括リセットの実行に失敗しました。" : "Failed to complete batch reset.") });
    } finally {
      setExecuting(false);
    }
  }

  const allSelected = selectableResults.length > 0 && selectableResults.every((item) => selectedIds.includes(item.背番号));

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? "在庫一括リセット" : "Batch Reset Inventory"}
      subtitle={isJa ? "詳細フィルターを使用して対象の在庫を特定し、監査ログを残しながら選択したアイテムをゼロにリセットします。" : "Use advanced filters to find inventory rows and reset the selected items to zero with an audit trail."}
      onClose={onClose}
      maxWidthClassName="max-w-7xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-muted)]">
            {isJa ? `${selectedItems.length} 件選択中` : `${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} selected`}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
            >
              {isJa ? "閉じる" : "Close"}
            </button>
            <button
              type="button"
              disabled={executing || selectedItems.length === 0}
              onClick={handleBatchReset}
              className="rounded-[6px] bg-[var(--status-danger)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {executing ? (isJa ? "リセット中..." : "Resetting...") : (isJa ? "選択項目をリセット" : "Reset Selected")}
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
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
          operatorLabels={isJa ? INVENTORY_OPERATOR_LABELS_JA : INVENTORY_OPERATOR_LABELS}
          useOperatorLabelsInSelect
          title={isJa ? "一括リセットフィルター" : "Batch Reset Filters"}
          addRowLabel={isJa ? "フィルターを追加" : "Add Filter"}
          activeSummaryTitle={isJa ? "適用中のリセットフィルター" : "Active Reset Filters"}
          activeSummaryDescription={isJa ? "品番、背番号、工場、モデルで絞り込み、対象となる在庫アイテムを確認します。" : "Filter by part number, serial number, factory, or model to preview affected inventory items."}
          variant="roomy"
          framed
          enableTextSuggestions
          inputIdPrefix="inventory-batch-reset"
          footer={(
            <div className="ml-auto flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void handleClearFilters();
                }}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                {isJa ? "フィルターをクリア" : "Clear Filters"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void handleApplyFilters();
                }}
                className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (isJa ? "検索中..." : "Finding Items...") : (isJa ? "アイテムを検索" : "Find Items")}
              </button>
            </div>
          )}
        />

        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "検索結果" : "Results"}</div>
              <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{isJa ? "在庫アイテム" : "Inventory Items"}</h3>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={selectableResults.length === 0}
                onChange={(event) => handleToggleAll(event.target.checked)}
                className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)]"
              />
              {isJa ? "在庫がゼロ以外の全アイテムを選択" : "Select all non-zero items"}
            </label>
          </div>

          {loading ? (
            <EmptyState variant="filled" className="mt-4 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] py-8 text-xs text-[var(--text-muted)]">
              {isJa ? "在庫アイテムを読み込み中..." : "Loading inventory items..."}
            </EmptyState>
          ) : results.length === 0 ? (
            <EmptyState variant="filled" className="mt-4 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] py-8 text-xs text-[var(--text-muted)]">
              {isJa ? "条件に一致する在庫アイテムはありません。" : "No inventory items matched the current filters."}
            </EmptyState>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-[6px] border border-[var(--border)]">
              <table className="min-w-full">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                  <tr>
                    {[
                      { key: "select", label: isJa ? "選択" : "Select" },
                      { key: "part", label: isJa ? "品番" : "Part Number" },
                      { key: "serial", label: isJa ? "背番号" : "Serial Number" },
                      { key: "physical", label: isJa ? "実在庫" : "Physical" },
                      { key: "reserved", label: isJa ? "引当" : "Reserved" },
                      { key: "available", label: isJa ? "利用可能" : "Available" },
                      { key: "factory", label: isJa ? "工場" : "Factory" },
                    ].map((col) => (
                      <th key={col.key} className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        {col.label}
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
                        className={`border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)] ${disabled ? "bg-[var(--surface-subtle)]/50 text-[var(--text-muted)] opacity-60" : ""}`.trim()}
                      >
                        <td className="px-3.5 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleSelected(itemId)}
                            className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)]"
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]">{item.品番 || "—"}</td>
                        <td className="px-3.5 py-2.5 text-xs text-[var(--text-primary)]">{item.背番号 || "—"}</td>
                        <td className="px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatInventoryNumber(item.physicalQuantity)}</td>
                        <td className="px-3.5 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{formatInventoryNumber(item.reservedQuantity)}</td>
                        <td className="px-3.5 py-2.5 text-xs font-semibold text-sky-600 dark:text-sky-400">{formatInventoryNumber(item.availableQuantity)}</td>
                        <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)]">{item.工場 || "—"}</td>
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