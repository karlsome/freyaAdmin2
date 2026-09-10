import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import NodaModalFrame from "./NodaModalFrame";
import DataTable from "../DataTable";
import EmptyState from "../EmptyState";
import StatusChip from "../StatusChip";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  addItemsToNodaRequest,
  batchUpdateNodaLineItemStatus,
  checkNodaInventory,
  deleteNodaLineItem,
  deleteNodaRequest,
  fetchNodaRequest,
  fetchNodaUserFullName,
  lookupNodaMasterData,
  updateNodaLineItemQuantity,
  updateNodaLineItemStatus,
  updateNodaRequest,
} from "../../services/nodaApi";
import {
  canManageNodaRequests,
  formatNodaDate,
  formatNodaDateTime,
  formatNodaTime,
  getNodaStatusMeta,
  joinNodaClasses,
  normalizeQuotedCsvValue,
  resolveNodaDisplayStatus,
} from "../../utils/noda";

function parseCsvAdditions(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeQuotedCsvValue,
    transform: normalizeQuotedCsvValue,
  });

  const headers = parsed.meta.fields || [];
  const serialHeader = headers.find((header) => header === "背番号");
  const partHeader = headers.find((header) => header === "品番");
  const quantityHeader = headers.find((header) => header === "収容数" || header === "納入指示数" || header === "数量");

  if (!quantityHeader || (!serialHeader && !partHeader)) {
    throw new Error("CSV must contain 背番号 or 品番 plus a quantity column.");
  }

  return parsed.data.reduce((items, row) => {
    const quantity = Number.parseInt(normalizeQuotedCsvValue(row?.[quantityHeader]), 10) || 0;
    const serialNumber = serialHeader ? normalizeQuotedCsvValue(row?.[serialHeader]) : "";
    const partNumber = partHeader ? normalizeQuotedCsvValue(row?.[partHeader]) : "";

    if (!quantity || (!serialNumber && !partNumber)) {
      return items;
    }

    items.push({ 背番号: serialNumber, 品番: partNumber, quantity });
    return items;
  }, []);
}

function readCsvWithShiftJisFallback(file) {
  return file.text().then((text) => {
    if (!text.includes("")) {
      return text;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read CSV file."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsText(file, "Shift_JIS");
    });
  });
}

function StatusBadge({ request, language }) {
  const meta = getNodaStatusMeta(resolveNodaDisplayStatus(request), language);
  return <StatusChip icon={meta.icon} label={meta.label} className={meta.badgeClassName} />;
}

function InventoryBadge({ lineItem, isJa }) {
  if (lineItem.inventoryStatus === "none") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>cancel</span>
        {isJa ? "待機中" : "Waiting"}
      </span>
    );
  }

  if (lineItem.inventoryStatus === "insufficient") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
        {isJa ? "一部引当" : "Partial"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
      {isJa ? "引当完了" : "OK"}
    </span>
  );
}

