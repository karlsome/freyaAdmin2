import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatSummaryCard from "../components/StatSummaryCard";
import StatusChip from "../components/StatusChip";
import { SearchableSelect } from "../components/AdvancedFilterSection";
import { useLanguage } from "../contexts/LanguageContext";
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
  const selectionSummary = summarizeFactoryStatusSelection(selectedFactories, language);

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
      label: isJa ? "タイムスタンプ" : "Timestamp",
      width: 220,
      renderCell: (row) => <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{formatFactoryStatusDateTime(row.timestamp)}</span>,
      disableCellWrapper: true,
    },
    {
      key: "factory",
      label: isJa ? "工場" : "Factory",
      width: 140,
      renderCell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{row.factory || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "equipment",
      label: isJa ? "設備" : "Equipment",
      width: 140,
      renderCell: (row) => <span className="text-xs font-semibold text-[var(--text-primary)]">{row.equipment || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: isJa ? "ステータス" : "Status",
      width: 130,
      renderCell: (row) => {
        const meta = getFactoryStatusLogStatusMeta(row.status, language);
        return <StatusChip label={meta.label} className={`text-xs ${meta.badgeClassName}`} />;
      },
      disableCellWrapper: true,
    },
    {
      key: "action",
      label: isJa ? "アクション" : "Action",
      width: 280,
      renderCell: (row) => <div className="whitespace-normal text-xs text-[var(--text-secondary)]">{row.action || "—"}</div>,
      disableCellWrapper: true,
    },
    {
      key: "workerName",
      label: isJa ? "作業者" : "Operator",
      width: 160,
      renderCell: (row) => <span className="text-xs font-medium text-[var(--text-primary)]">{getFactoryStatusOperatorName(row) || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "partNumber",
      label: isJa ? "品番" : "Part Number",
      width: 180,
      renderCell: (row) => <span className="text-xs font-mono font-medium text-[var(--text-primary)]">{row.partNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "backNumber",
      label: isJa ? "背番号" : "Serial Number",
      width: 150,
      renderCell: (row) => <span className="text-xs font-mono text-[var(--text-primary)]">{row.backNumber || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "sessionID",
      label: isJa ? "セッションID" : "Session ID",
      width: 220,
      renderCell: (row) => <span className="text-[11px] font-mono text-[var(--text-muted)]">{row.sessionID || "—"}</span>,
      disableCellWrapper: true,
    },
  ]), [isJa, language]);

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <div className="w-full">
        <PageHeader
          eyebrow={isJa ? "リアルタイム運用" : "Live Operations"}
          badge={isJa ? "ライブ" : "LIVE"}
          title={isJa ? "工場ログ履歴" : "Factory Status Logs"}
          subtitle={isJa
            ? "tabletLogDB から工場・設備・作業者・セッションごとのタブレットログ履歴を確認します。工場ステータスページの簡易モーダルよりも詳細な条件で絞り込めます。"
            : "Review tablet log history from tabletLogDB by factory, equipment, operator, and session. Use this full-page view for broader filtering beyond the quick equipment modal on Factory Status."}
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button
                type="button"
                onClick={() => navigate("/factoryStatus")}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
              >
                {isJa ? "ステータスへ戻る" : "Back To Status"}
              </button>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-mono text-[var(--text-secondary)]">
                {generatedAt ? (isJa ? `更新日時 ${formatFactoryStatusDateTime(generatedAt)}` : `Updated ${formatFactoryStatusDateTime(generatedAt)}`) : (isJa ? "初回読み込み待機中..." : "Waiting for first load...")}
              </div>
              <button
                type="button"
                onClick={() => setRefreshNonce((current) => current + 1)}
                disabled={loadingLogs || loadingFactories}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-none"
              >
                {loadingLogs ? (isJa ? "更新中..." : "Refreshing...") : (isJa ? "更新" : "Refresh")}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "フィルター" : "Filters"}</p>
              <h2 className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{isJa ? "ログ範囲" : "Log Scope"}</h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{selectionSummary.countLabel} · {selectionSummary.selectedText}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllFactories}
                disabled={!factoryOptions.length}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isJa ? "すべて選択" : "Select All"}
              </button>
              <button
                type="button"
                onClick={handleClearFactories}
                disabled={!selectedFactories.length}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isJa ? "クリア" : "Clear"}
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                {isJa ? "フィルター解除" : "Reset Filters"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_260px]">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "工場一覧" : "Factories"}</span>
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
                    {isJa ? "アクセス可能な工場がありません。" : "No accessible factories found."}
                  </div>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "日付" : "Date"}</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setPage(1);
                }}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {isJa ? "初期値は本日。60秒ごとに自動更新されます。" : "Defaults to today and auto-refreshes every 60 seconds."}
              </p>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5 border-t border-[var(--border)] pt-3">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "設備" : "Equipment"}</span>
              <SearchableSelect
                value={filters.equipment}
                options={filterOptions.equipments}
                onChange={({ value }) => updateFilter("equipment", value)}
                placeholder={isJa ? "設備で絞り込み" : "Filter by equipment"}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "作業者" : "Operator"}</span>
              <SearchableSelect
                value={filters.workerName}
                options={filterOptions.workers}
                onChange={({ value }) => updateFilter("workerName", value)}
                placeholder={isJa ? "作業者で絞り込み" : "Filter by operator"}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "ステータス" : "Status"}</span>
              <SearchableSelect
                value={filters.status}
                options={filterOptions.statuses}
                onChange={({ value }) => updateFilter("status", value)}
                placeholder={isJa ? "すべてのステータス" : "All statuses"}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "セッションID" : "Session ID"}</span>
              <input
                type="text"
                value={filters.sessionID}
                onChange={(event) => updateFilter("sessionID", event.target.value)}
                placeholder={isJa ? "セッションで絞り込み" : "Filter by session"}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "検索" : "Search"}</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder={isJa ? "アクション、品番、背番号..." : "Action, part, serial..."}
                className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] transition-colors"
              />
            </label>
          </div>
        </div>

        <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-4">
          <SummaryCard
            icon="receipt_long"
            label={isJa ? "ログ件数" : "Logs"}
            value={formatFactoryStatusNumber(summary.totalLogs)}
            subtitle={isJa ? "現在のフィルターに一致" : "Matching current filters"}
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="precision_manufacturing"
            label={isJa ? "設備数" : "Equipment"}
            value={formatFactoryStatusNumber(summary.equipmentCount)}
            subtitle={isJa ? "対象の設備数" : "Machines represented"}
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="badge"
            label={isJa ? "作業者数" : "Operators"}
            value={formatFactoryStatusNumber(summary.workerCount)}
            subtitle={isJa ? "結果内の作業者数" : "Workers in current result set"}
            loading={loadingLogs && !generatedAt}
          />
          <SummaryCard
            icon="fingerprint"
            label={isJa ? "セッション数" : "Sessions"}
            value={formatFactoryStatusNumber(summary.sessionCount)}
            subtitle={isJa ? "ユニークなセッションID" : "Distinct session IDs"}
            loading={loadingLogs && !generatedAt}
          />
        </div>

        {!selectedFactories.length && !loadingFactories ? (
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {isJa ? "工場を1つ以上選択してください" : "Choose at least one factory"}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {isJa ? "工場を選択するとログ一覧テーブルが表示されます。" : "The log table appears after you select one or more factories."}
            </p>
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
            pageSizeLabel={isJa ? "件数" : "Rows"}
            rowKey={(row) => row.id}
            renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
              <span className="text-xs text-[var(--text-secondary)] font-mono">{buildFactoryStatusLogPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize }, language)}</span>
            )}
            emptyTitle={isJa ? "一致するタブレットログがありません" : "No matching tablet logs"}
            emptyMessage={isJa ? "フィルターを調整するか、最新データに更新してください。" : "Adjust the filters or refresh the page to load more tablet activity."}
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