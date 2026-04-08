import { useDeferredValue, useEffect, useRef, useState } from "react";
import DataTable from "../components/DataTable";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import ApprovalsDetailModal from "../components/ApprovalsDetailModal";
import ApprovalsStatsStrip from "../components/ApprovalsStatsStrip";
import {
  approveApprovalDeleteRequest,
  approveApprovalRecord,
  cancelApprovalDeleteRequest,
  fetchApprovalFactories,
  fetchApprovalPage,
  fetchApprovalRecord,
  fetchApprovalRecycleBin,
  fetchApprovalStats,
  permanentlyDeleteApprovalFromRecycleBin,
  rejectApprovalDeleteRequest,
  requestApprovalCorrection,
  requestApprovalDeletion,
  resolveApprovalActorName,
  restoreApprovalFromRecycleBin,
  softDeleteApproval,
} from "../services/approvalsApi";
import { getAuthUser } from "../utils/masterDB";
import {
  APPROVAL_RANGE_MODES,
  APPROVAL_STATUS_OPTIONS,
  APPROVAL_TABS,
  APPROVAL_VIEW_MODES,
  buildApprovalQueryFilters,
  buildApprovalStatsFilters,
  canAccessRecycleBin,
  getApprovalDateTimeMismatch,
  getApprovalDefectRate,
  getApprovalFactoryAccess,
  getApprovalNGValue,
  getApprovalPrimaryApprover,
  getApprovalQuantityValue,
  getApprovalRecordId,
  getApprovalStatusMeta,
  getApproveActionLabel,
  getTodayDateString,
  hasApprovalAccess,
  isBatchSelectable,
  sortApprovalRows,
} from "../utils/approvals";

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];
const EMPTY_STATS = {
  pending: 0,
  hanchoApproved: 0,
  fullyApproved: 0,
  correctionNeeded: 0,
  correctionNeededFromKacho: 0,
  todayTotal: 0,
  overallTotal: 0,
};

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-error/20 bg-error/10 text-error"
    : flash.type === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={joinClasses("mb-6 rounded-3xl border px-5 py-4", tone)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em]">Status</div>
          <p className="mt-1 text-sm font-medium">{flash.message}</p>
        </div>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  );
}

function buildInitialTab() {
  const saved = localStorage.getItem("approvals_active_tab");
  return saved || APPROVAL_TABS[0].key;
}

function buildInitialViewMode() {
  const saved = localStorage.getItem("approvals_view_mode");
  return APPROVAL_VIEW_MODES.some((item) => item.key === saved) ? saved : "review";
}

function buildInitialRangeMode() {
  const saved = localStorage.getItem("approvals_range_mode");
  return APPROVAL_RANGE_MODES.some((item) => item.key === saved) ? saved : "current";
}