function sortNodaLineItems(items = [], sort = {}) {
  const column = String(sort?.column ?? "").trim();
  const direction = Number(sort?.direction) === -1 ? -1 : 1;
  if (!column) return items;

  const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

  return [...items].sort((left, right) => {
    let leftValue;
    let rightValue;

    switch (column) {
      case "lineNumber":
        leftValue = Number(left?.lineNumber) || 0;
        rightValue = Number(right?.lineNumber) || 0;
        break;
      case "quantity":
        leftValue = Number(left?.quantity) || 0;
        rightValue = Number(right?.quantity) || 0;
        break;
      case "reservedQuantity":
        leftValue = Number(left?.reservedQuantity ?? left?.quantity) || 0;
        rightValue = Number(right?.reservedQuantity ?? right?.quantity) || 0;
        break;
      case "shortfallQuantity":
        leftValue = Number(left?.shortfallQuantity) || 0;
        rightValue = Number(right?.shortfallQuantity) || 0;
        break;
      default:
        leftValue = String(left?.[column] ?? "");
        rightValue = String(right?.[column] ?? "");
        break;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return collator.compare(String(leftValue), String(rightValue)) * direction;
  });
}

export default function NodaDetailModal({ open, requestId, mode = "view", authUser, onClose, onSubmitted }) {
  const { language, t } = useLanguage();
  const isJa = language === "ja";
  const canManageRequest = canManageNodaRequests(authUser);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState(mode);
  const [bulkTab, setBulkTab] = useState("existing");
  const [singleForm, setSingleForm] = useState({ status: "", 品番: "", 背番号: "", date: "", quantity: "" });
  const [pickupDate, setPickupDate] = useState("");
  const [lineQuantities, setLineQuantities] = useState({});
  const [lineItemSort, setLineItemSort] = useState({ column: "", direction: 1 });
  const [selectedLineNumbers, setSelectedLineNumbers] = useState([]);
  const [addForm, setAddForm] = useState({ partNumber: "", backNumber: "", quantity: "" });
  const [addCart, setAddCart] = useState([]);
  const [inventoryPreview, setInventoryPreview] = useState(null);

  const isBulkRequest = request?.requestType === "bulk";
  const canEditBulkItems = canManageRequest && viewMode === "edit" && isBulkRequest && request?.status === "pending";
  const bulkLineItems = useMemo(() => (isBulkRequest ? request?.lineItems || [] : []), [isBulkRequest, request]);
  const eligibleLineItems = useMemo(
    () => bulkLineItems.filter((item) => item.status !== "completed" && item.status !== "in-progress"),
    [bulkLineItems]
  );
  const eligibleLineNumbers = useMemo(
    () => eligibleLineItems.map((item) => item.lineNumber),
    [eligibleLineItems]
  );

  const loadRequest = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    setError("");

    try {
      const nextRequest = await fetchNodaRequest(requestId);
      setRequest(nextRequest);
      setSingleForm({
        status: nextRequest?.status || "pending",
        品番: nextRequest?.品番 || "",
        背番号: nextRequest?.背番号 || "",
        date: nextRequest?.date || "",
        quantity: String(nextRequest?.quantity || ""),
      });
      setPickupDate(nextRequest?.pickupDate || nextRequest?.date || "");
      setLineQuantities(
        Object.fromEntries((nextRequest?.lineItems || []).map((lineItem) => [lineItem.lineNumber, String(lineItem.quantity || "")]))
      );
      setSelectedLineNumbers([]);
      setAddForm({ partNumber: "", backNumber: "", quantity: "" });
      setAddCart([]);
      setInventoryPreview(null);
    } catch (loadError) {
      setRequest(null);
      setError(loadError.message || (isJa ? "リクエスト詳細の読み込みに失敗しました。" : "Failed to load the request details."));
    } finally {
      setLoading(false);
    }
  }, [requestId, isJa]);

  useEffect(() => {
    if (!open) return;
    setViewMode(canManageRequest ? mode : "view");
    setBulkTab("existing");
    setLineItemSort({ column: "", direction: 1 });
    setSelectedLineNumbers([]);
    void loadRequest();
  }, [canManageRequest, loadRequest, mode, open]);

  useEffect(() => {
    if (!open || !addForm.backNumber.trim()) {
      setInventoryPreview(null);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await checkNodaInventory(addForm.backNumber.trim());
        if (cancelled) return;
        if (!result?.success || !result.inventory) {
          setInventoryPreview({ exists: false, message: isJa ? "在庫に対象品目が見つかりません。" : "Item not found in inventory." });
          return;
        }
        const available = result.inventory.availableQuantity || 0;
        const requested = Number.parseInt(addForm.quantity, 10) || 0;
        setInventoryPreview({
          exists: true,
          available,
          reserved: Math.min(available, requested || available),
          shortfall: Math.max(0, requested - available),
        });
      } catch (loadError) {
        if (!cancelled) {
          setInventoryPreview({ exists: false, message: loadError.message || (isJa ? "在庫を確認できませんでした。" : "Could not check inventory.") });
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [addForm.backNumber, addForm.quantity, open, isJa]);

  const summaryItems = useMemo(() => {
    if (!request) return [];
    return isBulkRequest ? request.lineItems || [] : [request];
  }, [isBulkRequest, request]);
  const sortedSummaryItems = useMemo(
    () => sortNodaLineItems(summaryItems, lineItemSort),
    [lineItemSort, summaryItems]
  );

  function handleLineItemSort(column) {
    setLineItemSort((current) => {
      if (current.column === column) {
        return { column, direction: current.direction === 1 ? -1 : 1 };
      }

      return { column, direction: 1 };
    });
  }

  const isAllEligibleSelected =
    eligibleLineNumbers.length > 0 &&
    eligibleLineNumbers.every((num) => selectedLineNumbers.includes(num));
  const isSomeEligibleSelected =
    eligibleLineNumbers.some((num) => selectedLineNumbers.includes(num)) &&
    !isAllEligibleSelected;

  const selectColumn = canManageRequest && viewMode === "edit" && isBulkRequest ? [{
    key: "select",
    label: (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={isAllEligibleSelected}
          ref={(el) => {
            if (el) {
              el.indeterminate = isSomeEligibleSelected;
            }
          }}
          onChange={(event) => {
            if (eligibleLineNumbers.length === 0) {
              alert(t("noEligibleLinesToComplete") || (isJa ? "完了可能な保留中/一時停止アイテムがありません。" : "No eligible pending/paused items to complete."));
              return;
            }
            if (event.target.checked) {
              setSelectedLineNumbers(eligibleLineNumbers);
            } else {
              setSelectedLineNumbers([]);
            }
          }}
          className="h-4 w-4 rounded border-2 border-slate-400 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer accent-[var(--freya-blue)]"
          title={isJa ? "すべての対象アイテムを選択" : "Select all eligible items"}
        />
      </div>
    ),
    width: 44,
    sortable: false,
    reorderable: false,
    align: "center",
    renderCell: (lineItem) => {
      const isEligible = lineItem.status !== "completed" && lineItem.status !== "in-progress";
      const isChecked = selectedLineNumbers.includes(lineItem.lineNumber);

      return (
        <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={isChecked}
            disabled={!isEligible}
            onChange={(event) => {
              setSelectedLineNumbers((prev) =>
                event.target.checked
                  ? [...prev, lineItem.lineNumber]
                  : prev.filter((num) => num !== lineItem.lineNumber)
              );
            }}
            className="h-4 w-4 rounded border-2 border-slate-400 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:border-slate-300 disabled:opacity-50 accent-[var(--freya-blue)]"
          />
        </div>
      );
    },
    disableCellWrapper: true,
  }] : [];

  const lineItemColumns = [
    ...selectColumn,
    {
      key: "lineNumber",
      label: isJa ? "行" : "Line #",
      width: 75,
      minWidth: 75,
      noTruncate: true,
      renderCell: (lineItem) => <span className="font-mono font-medium text-[var(--text-primary)]">{lineItem.lineNumber}</span>,
      disableCellWrapper: true,
    },
    {
      key: "品番",
      label: isJa ? "品番" : "Part Number",
      width: 170,
      minWidth: 170,
      noTruncate: true,
      renderCell: (lineItem) => <span className="font-mono font-semibold text-[var(--text-primary)]">{lineItem.品番 || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "背番号",
      label: isJa ? "背番号" : "Back #",
      width: 100,
      minWidth: 100,
      noTruncate: true,
      renderCell: (lineItem) => <span className="font-medium text-[var(--text-primary)]">{lineItem.背番号 || "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "箱数",
      label: isJa ? "出荷箱数" : "Shipped Boxes",
      width: 125,
      minWidth: 125,
      noTruncate: true,
      renderCell: (lineItem) => <span className="font-mono text-[var(--text-primary)]">{lineItem.箱数 ?? "—"}</span>,
      disableCellWrapper: true,
    },
    {
      key: "箱数足りない",
      label: isJa ? "不足箱数" : "Shortage Boxes",
      width: 125,
      minWidth: 125,
      noTruncate: true,
      renderCell: (lineItem) => (
        <span className={lineItem["箱数足りない"] > 0 ? "font-mono font-semibold text-error" : "font-mono text-[var(--text-muted)]"}>
          {lineItem["箱数足りない"] ?? "0"}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "quantity",
      label: isJa ? "数量" : "Quantity",
      width: 140,
      minWidth: 140,
      noTruncate: true,
      renderCell: (lineItem) => (
        canManageRequest && viewMode === "edit" ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              value={lineQuantities[lineItem.lineNumber] ?? lineItem.quantity}
              onChange={(event) => setLineQuantities((current) => ({
                ...current,
                [lineItem.lineNumber]: event.target.value,
              }))}
              className="h-8 w-20 rounded-md border border-[var(--border)] bg-white px-2 text-sm font-mono text-[var(--text-primary)] outline-none transition focus:border-primary/40 dark:bg-surface-container"
            />
            <button
              type="button"
              onClick={() => handleSaveLineQuantity(lineItem)}
              disabled={busy}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {isJa ? "保存" : "Save"}
            </button>
          </div>
        ) : (
          <span className="font-mono font-medium text-[var(--text-primary)]">{lineItem.quantity}</span>
        )
      ),
      disableCellWrapper: true,
    },
    {
      key: "reservedQuantity",
      label: isJa ? "即時引当" : "Reserved",
      width: 105,
      minWidth: 105,
      noTruncate: true,
      renderCell: (lineItem) => <span className="font-mono text-[var(--text-primary)]">{lineItem.reservedQuantity ?? lineItem.quantity}</span>,
      disableCellWrapper: true,
    },
    {
      key: "shortfallQuantity",
      label: isJa ? "不足分" : "Shortfall",
      width: 105,
      minWidth: 105,
      noTruncate: true,
      renderCell: (lineItem) => (
        <span className={Number(lineItem.shortfallQuantity) > 0 ? "font-mono font-semibold text-error" : "font-mono text-[var(--text-muted)]"}>
          {lineItem.shortfallQuantity ?? 0}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "inventoryStatus",
      label: isJa ? "在庫状況" : "Inventory",
      width: 120,
      minWidth: 120,
      noTruncate: true,
      renderCell: (lineItem) => <InventoryBadge lineItem={lineItem} isJa={isJa} />,
      disableCellWrapper: true,
    },
    {
      key: "status",
      label: isJa ? "ステータス" : "Status",
      width: 140,
      minWidth: 140,
      noTruncate: true,
      renderCell: (lineItem) => {
        const lineMeta = getNodaStatusMeta(lineItem.status, language);

        return canManageRequest && viewMode === "edit" ? (
          <select
            value={lineItem.status}
            onChange={(event) => handleUpdateLineStatus(lineItem, event.target.value)}
            disabled={busy}
            className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs font-medium text-[var(--text-primary)] outline-none transition focus:border-primary/40 dark:bg-surface-container"
          >
            <option value="pending">{isJa ? "保留中" : "Pending"}</option>
            <option value="in-progress">{isJa ? "進行中" : "In Progress"}</option>
            <option value="completed" disabled={lineItem.status === "in-progress"}>{isJa ? "完了" : "Completed"}</option>
          </select>
        ) : (
          <span className={joinNodaClasses("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", lineMeta.badgeClassName)}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{lineMeta.icon}</span>
            {lineMeta.label}
          </span>
        );
      },
      disableCellWrapper: true,
    },
    ...(canManageRequest && viewMode === "edit" ? [{
      key: "actions",
      label: isJa ? "操作" : "Actions",
      sortable: false,
      width: 120,
      minWidth: 120,
      noTruncate: true,
      align: "right",
      renderCell: (lineItem) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => handleUpdateLineStatus(lineItem, "completed")}
            disabled={busy || lineItem.status === "completed" || lineItem.status === "in-progress"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-30 dark:text-emerald-400"
            title={isJa ? "完了にする" : "Mark completed"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
          </button>
          <button
            type="button"
            onClick={() => handleDeleteLineItem(lineItem)}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-500/10 disabled:opacity-30 dark:text-red-400"
            title={isJa ? "行を削除" : "Delete line"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          </button>
        </div>
      ),
      disableCellWrapper: true,
    }] : []),
  ];

  async function resolveActorName() {
    if (!authUser?.username) {
      return "Unknown User";
    }
    return fetchNodaUserFullName(authUser.username);
  }

  async function handleSaveSingleRequest() {
    if (!request?._id) return;

    setBusy(true);
    setError("");

    try {
      await updateNodaRequest(request._id, {
        status: singleForm.status,
        品番: singleForm.品番.trim(),
        背番号: singleForm.背番号.trim(),
        date: singleForm.date,
        quantity: Number.parseInt(singleForm.quantity, 10) || 0,
      });
      await loadRequest();
      setViewMode("view");
      onSubmitted?.({ type: "success", message: `Updated ${request.requestNumber}.` });
    } catch (saveError) {
      setError(saveError.message || "Failed to save the request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePickupDate() {
    if (!request?._id || !pickupDate) return;

    setBusy(true);
    setError("");

    try {
      await updateNodaRequest(request._id, { pickupDate });
      await loadRequest();
      onSubmitted?.({ type: "success", message: `Updated pickup date for ${request.requestNumber}.` });
    } catch (saveError) {
      setError(saveError.message || "Failed to update pickup date.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateLineStatus(lineItem, nextStatus) {
    if (!request?._id) return;

    setBusy(true);
    setError("");

    try {
      await updateNodaLineItemStatus(request._id, lineItem.lineNumber, nextStatus);
      await loadRequest();
      onSubmitted?.({ type: "success", message: `Updated line ${lineItem.lineNumber} on ${request.requestNumber}.` });
    } catch (saveError) {
      setError(saveError.message || "Failed to update line status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLineQuantity(lineItem) {
    if (!request?._id) return;
    const newQuantity = Number.parseInt(lineQuantities[lineItem.lineNumber], 10) || 0;
    if (newQuantity <= 0) {
      setError(isJa ? "明細行の数量は0より大きい必要があります。" : "Line item quantity must be greater than zero.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      await updateNodaLineItemQuantity(request._id, {
        lineNumber: lineItem.lineNumber,
        newQuantity,
        originalQuantity: lineItem.quantity,
        背番号: lineItem.背番号,
      }, actorName);
      await loadRequest();
      onSubmitted?.({
        type: "success",
        message: isJa ? `行 ${lineItem.lineNumber} の数量を更新しました。` : `Updated quantity for line ${lineItem.lineNumber}.`,
      });
    } catch (saveError) {
      setError(saveError.message || (isJa ? "数量の更新に失敗しました。" : "Failed to update line quantity."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLineItem(lineItem) {
    if (!request?._id) return;

    const confirmed = window.confirm(
      isJa
        ? `${request.requestNumber} から行 ${lineItem.lineNumber} (${lineItem.背番号}) を削除しますか？`
        : `Delete line ${lineItem.lineNumber} (${lineItem.背番号}) from ${request.requestNumber}?`
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      await deleteNodaLineItem(request._id, {
        lineNumber: lineItem.lineNumber,
        背番号: lineItem.背番号,
        quantity: lineItem.quantity,
      }, actorName);
      await loadRequest();
      onSubmitted?.({
        type: "success",
        message: isJa ? `${request.requestNumber} から行 ${lineItem.lineNumber} を削除しました。` : `Deleted line ${lineItem.lineNumber} from ${request.requestNumber}.`,
      });
    } catch (deleteError) {
      setError(deleteError.message || (isJa ? "明細行の削除に失敗しました。" : "Failed to delete line item."));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkSelectedComplete() {
    if (!request?._id || selectedLineNumbers.length === 0) {
      alert(t("noLinesSelected") || (isJa ? "完了するアイテムを少なくとも1つ選択してください。" : "Please select at least one item to complete."));
      return;
    }

    const count = selectedLineNumbers.length;
    const confirmTemplate = t("alertMarkSelectedLinesCompleted") ||
      (isJa
        ? "選択した{count}件のアイテムを完了済みにしますか？これらの在庫が引き落とされます。"
        : "Are you sure you want to mark {count} selected items as completed? This will deduct inventory for each item.");
    const confirmMsg = confirmTemplate.replace("{count}", count);

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      const result = await batchUpdateNodaLineItemStatus(
        request._id,
        { lineNumbers: selectedLineNumbers, status: "completed" },
        actorName
      );

      setSelectedLineNumbers([]);
      await loadRequest();
      onSubmitted?.({
        type: "success",
        message: isJa
          ? `${result?.updatedCount || count} 件の明細を完了済みにしました。`
          : `Successfully marked ${result?.updatedCount || count} item(s) as completed.`,
      });
    } catch (saveError) {
      setError(saveError.message || (isJa ? "選択項目の完了に失敗しました。" : "Failed to complete selected items."));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAllPendingComplete() {
    if (!request?._id) return;
    const count = eligibleLineNumbers.length;
    if (count === 0) {
      alert(t("noEligibleLinesToComplete") || (isJa ? "完了可能な保留中/一時停止アイテムがありません。" : "No eligible pending/paused items to complete."));
      return;
    }

    const confirmTemplate = t("alertMarkAllLinesCompleted") ||
      (isJa
        ? "対象の{count}件のアイテムをすべて完了済みにしますか？すべての在庫が引き落とされます。"
        : "Are you sure you want to mark all {count} eligible items as completed? This will deduct inventory for each item.");
    const confirmMsg = confirmTemplate.replace("{count}", count);

    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      const result = await batchUpdateNodaLineItemStatus(
        request._id,
        { lineNumbers: "all", status: "completed" },
        actorName
      );

      setSelectedLineNumbers([]);
      await loadRequest();
      onSubmitted?.({
        type: "success",
        message: isJa
          ? `${result?.updatedCount || count} 件の明細を完了済みにしました。`
          : `Successfully marked ${result?.updatedCount || count} item(s) as completed.`,
      });
    } catch (saveError) {
      setError(saveError.message || (isJa ? "保留中項目の完了に失敗しました。" : "Failed to complete all pending items."));
    } finally {
      setBusy(false);
    }
  }

  function handleExportLineItems() {
    if (!request || !summaryItems.length) return;
    const matrix = [
      ["Line Number", "Part Number (品番)", "Serial Number (背番号)", "Quantity", "Reserved", "Shortfall", "Status"],
      ...summaryItems.map((item) => [
        item.lineNumber ?? "",
        item.品番 ?? "",
        item.背番号 ?? "",
        item.quantity ?? "",
        item.reservedQuantity ?? item.quantity ?? "",
        item.shortfallQuantity ?? 0,
        item.status ?? "",
      ]),
    ];
    const csvContent = "\uFEFF" + matrix.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `noda_${request.requestNumber || "detail"}_lines.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleDeleteRequest() {
    if (!request?._id) return;

    const confirmed = window.confirm(
      isJa
        ? `${request.requestNumber} を削除しますか？この操作は取り消せません。`
        : `Delete ${request.requestNumber}? This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      await deleteNodaRequest(request._id, actorName);
      onSubmitted?.({
        type: "success",
        message: isJa ? `${request.requestNumber} を削除しました。` : `Deleted ${request.requestNumber}.`,
      });
      onClose?.();
    } catch (deleteError) {
      setError(deleteError.message || (isJa ? "リクエストの削除に失敗しました。" : "Failed to delete the request."));
    } finally {
      setBusy(false);
    }
  }

  async function handlePartNumberBlur() {
    const partNumber = addForm.partNumber.trim();
    if (!partNumber || addForm.backNumber.trim()) return;

    try {
      const result = await lookupNodaMasterData({ 品番: partNumber });
      if (result?.success && result.data?.背番号) {
        setAddForm((current) => ({
          ...current,
          partNumber: current.partNumber.trim() || result.data.品番,
          backNumber: current.backNumber.trim() || result.data.背番号,
        }));
      }
    } catch {
      // Ignore convenience lookup failures.
    }
  }

  async function handleBackNumberBlur() {
    const backNumber = addForm.backNumber.trim();
    if (!backNumber || addForm.partNumber.trim()) return;

    try {
      const result = await lookupNodaMasterData({ 背番号: backNumber });
      if (result?.success && result.data?.品番) {
        setAddForm((current) => ({
          ...current,
          partNumber: current.partNumber.trim() || result.data.品番,
          backNumber: current.backNumber.trim() || result.data.背番号,
        }));
      }
    } catch {
      // Ignore convenience lookup failures.
    }
  }

  function handleAddToEditCart(item) {
    setAddCart((current) => {
      const existingIndex = current.findIndex((entry) => entry.背番号 === item.背番号);
      if (existingIndex === -1) {
        return [...current, item];
      }

      const nextCart = [...current];
      nextCart[existingIndex] = item;
      return nextCart;
    });
  }

  async function handleAddSingleItem() {
    const partNumber = addForm.partNumber.trim();
    const backNumber = addForm.backNumber.trim();
    const quantity = Number.parseInt(addForm.quantity, 10) || 0;

    if (!partNumber || !backNumber || quantity <= 0) {
      setError(isJa ? "品番、背番号、数量は必須です。" : "Part number, serial number, and quantity are required.");
      return;
    }

    handleAddToEditCart({ 品番: partNumber, 背番号: backNumber, quantity });
    setAddForm({ partNumber: "", backNumber: "", quantity: "" });
    setInventoryPreview(null);
    setError("");
  }

  async function handleCsvAddition(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError("");

    try {
      const csvText = await readCsvWithShiftJisFallback(file);
      const rows = parseCsvAdditions(csvText);

      for (const row of rows) {
        let item = { ...row };

        if (!item.背番号 && item.品番) {
          const lookup = await lookupNodaMasterData({ 品番: item.品番 });
          if (lookup?.success && lookup.data?.背番号) {
            item = { ...item, 背番号: lookup.data.背番号, 品番: lookup.data.品番 };
          }
        }

        if (!item.品番 && item.背番号) {
          const lookup = await lookupNodaMasterData({ 背番号: item.背番号 });
          if (lookup?.success && lookup.data?.品番) {
            item = { ...item, 背番号: lookup.data.背番号, 品番: lookup.data.品番 };
          }
        }

        if (item.背番号 && item.品番 && item.quantity > 0) {
          handleAddToEditCart(item);
        }
      }
    } catch (loadError) {
      setError(loadError.message || (isJa ? "CSVからの追加品目インポートに失敗しました。" : "Failed to import additional items from CSV."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitAddedItems() {
    if (!request?._id || !addCart.length) {
      setError(isJa ? "送信する前に追加する品目を最低1つ追加してください。" : "Add at least one new item before submitting.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      await addItemsToNodaRequest(request._id, addCart, actorName);
      setAddCart([]);
      await loadRequest();
      setBulkTab("existing");
      onSubmitted?.({
        type: "success",
        message: isJa
          ? `${request.requestNumber} に ${addCart.length} 件の品目を追加しました。`
          : `Added ${addCart.length} item${addCart.length === 1 ? "" : "s"} to ${request.requestNumber}.`,
      });
    } catch (saveError) {
      setError(saveError.message || (isJa ? "リクエストへの品目追加に失敗しました。" : "Failed to add items to the request."));
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      <div>
        {canManageRequest && viewMode === "edit" ? (
          <button
            type="button"
            onClick={handleDeleteRequest}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
            <span>{isJa ? "リクエストを削除" : "Delete Request"}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-mono font-medium text-[var(--text-muted)]">
              {loading ? (isJa ? "読込中…" : "Loading…") : request ? request.requestNumber : ""}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {canManageRequest && viewMode === "view" ? (
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--freya-blue,#2563eb)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            <span>{isJa ? "リクエストを編集" : "Edit Request"}</span>
          </button>
        ) : null}
        {viewMode === "edit" ? (
          <button
            type="button"
            onClick={() => setViewMode("view")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>done</span>
            <span>{isJa ? "編集完了" : "Finish Editing"}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          {isJa ? "閉じる" : "Close"}
        </button>
      </div>
    </div>
  );

  return (
    <NodaModalFrame
      open={open}
      onClose={onClose}
      eyebrow={isJa ? "野田リクエスト" : "Noda Request"}
      icon="description"
      showIcon={false}
      title={request?.requestNumber || (isJa ? "野田リクエスト" : "Noda Request")}
      subtitle={request ? (isJa ? `${isBulkRequest ? "一括" : "個別"}リクエスト詳細` : `${isBulkRequest ? "Bulk" : "Single"} request details`) : (isJa ? "リクエスト詳細を読込中…" : "Loading request details")}
      footer={footer}
      maxWidthClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-separator/40 bg-surface-container-low/35 px-6 py-12 text-center text-sm text-on-surface-variant">
            {isJa ? "リクエスト詳細を読込中…" : "Loading request details…"}
          </div>
        ) : null}

        {!loading && request ? (
          <>
            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "概要" : "Overview"}</span>
                    <StatusBadge request={request} language={language} />
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {isBulkRequest ? (isJa ? "一括" : "Bulk") : (isJa ? "個別" : "Single")}
                    </span>
                    {viewMode === "edit" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                        {isJa ? "編集中" : "Editing Mode"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {isJa ? `作成日時: ${formatNodaDateTime(request.createdAt)} • 作成者: ${request.createdBy || "不明"}` : `Created ${formatNodaDateTime(request.createdAt)} by ${request.createdBy || "Unknown User"}`}
                  </p>
                  {request.completedAt ? (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {isJa ? `完了日時: ${formatNodaDateTime(request.completedAt)}` : `Completed ${formatNodaDateTime(request.completedAt)}`}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3.5 shadow-sm transition hover:shadow dark:bg-surface-container">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "引取日" : "Pickup Date"}</p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">{formatNodaDate(request.pickupDate || request.date)}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3.5 shadow-sm transition hover:shadow dark:bg-surface-container">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "納入指示日" : "Deadline"}</p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">{formatNodaDate(request.納入指示日)}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3.5 shadow-sm transition hover:shadow dark:bg-surface-container">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "便" : "Delivery Order"}</p>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">{request.便 || "—"}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3.5 shadow-sm transition hover:shadow dark:bg-surface-container">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "納品書番号" : "Delivery Note"}</p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">{request.納品書番号 || "—"}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3.5 shadow-sm transition hover:shadow dark:bg-surface-container">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "完了日" : "Completed Date"}</p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">{formatNodaDate(request.completedAt)}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3.5 shadow-sm transition hover:shadow dark:bg-surface-container">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{isJa ? "完了時刻" : "Completed Time"}</p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-[var(--text-primary)]">{formatNodaTime(request.completedAt)}</p>
                </div>
              </div>
            </div>

            {!isBulkRequest ? (
              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "ステータス" : "Status"}</span>
                    {viewMode === "edit" ? (
                      <select
                        value={singleForm.status}
                        onChange={(event) => setSingleForm((current) => ({ ...current, status: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                      >
                        <option value="pending">{isJa ? "保留中" : "Pending"}</option>
                        <option value="active">{isJa ? "進行中" : "Active"}</option>
                        <option value="complete">{isJa ? "完了" : "Complete"}</option>
                        <option value="failed">{isJa ? "失敗" : "Failed"}</option>
                      </select>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-on-surface">{singleForm.status}</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">品番</span>
                    {viewMode === "edit" ? (
                      <input
                        type="text"
                        value={singleForm.品番}
                        onChange={(event) => setSingleForm((current) => ({ ...current, 品番: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                      />
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-on-surface">{request.品番}</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">背番号</span>
                    {viewMode === "edit" ? (
                      <input
                        type="text"
                        value={singleForm.背番号}
                        onChange={(event) => setSingleForm((current) => ({ ...current, 背番号: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                      />
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-on-surface">{request.背番号}</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "引取日" : "Pickup Date"}</span>
                    {viewMode === "edit" ? (
                      <input
                        type="date"
                        value={singleForm.date}
                        onChange={(event) => setSingleForm((current) => ({ ...current, date: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                      />
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-on-surface">{formatNodaDate(request.date)}</p>
                    )}
                  </label>
                  <label className="block md:col-span-2">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "数量" : "Quantity"}</span>
                    {viewMode === "edit" ? (
                      <input
                        type="number"
                        min="1"
                        value={singleForm.quantity}
                        onChange={(event) => setSingleForm((current) => ({ ...current, quantity: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                      />
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-on-surface">{request.quantity}</p>
                    )}
                  </label>
                </div>

                {canManageRequest && viewMode === "edit" ? (
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveSingleRequest}
                      disabled={busy}
                      className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busy ? (isJa ? "保存中…" : "Saving…") : (isJa ? "変更を保存" : "Save Changes")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                {canManageRequest && viewMode === "edit" ? (
                  <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <label className="block max-w-xs flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "引取日" : "Pickup Date"}</span>
                        <input
                          type="date"
                          value={pickupDate}
                          onChange={(event) => setPickupDate(event.target.value)}
                          className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleSavePickupDate}
                        disabled={busy || !pickupDate}
                        className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-60"
                      >
                        {isJa ? "引取日を保存" : "Save Pickup Date"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {canEditBulkItems ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBulkTab("existing")}
                      className={joinNodaClasses(
                        "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                        bulkTab === "existing"
                          ? "bg-primary text-on-primary"
                          : "border border-separator/40 text-on-surface hover:bg-surface-container"
                      )}
                    >
                      {isJa ? "既存明細" : "Existing Items"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkTab("add")}
                      className={joinNodaClasses(
                        "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                        bulkTab === "add"
                          ? "bg-primary text-on-primary"
                          : "border border-separator/40 text-on-surface hover:bg-surface-container"
                      )}
                    >
                      {isJa ? "品目を追加" : "Add More Items"}
                    </button>
                  </div>
                ) : null}

                {bulkTab === "existing" || !canEditBulkItems ? (
                  <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-semibold text-on-surface">{isJa ? "明細一覧" : "Line Items"}</h4>
                        <span className="text-xs text-on-surface-variant">({summaryItems.length})</span>
                        {canManageRequest && viewMode === "edit" && selectedLineNumbers.length > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {selectedLineNumbers.length} {isJa ? "件選択中" : "selected"}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageRequest && viewMode === "edit" && isBulkRequest ? (
                          <>
                            {selectedLineNumbers.length > 0 ? (
                              <button
                                type="button"
                                id="btnMarkSelectedComplete"
                                onClick={handleMarkSelectedComplete}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/30 dark:text-emerald-300"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                                <span id="btnMarkSelectedCompleteText">
                                  {t("markSelectedComplete") || (isJa ? "選択項目を完了" : "Complete Selected")} ({selectedLineNumbers.length})
                                </span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              id="btnMarkAllPendingComplete"
                              onClick={handleMarkAllPendingComplete}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>done_all</span>
                              <span>
                                {t("markCompleteAll") || (isJa ? "保留中をすべて完了" : "Complete All Pending")}
                              </span>
                            </button>
                          </>
                        ) : null}
                        {summaryItems.length > 0 ? (
                          <button
                            type="button"
                            onClick={handleExportLineItems}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                            title={isJa ? "明細をCSVエクスポート" : "Export line items to CSV"}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                            <span>{isJa ? "CSVエクスポート" : "Export CSV"}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <DataTable
                      columns={lineItemColumns}
                      rows={sortedSummaryItems}
                      sort={lineItemSort}
                      onSort={handleLineItemSort}
                      rowKey={(lineItem) => lineItem.lineNumber}
                      renderPageInfo={null}
                      emptyTitle={isJa ? "明細行がありません" : "No line items"}
                      emptyMessage={isJa ? "このリクエストには明細行が含まれていません。" : "This request does not contain any line items."}
                      enableColumnResize={false}
                      enableColumnReorder={false}
                      stickyHeader
                      stickyHeaderOffset={0}
                      className="overflow-hidden rounded-2xl border border-outline-variant/15"
                      topBarClassName="flex justify-end px-1 pb-4"
                      tableClassName="ui-table-data min-w-full"
                      tableViewportClassName="overflow-x-auto"
                      headClassName="bg-surface-container-high/50 border-b border-outline-variant/15"
                      headerCellClassName="px-4 py-3 text-left whitespace-nowrap"
                      cellClassName="px-4 py-3 align-top"
                      rowClassName="border-b border-outline-variant/10 transition hover:bg-surface-container"
                    />
                  </div>
                ) : null}

                {bulkTab === "add" && canEditBulkItems ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-on-surface">{isJa ? "品目追加" : "Add Items"}</h3>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/40 hover:bg-primary/5">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
                          {isJa ? "CSVインポート" : "Import CSV"}
                          <input type="file" accept=".csv" className="hidden" onChange={handleCsvAddition} disabled={busy} />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <label className="block">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">品番</span>
                          <input
                            type="text"
                            value={addForm.partNumber}
                            onChange={(event) => setAddForm((current) => ({ ...current, partNumber: event.target.value }))}
                            onBlur={handlePartNumberBlur}
                            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">背番号</span>
                          <input
                            type="text"
                            value={addForm.backNumber}
                            onChange={(event) => setAddForm((current) => ({ ...current, backNumber: event.target.value }))}
                            onBlur={handleBackNumberBlur}
                            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "数量" : "Quantity"}</span>
                          <input
                            type="number"
                            min="1"
                            value={addForm.quantity}
                            onChange={(event) => setAddForm((current) => ({ ...current, quantity: event.target.value }))}
                            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                          />
                        </label>
                      </div>

                      <div className="mt-4 rounded-2xl border border-separator/40 bg-surface-container-low/35 px-4 py-3 text-sm text-on-surface-variant">
                        {inventoryPreview?.exists
                          ? (isJa
                              ? `引当可能 ${inventoryPreview.available} • 即時引当 ${inventoryPreview.reserved} • 不足 ${inventoryPreview.shortfall}`
                              : `Available ${inventoryPreview.available} • Reserved now ${inventoryPreview.reserved} • Shortfall ${inventoryPreview.shortfall}`)
                          : inventoryPreview?.message || (isJa ? "背番号を入力すると在庫状況が表示されます。" : "Enter a serial number to preview inventory availability.")}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddSingleItem}
                          className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                        >
                          {isJa ? "追加リストに追加" : "Add To Pending Cart"}
                        </button>
                      </div>
                    </div>

                    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-on-surface">{isJa ? "追加予定品目" : "Items To Add"}</h3>
                        {addCart.length ? (
                          <button
                            type="button"
                            onClick={() => setAddCart([])}
                            className="rounded-2xl border border-separator/40 px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                          >
                            {isJa ? "クリア" : "Clear"}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-3">
                        {addCart.length ? addCart.map((item) => (
                          <div key={item.背番号} className="rounded-2xl border border-separator/40 bg-surface-container-low/35 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-semibold text-on-surface">{item.背番号}</div>
                                <div className="mt-1 text-sm text-on-surface-variant">{item.品番} • {isJa ? "数量" : "Qty"} {item.quantity}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAddCart((current) => current.filter((entry) => entry.背番号 !== item.背番号))}
                                className="flex h-9 w-9 items-center justify-center rounded-2xl text-error transition hover:bg-error/10"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                              </button>
                            </div>
                          </div>
                        )) : (
                          <EmptyState>{isJa ? "追加待ちの品目はありません。" : "No pending additions yet."}</EmptyState>
                        )}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSubmitAddedItems}
                          disabled={busy || !addCart.length}
                          className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          {isJa ? `${addCart.length || ""} 件の品目を追加` : `Add ${addCart.length || ""} Item${addCart.length === 1 ? "" : "s"}`}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </div>
    </NodaModalFrame>
  );
}