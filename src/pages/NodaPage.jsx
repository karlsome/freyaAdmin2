import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import DataTable from "../components/DataTable";
import IconButton from "../components/IconButton";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import StatusChip from "../components/StatusChip";
import NodaBulkRequestModal from "../components/noda/NodaBulkRequestModal";
import NodaDetailModal from "../components/noda/NodaDetailModal";
import NodaGenSyncModal from "../components/noda/NodaGenSyncModal";
import {
  exportNodaRequests,
  fetchNodaFilterOptions,
  fetchNodaPage,
  fetchNodaUserFullName,
  runNodaInventoryReservation,
} from "../services/nodaApi";
import { readStoredAuthUser } from "../utils/auth";
import { useLanguage } from "../contexts/LanguageContext";
import {
  buildNodaPageInfo,
  buildNodaQueryFilters,
  canManageNodaRequests,
  downloadCsvFile,
  EMPTY_NODA_STATS,
  formatNodaDate,
  formatNodaTime,
  getNodaItemsSummary,
  getNodaPickupDateValue,
  getNodaRowToneClass,
  getNodaStatusMeta,
  joinNodaClasses,
  NODA_PAGE_SIZE_OPTIONS,
  NODA_STATUS_CARDS,
  NODA_STATUS_OPTIONS,
  normalizeNodaStatistics,
  resolveNodaDisplayStatus,
} from "../utils/noda";

const EMPTY_PAGINATION = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: NODA_PAGE_SIZE_OPTIONS[0],
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
    <div className={joinNodaClasses("mb-6 rounded-[24px] border px-5 py-4", tone)}>
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


function CompletedAtCell({ value }) {
  if (!value) {
    return <span className="text-on-surface-variant">—</span>;
  }

  return (
    <div className="min-w-0">
      <div className="font-semibold text-on-surface">{formatNodaDate(value)}</div>
      <div className="mt-1 text-xs text-on-surface-variant">{formatNodaTime(value)}</div>
    </div>
  );
}

function buildExportMatrix(requests = [], t) {
  return [
    [
      "Request Number",
      "Type",
      "Status",
      "Pickup Date",
      "Deadline",
      "Delivery Order",
      "Delivery Note",
      "Completed Date",
      "Completed Time",
      "Items",
      "Created At",
      "Created By",
    ],
    ...requests.map((request) => {
      const itemSummary = request.requestType === "bulk"
        ? (request.lineItems || []).map((lineItem) => `${lineItem.品番}/${lineItem.背番号}/${lineItem.quantity}`).join(" | ")
        : `${request.品番 || ""}/${request.背番号 || ""}/${request.quantity || ""}`;

      return [
        request.requestNumber || "",
        request.requestType || "single",
        t(getNodaStatusMeta(resolveNodaDisplayStatus(request)).labelKey),
        getNodaPickupDateValue(request) || "",
        request.納入指示日 || "",
        request.便 || "",
        request.納品書番号 || "",
        formatNodaDate(request.completedAt),
        formatNodaTime(request.completedAt),
        itemSummary,
        request.createdAt || "",
        request.createdBy || "",
      ];
    }),
  ];
}

