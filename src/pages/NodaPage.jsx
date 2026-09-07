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
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
    : flash.type === "warning"
      ? "border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
      : "border-[var(--status-normal)]/30 bg-[var(--status-normal)]/10 text-[var(--status-normal)]";

  return (
    <div className={joinNodaClasses("mb-6 rounded-[8px] border px-4 py-3 freya-card shadow-sm", tone)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">Status</p>
          <p className="mt-0.5 text-xs font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
    </div>
  );
}


function CompletedAtCell({ value }) {
  if (!value) {
    return <span className="text-[var(--text-muted)] font-mono text-xs">—</span>;
  }

  return (
    <div className="min-w-0 font-mono text-xs">
      <div className="font-semibold text-[var(--text-primary)]">{formatNodaDate(value)}</div>
      <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatNodaTime(value)}</div>
    </div>
  );
}

function buildExportMatrix(requests = []) {
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
        getNodaStatusMeta(resolveNodaDisplayStatus(request)).label,
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
        setError(loadError.message || "Failed to load Noda requests.");
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
      downloadCsvFile("noda-requests.csv", buildExportMatrix(requests));
      setFlash({ type: "success", message: `Exported ${requests.length} Noda request${requests.length === 1 ? "" : "s"}.` });
    } catch (exportError) {
      setFlash({ type: "error", message: exportError.message || "Failed to export Noda requests." });
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
        message: `Inventory check complete. ${result.updatedRequests || 0} request${result.updatedRequests === 1 ? " was" : "s were"} updated with ${result.totalReservations || 0} reservation${result.totalReservations === 1 ? "" : "s"}.`,
      });
      setRefreshNonce((current) => current + 1);
    } catch (inventoryError) {
      setFlash({ type: "error", message: inventoryError.message || "Manual inventory check failed." });
    } finally {
      setCheckingInventory(false);
    }
  }

  const columns = useMemo(() => ([
    {
      key: "requestNumber",
      label: "Request Number",
      width: 180,
      renderCell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setDetailState({ open: true, requestId: row._id, mode: "view" });
          }}
          className="text-left font-mono font-semibold text-xs text-[var(--freya-blue)] hover:underline"
        >
          {row.requestNumber}
        </button>
      ),
      disableCellWrapper: true,
    },
    {
      key: "便",
      label: "便",
      width: 120,
      renderCell: (row) => row.便 ? <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{row.便}</span> : <span className="text-[var(--text-muted)] font-mono text-xs">—</span>,
      disableCellWrapper: true,
    },
    {
      key: "納品書番号",
      label: "納品書番号",
      width: 160,
      renderCell: (row) => row.納品書番号 ? <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{row.納品書番号}</span> : <span className="text-[var(--text-muted)] font-mono text-xs">—</span>,
      disableCellWrapper: true,
    },
    {
      key: "requestType",
      label: "Type",
      width: 130,
      renderCell: (row) => (
        <span className={joinNodaClasses(
          "inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider border",
          row.requestType === "bulk"
            ? "border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]"
            : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]"
        )}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {row.requestType === "bulk" ? "stacked_email" : "article"}
          </span>
          {row.requestType === "bulk" ? "Bulk" : "Single"}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: "Status",
      width: 170,
      renderCell: (row) => {
        const meta = getNodaStatusMeta(resolveNodaDisplayStatus(row));
        return <StatusChip icon={meta.icon} label={meta.label} className={meta.badgeClassName} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "itemsSummary",
      label: "Items",
      sortable: false,
      width: 240,
      renderCell: (row) => {
        const summary = getNodaItemsSummary(row);
        return (
          <div className="min-w-0">
            <div className="font-semibold text-xs text-[var(--text-primary)]">{summary.title}</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)] font-mono">{summary.subtitle}</div>
            {summary.warnings.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.warnings.map((warning) => (
                  <span
                    key={`${row._id}-${warning.label}`}
                    className={joinNodaClasses(
                      "inline-flex rounded-[4px] px-1.5 py-0.5 text-[10px] font-mono font-semibold border",
                      warning.tone === "danger"
                        ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
                        : warning.tone === "warning"
                          ? "border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                          : "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]"
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
      label: "Pickup Date",
      sortKey: "pickupDate",
      width: 140,
      renderCell: (row) => <span className="text-[var(--text-primary)] font-mono text-xs">{formatNodaDate(getNodaPickupDateValue(row))}</span>,
      disableCellWrapper: true,
    },
    {
      key: "納入指示日",
      label: "Deadline",
      sortKey: "納入指示日",
      width: 140,
      renderCell: (row) => (
        <span className={joinNodaClasses("font-mono text-xs font-semibold", row.納入指示日 ? "text-[var(--status-danger)]" : "text-[var(--text-muted)]")}>
          {formatNodaDate(row.納入指示日)}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "completedAt",
      label: "Completed",
      sortKey: "completedAt",
      width: 150,
      renderCell: (row) => <CompletedAtCell value={row.completedAt} />,
      disableCellWrapper: true,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      width: 150,
      align: "right",
      renderCell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton
            icon="visibility"
            onClick={(event) => { event.stopPropagation(); setDetailState({ open: true, requestId: row._id, mode: "view" }); }}
            variant="ghost"
            size="sm"
            iconSize={16}
            ariaLabel="View request"
            className="rounded-[6px]"
          />
          {canManage ? (
            <IconButton
              icon="edit"
              onClick={(event) => { event.stopPropagation(); setDetailState({ open: true, requestId: row._id, mode: "edit" }); }}
              variant="ghost"
              size="sm"
              iconSize={16}
              ariaLabel="Edit request"
              className="rounded-[6px]"
            />
          ) : null}
        </div>
      ),
      disableCellWrapper: true,
    },
  ]), [canManage]);

  const statusDotMap = {
    all: undefined,
    pending: "warning",
    "in-progress": undefined,
    completed: "complete",
    "past-deadline": "defect",
    "partial-inventory": "warning",
    cancelled: "defect",
  };

  return (
    <section className="min-h-screen max-w-[1600px] mx-auto space-y-6 pt-20 px-6 pb-12">
      <div className="w-full">
        <PageHeader
          eyebrow="Warehouse Workflow"
          eyebrowClassName="tracking-[0.18em] text-[var(--freya-blue)]"
          title="Noda"
          subtitle="Manage Noda warehouse picking requests, inspect FIFO inventory impact, upload bulk CSV orders, and sync remaining work from GEN."
          subtitleClassName="max-w-3xl"
          className="md:flex-row md:items-start md:justify-between mb-6"
          actions={(
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>refresh</span>
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>download</span>
                Export CSV
              </button>
              {canManage ? (
                <button
                  type="button"
                  onClick={handleManualInventoryCheck}
                  disabled={checkingInventory}
                  aria-busy={checkingInventory}
                  className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkingInventory ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[var(--freya-blue)]" style={{ fontSize: 16 }}>autorenew</span>
                      Checking...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>inventory</span>
                      Check Inventory
                    </>
                  )}
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setGenModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue)]/20 transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                  Sync From GEN
                </button>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-2xs"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  New Bulk Request
                </button>
              ) : null}
            </div>
          )}
        />

        <FlashBanner flash={flash} onClose={() => setFlash(null)} />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {NODA_STATUS_CARDS.map((card) => (
            <StatSummaryCard
              key={card.key}
              variant="freya"
              icon={card.icon}
              label={card.label}
              value={stats[card.key] ?? 0}
              subtitle={card.key === "all" ? "All tracked requests" : `Filter by ${card.label.toLowerCase()}`}
              statusDot={statusDotMap[card.key]}
              active={activeStatus === card.key}
              loading={loading}
              onClick={() => handleStatusCardClick(card.key)}
              className="cursor-pointer"
            />
          ))}
        </div>

        <div className="freya-card rounded-[8px] p-5 mb-6 border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Filters</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Refine the active request list by status, item, deadline, or search term.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilters({ status: "", partNumber: "", backNumber: "", dateFrom: "", dateTo: "", search: "" });
                setActiveStatus("all");
                setPage(1);
              }}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="block xl:col-span-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">Status</span>
              <select
                value={filters.status}
                onChange={(event) => handleStatusSelectChange(event.target.value)}
                className="w-full h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] transition-colors"
              >
                {NODA_STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">品番</span>
              <select
                value={filters.partNumber}
                onChange={(event) => updateFilter("partNumber", event.target.value)}
                className="w-full h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] transition-colors"
              >
                <option value="">All Part Numbers</option>
                {filterOptions.partNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">背番号</span>
              <select
                value={filters.backNumber}
                onChange={(event) => updateFilter("backNumber", event.target.value)}
                className="w-full h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] transition-colors"
              >
                <option value="">All Serial Numbers</option>
                {filterOptions.backNumbers.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">Deadline From</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
                className="w-full h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] transition-colors font-mono"
              />
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">Deadline To</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
                className="w-full h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] transition-colors font-mono"
              />
            </label>

            <label className="block xl:col-span-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">Search</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Request number, item, serial…"
                className="w-full h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] transition-colors"
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
          pageSizeLabel="Rows"
          rowKey={(row) => row._id}
          onRowClick={(row) => setDetailState({ open: true, requestId: row._id, mode: "view" })}
          getRowClassName={(row) => getNodaRowToneClass(row)}
          renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
            <span className="font-mono text-xs">{buildNodaPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize })}</span>
          )}
          emptyTitle="No matching Noda requests"
          emptyMessage="Adjust the filters or create a new bulk request."
          layoutStorageKey="noda-table-layout"
          enableColumnResize
          enableColumnReorder
          stickyHeader
          stickyHeaderOffset={0}
          className="freya-card mb-6 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm"
          topBarClassName="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-3.5 bg-[var(--surface-subtle)] md:flex-row md:items-center md:justify-between"
          bottomBarClassName="flex flex-col gap-4 border-t border-[var(--border)] px-5 py-3.5 bg-[var(--surface-subtle)] md:flex-row md:items-center md:justify-between"
          rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          rowsSelectClassName="h-7 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--text-primary)] outline-none"
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