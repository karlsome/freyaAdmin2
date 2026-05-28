import { useEffect, useMemo, useRef, useState } from "react";
import DataTable from "../DataTable";
import PlannerModalShell from "../planner/PlannerModalShell";
import StatusChip from "../StatusChip";
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

function SummaryTile({ label, value, toneClassName = "text-on-surface" }) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
      <p className="planner-data-label text-outline">{label}</p>
      <p className={joinClasses("planner-data-text mt-2 text-lg font-black tabular-nums", toneClassName)}>{value}</p>
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
      label: "Timestamp",
      width: 220,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{formatFactoryStatusDateTime(row.timestamp)}</span>,
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
      width: 320,
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
    <PlannerModalShell
      open={open}
      title={equipment ? `Equipment Logs · ${equipment}` : "Equipment Logs"}
      subtitle={factory && date ? `${factory} · ${date}` : "Review tablet logs for the selected equipment."}
      onClose={onClose}
      maxWidthClassName="max-w-7xl"
      footer={(
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenFullPage?.()}
            className="planner-data-text rounded-2xl border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container"
          >
            Open Full Logs Page
          </button>
          <button
            type="button"
            onClick={onClose}
            className="planner-data-text rounded-2xl border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container"
          >
            Close
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="planner-data-label text-outline">Equipment Scope</div>
              <h3 className="planner-data-text mt-1 text-xl font-black text-on-surface">{equipment || "—"}</h3>
              <p className="planner-data-text mt-1 text-sm text-on-surface-variant">
                {factory || "Unknown Factory"} {generatedAt ? `· Updated ${formatFactoryStatusDateTime(generatedAt)}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <SummaryTile label="Logs" value={formatFactoryStatusNumber(summary.totalLogs)} toneClassName="text-primary" />
            <SummaryTile label="Operators" value={formatFactoryStatusNumber(summary.workerCount)} toneClassName="text-emerald-700 dark:text-emerald-300" />
            <SummaryTile label="Sessions" value={formatFactoryStatusNumber(summary.sessionCount)} toneClassName="text-amber-700 dark:text-amber-300" />
            <SummaryTile label="Equipment Count" value={formatFactoryStatusNumber(summary.equipmentCount)} toneClassName="text-sky-700 dark:text-sky-300" />
          </div>
        </div>

        {error ? (
          <div className="planner-data-text rounded-2xl border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
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
          pageSizeLabel="Rows"
          rowKey={(row) => row.id}
          renderPageInfo={({ filteredCount, page: currentPage, pageSize: currentPageSize }) => (
            <span className="planner-data-text">{buildFactoryStatusLogPageInfo({ filteredCount, page: currentPage, pageSize: currentPageSize })}</span>
          )}
          emptyTitle="No equipment logs"
          emptyMessage="No tablet logs were found for this equipment on the selected date."
          layoutStorageKey="factory-status-logs-modal-table-layout"
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
      </div>
    </PlannerModalShell>
  );
}