export default function NodaPage() {
  const { t } = useLanguage();
  const authUser = readStoredAuthUser();
  const canManage = canManageNodaRequests(authUser);
  const requestIdRef = useRef(0);

  const [filters, setFilters] = useState({
    status: "",
    partNumber: "",
    backNumber: "",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const deferredSearchValue = useDeferredValue(filters.search);
  const [activeStatus, setActiveStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(NODA_PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState({ column: "", direction: 1 });
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(EMPTY_NODA_STATS);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [filterOptions, setFilterOptions] = useState({ partNumbers: [], backNumbers: [] });
  const [loading, setLoading] = useState(false);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [detailState, setDetailState] = useState({ open: false, requestId: null, mode: "view" });

  useEffect(() => {
    if (!flash) return undefined;
    const timeoutId = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [flash]);

  useEffect(() => {
    let cancelled = false;

    fetchNodaFilterOptions()
      .then((options) => {
        if (!cancelled) {
          setFilterOptions(options);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFilterOptions({ partNumbers: [], backNumbers: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    const queryFilters = buildNodaQueryFilters({
      activeStatus,
      status: filters.status,
      partNumber: filters.partNumber,
      backNumber: filters.backNumber,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: deferredSearchValue,
    });

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchNodaPage({
          filters: queryFilters,
          page,
          limit: pageSize,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        setRows(Array.isArray(result?.data) ? result.data : []);
        setStats(normalizeNodaStatistics(result?.statistics || {}));
        setPagination(result?.pagination || EMPTY_PAGINATION);
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setStats(EMPTY_NODA_STATS);
        setPagination(EMPTY_PAGINATION);
        setError(loadError.message || t("failedToLoadNodaRequests"));
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
  }, [activeStatus, deferredSearchValue, filters.backNumber, filters.dateFrom, filters.dateTo, filters.partNumber, filters.status, page, pageSize, refreshNonce, sort]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function handleStatusCardClick(status) {
    setActiveStatus(status);
    setFilters((current) => ({
      ...current,
      status: status === "all" ? "" : status,
    }));
    setPage(1);
  }

  function handleStatusSelectChange(value) {
    const normalizedValue = value || "all";
    setActiveStatus(normalizedValue);
    updateFilter("status", value);
  }

  function handleSort(column) {
    setSort((current) => {
      if (current.column === column) {
        return {
          column,
          direction: current.direction === 1 ? -1 : 1,
        };
      }

      return {
        column,
        direction: 1,
      };
    });
  }

  function handleModalResult(result) {
    if (result?.message) {
      setFlash({ type: result.type || "success", message: result.message });
    }
    setRefreshNonce((current) => current + 1);
  }

  async function handleExport() {
    try {
      const filtersForExport = buildNodaQueryFilters({
        activeStatus,
        status: filters.status,
        partNumber: filters.partNumber,
        backNumber: filters.backNumber,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        search: deferredSearchValue,
      });
      const requests = await exportNodaRequests(filtersForExport);
      downloadCsvFile("noda-requests.csv", buildExportMatrix(requests, t));
      setFlash({ type: "success", message: t("exportedNodaRequestsMessage", { count: requests.length, plural: requests.length === 1 ? "" : "s" }) });
    } catch (exportError) {
      setFlash({ type: "error", message: exportError.message || t("failedToExportNodaRequests") });
    }
  }

  async function handleManualInventoryCheck() {
    if (checkingInventory) return;

    setCheckingInventory(true);

    try {
      const actorName = authUser?.username
        ? await fetchNodaUserFullName(authUser.username)
        : (authUser?.username || "System");
      const result = await runNodaInventoryReservation(actorName);
      setFlash({
        type: "success",
        message: t("inventoryCheckCompleteMessage", {
          count: result.updatedRequests || 0,
          verb: result.updatedRequests === 1 ? "was" : "were",
          reservations: result.totalReservations || 0,
          reservationsPlural: result.totalReservations === 1 ? "" : "s",
        }),
      });
      setRefreshNonce((current) => current + 1);
    } catch (inventoryError) {
      setFlash({ type: "error", message: inventoryError.message || t("manualInventoryCheckFailed") });
    } finally {
      setCheckingInventory(false);
    }
  }

  const columns = useMemo(() => ([
    {
      key: "requestNumber",
      label: t("requestNumberLabel"),
      width: 180,
      renderCell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setDetailState({ open: true, requestId: row._id, mode: "view" });
          }}
          className="text-left font-semibold text-primary transition hover:underline"
        >
          {row.requestNumber}
        </button>
      ),
      disableCellWrapper: true,
    },
    {
      key: "便",
      label: t("deliveryRunLabel"),
      width: 120,
      renderCell: (row) => row.便 ? <span className="font-semibold text-primary">{row.便}</span> : <span className="text-on-surface-variant">—</span>,
      disableCellWrapper: true,
    },
    {
      key: "納品書番号",
      label: t("deliveryNoteNumberLabel"),
      width: 160,
      renderCell: (row) => row.納品書番号 ? <span className="font-semibold text-primary">{row.納品書番号}</span> : <span className="text-on-surface-variant">—</span>,
      disableCellWrapper: true,
    },
    {
      key: "requestType",
      label: t("typeLabel"),
      width: 130,
      renderCell: (row) => (
        <span className={joinNodaClasses(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
          row.requestType === "bulk"
            ? "bg-primary/12 text-primary"
            : "bg-surface-container text-on-surface-variant"
        )}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {row.requestType === "bulk" ? "stacked_email" : "article"}
          </span>
          {row.requestType === "bulk" ? t("bulkLabel") : t("singleLabel")}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: t("status"),
      width: 170,
      renderCell: (row) => {
        const meta = getNodaStatusMeta(resolveNodaDisplayStatus(row));
        return <StatusChip icon={meta.icon} label={t(meta.labelKey)} className={meta.badgeClassName} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "itemsSummary",
      label: t("itemsLabel"),
      sortable: false,
      width: 240,
      renderCell: (row) => {
        const summary = getNodaItemsSummary(row, t);
        return (
          <div className="min-w-0">
            <div className="font-semibold text-on-surface">{summary.title}</div>
            <div className="mt-1 text-xs text-on-surface-variant">{summary.subtitle}</div>
            {summary.warnings.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.warnings.map((warning) => (
                  <span
                    key={`${row._id}-${warning.label}`}
                    className={joinNodaClasses(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      warning.tone === "danger"
                        ? "bg-error/10 text-error"
                        : warning.tone === "warning"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-surface-container text-on-surface-variant"
                    )}
                  >
                    {warning.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "pickupDate",
      label: t("pickupDateLabel"),
      sortKey: "pickupDate",
      width: 140,
      renderCell: (row) => <span className="text-on-surface">{formatNodaDate(getNodaPickupDateValue(row))}</span>,
      disableCellWrapper: true,
    },
    {
      key: "納入指示日",
      label: t("deadlineLabel"),
      sortKey: "納入指示日",
      width: 140,
      renderCell: (row) => (
        <span className={joinNodaClasses("font-semibold", row.納入指示日 ? "text-error" : "text-on-surface-variant")}>
          {formatNodaDate(row.納入指示日)}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "completedAt",
      label: t("completedColumnLabel"),
      sortKey: "completedAt",
      width: 150,
      renderCell: (row) => <CompletedAtCell value={row.completedAt} />,
      disableCellWrapper: true,
    },
    {
      key: "actions",
      label: t("actions"),
      sortable: false,
      width: 150,
      align: "right",
      renderCell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <IconButton
            icon="visibility"
            onClick={(event) => { event.stopPropagation(); setDetailState({ open: true, requestId: row._id, mode: "view" }); }}
            variant="ghost"
            size="md"
            iconSize={18}
            ariaLabel={t("viewRequestAria")}
          />
          {canManage ? (
            <IconButton
              icon="edit"
              onClick={(event) => { event.stopPropagation(); setDetailState({ open: true, requestId: row._id, mode: "edit" }); }}
              variant="ghost"
              size="md"
              iconSize={18}
              ariaLabel={t("editRequestAria")}
            />
          ) : null}
        </div>
      ),
      disableCellWrapper: true,
    },
  ]), [canManage, t]);

  return (
    <section className="h-screen overflow-y-auto scrollbar-hide px-8 pb-16 pt-24">
      <div className="w-full">
        <PageHeader
          eyebrow={t("warehouseWorkflowEyebrow")}
          eyebrowClassName="tracking-[0.18em] text-primary"
          title="Noda"
          subtitle={t("nodaPageSubtitle")}
          subtitleClassName="max-w-3xl"
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {t("refresh")}
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {t("exportCSVLabel")}
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={handleManualInventoryCheck}
                  disabled={checkingInventory}
                  aria-busy={checkingInventory}
                  className="inline-flex min-w-[168px] items-center justify-center gap-2 rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingInventory ? (
                    <>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>autorenew</span>
                      {t("checkingInventoryButton")}
                    </>
                  ) : t("checkInventoryButton")}
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setGenModalOpen(true)}
                  className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/12"
                >
                  {t("syncFromGenLabel")}
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                >
                  {t("newBulkRequestButton")}
                </button>
              ) : null}
            </>
          )}
        />

        <FlashBanner flash={flash} onClose={() => setFlash(null)} />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          {NODA_STATUS_CARDS.map((card) => (
            <StatSummaryCard
              key={card.key}
              icon={card.icon}
              label={t(card.labelKey)}
              value={stats[card.key] ?? 0}
              subtitle={card.key === "all" ? t("allTrackedRequests") : t("filterByStatus", { status: t(card.labelKey).toLowerCase() })}
              accent={card.accent}
              active={activeStatus === card.key}
              loading={loading}
              onClick={() => handleStatusCardClick(card.key)}
              className="min-h-[128px]"
            />
          ))}
        </div>

        <div className="glass-card mb-6 rounded-[28px] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-on-surface">{t("filtersHeading")}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{t("nodaFiltersDescription")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilters({ status: "", partNumber: "", backNumber: "", dateFrom: "", dateTo: "", search: "" });
                setActiveStatus("all");
                setPage(1);
              }}
              className="rounded-2xl border border-outline-variant/25 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
            >
              {t("resetFiltersLabel")}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="block xl:col-span-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("status")}</span>
              <select
                value={filters.status}
                onChange={(event) => handleStatusSelectChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                {NODA_STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{t(option.labelKey)}</option>
                ))}
              </select>
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("partNumberLabel")}</span>
              <select
                value={filters.partNumber}
                onChange={(event) => updateFilter("partNumber", event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                <option value="">{t("allPartNumbersOption")}</option>
                {filterOptions.partNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("serialNumberLabel")}</span>
              <select
                value={filters.backNumber}
                onChange={(event) => updateFilter("backNumber", event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                <option value="">{t("allSerialNumbersOption")}</option>
                {filterOptions.backNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("deadlineFromLabel")}</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("deadlineToLabel")}</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("search")}</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder={t("nodaSearchPlaceholder")}
                className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
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
          pageSizeOptions={NODA_PAGE_SIZE_OPTIONS}
          pageSizeLabel={t("rowsSuffix")}
          previousLabel={t("previousLabel")}
          nextLabel={t("next")}
          rowKey={(row) => row._id}
          onRowClick={(row) => setDetailState({ open: true, requestId: row._id, mode: "view" })}
          getRowClassName={(row) => getNodaRowToneClass(row)}
          renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
            <span>{buildNodaPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize, t })}</span>
          )}
          emptyTitle={t("noMatchingNodaRequests")}
          emptyMessage={t("adjustFiltersOrCreateRequest")}
          layoutStorageKey="noda-table-layout"
          enableColumnResize
          enableColumnReorder
          stickyHeader
          stickyHeaderOffset={0}
          className="glass-card mb-6 overflow-hidden rounded-[28px]"
          topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
          bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
          rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
          rowsSelectClassName="h-10 rounded-2xl border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
        />

        <NodaBulkRequestModal
          open={addModalOpen}
          authUser={authUser}
          onClose={() => setAddModalOpen(false)}
          onSubmitted={(result) => {
            setAddModalOpen(false);
            handleModalResult(result);
          }}
        />

        <NodaGenSyncModal
          open={genModalOpen}
          authUser={authUser}
          onClose={() => setGenModalOpen(false)}
          onSubmitted={(result) => {
            setGenModalOpen(false);
            handleModalResult(result);
          }}
        />

        <NodaDetailModal
          open={detailState.open}
          requestId={detailState.requestId}
          mode={detailState.mode}
          authUser={authUser}
          onClose={() => setDetailState({ open: false, requestId: null, mode: "view" })}
          onSubmitted={handleModalResult}
        />
      </div>
    </section>
  );
}