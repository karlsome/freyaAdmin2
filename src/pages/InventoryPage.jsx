import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import AdvancedFilterSection from "../components/AdvancedFilterSection";
import DataTable from "../components/DataTable";
import IconButton from "../components/IconButton";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import InventoryAddModal from "../components/inventory/InventoryAddModal";
import InventoryBatchResetModal from "../components/inventory/InventoryBatchResetModal";
import InventoryTransactionsModal from "../components/inventory/InventoryTransactionsModal";
import {
  exportInventoryData,
  fetchInventoryFilterOptions,
  fetchInventoryModels,
  fetchInventoryPage,
  fetchInventoryProducts,
  resolveInventoryActorName,
} from "../services/inventoryApi";
import { getAuthDisplayName, readStoredAuthUser } from "../utils/auth";
import { useLanguage } from "../contexts/LanguageContext";
import {
  buildInventoryExportMatrix,
  buildInventoryAdvancedFilterClauses,
  buildInventoryPageInfo,
  buildInventoryQueryFilters,
  canAddInventory,
  canAdminResetInventory,
  createInventoryAdvancedFilterRow,
  downloadInventoryCsvFile,
  EMPTY_INVENTORY_SUMMARY,
  formatInventoryDateTime,
  formatInventoryNumber,
  getInventoryAvailabilityMeta,
  getInventoryRowToneClass,
  INVENTORY_ADVANCED_FILTER_FIELDS,
  INVENTORY_OPERATOR_LABELS,
  INVENTORY_OPERATOR_LABELS_JA,
  INVENTORY_PAGE_SIZE_OPTIONS,
  INVENTORY_SUMMARY_CARDS,
  joinInventoryClasses,
  summarizeSelectedInventoryTags,
} from "../utils/inventory";

const EMPTY_PAGINATION = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: INVENTORY_PAGE_SIZE_OPTIONS[0],
};

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
    : flash.type === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={joinInventoryClasses("mb-6 rounded-[8px] border px-4 py-3", tone)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">Status</p>
          <p className="mt-0.5 text-xs font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-[4px] text-current/70 transition hover:bg-[var(--surface-hover)] hover:text-current">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>
    </div>
  );
}

