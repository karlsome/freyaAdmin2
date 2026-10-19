import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import DataTable from "../DataTable";
import IconButton from "../IconButton";
import StatSummaryCard from "../StatSummaryCard";
import StatusChip from "../StatusChip";
import ScnaProductionDetailModal from "./ScnaProductionDetailModal";
import {
  fetchFreyaTabletData,
  fetchFreyaTabletEquipmentOptions,
} from "../../services/scnaApi";
import {
  downloadCsvWithBom,
  getDefaultFreyaTabletDates,
  getRecordImages,
  SCNA_PAGE_SIZE_OPTIONS,
} from "../../utils/scna";

export default function ScnaFreyaTabletTab({ onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const defaultDates = useMemo(() => getDefaultFreyaTabletDates(), []);

  const [equipment, setEquipment] = useState("");
  const [dateFromInput, setDateFromInput] = useState(defaultDates.dateFrom);
  const [dateToInput, setDateToInput] = useState(defaultDates.dateTo);
  const [appliedDates, setAppliedDates] = useState(defaultDates);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ column: "Date", direction: -1 });

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  });
  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const requestIdRef = useRef(0);

  // Debounce search by 500ms matching freyaTablet.js
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Load distinct SCNA equipment options
  useEffect(() => {
    let cancelled = false;
    fetchFreyaTabletEquipmentOptions()
      .then((options) => {
        if (!cancelled && options.length > 0) {
          setEquipmentOptions((prev) =>
            Array.from(new Set([...prev, ...options])).sort()
          );
        }
      })
      .catch(() => {
        // Fallback to records-derived equipment list
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  // Fetch Freya Tablet paginated records
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    async function loadRecords() {
      setLoading(true);
      setError("");
      try {
        const result = await fetchFreyaTabletData({
          page,
          limit: pageSize,
          sortField: sort.column || "Date",
          sortDirection: sort.direction,
          equipment,
          dateFrom: appliedDates.dateFrom,
          dateTo: appliedDates.dateTo,
          search: debouncedSearch,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        if (!result?.success) {
          throw new Error(result?.message || "Failed to fetch production records");
        }

        const nextRows = Array.isArray(result.data) ? result.data : [];
        setRows(nextRows);
        setPagination(
          result.pagination || {
            currentPage: page,
            totalPages: Math.ceil(nextRows.length / pageSize) || 1,
            totalItems: nextRows.length,
            itemsPerPage: pageSize,
          }
        );

        // Merge equipment names from loaded rows
        const rowEquipments = nextRows
          .map((item) => item["設備"])
          .filter((val) => val && String(val).trim() !== "");
        if (rowEquipments.length > 0) {
          setEquipmentOptions((prev) =>
            Array.from(new Set([...prev, ...rowEquipments])).sort()
          );
        }
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setError(
          err.message ||
            (isJa
              ? "Freya Tabletの生産記録の取得に失敗しました。"
              : "Failed to load Freya Tablet production records.")
        );
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadRecords();
    return () => {
      cancelled = true;
    };
  }, [
    appliedDates.dateFrom,
    appliedDates.dateTo,
    debouncedSearch,
    equipment,
    isJa,
    page,
    pageSize,
    refreshNonce,
    sort.column,
    sort.direction,
  ]);

  // KPI calculations matching freyaTablet.js updateStatistics()
  const stats = useMemo(() => {
    const totalRecords = rows.length;
    const totalQuantity = rows.reduce(
      (sum, item) => sum + (parseInt(item.Total || item.Process_Quantity, 10) || 0),
      0
    );
    const totalNG = rows.reduce(
      (sum, item) => sum + (parseInt(item.Total_NG, 10) || 0),
      0
    );
    const avgCycleTime =
      totalRecords > 0
        ? rows.reduce((sum, item) => sum + (parseFloat(item.Cycle_Time) || 0), 0) /
          totalRecords
        : 0;

    return {
      totalRecords,
      totalQuantity,
      totalNG,
      avgCycleTime,
    };
  }, [rows]);

  function handleApplyFilters() {
    setAppliedDates({
      dateFrom: dateFromInput,
      dateTo: dateToInput,
    });
    setPage(1);
  }

  function handleSort(columnKey) {
    setSort((prev) => {
      if (prev.column === columnKey) {
        return { column: columnKey, direction: prev.direction === 1 ? -1 : 1 };
      }
      return { column: columnKey, direction: -1 };
    });
    setPage(1);
  }

  function handleExportCsv() {
    if (!rows.length) {
      onFlash?.({
        type: "warning",
        message: isJa ? "エクスポートするデータがありません。" : "No data to export.",
      });
      return;
    }

    const headers = [
      "Date",
      "Equipment",
      "Worker Name",
      "Part Number",
      "Back Number",
      "Time Start",
      "Time End",
      "Process Quantity",
      "Total Good",
      "Total NG",
      "Scratch Processed",
      "Scratch NG",
      "Process NG",
      "Other NG",
      "Cycle Time (s)",
      "Work Order Number",
      "Product Name",
      "Required Quantity",
      "Remaining WorkOrder",
      "Break Minutes",
      "Quality Checks",
      "Lot Number",
      "Material Lot",
      "Comment",
    ];

    const csvRows = rows.map((item) => [
      item.Date || "",
      item["設備"] || "",
      item.Worker_Name || "",
      item["品番"] || "",
      item["背番号"] || "",
      item.Time_start || "",
      item.Time_end || "",
      item.Process_Quantity || 0,
      item.Total || 0,
      item.Total_NG || 0,
      item["疵引処理数"] || 0,
      item["疵引不良"] || 0,
      item["加工不良"] || 0,
      item["その他"] || 0,
      item.Cycle_Time || 0,
      item.WorkOrder_Info?.workOrderNumber || "",
      item.WorkOrder_Info?.productName || "",
      item.WorkOrder_Info?.requiredQuantity || 0,
      item.Remaining_WorkOrder || "",
      item.Break_Time_Data?.totalBreakMinutes || 0,
      item.Quality_Check_Data?.totalChecks || 0,
      item["製造ロット"] || "",
      item["材料ロット"] || "",
      (item.Comment || "").replace(/"/g, '""'),
    ]);

    const todayStr = new Date().toISOString().split("T")[0];
    downloadCsvWithBom(headers, csvRows, `freya_tablet_production_${todayStr}.csv`);
    onFlash?.({
      type: "success",
      message: isJa
        ? "Freya TabletのCSVデータをエクスポートしました。"
        : "Exported Freya Tablet production records to CSV.",
    });
  }

  const columns = useMemo(
    () => [
      {
        key: "Date",
        sortKey: "Date",
        label: isJa ? "日付 (Date)" : "Date",
        width: 145,
        renderCell: (row) => (
          <div>
            <div className="font-mono font-semibold text-[var(--text-primary)]">
              {row.Date || "N/A"}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)]">
              {row.Time_start || ""} - {row.Time_end || ""}
            </div>
          </div>
        ),
      },
      {
        key: "設備",
        sortKey: "設備",
        label: isJa ? "設備 (Equipment)" : "Equipment",
        width: 135,
        renderCell: (row) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {row["設備"] || "N/A"}
          </span>
        ),
      },
      {
        key: "品番",
        sortKey: "品番",
        label: isJa ? "品番 (Part Number)" : "Part Number",
        width: 180,
        renderCell: (row) => (
          <div>
            <div className="font-mono font-semibold text-[var(--text-primary)]">
              {row["品番"] || "N/A"}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)]">
              背番号: {row["背番号"] || "N/A"}
            </div>
          </div>
        ),
      },
      {
        key: "Worker_Name",
        sortKey: "Worker_Name",
        label: isJa ? "作業者 (Worker)" : "Worker",
        width: 140,
        renderCell: (row) => (
          <span className="text-[var(--text-primary)]">{row.Worker_Name || "N/A"}</span>
        ),
      },
      {
        key: "Total",
        sortKey: "Total",
        label: isJa ? "数量 (Quantity)" : "Quantity",
        width: 130,
        renderCell: (row) => (
          <div>
            <div className="font-mono font-bold text-[var(--text-primary)]">
              {Number(row.Total || 0).toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)]">
              Made: {Number(row.Process_Quantity || 0).toLocaleString()}
            </div>
          </div>
        ),
      },
      {
        key: "Total_NG",
        sortKey: "Total_NG",
        label: isJa ? "NG数 (NG Count)" : "NG Count",
        width: 115,
        renderCell: (row) => {
          const ngCount = parseInt(row.Total_NG, 10) || 0;
          return (
            <StatusChip
              label={String(ngCount)}
              className={
                ngCount > 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
              }
            />
          );
        },
      },
      {
        key: "Cycle_Time",
        sortKey: "Cycle_Time",
        label: isJa ? "サイクルタイム" : "Cycle Time",
        width: 120,
        renderCell: (row) => {
          const ct = parseFloat(row.Cycle_Time) || 0;
          return (
            <span className="font-mono text-[var(--text-primary)]">
              {ct ? `${ct.toFixed(2)}s` : "0s"}
            </span>
          );
        },
      },
      {
        key: "WorkOrder",
        sortable: false,
        label: isJa ? "ワークオーダー" : "Work Order",
        width: 150,
        renderCell: (row) =>
          row.WorkOrder_Info?.workOrderNumber ? (
            <StatusChip
              icon="assignment"
              label={row.WorkOrder_Info.workOrderNumber}
              className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25"
            />
          ) : (
            <span className="text-xs text-[var(--text-muted)]">N/A</span>
          ),
      },
      {
        key: "Images",
        sortable: false,
        label: isJa ? "画像 (Images)" : "Images",
        width: 110,
        renderCell: (row) => {
          const imgs = getRecordImages(row);
          return imgs.length > 0 ? (
            <StatusChip
              icon="photo_camera"
              label={String(imgs.length)}
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
            />
          ) : (
            <span className="text-xs text-[var(--text-muted)]">None</span>
          );
        },
      },
      {
        key: "actions",
        sortable: false,
        align: "right",
        label: isJa ? "操作" : "Actions",
        width: 90,
        disableCellWrapper: true,
        renderCell: (row) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              icon="visibility"
              label={isJa ? "詳細を表示" : "View Details"}
              onClick={() => setSelectedRecord(row)}
            />
          </div>
        ),
      },
    ],
    [isJa]
  );

  return (
    <div className="space-y-6">
      {/* Filter & Action Card */}
      <div className="freya-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[var(--border)] pb-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {isJa
                ? "Freya Tablet 生産記録 (SCNA工場)"
                : "Freya Tablet Production Records"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {isJa
                ? "SCNA工場のプレス生産記録・品質チェック・休憩履歴・画像記録"
                : "Press production records from SCNA factory with quality checks, break sessions, and photo evidence"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                download
              </span>
              {isJa ? "CSVエクスポート" : "CSV Export"}
            </button>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                refresh
              </span>
              {isJa ? "更新" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "設備 (Equipment)" : "Equipment"}
            </label>
            <select
              value={equipment}
              onChange={(e) => {
                setEquipment(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            >
              <option value="">{isJa ? "すべての設備" : "All Equipment"}</option>
              {equipmentOptions.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "開始日 (Date From)" : "Date From"}
            </label>
            <input
              type="date"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "終了日 (Date To)" : "Date To"}
            </label>
            <input
              type="date"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                filter_alt
              </span>
              {isJa ? "フィルター適用" : "Apply Filters"}
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "検索 (Search)" : "Search"}
            </label>
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                style={{ fontSize: 16 }}
              >
                search
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={
                  isJa
                    ? "品番・背番号・作業者・ロット..."
                    : "Search part number, worker..."
                }
                className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatSummaryCard
          variant="freya"
          icon="database"
          label={isJa ? "表示レコード数 (Total Records)" : "Total Records"}
          value={stats.totalRecords.toLocaleString()}
          subtitle={
            pagination.totalItems > stats.totalRecords
              ? isJa
                ? `全 ${pagination.totalItems.toLocaleString()} 件中`
                : `Out of ${pagination.totalItems.toLocaleString()} matched`
              : isJa
                ? "現在のページの生産記録"
                : "Current page records"
          }
          accent="primary"
          loading={loading}
        />
        <StatSummaryCard
          variant="freya"
          icon="inventory_2"
          label={isJa ? "総生産数 (Total Quantity)" : "Total Quantity"}
          value={stats.totalQuantity.toLocaleString()}
          subtitle={isJa ? "良品・加工合計" : "Total produced on current page"}
          accent="emerald"
          loading={loading}
        />
        <StatSummaryCard
          variant="freya"
          icon="error"
          label={isJa ? "総不良数 (Total NG)" : "Total NG"}
          value={stats.totalNG.toLocaleString()}
          subtitle={isJa ? "不良合計" : "Defective units recorded"}
          accent="error"
          loading={loading}
        />
        <StatSummaryCard
          variant="freya"
          icon="timer"
          label={isJa ? "平均サイクルタイム (Avg Cycle Time)" : "Avg Cycle Time"}
          value={`${stats.avgCycleTime.toFixed(1)}s`}
          subtitle={isJa ? "1サイクルあたり平均秒数" : "Average seconds per cycle"}
          accent="amber"
          loading={loading}
        />
      </div>

      {/* Production Records Table */}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        sort={sort}
        page={pagination.currentPage || page}
        pageSize={pageSize}
        filteredCount={pagination.totalItems || rows.length}
        totalPages={pagination.totalPages || 1}
        onSort={handleSort}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        pageSizeOptions={SCNA_PAGE_SIZE_OPTIONS}
        pageSizeLabel={isJa ? "表示件数" : "Items per page"}
        rowKey={(row, idx) => row._id || `${row.Date}-${row["設備"]}-${idx}`}
        onRowClick={(row) => setSelectedRecord(row)}
        enableColumnResize
        layoutStorageKey="freya2:scna:freyaTablet:columns"
        renderPageInfo={({ filteredCount, page: currentPage, pageSize: size }) => {
          if (!filteredCount) {
            return <span>{isJa ? "0 件" : "Showing 0 to 0 of 0 entries"}</span>;
          }
          const start = (currentPage - 1) * size + 1;
          const end = Math.min(currentPage * size, filteredCount);
          return (
            <span>
              {isJa
                ? `全 ${filteredCount.toLocaleString()} 件中 ${start} - ${end} 件を表示`
                : `Showing ${start} to ${end} of ${filteredCount.toLocaleString()} entries`}
            </span>
          );
        }}
      />

      {/* Detail Modal */}
      <ScnaProductionDetailModal
        open={Boolean(selectedRecord)}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