export default function ApprovalsPage() {
  const authUser = getAuthUser();
  const requestIdRef = useRef(0);
  const actorNameRef = useRef("");
  const authRole = authUser?.role || "";
  const authUsername = authUser?.username || "";
  const authFirstName = authUser?.firstName || "";
  const authLastName = authUser?.lastName || "";
  const hasAccess = hasApprovalAccess(authUser);
  const canUseRecycleBin = canAccessRecycleBin(authUser);
  const factoryAccess = getApprovalFactoryAccess(authUser);
  const factoryAccessKey = factoryAccess.join("||");
  const today = getTodayDateString();

  const [activeTab, setActiveTab] = useState(buildInitialTab);
  const [viewMode, setViewMode] = useState(buildInitialViewMode);
  const [rangeMode, setRangeMode] = useState(buildInitialRangeMode);
  const [filters, setFilters] = useState({ factory: "", status: "", date: today });
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [binSearchInput, setBinSearchInput] = useState("");
  const deferredBinSearch = useDeferredValue(binSearchInput);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState({ column: "", direction: 1 });
  const [stats, setStats] = useState(EMPTY_STATS);
  const [factories, setFactories] = useState([]);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 0, totalRecords: 0 });
  const [recycleItems, setRecycleItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [detailState, setDetailState] = useState({ open: false, record: null, mode: "live" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const tableTabs = canUseRecycleBin
    ? [...APPROVAL_TABS, { key: "recycleBin", label: "Recycle Bin" }]
    : APPROVAL_TABS;

  useEffect(() => {
    if (!hasAccess) return undefined;
    const initialName = [authLastName, authFirstName].filter(Boolean).join(" ").trim();
    if (initialName) {
      actorNameRef.current = initialName;
      return undefined;
    }

    let cancelled = false;
    resolveApprovalActorName(authUser).then((name) => {
      if (!cancelled) {
        actorNameRef.current = name;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authFirstName, authLastName, authUsername, hasAccess]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    const allowedKeys = tableTabs.map((item) => item.key);
    if (!allowedKeys.includes(activeTab)) {
      setActiveTab(APPROVAL_TABS[0].key);
    }
  }, [activeTab, tableTabs]);

  useEffect(() => {
    localStorage.setItem("approvals_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("approvals_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("approvals_range_mode", rangeMode);
  }, [rangeMode]);

  useEffect(() => {
    if (rangeMode === "current" && !filters.date) {
      setFilters((current) => ({ ...current, date: today }));
    }
  }, [filters.date, rangeMode, today]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, viewMode, page, pageSize, deferredSearch, deferredBinSearch, filters.factory, filters.status, filters.date, rangeMode]);

  useEffect(() => {
    if (!hasAccess) return undefined;

    let cancelled = false;

    async function loadRecycleBin() {
      if (activeTab !== "recycleBin") return;
      setLoading(true);
      setError("");

      try {
        const nextItems = await fetchApprovalRecycleBin();
        if (cancelled) return;
        setRecycleItems(nextItems);
      } catch (loadError) {
        if (cancelled) return;
        setRecycleItems([]);
        setError(loadError.message || "Failed to load recycle bin records.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecycleBin();

    return () => {
      cancelled = true;
    };
  }, [activeTab, hasAccess, refreshNonce]);

  useEffect(() => {
    if (!hasAccess || activeTab === "recycleBin") return undefined;

    let cancelled = false;
    const requestId = ++requestIdRef.current;
    const queryFilters = buildApprovalQueryFilters({
      factory: filters.factory,
      status: filters.status,
      date: filters.date,
      search: deferredSearch,
      rangeMode,
    });
    const statsFilters = buildApprovalStatsFilters({
      factory: filters.factory,
      date: filters.date,
      search: deferredSearch,
      rangeMode,
    });

    async function loadApprovals() {
      setLoading(true);
      setError("");

      try {
        const [nextFactories, pageResult, nextStats] = await Promise.all([
          fetchApprovalFactories({ collectionName: activeTab, userRole: authRole, factoryAccess }),
          fetchApprovalPage({
            collectionName: activeTab,
            page,
            limit: pageSize,
            filters: queryFilters,
            userRole: authRole,
            factoryAccess,
          }),
          fetchApprovalStats({
            collectionName: activeTab,
            filters: statsFilters,
            userRole: authRole,
            factoryAccess,
          }),
        ]);

        if (cancelled || requestId !== requestIdRef.current) return;

        setFactories(nextFactories);
        setRecords(Array.isArray(pageResult?.data) ? pageResult.data : []);
        setPagination(pageResult?.pagination || { currentPage: page, totalPages: 0, totalRecords: 0 });
        setStats(nextStats || EMPTY_STATS);

        if (filters.factory && nextFactories.length > 0 && !nextFactories.includes(filters.factory)) {
          setFilters((current) => ({ ...current, factory: "" }));
        }
      } catch (loadError) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError(loadError.message || "Failed to load approval records.");
        setRecords([]);
        setPagination({ currentPage: page, totalPages: 0, totalRecords: 0 });
        setStats(EMPTY_STATS);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    loadApprovals();

    return () => {
      cancelled = true;
    };
  }, [activeTab, authRole, deferredSearch, factoryAccessKey, filters.date, filters.factory, filters.status, hasAccess, page, pageSize, rangeMode, refreshNonce]);

  const liveRows = sortApprovalRows(records, sort, activeTab);
  const binRows = sortApprovalRows(
    recycleItems.filter((item) => {
      const query = deferredBinSearch.trim().toLowerCase();
      if (!query) return true;
      const original = item?.originalDoc || {};
      return [
        item?.originalCollection,
        item?.deleteReason,
        item?.deletedBy,
        original?.工場,
        original?.品番,
        original?.背番号,
        original?.Worker_Name,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    }),
    sort,
    activeTab
  );

  const binTotalPages = Math.max(1, Math.ceil(binRows.length / pageSize));
  const effectiveBinPage = Math.min(page, binTotalPages);
  const binPageRows = binRows.slice((effectiveBinPage - 1) * pageSize, effectiveBinPage * pageSize);

  useEffect(() => {
    const visibleIds = new Set((activeTab === "recycleBin" ? binPageRows : liveRows).map((row) => getApprovalRecordId(row)));
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [activeTab, binPageRows, liveRows]);

  useEffect(() => {
    if (activeTab === "recycleBin") {
      if (page > binTotalPages) {
        setPage(binTotalPages);
      }
      return;
    }

    if (pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [activeTab, binTotalPages, page, pagination.totalPages]);

  async function ensureActorName() {
    if (actorNameRef.current) return actorNameRef.current;
    const resolved = await resolveApprovalActorName(authUser);
    actorNameRef.current = resolved;
    return resolved;
  }

  function setFilterPatch(patch) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    setPage(1);
    setSort({ column: "", direction: 1 });
    setError("");
    setDetailState({ open: false, record: null, mode: "live" });
    if (nextTab === "recycleBin") {
      setViewMode("review");
    }
  }

  function handleSortChange(column) {
    setSort((current) => {
      if (current.column === column) {
        return { column, direction: current.direction * -1 };
      }

      return { column, direction: 1 };
    });
  }

  function handleStatSelect(key) {
    if (key === "todayTotal") {
      setPage(1);
      setRangeMode("current");
      setFilters((current) => ({ ...current, status: "", date: today }));
      return;
    }

    setFilterPatch({ status: key });
  }

  function clearLiveFilters() {
    setPage(1);
    setSearchInput("");
    setFilters({ factory: "", status: "", date: rangeMode === "current" ? today : "" });
  }

  function openDetail(record, mode = "live") {
    setDetailState({ open: true, record, mode });

    if (mode === "recycleBin") return;

    const recordId = getApprovalRecordId(record);
    fetchApprovalRecord(activeTab, recordId)
      .then((fullRecord) => {
        if (!fullRecord) return;
        setDetailState((current) => {
          if (!current.open || getApprovalRecordId(current.record || {}) !== recordId) {
            return current;
          }

          return { ...current, record: fullRecord };
        });
      })
      .catch(() => {});
  }

  async function runAction(executor, successMessage, { closeDetail = true, keepSelection = false } = {}) {
    setActionBusy(true);

    try {
      const actorName = await ensureActorName();
      await executor(actorName);
      setFlash({ type: "success", message: successMessage });

      if (closeDetail) {
        setDetailState({ open: false, record: null, mode: "live" });
      }

      if (!keepSelection) {
        setSelectedIds([]);
      }

      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setFlash({ type: "error", message: actionError.message || "Action failed." });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleApprove(record) {
    await runAction(
      async (actorName) => approveApprovalRecord({ collectionName: activeTab, record, authUser, actorName }),
      `${getApproveActionLabel(record, authUser)} completed.`
    );
  }

  async function handleRequestCorrection(record) {
    const comment = window.prompt("Enter the correction reason.");
    if (!comment || !comment.trim()) return;

    await runAction(
      async (actorName) => requestApprovalCorrection({
        collectionName: activeTab,
        record,
        authUser,
        actorName,
        comment: comment.trim(),
      }),
      "Correction request sent."
    );
  }

  async function handleSoftDelete(record) {
    const reason = window.prompt("Enter the reason for soft deleting this record.");
    if (!reason || !reason.trim()) return;

    await runAction(
      async (actorName) => softDeleteApproval({
        collectionName: activeTab,
        itemId: getApprovalRecordId(record),
        actorName,
        username: authUser?.username,
        reason: reason.trim(),
      }),
      "Record moved to recycle bin."
    );
  }

  async function handleRequestDelete(record) {
    const reason = window.prompt("Enter the reason for the delete request.");
    if (!reason || !reason.trim()) return;

    await runAction(
      async (actorName) => requestApprovalDeletion({
        collectionName: activeTab,
        itemId: getApprovalRecordId(record),
        actorName,
        username: authUser?.username,
        reason: reason.trim(),
      }),
      "Delete request submitted."
    );
  }

  async function handleApproveDeleteRequest(record) {
    const confirmed = window.confirm("Approve this delete request?");
    if (!confirmed) return;

    await runAction(
      async (actorName) => approveApprovalDeleteRequest({
        collectionName: activeTab,
        itemId: getApprovalRecordId(record),
        actorName,
        username: authUser?.username,
      }),
      "Delete request approved."
    );
  }

  async function handleRejectDeleteRequest(record) {
    const reason = window.prompt("Optional: enter a rejection reason.") || "";

    await runAction(
      async (actorName) => rejectApprovalDeleteRequest({
        collectionName: activeTab,
        itemId: getApprovalRecordId(record),
        actorName,
        username: authUser?.username,
        rejectReason: reason.trim(),
      }),
      "Delete request rejected."
    );
  }

  async function handleCancelDeleteRequest(record) {
    const confirmed = window.confirm("Cancel this delete request?");
    if (!confirmed) return;

    await runAction(
      async (actorName) => cancelApprovalDeleteRequest({
        collectionName: activeTab,
        itemId: getApprovalRecordId(record),
        actorName,
        username: authUser?.username,
      }),
      "Delete request canceled."
    );
  }

  async function handleRestore(record) {
    const confirmed = window.confirm("Restore this record from the recycle bin?");
    if (!confirmed) return;

    await runAction(
      async (actorName) => restoreApprovalFromRecycleBin({
        binDocId: getApprovalRecordId(record),
        actorName,
        username: authUser?.username,
      }),
      "Record restored from recycle bin."
    );
  }

  async function handlePermanentDelete(record) {
    const confirmed = window.confirm("Permanently delete this recycle-bin record? This cannot be undone.");
    if (!confirmed) return;

    await runAction(
      async (actorName) => permanentlyDeleteApprovalFromRecycleBin({
        binDocId: getApprovalRecordId(record),
        actorName,
      }),
      "Recycle-bin record permanently deleted."
    );
  }

  function getSelectedLiveRows() {
    return liveRows.filter((row) => selectedIds.includes(getApprovalRecordId(row)));
  }

  async function handleBatchApprove() {
    const targetRows = getSelectedLiveRows();
    if (!targetRows.length) return;

    setActionBusy(true);

    try {
      const actorName = await ensureActorName();
      const results = await Promise.allSettled(
        targetRows.map((record) => approveApprovalRecord({ collectionName: activeTab, record, authUser, actorName }))
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failureCount = results.length - successCount;

      setFlash({
        type: failureCount ? "warning" : "success",
        message: failureCount
          ? `${successCount} records approved, ${failureCount} failed.`
          : `${successCount} records approved.`,
      });
      setSelectedIds([]);
      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setFlash({ type: "error", message: actionError.message || "Batch approval failed." });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleBatchCorrection() {
    const targetRows = getSelectedLiveRows();
    if (!targetRows.length) return;

    const comment = window.prompt("Enter the correction reason for all selected records.");
    if (!comment || !comment.trim()) return;

    setActionBusy(true);

    try {
      const actorName = await ensureActorName();
      const results = await Promise.allSettled(
        targetRows.map((record) => requestApprovalCorrection({
          collectionName: activeTab,
          record,
          authUser,
          actorName,
          comment: comment.trim(),
        }))
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failureCount = results.length - successCount;

      setFlash({
        type: failureCount ? "warning" : "success",
        message: failureCount
          ? `${successCount} correction requests sent, ${failureCount} failed.`
          : `${successCount} correction requests sent.`,
      });
      setSelectedIds([]);
      setRefreshNonce((current) => current + 1);
    } catch (actionError) {
      setFlash({ type: "error", message: actionError.message || "Batch correction failed." });
    } finally {
      setActionBusy(false);
    }
  }

  function toggleSelection(recordId) {
    setSelectedIds((current) => (
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    ));
  }

  function selectVisibleRows() {
    const nextIds = liveRows
      .filter((record) => isBatchSelectable(record, authUser))
      .map((record) => getApprovalRecordId(record));
    setSelectedIds(nextIds);
  }

  const batchSelectedCount = selectedIds.length;
  const activeStatsKey = filters.status || "";

  const liveColumns = [
    ...(viewMode === "batch"
      ? [{
          key: "select",
          label: "Sel",
          sortable: false,
          width: 66,
          disableCellWrapper: true,
          align: "center",
          renderCell: (row) => {
            const recordId = getApprovalRecordId(row);
            const selectable = isBatchSelectable(row, authUser);

            return (
              <input
                type="checkbox"
                checked={selectedIds.includes(recordId)}
                disabled={!selectable || actionBusy}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleSelection(recordId)}
                className="h-4 w-4 rounded border-outline-variant/40"
              />
            );
          },
        }]
      : []),
    {
      key: "approvalStatus",
      label: "Status",
      width: 148,
      disableCellWrapper: true,
      renderCell: (row) => {
        const meta = getApprovalStatusMeta(row);
        return (
          <span className={joinClasses("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold", meta.badgeClassName)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "Date",
      label: "Submitted",
      width: 158,
      disableCellWrapper: true,
      renderCell: (row) => {
        const mismatch = getApprovalDateTimeMismatch(row);

        return (
          <div>
            <div className={joinClasses("planner-data-text flex items-center gap-1 text-sm font-semibold", mismatch.dateMismatch ? "text-error" : "text-on-surface")}>
              <span>{row.Date || "—"}</span>
              {mismatch.dateMismatch ? (
                <span
                  className="material-symbols-outlined text-error"
                  style={{ fontSize: 16 }}
                  title={`Date mismatch. Actual submission date: ${mismatch.objectIdDate || "unknown"}`}
                >
                  warning
                </span>
              ) : null}
            </div>
            <div className={joinClasses("planner-data-text flex items-center gap-1 text-xs", mismatch.timeMismatch ? "font-semibold text-amber-700 dark:text-amber-300" : "text-on-surface-variant")}>
              <span>{[row.Time_start, row.Time_end].filter(Boolean).join(" - ") || "—"}</span>
              {mismatch.timeMismatch ? (
                <span
                  className="material-symbols-outlined text-amber-600 dark:text-amber-300"
                  style={{ fontSize: 16 }}
                  title={`Time mismatch. Actual submission time: ${mismatch.objectIdTime || "unknown"}`}
                >
                  schedule
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      key: "工場",
      label: "Factory",
      width: 130,
      contentClassName: "planner-data-text text-sm font-semibold",
    },
    {
      key: "品番",
      label: "Part No.",
      width: 176,
      contentClassName: "planner-data-text text-sm font-semibold",
    },
    {
      key: "背番号",
      label: "Serial No.",
      width: 142,
      contentClassName: "planner-data-text text-sm font-semibold",
    },
    {
      key: "Worker_Name",
      label: "Worker",
      width: 144,
      contentClassName: "planner-data-text text-sm font-semibold",
    },
    {
      key: "quantity",
      label: "Qty",
      width: 112,
      align: "right",
      disableCellWrapper: true,
      renderCell: (row) => (
        <span className="planner-data-text text-sm font-semibold tabular-nums text-on-surface">
          {getApprovalQuantityValue(row, activeTab).toLocaleString()}
        </span>
      ),
    },
    {
      key: "ng",
      label: "NG",
      width: 98,
      align: "right",
      disableCellWrapper: true,
      renderCell: (row) => {
        const ngValue = getApprovalNGValue(row, activeTab);
        return (
          <span className={joinClasses("planner-data-text text-sm font-semibold tabular-nums", ngValue > 0 ? "text-error" : "text-on-surface")}>{ngValue.toLocaleString()}</span>
        );
      },
    },
    {
      key: "defectRate",
      label: "Defect",
      width: 112,
      align: "right",
      disableCellWrapper: true,
      renderCell: (row) => {
        const defectRate = getApprovalDefectRate(row, activeTab);
        return (
          <span className={joinClasses("planner-data-text text-sm font-semibold tabular-nums", defectRate > 0 ? "text-error" : "text-emerald-600 dark:text-emerald-300")}>
            {defectRate.toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: "approvedBy",
      label: "Approver",
      width: 160,
      disableCellWrapper: true,
      renderCell: (row) => (
        <span className="planner-data-text text-sm font-semibold text-on-surface">{getApprovalPrimaryApprover(row) || "—"}</span>
      ),
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      width: 112,
      disableCellWrapper: true,
      align: "center",
      renderCell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openDetail(row, "live");
          }}
          className="rounded-2xl border border-outline-variant/20 bg-white px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
        >
          Review
        </button>
      ),
    },
  ];

  const recycleColumns = [
    {
      key: "deletedAt",
      label: "Deleted",
      width: 168,
      disableCellWrapper: true,
      renderCell: (row) => (
        <div>
          <div className="planner-data-text text-sm font-semibold text-on-surface">{row.deletedAt ? new Date(row.deletedAt).toLocaleDateString("ja-JP") : "—"}</div>
          <div className="planner-data-text text-xs text-on-surface-variant">{row.deletedAt ? new Date(row.deletedAt).toLocaleTimeString("ja-JP") : "—"}</div>
        </div>
      ),
    },
    {
      key: "collection",
      label: "Collection",
      width: 128,
      disableCellWrapper: true,
      renderCell: (row) => (
        <span className="planner-data-text text-sm font-semibold text-on-surface">{row.originalCollection || "—"}</span>
      ),
    },
    {
      key: "工場",
      label: "Factory",
      width: 126,
      disableCellWrapper: true,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.originalDoc?.工場 || "—"}</span>,
    },
    {
      key: "品番",
      label: "Part No.",
      width: 176,
      disableCellWrapper: true,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.originalDoc?.品番 || "—"}</span>,
    },
    {
      key: "背番号",
      label: "Serial No.",
      width: 140,
      disableCellWrapper: true,
      renderCell: (row) => <span className="planner-data-text text-sm font-semibold text-on-surface">{row.originalDoc?.背番号 || "—"}</span>,
    },
    {
      key: "deletedBy",
      label: "Deleted By",
      width: 160,
      contentClassName: "planner-data-text text-sm font-semibold",
    },
    {
      key: "deleteReason",
      label: "Reason",
      width: 240,
      wrap: true,
      contentClassName: "planner-data-text text-sm",
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      width: 110,
      disableCellWrapper: true,
      align: "center",
      renderCell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openDetail(row, "recycle");
          }}
          className="rounded-2xl border border-outline-variant/20 bg-white px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
        >
          Inspect
        </button>
      ),
    },
  ];

  if (!hasAccess) {
    return (
      <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
        <div className="glass-card rounded-[28px] px-6 py-8">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Approvals</div>
          <h1 className="mt-2 text-2xl font-black text-on-surface">Access Required</h1>
          <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
            The approval workflow is available only to admin, 部長, 課長, 係長, and 班長 roles.
          </p>
        </div>
      </section>
    );
  }

  const dataTableRows = activeTab === "recycleBin" ? binPageRows : liveRows;
  const dataTableColumns = activeTab === "recycleBin" ? recycleColumns : liveColumns;
  const dataTableTotalPages = activeTab === "recycleBin" ? binTotalPages : pagination.totalPages || 1;
  const dataTableTotalRecords = activeTab === "recycleBin" ? binRows.length : pagination.totalRecords || 0;
  const currentPage = activeTab === "recycleBin" ? effectiveBinPage : pagination.currentPage || page;

  return (
    <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
      <FlashBanner flash={flash} onClose={() => setFlash(null)} />

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Approvals</div>
          <h1 className="mt-2 text-3xl font-black text-on-surface">Production Approval Desk</h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Review submissions from inspection, press, SRS, and slit lines with the same backend rules as the original Freya Admin workflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab !== "recycleBin" ? (
            <LiquidSegmentedControl items={APPROVAL_VIEW_MODES} activeKey={viewMode} onChange={(next) => setViewMode(next)} />
          ) : null}
          <button
            type="button"
            onClick={() => setRefreshNonce((current) => current + 1)}
            className="flex h-11 items-center gap-2 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-full overflow-x-auto scrollbar-hide">
          <LiquidSegmentedControl items={tableTabs} activeKey={activeTab} onChange={handleTabChange} className="min-w-max" />
        </div>

        {activeTab !== "recycleBin" ? (
          <LiquidSegmentedControl
            items={APPROVAL_RANGE_MODES}
            activeKey={rangeMode}
            onChange={(next) => {
              setPage(1);
              setRangeMode(next);
              if (next === "all") {
                setFilters((current) => ({ ...current, date: "" }));
              } else {
                setFilters((current) => ({ ...current, date: current.date || today }));
              }
            }}
          />
        ) : null}
      </div>

      {activeTab !== "recycleBin" ? (
        <ApprovalsStatsStrip stats={stats} authUser={authUser} activeKey={activeStatsKey} onSelect={handleStatSelect} />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="glass-card rounded-3xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Recycle Bin</div>
            <div className="planner-data-text mt-2 text-3xl font-black text-on-surface tabular-nums">{binRows.length.toLocaleString()}</div>
            <p className="mt-1 text-xs text-on-surface-variant">Soft-deleted approval records</p>
          </div>
          <div className="glass-card rounded-3xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Restorable</div>
            <div className="planner-data-text mt-2 text-3xl font-black text-on-surface tabular-nums">
              {binRows.length.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">Available for restore using original collection metadata</p>
          </div>
          <div className="glass-card rounded-3xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Role</div>
            <div className="planner-data-text mt-2 text-lg font-black text-on-surface">{authUser?.role || "Unknown"}</div>
            <p className="mt-1 text-xs text-on-surface-variant">Recycle bin tools follow original role restrictions</p>
          </div>
        </div>
      )}

      <div className="glass-card mb-6 rounded-[28px] p-5">
        {activeTab === "recycleBin" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Search Recycle Bin</label>
              <input
                type="text"
                value={binSearchInput}
                onChange={(event) => {
                  setPage(1);
                  setBinSearchInput(event.target.value);
                }}
                placeholder="Factory, part no., serial no., deleted by, reason..."
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setBinSearchInput("");
                }}
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
              >
                Clear Search
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[180px_180px_180px_minmax(0,1fr)_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Factory</label>
              <select
                value={filters.factory}
                onChange={(event) => setFilterPatch({ factory: event.target.value })}
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                <option value="">All Factories</option>
                {factories.map((factory) => (
                  <option key={factory} value={factory}>{factory}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Status</label>
              <select
                value={filters.status}
                onChange={(event) => setFilterPatch({ status: event.target.value })}
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              >
                {APPROVAL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(event) => setFilterPatch({ date: event.target.value })}
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Search</label>
              <input
                type="text"
                value={searchInput}
                onChange={(event) => {
                  setPage(1);
                  setSearchInput(event.target.value);
                }}
                placeholder="Part no., serial no., worker..."
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearLiveFilters}
                className="h-11 rounded-2xl border border-outline-variant/20 bg-white px-4 text-sm font-bold text-on-surface transition hover:bg-surface-container dark:bg-surface-container"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {activeTab !== "recycleBin" && viewMode === "batch" ? (
        <div className="glass-card mb-6 rounded-[28px] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Batch Mode</div>
              <p className="mt-1 text-sm text-on-surface-variant">
                Select actionable rows on the current page and run the same approval or correction workflow in one pass.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectVisibleRows}
                disabled={actionBusy || !liveRows.some((record) => isBatchSelectable(record, authUser))}
                className="rounded-2xl border border-outline-variant/20 bg-white px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-container"
              >
                Select Visible
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                disabled={actionBusy || !batchSelectedCount}
                className="rounded-2xl border border-outline-variant/20 bg-white px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-container"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={handleBatchApprove}
                disabled={actionBusy || !batchSelectedCount}
                className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve Selected ({batchSelectedCount})
              </button>
              <button
                type="button"
                onClick={handleBatchCorrection}
                disabled={actionBusy || !batchSelectedCount}
                className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Request Correction ({batchSelectedCount})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DataTable
        columns={dataTableColumns}
        rows={dataTableRows}
        loading={loading}
        error={error}
        sort={sort}
        page={currentPage}
        pageSize={pageSize}
        filteredCount={dataTableTotalRecords}
        totalPages={dataTableTotalPages}
        onSort={handleSortChange}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextSize) => {
          setPage(1);
          setPageSize(nextSize);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        rowKey={(row) => getApprovalRecordId(row)}
        onRowClick={(row) => openDetail(row, activeTab === "recycleBin" ? "recycle" : "live")}
        getRowClassName={(row) => {
          const recordId = getApprovalRecordId(row);
          const selected = selectedIds.includes(recordId);

          if (activeTab === "recycleBin") {
            return selected ? "bg-primary/5" : "bg-error/5";
          }

          const mismatch = getApprovalDateTimeMismatch(row);

          return joinClasses(
            getApprovalStatusMeta(row).rowClassName,
            mismatch.dateMismatch ? "bg-error/5 shadow-[inset_4px_0_0_rgba(239,68,68,0.65)]" : "",
            selected ? "bg-primary/5" : ""
          );
        }}
        renderPageInfo={({ filteredCount, page: current, pageSize: currentPageSize }) => {
          if (!filteredCount) return <span>0 records shown</span>;
          const start = (current - 1) * currentPageSize + 1;
          const end = Math.min(current * currentPageSize, filteredCount);
          const totalPages = activeTab === "recycleBin" ? binTotalPages : (pagination.totalPages || 1);
          return <span>{filteredCount.toLocaleString()} records, showing {start}-{end} · page {current}/{totalPages}</span>;
        }}
        loadingMessage={activeTab === "recycleBin" ? "Loading recycle bin…" : "Loading approvals…"}
        errorTitle={activeTab === "recycleBin" ? "Could not load recycle bin" : "Could not load approvals"}
        emptyTitle={activeTab === "recycleBin" ? "Recycle bin is empty" : "No matching approvals"}
        emptyMessage={activeTab === "recycleBin" ? "No deleted approval records matched the current search." : "Adjust the filters and try again."}
        enableColumnResize
        enableColumnReorder
        stickyHeader
        stickyHeaderOffset={0}
        stickyHeaderCellClassName="bg-surface-container-high shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]"
        layoutStorageKey={activeTab === "recycleBin" ? "approvals_bin_table" : `approvals_${activeTab}_${viewMode}`}
        className="glass-card mb-8 overflow-hidden rounded-[28px]"
        topBarClassName="flex flex-col gap-4 border-b border-outline-variant/20 px-5 py-4 md:flex-row md:items-center md:justify-between"
        bottomBarClassName="flex flex-col gap-4 border-t border-outline-variant/20 px-5 py-4 md:flex-row md:items-center md:justify-between"
        tableClassName="ui-table-data w-full border-separate border-spacing-0"
        tableViewportClassName="max-h-[68vh] overflow-auto"
      />

      <ApprovalsDetailModal
        open={detailState.open}
        record={detailState.record}
        tabKey={detailState.mode === "recycle" ? detailState.record?.originalCollection || activeTab : activeTab}
        authUser={authUser}
        busy={actionBusy}
        mode={detailState.mode}
        onClose={() => setDetailState({ open: false, record: null, mode: "live" })}
        onApprove={handleApprove}
        onRequestCorrection={handleRequestCorrection}
        onRequestDeletion={handleRequestDelete}
        onSoftDelete={handleSoftDelete}
        onApproveDeleteRequest={handleApproveDeleteRequest}
        onRejectDeleteRequest={handleRejectDeleteRequest}
        onCancelDeleteRequest={handleCancelDeleteRequest}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
      />
    </section>
  );
}