function AvailabilityCell({ value, language = "en" }) {
  const meta = getInventoryAvailabilityMeta(value, language);

  return (
    <div className="min-w-0">
      <div className="font-semibold text-[var(--text-primary)]">{formatInventoryNumber(value)}</div>
      <div className="mt-1">
        <span className={joinInventoryClasses("inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-xs font-semibold", meta.badgeClassName)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{meta.icon}</span>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [authUser] = useState(() => readStoredAuthUser());
  const canAdd = canAddInventory(authUser);
  const canAdminReset = canAdminResetInventory(authUser);
  const requestIdRef = useRef(0);

  const [filters, setFilters] = useState({ partNumber: "", backNumber: "", model: "", search: "" });
  const [advancedRows, setAdvancedRows] = useState(() => [createInventoryAdvancedFilterRow()]);
  const [advancedFilters, setAdvancedFilters] = useState([]);
  const [selectedBackNumbers, setSelectedBackNumbers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(INVENTORY_PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState({ column: "", direction: 1 });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_INVENTORY_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [filterOptions, setFilterOptions] = useState({ partNumbers: [], backNumbers: [], factories: [] });
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [actorName, setActorName] = useState(() => getAuthDisplayName(authUser));
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [batchResetOpen, setBatchResetOpen] = useState(false);
  const [transactionState, setTransactionState] = useState({ open: false, backNumber: "" });

  const deferredSearch = useDeferredValue(filters.search);
  const selectedTagSummary = summarizeSelectedInventoryTags(selectedBackNumbers, language);
  const advancedFieldDefinitions = useMemo(() => (
    INVENTORY_ADVANCED_FILTER_FIELDS.map((field) => ({
      ...field,
      label: isJa ? (field.labelJa || field.label) : field.label,
      group: isJa ? (field.groupJa || field.group) : field.group,
      options: field.field === "品番"
        ? filterOptions.partNumbers
        : field.field === "背番号"
          ? filterOptions.backNumbers
          : field.field === "工場"
            ? filterOptions.factories
            : [],
    }))
  ), [filterOptions.backNumbers, filterOptions.factories, filterOptions.partNumbers, isJa]);

  useEffect(() => {
    if (!flash) return undefined;
    const timeoutId = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [flash]);

  useEffect(() => {
    let cancelled = false;
    const displayName = getAuthDisplayName(authUser);
    setActorName(displayName);

    if (!authUser?.username || displayName !== authUser.username) {
      return () => {
        cancelled = true;
      };
    }

    resolveInventoryActorName(authUser).then((name) => {
      if (!cancelled && name) {
        setActorName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageMeta() {
      try {
        const [nextFilters, nextModels] = await Promise.all([
          fetchInventoryFilterOptions(),
          fetchInventoryModels(),
        ]);

        if (cancelled) return;
        setFilterOptions(nextFilters);
        setModels(nextModels);
      } catch (loadError) {
        if (!cancelled) {
          setFlash({ type: "error", message: loadError.message || "Failed to load inventory filters." });
        }
      }
    }

    void loadPageMeta();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  useEffect(() => {
    if (!filters.model) {
      setSelectedBackNumbers([]);
      setModelLoading(false);
      return undefined;
    }

    let cancelled = false;
    setModelLoading(true);

    async function loadModelProducts() {
      try {
        const products = await fetchInventoryProducts(filters.model);
        if (cancelled) return;

        const nextBackNumbers = [...new Set(products.map((item) => item.背番号).filter(Boolean))];
        setSelectedBackNumbers(nextBackNumbers);
      } catch (loadError) {
        if (!cancelled) {
          setSelectedBackNumbers([]);
          setFlash({ type: "error", message: loadError.message || "Failed to load products for the selected model." });
        }
      } finally {
        if (!cancelled) {
          setModelLoading(false);
        }
      }
    }

    void loadModelProducts();

    return () => {
      cancelled = true;
    };
  }, [filters.model]);

  useEffect(() => {
    if (filters.model && modelLoading) return undefined;

    if (filters.model && !modelLoading && selectedBackNumbers.length === 0) {
      setRows([]);
      setSummary(EMPTY_INVENTORY_SUMMARY);
      setPagination(EMPTY_PAGINATION);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;
    const requestId = ++requestIdRef.current;
    const queryFilters = buildInventoryQueryFilters({
      partNumber: filters.partNumber,
      backNumber: filters.backNumber,
      search: deferredSearch,
      selectedBackNumbers,
      advancedFilters,
    });

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchInventoryPage({
          filters: queryFilters,
          page,
          limit: pageSize,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        setRows(Array.isArray(result?.data) ? result.data : []);
        setSummary(result?.summary || EMPTY_INVENTORY_SUMMARY);
        setPagination(result?.pagination || EMPTY_PAGINATION);
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setSummary(EMPTY_INVENTORY_SUMMARY);
        setPagination(EMPTY_PAGINATION);
        setError(loadError.message || "Failed to load inventory data.");
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [advancedFilters, deferredSearch, filters.backNumber, filters.model, filters.partNumber, modelLoading, page, pageSize, refreshNonce, selectedBackNumbers, sort]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function handleModelChange(value) {
    setFilters((current) => ({
      ...current,
      model: value,
      backNumber: value ? "" : current.backNumber,
    }));
    setPage(1);
  }

  function handleSort(column) {
    setPage(1);
    setSort((current) => {
      if (current.column === column) {
        return { column, direction: current.direction === 1 ? -1 : 1 };
      }

      return { column, direction: 1 };
    });
  }

  function handleRemoveSelectedBackNumber(backNumber) {
    setSelectedBackNumbers((current) => {
      const next = current.filter((value) => value !== backNumber);
      if (next.length === 0) {
        setFilters((state) => ({ ...state, model: "" }));
      }
      return next;
    });
    setPage(1);
  }

  function handleUpdateAdvancedRow(rowId, patch) {
    setAdvancedRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function handleRemoveAdvancedRow(rowId) {
    setAdvancedRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createInventoryAdvancedFilterRow()];
    });
  }

  function handleApplyAdvancedFilters() {
    setPage(1);
    setAdvancedFilters(buildInventoryAdvancedFilterClauses(advancedRows, advancedFieldDefinitions));
  }

  function handleClearAdvancedFilters() {
    setPage(1);
    setAdvancedRows([createInventoryAdvancedFilterRow()]);
    setAdvancedFilters([]);
  }

  async function handleExport() {
    setExporting(true);

    try {
      if (filters.model && selectedBackNumbers.length === 0) {
        setFlash({ type: "warning", message: isJa ? "選択したモデルに紐づく背番号が現在存在しません。" : "The selected model does not currently map to any serial numbers to export." });
        return;
      }

      const exportFilters = buildInventoryQueryFilters({
        partNumber: filters.partNumber,
        backNumber: filters.backNumber,
        search: deferredSearch,
        selectedBackNumbers,
        advancedFilters,
      });
      const result = await exportInventoryData(exportFilters);
      downloadInventoryCsvFile("inventory-data.csv", buildInventoryExportMatrix(result));
      setFlash({ type: "success", message: isJa ? `${result.length} 件の在庫アイテムをエクスポートしました。` : `Exported ${result.length} inventory item${result.length === 1 ? "" : "s"}.` });
    } catch (exportError) {
      setFlash({ type: "error", message: exportError.message || (isJa ? "在庫データのエクスポートに失敗しました。" : "Failed to export inventory data.") });
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo(() => ([
    {
      key: "品番",
      label: isJa ? "品番" : "Part Number",
      width: 170,
      renderCell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setTransactionState({ open: true, backNumber: row.背番号 });
          }}
          className="text-left font-semibold text-[var(--freya-blue)] transition hover:underline"
        >
          {row.品番 || "—"}
        </button>
      ),
      disableCellWrapper: true,
    },
    {
      key: "背番号",
      label: isJa ? "背番号" : "Serial Number",
      width: 170,
      renderCell: (row) => <span className="font-semibold text-[var(--text-primary)]">{row.背番号 || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "工場",
      label: isJa ? "工場" : "Factory",
      width: 140,
      renderCell: (row) => row.工場 ? (
        <span className="inline-flex items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)]">
          {row.工場}
        </span>
      ) : <span className="text-[var(--text-muted)]">—</span>,
      disableCellWrapper: true,
    },
    {
      key: "physicalQuantity",
      label: isJa ? "実在庫" : "Physical",
      width: 120,
      renderCell: (row) => <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatInventoryNumber(row.physicalQuantity)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "reservedQuantity",
      label: isJa ? "引当" : "Reserved",
      width: 120,
      renderCell: (row) => <span className="font-semibold text-amber-600 dark:text-amber-400">{formatInventoryNumber(row.reservedQuantity)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "availableQuantity",
      label: isJa ? "利用可能" : "Available",
      width: 180,
      renderCell: (row) => <AvailabilityCell value={row.availableQuantity} language={language} />,
      disableCellWrapper: true,
    },
    {
      key: "lastUpdated",
      label: isJa ? "最終更新日時" : "Last Updated",
      width: 190,
      renderCell: (row) => <span className="text-[var(--text-muted)]">{formatInventoryDateTime(row.lastUpdated)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "actions",
      label: isJa ? "操作" : "Actions",
      sortable: false,
      width: 90,
      renderCell: (row) => (
        <IconButton
          icon="history"
          onClick={(event) => { event.stopPropagation(); setTransactionState({ open: true, backNumber: row.背番号 }); }}
          variant="ghost"
          size="md"
          iconSize={18}
          ariaLabel={isJa ? "履歴を表示" : "View transactions"}
        />
      ),
      disableCellWrapper: true,
    },
  ]), [isJa, language]);

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <div className="w-full">
        <PageHeader
          eyebrow={isJa ? "倉庫台帳" : "Warehouse Ledger"}
          eyebrowClassName="tracking-[0.04em] text-[var(--freya-blue)] uppercase font-semibold text-xs"
          title={isJa ? "在庫管理" : "Inventory"}
          subtitle={isJa ? "背番号ごとの最新在庫状況の追跡、入出庫履歴の確認、手動在庫追加、および制御されたリセット処理を行います。" : "Track the latest inventory state by serial number, inspect transaction history, add stock manually, and run controlled reset workflows."}
          subtitleClassName="max-w-3xl text-xs text-[var(--text-muted)]"
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loading || modelLoading}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isJa ? "更新" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || modelLoading}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? (isJa ? "エクスポート中..." : "Exporting...") : (isJa ? "CSVエクスポート" : "Export CSV")}
              </button>
              {canAdminReset ? (
                <button
                  type="button"
                  onClick={() => setBatchResetOpen(true)}
                  className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10"
                >
                  {isJa ? "一括リセット" : "Batch Reset"}
                </button>
              ) : null}
              {canAdd ? (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)]"
                >
                  {isJa ? "在庫追加" : "Add Inventory"}
                </button>
              ) : null}
            </>
          )}
        />

        <FlashBanner flash={flash} onClose={() => setFlash(null)} />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {INVENTORY_SUMMARY_CARDS.map((card) => (
            <StatSummaryCard
              key={card.key}
              variant="freya"
              icon={card.icon}
              label={isJa ? (card.labelJa || card.label) : card.label}
              value={formatInventoryNumber(summary[card.key] ?? 0)}
              subtitle={card.key === "totalItems" ? (isJa ? "最新の固有背番号レコード" : "Latest unique serial records") : (isJa ? "現在の在庫フィルター全体" : "Across the current inventory filter set")}
              accent={card.accent}
              loading={loading && !rows.length}
            />
          ))}
        </div>

        <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "フィルター" : "Filters"}</p>
              <h2 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{isJa ? "在庫フィルター" : "Inventory Filters"}</h2>
            </div>
            {modelLoading ? <p className="text-xs text-[var(--text-muted)]">{isJa ? "モデル製品を読み込み中..." : "Loading model products..."}</p> : null}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "品番" : "Part Number"}</span>
              <select
                value={filters.partNumber}
                onChange={(event) => updateFilter("partNumber", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
              >
                <option value="">{isJa ? "すべての品番" : "All Part Numbers"}</option>
                {filterOptions.partNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "背番号" : "Serial Number"}</span>
              <select
                value={filters.backNumber}
                onChange={(event) => updateFilter("backNumber", event.target.value)}
                disabled={selectedBackNumbers.length > 0}
                className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{selectedBackNumbers.length > 0 ? (isJa ? "モデルタグフィルター有効" : "Model tag filter active") : (isJa ? "すべての背番号" : "All Serial Numbers")}</option>
                {filterOptions.backNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "モデル" : "Model"}</span>
              <select
                value={filters.model}
                onChange={(event) => handleModelChange(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
              >
                <option value="">{isJa ? "すべてのモデル" : "All Models"}</option>
                {models.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "検索" : "Search"}</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder={isJa ? "品番または背番号で検索..." : "Part number or serial number..."}
                className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
              />
            </label>
          </div>

          <AdvancedFilterSection
            rows={advancedRows}
            fieldDefinitions={advancedFieldDefinitions}
            onUpdateRow={handleUpdateAdvancedRow}
            onAddRow={() => setAdvancedRows((current) => [...current, createInventoryAdvancedFilterRow()])}
            onRemoveRow={handleRemoveAdvancedRow}
            onClearRows={handleClearAdvancedFilters}
            operatorLabels={isJa ? INVENTORY_OPERATOR_LABELS_JA : INVENTORY_OPERATOR_LABELS}
            useOperatorLabelsInSelect
            title={isJa ? "詳細フィルター" : "Advanced Filters"}
            activeSummaryDescription={isJa ? "実行前の現在の詳細在庫条件。" : "Current advanced inventory conditions before execution."}
            variant="compact"
            framed
            enableTextSuggestions
            inputIdPrefix="inventory-filter-options"
            footer={(
              <>
                <button
                  type="button"
                  onClick={handleApplyAdvancedFilters}
                  className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
                  {isJa ? "詳細フィルターを適用" : "Apply Advanced Filters"}
                </button>

                <button
                  type="button"
                  onClick={handleClearAdvancedFilters}
                  className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                  {isJa ? "詳細フィルターをリセット" : "Reset Advanced Filters"}
                </button>
              </>
            )}
          />

          {filters.model || selectedBackNumbers.length > 0 ? (
            <div className="mt-4 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "選択中の製品" : "Selected Products"}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-primary)]">{selectedTagSummary.countLabel}</p>
                </div>
                {filters.model ? (
                  <button
                    type="button"
                    onClick={() => handleModelChange("")}
                    className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {isJa ? "モデルフィルターを解除" : "Clear Model Filter"}
                  </button>
                ) : null}
              </div>

              {selectedTagSummary.visible.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedTagSummary.visible.map((backNumber) => (
                    <span key={backNumber} className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--freya-blue)]">
                      {backNumber}
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedBackNumber(backNumber)}
                        className="text-current/70 transition hover:text-current"
                        aria-label={isJa ? `${backNumber} を削除` : `Remove ${backNumber}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </span>
                  ))}
                  {selectedTagSummary.overflow > 0 ? (
                    <span className="inline-flex items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                      +{selectedTagSummary.overflow} {isJa ? "件" : "more"}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading || modelLoading}
          error={error}
          sort={sort}
          page={pagination.currentPage || page}
          pageSize={pageSize}
          filteredCount={pagination.totalItems || rows.length}
          totalPages={pagination.totalPages || 0}
          onSort={handleSort}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          pageSizeOptions={INVENTORY_PAGE_SIZE_OPTIONS}
          pageSizeLabel={isJa ? "件数" : "Rows"}
          rowKey={(row) => row.背番号}
          onRowClick={(row) => setTransactionState({ open: true, backNumber: row.背番号 })}
          getRowClassName={(row) => getInventoryRowToneClass(row)}
          renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
            <span>{buildInventoryPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize }, language)}</span>
          )}
          emptyTitle={isJa ? "該当する在庫レコードがありません" : "No matching inventory records"}
          emptyMessage={isJa ? "フィルターを調整するか、在庫を追加して最初の取引を作成してください。" : "Adjust the filters or add inventory to create the first transaction."}
          layoutStorageKey="inventory-table-layout"
          enableColumnResize
          enableColumnReorder
          stickyHeader
          stickyHeaderOffset={0}
          className="freya-card mb-6 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm"
          topBarClassName="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
          bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between text-xs text-[var(--text-muted)]"
          rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          rowsSelectClassName="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
        />

        <InventoryAddModal
          open={addModalOpen}
          authUser={authUser}
          actorName={actorName}
          onClose={() => setAddModalOpen(false)}
          onSubmitted={(result) => {
            setAddModalOpen(false);
            if (result?.message) {
              setFlash({ type: result.type || "success", message: result.message });
            }
            setRefreshNonce((current) => current + 1);
          }}
        />

        <InventoryTransactionsModal
          open={transactionState.open}
          backNumber={transactionState.backNumber}
          authUser={authUser}
          actorName={actorName}
          canReset={canAdminReset}
          onClose={() => setTransactionState({ open: false, backNumber: "" })}
          onUpdated={(result) => {
            if (result?.message) {
              setFlash({ type: result.type || "success", message: result.message });
            }
            setRefreshNonce((current) => current + 1);
          }}
        />

        <InventoryBatchResetModal
          open={batchResetOpen}
          authUser={authUser}
          actorName={actorName}
          onClose={() => setBatchResetOpen(false)}
          onCompleted={(result) => {
            setBatchResetOpen(false);
            if (result?.message) {
              setFlash({ type: result.type || "success", message: result.message });
            }
            setRefreshNonce((current) => current + 1);
          }}
        />
      </div>
    </div>
  );
}