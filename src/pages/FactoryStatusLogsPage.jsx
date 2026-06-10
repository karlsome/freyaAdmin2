import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import StatusChip from "../components/StatusChip";
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
      icon={icon}
      label={label}
      value={value}
      subtitle={subtitle}
      accent={accent}
      loading={loading}
      valueClassName="planner-data-text text-2xl font-semibold tabular-nums"
      labelClassName="planner-data-text text-[11px] font-semibold text-on-surface-variant"
      subtitleClassName="planner-data-text text-[10px] text-outline"
      iconClassName="shadow-none"
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
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{formatFactoryStatusDateTime(row.timestamp)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "factory",
      label: "Factory",
      width: 140,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.factory || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "equipment",
      label: "Equipment",
      width: 140,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.equipment || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: "Status",
      width: 130,
      renderCell: (row) => {
        const meta = getFactoryStatusLogStatusMeta(row.status);
        return <StatusChip label={meta.label} className={`planner-data-text ${meta.badgeClassName}`} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "action",
      label: "Action",
      width: 280,
      renderCell: (row) => <div className="planner-data-text whitespace-normal text-sm text-on-surface-variant">{row.action || "—"}</div>,
      disableCellWrapper: true,
    },
    {
      key: "workerName",
      label: "Operator",
      width: 160,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{getFactoryStatusOperatorName(row) || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "partNumber",
      label: "Part Number",
      width: 180,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.partNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "backNumber",
      label: "Serial Number",
      width: 150,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.backNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "sessionID",
      label: "Session ID",
      width: 220,
      renderCell: (row) => <span className="planner-data-text text-xs font-semibold text-on-surface-variant">{row.sessionID || "—"}</span>,
      disableCellWrapper: true,
    },
  ]), []);

  return (
    <section className="h-screen overflow-y-auto scrollbar-hide px-8 pb-16 pt-24">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          eyebrow="Live Operations"
          eyebrowClassName="tracking-[0.24em] text-primary"
          title="Factory Status Logs"
          subtitle="Review tablet log history from tabletLogDB by factory, equipment, operator, and session. Use this full-page view for broader filtering beyond the quick equipment modal on Factory Status."
          subtitleClassName="max-w-4xl"
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => navigate("/factoryStatus")}
                className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Back To Status
              </button>
              <div className="planner-data-text rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 px-4 py-2.5 text-sm text-on-surface-variant">
                {generatedAt ? `Updated ${formatFactoryStatusDateTime(generatedAt)}` : "Waiting for first load..."}
              </div>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loadingLogs || loadingFactories}
                className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingLogs ? "Refreshing..." : "Refresh"}
              </button>
            </>
          )}
        />

        {error ? (
          <div className="planner-data-text mb-6 rounded-2xl border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        <div className="dashboard-section mb-6 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-outline">Filters</p>
              <h2 className="mt-1 text-lg font-semibold text-on-surface">Log Scope</h2>
              <p className="planner-data-text mt-2 text-sm text-on-surface-variant">{selectionSummary.countLabel} · {selectionSummary.selectedText}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllFactories}
                disabled={!factoryOptions.length}
                className="rounded-2xl border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearFactories}
                disabled={!selectedFactories.length}
                className="rounded-2xl border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-2xl border border-outline-variant/20 px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_260px]">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Factories</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {factoryOptions.map((factory) => {
                  const active = selectedFactories.includes(factory);

                  return (
                    <button
                      key={factory}
                      type="button"
                      onClick={() => toggleFactory(factory)}
                      className={joinClasses(
                        "planner-data-text rounded-full border px-3 py-2 text-sm font-semibold transition",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-outline-variant/20 bg-white text-on-surface hover:bg-surface-container dark:bg-surface-container"
                      )}
                    >
                      {factory}
                    </button>
                  );
                })}
                {!factoryOptions.length && !loadingFactories ? (
                  <div className="planner-data-text rounded-2xl border border-outline-variant/20 bg-surface-container-low/35 px-4 py-3 text-sm text-on-surface-variant">
                    No accessible factories found.
                  </div>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPage(1);
                }}
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
              <p className="planner-data-text mt-2 text-xs text-on-surface-variant">Defaults to today and auto-refreshes every 60 seconds.</p>
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Equipment</span>
              <input
                type="text"
                list="factory-status-log-equipment-options"
                value={filters.equipment}
                onChange={(event) => updateFilter("equipment", event.target.value)}
                placeholder="Filter by equipment"
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Operator</span>
              <input
                type="text"
                list="factory-status-log-worker-options"
                value={filters.workerName}
                onChange={(event) => updateFilter("workerName", event.target.value)}
                placeholder="Filter by operator"
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Status</span>
              <select
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                <option value="">All statuses</option>
                {filterOptions.statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Session ID</span>
              <input
                type="text"
                value={filters.sessionID}
                onChange={(event) => updateFilter("sessionID", event.target.value)}
                placeholder="Filter by session"
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">Search</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Action, part, serial..."
                className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </label>
          </div>

          <datalist id="factory-status-log-equipment-options">
            {filterOptions.equipments.map((equipment) => (
              <option key={equipment} value={equipment} />
            ))}
          </datalist>

          <datalist id="factory-status-log-worker-options">
            {filterOptions.workers.map((worker) => (
              <option key={worker} value={worker} />
            ))}
          </datalist>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon="receipt_long"
            label="Logs"
            value={formatFactoryStatusNumber(summary.totalLogs)}
            subtitle="Matching current filters"
            accent="bg-primary/10 text-primary"
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="precision_manufacturing"
            label="Equipment"
            value={formatFactoryStatusNumber(summary.equipmentCount)}
            subtitle="Machines represented"
            accent="bg-sky-500/10 text-sky-600 dark:text-sky-300"
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="badge"
            label="Operators"
            value={formatFactoryStatusNumber(summary.workerCount)}
            subtitle="Workers in current result set"
            accent="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="fingerprint"
            label="Sessions"
            value={formatFactoryStatusNumber(summary.sessionCount)}
            subtitle="Distinct session IDs"
            accent="bg-amber-500/10 text-amber-700 dark:text-amber-300"
            loading={loadingLogs && !generatedAt}
          />
        </div>

        {!selectedFactories.length && !loadingFactories ? (
          <div className="glass-card rounded-2xl px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-on-surface">Choose at least one factory</h2>
            <p className="planner-data-text mt-2 text-sm text-on-surface-variant">The log table appears after you select one or more factories.</p>
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
              <span className="planner-data-text">{buildFactoryStatusLogPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize })}</span>
            )}
            emptyTitle="No matching tablet logs"
            emptyMessage="Adjust the filters or refresh the page to load more tablet activity."
            layoutStorageKey="factory-status-logs-table-layout"
            enableColumnResize
            enableColumnReorder
            stickyHeader
            stickyHeaderOffset={0}
            tableClassName="ui-table-data min-w-full border-separate border-spacing-0"
            className="glass-card overflow-hidden rounded-[28px]"
            topBarClassName="flex flex-col gap-4 border-b border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
            bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/15 px-5 py-4 md:flex-row md:items-center md:justify-between"
            rowClassName="border-b border-outline-variant/10 transition hover:bg-primary/5"
          />
        )}
      </div>
    </section>
  );
}