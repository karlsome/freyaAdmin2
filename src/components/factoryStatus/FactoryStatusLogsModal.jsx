import { useEffect, useMemo, useRef, useState } from "react";
import DataTable from "../DataTable";
import PlannerModalShell from "../planner/PlannerModalShell";
import StatusChip from "../StatusChip";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchFactoryStatusLogs } from "../../services/factoryStatusApi";
import {
  buildFactoryStatusLogPageInfo,
  FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS,
  formatFactoryStatusDateTime,
  formatFactoryStatusNumber,
  getFactoryStatusLogStatusMeta,
  getFactoryStatusOperatorName,
} from "../../utils/factoryStatus";

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
  itemsPerPage: FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS[0],
};

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function SummaryTile({ label, value, toneClassName = "text-[var(--text-primary)]" }) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</p>
      <p className={joinClasses("mt-1 text-base font-semibold font-mono freya-tabular", toneClassName)}>{value}</p>
    </div>
  );
}


export default function FactoryStatusLogsModal({
  open,
  factory,
  equipment,
  date,
  onClose,
  onOpenFullPage,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const requestIdRef = useRef(0);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS[0]);
  const [sort, setSort] = useState({ column: "timestamp", direction: -1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setPageSize(FACTORY_STATUS_LOG_PAGE_SIZE_OPTIONS[0]);
    setSort({ column: "timestamp", direction: -1 });
    setError("");
  }, [open, factory, equipment, date]);

  useEffect(() => {
    if (!open || !factory || !equipment || !date) {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setPagination((current) => ({ ...EMPTY_PAGINATION, itemsPerPage: current.itemsPerPage || pageSize }));
      setGeneratedAt("");
      return;
    }

    let cancelled = false;
    const requestId = ++requestIdRef.current;

    async function loadLogs() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchFactoryStatusLogs({
          date,
          factories: [factory],
          equipment,
          page,
          limit: pageSize,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        setRows(Array.isArray(result?.rows) ? result.rows : []);
        setSummary(result?.summary || EMPTY_SUMMARY);
        setPagination(result?.pagination || EMPTY_PAGINATION);
        setGeneratedAt(result?.generatedAt || "");
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setSummary(EMPTY_SUMMARY);
        setPagination((current) => ({ ...EMPTY_PAGINATION, itemsPerPage: current.itemsPerPage || pageSize }));
        setError(loadError.message || "Failed to load equipment logs.");
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [date, equipment, factory, open, page, pageSize, sort]);

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
      renderCell: (row) => <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{formatFactoryStatusDateTime(row.timestamp)}</span>,
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
      width: 320,
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
    <PlannerModalShell
      open={open}
      title={equipment ? (isJa ? `設備ログ · ${equipment}` : `Equipment Logs · ${equipment}`) : (isJa ? "設備ログ" : "Equipment Logs")}
      subtitle={factory && date ? `${factory} · ${date}` : (isJa ? "選択した設備のタブレットログを確認します。" : "Review tablet logs for the selected equipment.")}
      onClose={onClose}
      maxWidthClassName="max-w-7xl"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-none"
          >
            {isJa ? "閉じる" : "Close"}
          </button>
          <button
            type="button"
            onClick={() => onOpenFullPage?.()}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors shadow-none"
          >
            {isJa ? "ログ一覧ページを開く" : "Open Full Logs Page"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "設備スコープ" : "Equipment Scope"}
              </div>
              <h3 className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{equipment || "—"}</h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {factory || (isJa ? "不明な工場" : "Unknown Factory")} {generatedAt ? (isJa ? `· 更新日時 ${formatFactoryStatusDateTime(generatedAt)}` : `· Updated ${formatFactoryStatusDateTime(generatedAt)}`) : ""}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
            <SummaryTile label={isJa ? "ログ件数" : "Logs"} value={formatFactoryStatusNumber(summary.totalLogs)} toneClassName="text-[var(--freya-blue)]" />
            <SummaryTile label={isJa ? "作業者数" : "Operators"} value={formatFactoryStatusNumber(summary.workerCount)} toneClassName="text-emerald-600 dark:text-emerald-400" />
            <SummaryTile label={isJa ? "セッション数" : "Sessions"} value={formatFactoryStatusNumber(summary.sessionCount)} toneClassName="text-amber-600 dark:text-amber-400" />
            <SummaryTile label={isJa ? "設備数" : "Equipment Count"} value={formatFactoryStatusNumber(summary.equipmentCount)} toneClassName="text-sky-600 dark:text-sky-400" />
          </div>
        </div>

        {error ? (
          <div className="rounded-[6px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error=""
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
          emptyTitle={isJa ? "設備ログがありません" : "No equipment logs"}
          emptyMessage={isJa ? "選択した日付において、この設備のタブレットログは見つかりませんでした。" : "No tablet logs were found for this equipment on the selected date."}
          layoutStorageKey="factory-status-logs-modal-table-layout"
          enableColumnResize
          enableColumnReorder
          stickyHeader
          stickyHeaderOffset={0}
          tableClassName="ui-table-data min-w-full border-separate border-spacing-0 text-xs"
          className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          topBarClassName="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between"
          bottomBarClassName="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between"
          rowClassName="border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)]"
        />
      </div>
    </PlannerModalShell>
  );
}