import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import StatusChip from "../components/StatusChip";
import { SearchableSelect } from "../components/AdvancedFilterSection";
import {
  fetchFactoryStatusFactories,
  fetchFactoryStatusLogs,
} from "../services/factoryStatusApi";
import { readStoredAuthUser } from "../utils/auth";
import {
  buildFactoryStatusLogPageInfo,
  FACTORY_STATUS_AUTO_REFRESH_MS,
  FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS,
  formatFactoryStatusDateTime,
  formatFactoryStatusNumber,
  getDefaultFactoryStatusSelection,
  getFactoryStatusAccessibleFactories,
  getFactoryStatusLogStatusMeta,
  getFactoryStatusOperatorName,
  sortFactoryStatusFactories,
  summarizeFactoryStatusSelection,
} from "../utils/factoryStatus";

const EMPTY_SUMMARY = {
  totalLogs: 0,
  equipmentCount: 0,
  workerCount: 0,
  sessionCount: 0,
};

const EMPTY_PAGINATION = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS[1],
};

const EMPTY_FILTER_OPTIONS = {
  equipments: [],
  workers: [],
  statuses: [],
};

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseFactoriesParam(searchParams) {
  const factoriesParam = searchParams.get("factories") || searchParams.get("factory") || "";
  return sortFactoryStatusFactories(
    factoriesParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function SummaryCard({ icon, label, value, subtitle, accent, loading = false }) {
  return (
    <StatSummaryCard
      variant="freya"
      icon={icon}
      label={label}
      value={value}
      subtitle={subtitle}
      accent={accent}
      loading={loading}
    />
  );
}


export default function FactoryStatusLogsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authUser] = useState(() => readStoredAuthUser());
  const requestIdRef = useRef(0);
  const [factoryOptions, setFactoryOptions] = useState([]);
  const [selectedFactories, setSelectedFactories] = useState(() => parseFactoriesParam(searchParams));
  const [date, setDate] = useState(() => searchParams.get("date") || todayString());
  const [filters, setFilters] = useState(() => ({
    equipment: searchParams.get("equipment") || "",
    workerName: searchParams.get("workerName") || "",
    status: searchParams.get("status") || "",
    sessionID: searchParams.get("sessionID") || "",
    search: searchParams.get("search") || "",
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS[1]);
  const [sort, setSort] = useState({ column: "timestamp", direction: -1 });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [filterOptions, setFilterOptions] = useState(EMPTY_FILTER_OPTIONS);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loadingFactories, setLoadingFactories] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const deferredEquipment = useDeferredValue(filters.equipment);
  const deferredWorkerName = useDeferredValue(filters.workerName);
  const deferredSessionId = useDeferredValue(filters.sessionID);
  const deferredSearch = useDeferredValue(filters.search);
  const selectedFactoriesKey = selectedFactories.join("||");
  const selectionSummary = summarizeFactoryStatusSelection(selectedFactories);

  useEffect(() => {
    let cancelled = false;
    setLoadingFactories(true);

    async function loadFactories() {
      try {
        const nextFactories = await fetchFactoryStatusFactories();
        if (cancelled) return;

        const accessibleFactories = getFactoryStatusAccessibleFactories(authUser, nextFactories);
        setFactoryOptions(accessibleFactories);
        setSelectedFactories((current) => {
          const validCurrent = sortFactoryStatusFactories(current.filter((factory) => accessibleFactories.includes(factory)));
          return validCurrent.length ? validCurrent : getDefaultFactoryStatusSelection(accessibleFactories);
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load factories.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFactories(false);
        }
      }
    }

    void loadFactories();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshNonce((current) => current + 1);
    }, FACTORY_STATUS_AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedFactories.length) {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setPagination((current) => ({ ...EMPTY_PAGINATION, itemsPerPage: current.itemsPerPage || pageSize }));
      setFilterOptions(EMPTY_FILTER_OPTIONS);
      setGeneratedAt("");
      return;
    }

    let cancelled = false;
    const requestId = ++requestIdRef.current;

    async function loadLogs() {
      setLoadingLogs(true);
      setError("");

      try {
        const result = await fetchFactoryStatusLogs({
          date,
          factories: selectedFactories,
          equipment: deferredEquipment,
          workerName: deferredWorkerName,
          status: filters.status,
          sessionID: deferredSessionId,
          search: deferredSearch,
          page,
          limit: pageSize,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        setRows(Array.isArray(result?.rows) ? result.rows : []);
        setSummary(result?.summary || EMPTY_SUMMARY);
        setPagination(result?.pagination || EMPTY_PAGINATION);
        setFilterOptions(result?.filterOptions || EMPTY_FILTER_OPTIONS);
        setGeneratedAt(result?.generatedAt || "");
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setSummary(EMPTY_SUMMARY);
        setPagination((current) => ({ ...EMPTY_PAGINATION, itemsPerPage: current.itemsPerPage || pageSize }));
        setError(loadError.message || "Failed to load factory logs.");
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoadingLogs(false);
        }
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [date, deferredEquipment, deferredSearch, deferredSessionId, deferredWorkerName, filters.status, page, pageSize, refreshNonce, selectedFactories, selectedFactoriesKey, sort]);

  function toggleFactory(factory) {
    setSelectedFactories((current) => {
      const next = current.includes(factory)
        ? current.filter((value) => value !== factory)
        : [...current, factory];
      return factoryOptions.filter((option) => next.includes(option));
    });
    setPage(1);
  }

  function handleSelectAllFactories() {
    setSelectedFactories(factoryOptions);
    setPage(1);
  }

  function handleClearFactories() {
    setSelectedFactories([]);
    setPage(1);
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function handleResetFilters() {
    setSelectedFactories(getDefaultFactoryStatusSelection(factoryOptions));
    setDate(todayString());
    setFilters({ equipment: "", workerName: "", status: "", sessionID: "", search: "" });
    setPage(1);
    setPageSize(FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS[1]);
    setSort({ column: "timestamp", direction: -1 });
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

  const columns = useMemo(() => ([
    {
      key: "timestamp",
      label: "Timestamp",
      width: 220,
      renderCell: (row) => <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{formatFactoryStatusDateTime(row.timestamp)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "factory",
      label: "Factory",
      width: 140,
      renderCell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{row.factory || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "equipment",
      label: "Equipment",
      width: 140,
      renderCell: (row) => <span className="text-xs font-semibold text-[var(--text-primary)]">{row.equipment || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: "Status",
      width: 130,
      renderCell: (row) => {
        const meta = getFactoryStatusLogStatusMeta(row.status);
        return <StatusChip label={meta.label} className={`text-xs ${meta.badgeClassName}`} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "action",
      label: "Action",
      width: 280,
      renderCell: (row) => <div className="whitespace-normal text-xs text-[var(--text-secondary)]">{row.action || "—"}</div>,
      disableCellWrapper: true,
    },
    {
      key: "workerName",
      label: "Operator",
      width: 160,
      renderCell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{getFactoryStatusOperatorName(row) || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "partNumber",
      label: "Part Number",
      width: 180,
      renderCell: (row) => <span className="text-xs font-mono font-medium text-[var(--text-primary)]">{row.partNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "backNumber",
      label: "Serial Number",
      width: 150,
      renderCell: (row) => <span className="text-xs font-mono text-[var(--text-primary)]">{row.backNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "sessionID",
      label: "Session ID",
      width: 220,
      renderCell: (row) => <span className="text-[11px] font-mono text-[var(--text-muted)]">{row.sessionID || "—"}</span>,
      disableCellWrapper: true,
    },
  ]), []);

  return (
    <div className="min-h-screen px-6 py-6 max-w-[1600px] mx-auto space-y-6 pt-20">
      <div className="w-full">
        <PageHeader
          eyebrow="Live Operations"
          badge="LIVE"
          title="Factory Status Logs"
          subtitle="Review tablet log history from tabletLogDB by factory, equipment, operator, and session. Use this full-page view for broader filtering beyond the quick equipment modal on Factory Status."
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => navigate("/factoryStatus")}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
              >
                Back To Status
              </button>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-mono text-[var(--text-secondary)]">
                {generatedAt ? `Updated ${formatFactoryStatusDateTime(generatedAt)}` : "Waiting for first load..."}
              </div>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loadingLogs || loadingFactories}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-none"
              >
                {loadingLogs ? "Refreshing..." : "Refresh"}
              </button>
            </>
          )}
        />

        {error ? (
          <div className="mb-4 rounded-[6px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Filters</p>
              <h2 className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">Log Scope</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{selectionSummary.countLabel} · {selectionSummary.selectedText}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllFactories}
                disabled={!factoryOptions.length}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearFactories}
                disabled={!selectedFactories.length}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_260px]">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Factories</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {factoryOptions.map((factory) => {
                  const active = selectedFactories.includes(factory);

                  return (
                    <button
                      key={factory}
                      type="button"
                      onClick={() => toggleFactory(factory)}
                      className={joinClasses(
                        "rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] font-semibold"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      {factory}
                    </button>
                  );
                })}
                {!factoryOptions.length && !loadingFactories ? (
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    No accessible factories found.
                  </div>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPage(1);
                }}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Defaults to today and auto-refreshes every 60 seconds.</p>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5 border-t border-[var(--border)] pt-3">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Equipment</span>
              <SearchableSelect
                value={filters.equipment}
                options={filterOptions.equipments}
                onChange={({ value }) => updateFilter("equipment", value)}
                placeholder="Filter by equipment"
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Operator</span>
              <SearchableSelect
                value={filters.workerName}
                options={filterOptions.workers}
                onChange={({ value }) => updateFilter("workerName", value)}
                placeholder="Filter by operator"
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Status</span>
              <SearchableSelect
                value={filters.status}
                options={filterOptions.statuses}
                onChange={({ value }) => updateFilter("status", value)}
                placeholder="All statuses"
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Session ID</span>
              <input
                type="text"
                value={filters.sessionID}
                onChange={(event) => updateFilter("sessionID", event.target.value)}
                placeholder="Filter by session"
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Search</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Action, part, serial..."
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>
          </div>
        </div>

        <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-4">
          <SummaryCard
            icon="receipt_long"
            label="Logs"
            value={formatFactoryStatusNumber(summary.totalLogs)}
            subtitle="Matching current filters"
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="precision_manufacturing"
            label="Equipment"
            value={formatFactoryStatusNumber(summary.equipmentCount)}
            subtitle="Machines represented"
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="badge"
            label="Operators"
            value={formatFactoryStatusNumber(summary.workerCount)}
            subtitle="Workers in current result set"
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="fingerprint"
            label="Sessions"
            value={formatFactoryStatusNumber(summary.sessionCount)}
            subtitle="Distinct session IDs"
            loading={loadingLogs && !generatedAt}
          />
        </div>

        {!selectedFactories.length && !loadingFactories ? (
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Choose at least one factory</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">The log table appears after you select one or more factories.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loadingLogs}
            error={error}
            sort={sort}
            page={pagination.currentPage || page}
            pageSize={pagination.itemsPerPage || pageSize}
            filteredCount={pagination.totalItems || rows.length}
            totalPages={pagination.totalPages || 0}
            onSort={handleSort}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
            pageSizeOptions={FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS}
            pageSizeLabel="Rows"
            rowKey={(row) => row.id}
            renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
              <span className="text-xs text-[var(--text-secondary)] font-mono">{buildFactoryStatusLogPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize })}</span>
            )}
            emptyTitle="No matching tablet logs"
            emptyMessage="Adjust the filters or refresh the page to load more tablet activity."
            layoutStorageKey="factory-status-logs-table-layout"
            enableColumnResize
            enableColumnReorder
            stickyHeader
            stickyHeaderOffset={0}
            tableClassName="ui-table-data min-w-full border-separate border-spacing-0 text-xs"
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm"
            topBarClassName="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between"
            bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between"
            rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
          />
        )}
      </div>
    </div>
  );
}