import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import DataTable from "../DataTable";
import IconButton from "../IconButton";
import ModalShell from "../ModalShell";
import StatSummaryCard from "../StatSummaryCard";
import StatusChip from "../StatusChip";
import ScnaWorkOrderDetailModal from "./ScnaWorkOrderDetailModal";
import ScnaWorkOrderEditModal from "./ScnaWorkOrderEditModal";
import {
  bulkUploadWorkOrders,
  fetchWorkOrderAssignees,
  fetchWorkOrders,
} from "../../services/scnaApi";
import { readStoredAuthUser } from "../../utils/auth";
import {
  downloadCsvWithBom,
  formatWorkOrderDate,
  getDefaultWorkOrderDates,
  getWorkOrderDeadlineMeta,
  getWorkOrderFinishedGoods,
  getWorkOrderMaterialLoading,
  getWorkOrderStatusBadgeClass,
  parsePercentageValue,
  SCNA_PAGE_SIZE_OPTIONS,
} from "../../utils/scna";

export default function ScnaWorkOrderTab({ onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const authUser = readStoredAuthUser();
  const defaultDates = useMemo(() => getDefaultWorkOrderDates(), []);

  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [assignToFilter, setAssignToFilter] = useState("");
  const [dateFromInput, setDateFromInput] = useState(defaultDates.dateFrom);
  const [dateToInput, setDateToInput] = useState(defaultDates.dateTo);
  const [appliedDates, setAppliedDates] = useState(defaultDates);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ column: "Date", direction: -1 });

  const [rows, setRows] = useState([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    entered: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  });

  const [customerOptions, setCustomerOptions] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingJson, setUploadingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Modals
  const [detailWorkOrder, setDetailWorkOrder] = useState(null);
  const [editWorkOrder, setEditWorkOrder] = useState(null);
  const [duplicateUploadState, setDuplicateUploadState] = useState(null);

  const fileInputRef = useRef(null);
  const requestIdRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Load assignee options from API
  useEffect(() => {
    let cancelled = false;
    fetchWorkOrderAssignees()
      .then((list) => {
        if (!cancelled && list.length > 0) {
          setAssigneeOptions((prev) =>
            Array.from(new Set([...prev, ...list])).sort()
          );
        }
      })
      .catch(() => {
        // Fallback to rows-derived assignees
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  // Fetch paginated work orders
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    async function loadWorkOrders() {
      setLoading(true);
      setError("");
      try {
        const result = await fetchWorkOrders({
          filters: {
            status: statusFilter,
            customer: customerFilter,
            assignTo: assignToFilter,
            dateFrom: appliedDates.dateFrom,
            dateTo: appliedDates.dateTo,
            search: debouncedSearch,
          },
          page,
          limit: pageSize,
          sort,
        });

        if (cancelled || requestId !== requestIdRef.current) return;

        if (!result?.success) {
          throw new Error(result?.error || "Failed to load work orders");
        }

        const nextRows = Array.isArray(result.data) ? result.data : [];
        setRows(nextRows);
        setStatistics({
          total: result.statistics?.total || 0,
          entered: result.statistics?.entered || 0,
          inProgress: result.statistics?.inProgress || 0,
          completed: result.statistics?.completed || 0,
          cancelled: result.statistics?.cancelled || 0,
          overdue: result.statistics?.overdue || 0,
        });
        setPagination(
          result.pagination || {
            currentPage: page,
            totalPages: Math.ceil(nextRows.length / pageSize) || 1,
            totalItems: nextRows.length,
            itemsPerPage: pageSize,
          }
        );

        // Extract unique customers and assignees from loaded rows
        const rowCustomers = nextRows
          .map((wo) => wo["Customer-Custom fields"])
          .filter(Boolean);
        if (rowCustomers.length > 0) {
          setCustomerOptions((prev) =>
            Array.from(new Set([...prev, ...rowCustomers])).sort()
          );
        }

        const rowAssignees = nextRows
          .map((wo) => wo["Assign to-Custom fields"])
          .filter(Boolean);
        if (rowAssignees.length > 0) {
          setAssigneeOptions((prev) =>
            Array.from(new Set([...prev, ...rowAssignees])).sort()
          );
        }
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setRows([]);
        setError(
          err.message ||
            (isJa
              ? "ワークオーダーの取得に失敗しました。"
              : "Failed to load work orders.")
        );
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadWorkOrders();
    return () => {
      cancelled = true;
    };
  }, [
    appliedDates.dateFrom,
    appliedDates.dateTo,
    assignToFilter,
    customerFilter,
    debouncedSearch,
    isJa,
    page,
    pageSize,
    refreshNonce,
    sort,
    statusFilter,
  ]);

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

  async function handleJsonFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      onFlash?.({
        type: "error",
        message: isJa
          ? "有効なJSONファイルを選択してください。"
          : "Please select a valid JSON file.",
      });
      return;
    }

    setUploadingJson(true);
    try {
      const text = await file.text();
      let jsonData;
      try {
        jsonData = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Invalid JSON file format: ${parseErr.message}`);
      }

      if (!Array.isArray(jsonData)) {
        throw new Error("JSON file must contain an array of work order objects.");
      }

      if (jsonData.length === 0) {
        throw new Error("JSON file is empty.");
      }

      const requiredFields = [
        "Number",
        "Status",
        "Customer-Custom fields",
        "P_SKU-Custom fields",
      ];
      const firstItem = jsonData[0];
      const missingFields = requiredFields.filter(
        (field) => !Object.prototype.hasOwnProperty.call(firstItem, field)
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required fields in JSON: ${missingFields.join(", ")}`
        );
      }

      const username =
        authUser?.username ||
        localStorage.getItem("username") ||
        "admin";

      const result = await bulkUploadWorkOrders({
        workOrders: jsonData,
        username,
        overwrite: false,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Failed to upload work orders.");
      }

      const duplicates = Array.isArray(result.duplicates)
        ? result.duplicates
        : [];

      if (result.duplicatesFound || duplicates.length > 0) {
        setDuplicateUploadState({
          workOrders: jsonData,
          duplicates,
          insertedCount: result.inserted || 0,
        });
      } else {
        onFlash?.({
          type: "success",
          message: isJa
            ? `${result.inserted || 0} 件のワークオーダーをアップロードしました。`
            : `Successfully uploaded ${result.inserted || 0} work orders!`,
        });
        setRefreshNonce((n) => n + 1);
      }
    } catch (err) {
      onFlash?.({
        type: "error",
        message: err.message || "Error uploading work orders JSON.",
      });
    } finally {
      setUploadingJson(false);
    }
  }

  async function handleConfirmOverwriteDuplicates() {
    if (!duplicateUploadState?.workOrders) return;
    setUploadingJson(true);
    try {
      const username =
        authUser?.username ||
        localStorage.getItem("username") ||
        "admin";

      const overwriteResult = await bulkUploadWorkOrders({
        workOrders: duplicateUploadState.workOrders,
        username,
        overwrite: true,
      });

      if (!overwriteResult?.success) {
        throw new Error(
          overwriteResult?.error || "Failed to overwrite duplicate work orders"
        );
      }

      onFlash?.({
        type: "success",
        message: isJa
          ? `重複分を含め、全 ${overwriteResult.inserted || 0} 件のワークオーダーをアップロード・更新しました。`
          : `Successfully uploaded/updated ${overwriteResult.inserted || 0} work orders (including duplicates)!`,
      });
      setDuplicateUploadState(null);
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      onFlash?.({
        type: "error",
        message: err.message || "Error overwriting duplicate work orders.",
      });
    } finally {
      setUploadingJson(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const result = await fetchWorkOrders({
        filters: {
          status: statusFilter,
          customer: customerFilter,
          assignTo: assignToFilter,
          dateFrom: appliedDates.dateFrom,
          dateTo: appliedDates.dateTo,
          search: debouncedSearch,
        },
        page: 1,
        limit: 1000,
        sort,
      });

      if (!result?.success || !Array.isArray(result.data) || !result.data.length) {
        onFlash?.({
          type: "warning",
          message: isJa
            ? "エクスポートするワークオーダーがありません。"
            : "No work orders to export.",
        });
        return;
      }

      const headers = [
        "Work Order Number",
        "Status",
        "Customer",
        "Product SKU",
        "Assigned To",
        "Owner",
        "Created Date",
        "Deadline",
        "Material Loading %",
        "Finished Goods %",
        "Quantity Status",
        "Estimated Cost",
        "Actual Cost",
        "Time Track",
      ];

      const csvRows = result.data.map((wo) => [
        wo.Number || "",
        wo.Status || "",
        wo["Customer-Custom fields"] || "",
        wo["P_SKU-Custom fields"] || "",
        wo["Assign to-Custom fields"] || "",
        wo.Owner || "",
        formatWorkOrderDate(wo["Date"]),
        formatWorkOrderDate(wo["Deadline"]),
        getWorkOrderMaterialLoading(wo),
        getWorkOrderFinishedGoods(wo),
        wo["Quantity status"] || "",
        wo["Estimated cost"] || 0,
        wo["Cost"] || 0,
        wo["Time track"] || "",
      ]);

      const todayStr = new Date().toISOString().split("T")[0];
      downloadCsvWithBom(headers, csvRows, `work_orders_${todayStr}.csv`);
      onFlash?.({
        type: "success",
        message: isJa
          ? `${result.data.length} 件のワークオーダーをCSVエクスポートしました。`
          : `Exported ${result.data.length} work orders to CSV.`,
      });
    } catch (err) {
      onFlash?.({
        type: "error",
        message: err.message || "Error exporting work order data.",
      });
    } finally {
      setExportingCsv(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "Number",
        sortKey: "Number",
        label: isJa ? "WO番号 (Work Order #)" : "Work Order #",
        width: 170,
        renderCell: (row) => (
          <div>
            <div className="font-mono font-bold text-[var(--text-primary)]">
              {row.Number || "N/A"}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)]">
              {row["P_SKU-Custom fields"] || "No SKU"}
            </div>
          </div>
        ),
      },
      {
        key: "Status",
        sortKey: "Status",
        label: isJa ? "ステータス (Status)" : "Status",
        width: 130,
        renderCell: (row) => (
          <StatusChip
            label={row.Status || "Unknown"}
            className={getWorkOrderStatusBadgeClass(row.Status)}
          />
        ),
      },
      {
        key: "Customer-Custom fields",
        sortKey: "Customer-Custom fields",
        label: isJa ? "顧客 (Customer)" : "Customer",
        width: 140,
        renderCell: (row) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {row["Customer-Custom fields"] || "N/A"}
          </span>
        ),
      },
      {
        key: "P_SKU-Custom fields",
        sortKey: "P_SKU-Custom fields",
        label: isJa ? "製品SKU (Product SKU)" : "Product SKU",
        width: 160,
        renderCell: (row) => (
          <span className="font-mono text-[var(--text-primary)]">
            {row["P_SKU-Custom fields"] || "N/A"}
          </span>
        ),
      },
      {
        key: "Assign to-Custom fields",
        sortKey: "Assign to-Custom fields",
        label: isJa ? "担当設備 (Assigned To)" : "Assigned To",
        width: 140,
        renderCell: (row) => (
          <span className="text-[var(--text-primary)]">
            {row["Assign to-Custom fields"] || "Unassigned"}
          </span>
        ),
      },
      {
        key: "MaterialLoading",
        sortable: false,
        label: isJa ? "材料投入率 (Material Loading)" : "Material Loading",
        width: 175,
        renderCell: (row) => {
          const matStr = getWorkOrderMaterialLoading(row);
          const finStr = getWorkOrderFinishedGoods(row);
          const matPct = Math.min(100, Math.max(0, parsePercentageValue(matStr)));
          return (
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${matPct}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                  {matStr}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-[var(--text-muted)]">
                Finished: {finStr}
              </div>
            </div>
          );
        },
      },
      {
        key: "Estimated cost",
        sortKey: "Estimated cost",
        label: isJa ? "見積コスト (Estimated Cost)" : "Estimated Cost",
        width: 145,
        renderCell: (row) => {
          const est = parseFloat(row["Estimated cost"]) || 0;
          const act = parseFloat(row["Cost"]) || 0;
          return (
            <div>
              <div className="font-mono font-bold text-[var(--text-primary)]">
                ${est.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-[var(--text-muted)]">
                Actual: ${act.toFixed(2)}
              </div>
            </div>
          );
        },
      },
      {
        key: "Deadline",
        sortKey: "Deadline",
        label: isJa ? "納期 (Deadline)" : "Deadline",
        width: 155,
        renderCell: (row) => {
          const meta = getWorkOrderDeadlineMeta(row);
          return (
            <div>
              <div
                className={`font-mono font-semibold ${
                  meta.isOverdue
                    ? "text-rose-600 dark:text-rose-400"
                    : meta.isDueSoon
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-[var(--text-primary)]"
                }`}
              >
                {meta.formatted}
              </div>
              {meta.isOverdue && (
                <div className="mt-0.5">
                  <StatusChip
                    label={isJa ? "期限超過 (Overdue)" : "Overdue"}
                    className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                  />
                </div>
              )}
              {meta.isDueSoon && (
                <div className="mt-0.5">
                  <StatusChip
                    label={isJa ? "期限間近 (Due Soon)" : "Due Soon"}
                    className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                  />
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        sortable: false,
        align: "right",
        label: isJa ? "操作" : "Actions",
        width: 110,
        disableCellWrapper: true,
        renderCell: (row) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              icon="visibility"
              label={isJa ? "詳細を表示" : "View Details"}
              onClick={() => setDetailWorkOrder(row)}
            />
            <IconButton
              icon="edit"
              label={isJa ? "編集" : "Edit Work Order"}
              onClick={() => setEditWorkOrder(row)}
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
                ? "SCNA ワークオーダー管理"
                : "SCNA Work Order Management"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {isJa
                ? "ワークオーダーの進捗・納期・コスト管理とJSON一括アップロード"
                : "Manage work order schedules, material loading, costs, and JSON bulk uploads"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleJsonFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingJson}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-purple-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-purple-700 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {uploadingJson ? "progress_activity" : "upload_file"}
              </span>
              {uploadingJson
                ? isJa
                  ? "アップロード中..."
                  : "Uploading..."
                : isJa
                  ? "JSONアップロード"
                  : "Upload JSON"}
            </button>

            <button
              type="button"
              disabled={exportingCsv}
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                download
              </span>
              {exportingCsv
                ? isJa
                  ? "エクスポート中..."
                  : "Exporting..."
                : isJa
                  ? "CSVエクスポート"
                  : "CSV Export"}
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

        {/* Filters Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "ステータス (Status)" : "Status"}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            >
              <option value="">{isJa ? "すべて" : "All Status"}</option>
              <option value="Entered">Entered</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "顧客 (Customer)" : "Customer"}
            </label>
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            >
              <option value="">{isJa ? "すべての顧客" : "All Customers"}</option>
              {customerOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "担当設備 (Assigned To)" : "Assigned To"}
            </label>
            <select
              value={assignToFilter}
              onChange={(e) => {
                setAssignToFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            >
              <option value="">{isJa ? "すべて" : "All Assignees"}</option>
              {assigneeOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1">
              {isJa ? "納期 開始 (Deadline From)" : "Deadline From"}
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
              {isJa ? "納期 終了 (Deadline To)" : "Deadline To"}
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
        </div>

        {/* Search Input Row */}
        <div className="mt-3">
          <div className="relative max-w-md">
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
                  ? "ワークオーダー番号・顧客・製品SKU・担当者で検索..."
                  : "Search work order, customer, SKU..."
              }
              className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            />
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatSummaryCard
          variant="freya"
          icon="assignment"
          label={isJa ? "総オーダー数 (Total Orders)" : "Total Orders"}
          value={statistics.total.toLocaleString()}
          subtitle={isJa ? "条件に一致する全オーダー" : "Total matching work orders"}
          accent="primary"
          loading={loading}
        />
        <StatSummaryCard
          variant="freya"
          icon="pending_actions"
          label={isJa ? "進行中 (In Progress)" : "In Progress"}
          value={statistics.inProgress.toLocaleString()}
          subtitle={isJa ? "現在進行中のオーダー" : "Currently active work orders"}
          accent="amber"
          loading={loading}
        />
        <StatSummaryCard
          variant="freya"
          icon="task_alt"
          label={isJa ? "完了 (Completed)" : "Completed"}
          value={statistics.completed.toLocaleString()}
          subtitle={isJa ? "完了済みオーダー" : "Completed work orders"}
          accent="emerald"
          loading={loading}
        />
        <StatSummaryCard
          variant="freya"
          icon="warning"
          label={isJa ? "期限超過 (Overdue)" : "Overdue"}
          value={statistics.overdue.toLocaleString()}
          subtitle={isJa ? "納期を超過した未完了オーダー" : "Past deadline and not completed"}
          accent="error"
          loading={loading}
        />
      </div>

      {/* Work Orders DataTable */}
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
        rowKey={(row, idx) => row._id || row.Number || idx}
        onRowClick={(row) => setDetailWorkOrder(row)}
        enableColumnResize
        layoutStorageKey="freya2:scna:workOrders:columns"
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
      <ScnaWorkOrderDetailModal
        open={Boolean(detailWorkOrder)}
        workOrderId={detailWorkOrder?._id}
        initialWorkOrder={detailWorkOrder}
        onClose={() => setDetailWorkOrder(null)}
        onEdit={(wo) => {
          setDetailWorkOrder(null);
          setEditWorkOrder(wo);
        }}
      />

      {/* Edit Modal */}
      <ScnaWorkOrderEditModal
        open={Boolean(editWorkOrder)}
        workOrderId={editWorkOrder?._id}
        initialWorkOrder={editWorkOrder}
        assigneeOptions={assigneeOptions}
        onClose={() => setEditWorkOrder(null)}
        onSaved={() => setRefreshNonce((n) => n + 1)}
        onFlash={onFlash}
      />

      {/* Duplicate JSON Upload Confirmation Modal */}
      {duplicateUploadState && (
        <ModalShell
          open={Boolean(duplicateUploadState)}
          onClose={() => {
            setDuplicateUploadState(null);
            setRefreshNonce((n) => n + 1);
          }}
          eyebrow={isJa ? "重複ワークオーダーの確認" : "Duplicate Work Orders Detected"}
          title={
            isJa
              ? `${duplicateUploadState.duplicates.length} 件の重複ワークオーダーが見つかりました`
              : `Found ${duplicateUploadState.duplicates.length} Duplicate Work Orders`
          }
          subtitle={
            isJa
              ? `新規 ${duplicateUploadState.insertedCount} 件は登録済みです。既存の重複データを上書きしますか？`
              : `${duplicateUploadState.insertedCount} new work orders were uploaded. Do you want to overwrite the existing duplicates?`
          }
          maxWidth="max-w-lg"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  onFlash?.({
                    type: "success",
                    message: isJa
                      ? `新規 ${duplicateUploadState.insertedCount} 件を登録し、重複 ${duplicateUploadState.duplicates.length} 件をスキップしました。`
                      : `Uploaded ${duplicateUploadState.insertedCount} new work orders. Skipped ${duplicateUploadState.duplicates.length} duplicates.`,
                  });
                  setDuplicateUploadState(null);
                  setRefreshNonce((n) => n + 1);
                }}
                className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
              >
                {isJa ? "重複をスキップ (Skip)" : "Skip Duplicates"}
              </button>
              <button
                type="button"
                disabled={uploadingJson}
                onClick={handleConfirmOverwriteDuplicates}
                className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-amber-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  sync
                </span>
                {uploadingJson
                  ? isJa
                    ? "上書き中..."
                    : "Overwriting..."
                  : isJa
                    ? "重複を上書き (Overwrite)"
                    : "Overwrite Duplicates"}
              </button>
            </div>
          }
        >
          <div className="p-6 space-y-3">
            <p className="text-xs text-[var(--text-secondary)]">
              {isJa
                ? "以下のワークオーダー番号は既にデータベースに存在します:"
                : "The following Work Order Numbers already exist in the database:"}
            </p>
            <div className="max-h-48 overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--text-primary)] space-y-1">
              {duplicateUploadState.duplicates.map((dup, index) => (
                <div
                  key={dup.Number || index}
                  className="flex items-center justify-between border-b border-[var(--border)]/50 pb-1 last:border-b-0"
                >
                  <span className="font-semibold">{dup.Number}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {dup["Customer-Custom fields"] || ""} • {dup["P_SKU-Custom fields"] || ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

