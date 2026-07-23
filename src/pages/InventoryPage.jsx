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
  INVENTORY_FILTER_GROUP_LABEL_KEYS,
  INVENTORY_OPERATOR_LABEL_KEYS,
  INVENTORY_PAGE_SIZE_OPTIONS,
  INVENTORY_SUMMARY_CARDS,
  joinInventoryClasses,
  summarizeSelectedInventoryTags,
} from "../utils/inventory";
import { useLanguage } from "../contexts/LanguageContext";

const EMPTY_PAGINATION = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: INVENTORY_PAGE_SIZE_OPTIONS[0],
};

function FlashBanner({ flash, onClose }) {
  const { t } = useLanguage();
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-error/20 bg-error/10 text-error"
    : flash.type === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={joinInventoryClasses("mb-6 rounded-3xl border px-5 py-4", tone)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t("status")}</p>
          <p className="mt-1 text-sm font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

function AvailabilityCell({ value }) {
  const { t } = useLanguage();
  const meta = getInventoryAvailabilityMeta(value);

  return (
    <div className="min-w-0">
      <div className="font-semibold text-on-surface">{formatInventoryNumber(value)}</div>
      <div className="mt-2">
        <span className={joinInventoryClasses("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", meta.badgeClassName)}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{meta.icon}</span>
          {t(meta.labelKey)}
        </span>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { t } = useLanguage();
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
  const selectedTagSummary = summarizeSelectedInventoryTags(selectedBackNumbers, t);
  const advancedFieldDefinitions = useMemo(() => (
    INVENTORY_ADVANCED_FILTER_FIELDS.map((field) => ({
      ...field,
      label: t(field.labelKey),
      group: t(INVENTORY_FILTER_GROUP_LABEL_KEYS[field.group] || field.group),
      options: field.field === "品番"
        ? filterOptions.partNumbers
        : field.field === "背番号"
          ? filterOptions.backNumbers
          : field.field === "工場"
            ? filterOptions.factories
            : [],
    }))
  ), [filterOptions.backNumbers, filterOptions.factories, filterOptions.partNumbers, t]);
  const advancedOperatorLabels = useMemo(() => (
    Object.fromEntries(Object.entries(INVENTORY_OPERATOR_LABEL_KEYS).map(([key, labelKey]) => [key, t(labelKey)]))
  ), [t]);

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
          setFlash({ type: "error", message: loadError.message || t("failedLoadInventoryFiltersMessage") });
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
          setFlash({ type: "error", message: loadError.message || t("failedLoadModelProductsMessage") });
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
        setError(loadError.message || t("failedLoadInventoryDataMessage"));
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
        setFlash({ type: "warning", message: t("modelNoSerialNumbersMessage") });
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
      setFlash({ type: "success", message: t("exportedInventoryItemsMessage", { count: result.length, plural: result.length === 1 ? "" : "s" }) });
    } catch (exportError) {
      setFlash({ type: "error", message: exportError.message || t("failedExportInventoryMessage") });
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo(() => ([
    {
      key: "品番",
      label: t("partNumberLabel"),
      width: 170,
      renderCell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setTransactionState({ open: true, backNumber: row.背番号 });
          }}
          className="text-left font-semibold text-primary transition hover:underline"
        >
          {row.品番 || "—"}
        </button>
      ),
      disableCellWrapper: true,
    },
    {
      key: "背番号",
      label: t("serialNumberLabel"),
      width: 170,
      renderCell: (row) => <span className="font-semibold text-on-surface">{row.背番号 || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "工場",
      label: t("factory"),
      width: 140,
      renderCell: (row) => row.工場 ? (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {row.工場}
        </span>
      ) : <span className="text-on-surface-variant">—</span>,
      disableCellWrapper: true,
    },
    {
      key: "physicalQuantity",
      label: t("physicalLabel"),
      width: 120,
      renderCell: (row) => <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatInventoryNumber(row.physicalQuantity)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "reservedQuantity",
      label: t("reservedColumnLabel"),
      width: 120,
      renderCell: (row) => <span className="font-semibold text-amber-700 dark:text-amber-300">{formatInventoryNumber(row.reservedQuantity)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "availableQuantity",
      label: t("availableLabel"),
      width: 180,
      renderCell: (row) => <AvailabilityCell value={row.availableQuantity} />,
      disableCellWrapper: true,
    },
    {
      key: "lastUpdated",
      label: t("lastUpdatedLabel"),
      width: 190,
      renderCell: (row) => <span className="text-on-surface-variant">{formatInventoryDateTime(row.lastUpdated)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "actions",
      label: t("actions"),
      sortable: false,
      width: 90,
      renderCell: (row) => (
        <IconButton
          icon="history"
          onClick={(event) => { event.stopPropagation(); setTransactionState({ open: true, backNumber: row.背番号 }); }}
          variant="ghost"
          size="md"
          iconSize={18}
          ariaLabel={t("viewTransactionsAria")}
        />
      ),
      disableCellWrapper: true,
    },
  ]), [t]);

  return (
    <section className="h-screen overflow-y-auto scrollbar-hide px-8 pb-16 pt-24">
      <div className="w-full">
        <PageHeader
          eyebrow={t("warehouseLedgerEyebrow")}
          eyebrowClassName="tracking-[0.18em] text-primary"
          title={t("inventory")}
          subtitle={t("inventoryPageSubtitle")}
          subtitleClassName="max-w-3xl"
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loading || modelLoading}
                className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("refresh")}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || modelLoading}
                className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? t("exportingLabel") : t("exportCSVLabel")}
              </button>
              {canAdminReset ? (
                <button
                  type="button"
                  onClick={() => setBatchResetOpen(true)}
                  className="rounded-2xl border border-error/20 bg-error/8 px-4 py-2.5 text-sm font-semibold text-error transition hover:bg-error/12"
                >
                  {t("batchResetButton")}
                </button>
              ) : null}
              {canAdd ? (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                >
                  {t("addInventoryButton")}
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
              icon={card.icon}
              label={t(card.labelKey)}
              value={formatInventoryNumber(summary[card.key] ?? 0)}
              subtitle={card.key === "totalItems" ? t("latestUniqueSerialRecordsMessage") : t("acrossCurrentFilterSetMessage")}
              accent={card.accent}
              loading={loading && !rows.length}
            />
          ))}
        </div>

        <div className="dashboard-section mb-6 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("filtersHeading")}</p>
              <h2 className="mt-1 text-lg font-semibold text-on-surface">{t("inventoryFiltersHeading")}</h2>
            </div>
            {modelLoading ? <p className="text-sm text-on-surface-variant">{t("loadingModelProductsMessage")}</p> : null}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("partNumberLabel")}</span>
              <select
                value={filters.partNumber}
                onChange={(event) => updateFilter("partNumber", event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                <option value="">{t("allPartNumbersOption")}</option>
                {filterOptions.partNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("serialNumberLabel")}</span>
              <select
                value={filters.backNumber}
                onChange={(event) => updateFilter("backNumber", event.target.value)}
                disabled={selectedBackNumbers.length > 0}
                className="mt-2 h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-container"
              >
                <option value="">{selectedBackNumbers.length > 0 ? t("modelTagFilterActiveMessage") : t("allSerialNumbersOption")}</option>
                {filterOptions.backNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("modelLabel")}</span>
              <select
                value={filters.model}
                onChange={(event) => handleModelChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                <option value="">{t("allModelsOption")}</option>
                {models.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("search")}</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder={t("partOrSerialSearchPlaceholder")}
                className="mt-2 h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
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
            operatorLabels={advancedOperatorLabels}
            useOperatorLabelsInSelect
            title={t("advancedFiltersTitle")}
            activeSummaryDescription={t("currentAdvancedConditionsMessage")}
            variant="compact"
            framed
            enableTextSuggestions
            inputIdPrefix="inventory-filter-options"
            footer={(
              <>
                <button
                  type="button"
                  onClick={handleApplyAdvancedFilters}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt</span>
                  {t("applyAdvancedFiltersButton")}
                </button>

                <button
                  type="button"
                  onClick={handleClearAdvancedFilters}
                  className="flex items-center gap-2 rounded-xl border border-separator/40 glass-card px-5 py-2.5 text-sm font-semibold text-on-surface transition-all hover:border-primary/30"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                  {t("resetAdvancedFiltersButton")}
                </button>
              </>
            )}
          />

          {filters.model || selectedBackNumbers.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("selectedProductsLabel")}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{selectedTagSummary.countLabel}</p>
                </div>
                {filters.model ? (
                  <button
                    type="button"
                    onClick={() => handleModelChange("")}
                    className="rounded-2xl border border-separator/40 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
                  >
                    {t("clearModelFilterButton")}
                  </button>
                ) : null}
              </div>

              {selectedTagSummary.visible.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedTagSummary.visible.map((backNumber) => (
                    <span key={backNumber} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                      {backNumber}
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedBackNumber(backNumber)}
                        className="text-current/70 transition hover:text-current"
                        aria-label={t("removeItemAria", { serial: backNumber })}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </span>
                  ))}
                  {selectedTagSummary.overflow > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant">
                      {t("moreCountLabel", { count: selectedTagSummary.overflow })}
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
          pageSizeLabel={t("rowsSuffix")}
          previousLabel={t("previousLabel")}
          nextLabel={t("next")}
          rowKey={(row) => row.背番号}
          onRowClick={(row) => setTransactionState({ open: true, backNumber: row.背番号 })}
          getRowClassName={(row) => getInventoryRowToneClass(row)}
          renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
            <span>{buildInventoryPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize, t })}</span>
          )}
          emptyTitle={t("noMatchingInventoryRecordsMessage")}
          emptyMessage={t("adjustFiltersOrAddInventoryMessage")}
          layoutStorageKey="inventory-table-layout"
          enableColumnResize
          enableColumnReorder
          stickyHeader
          stickyHeaderOffset={0}
          className="dashboard-section mb-6 overflow-hidden rounded-2xl"
          topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
          bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
          rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
          rowsSelectClassName="h-10 rounded-2xl border border-separator/40 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
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
    </section>
  );
}