import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import NodaModalFrame from "./NodaModalFrame";
import StatusChip from "../StatusChip";
import {
  addItemsToNodaRequest,
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
    if (!text.includes("�")) {
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

function StatusBadge({ request }) {
  const meta = getNodaStatusMeta(resolveNodaDisplayStatus(request));
  return <StatusChip icon={meta.icon} label={meta.label} className={meta.badgeClassName} />;
}

function InventoryBadge({ lineItem }) {
  if (lineItem.inventoryStatus === "none") {
    return <span className="inline-flex rounded-full bg-error/10 px-2.5 py-1 text-xs font-bold text-error">Waiting</span>;
  }

  if (lineItem.inventoryStatus === "insufficient") {
    return <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">Partial</span>;
  }

  return <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">OK</span>;
}

export default function NodaDetailModal({ open, requestId, mode = "view", authUser, onClose, onSubmitted }) {
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
  const [addForm, setAddForm] = useState({ partNumber: "", backNumber: "", quantity: "" });
  const [addCart, setAddCart] = useState([]);
  const [inventoryPreview, setInventoryPreview] = useState(null);

  const isBulkRequest = request?.requestType === "bulk";
  const canEditBulkItems = canManageRequest && viewMode === "edit" && isBulkRequest && request?.status === "pending";

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
      setAddForm({ partNumber: "", backNumber: "", quantity: "" });
      setAddCart([]);
      setInventoryPreview(null);
    } catch (loadError) {
      setRequest(null);
      setError(loadError.message || "Failed to load the request details.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!open) return;
    setViewMode(canManageRequest ? mode : "view");
    setBulkTab("existing");
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
          setInventoryPreview({ exists: false, message: "Item not found in inventory." });
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
          setInventoryPreview({ exists: false, message: loadError.message || "Could not check inventory." });
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [addForm.backNumber, addForm.quantity, open]);

  const summaryItems = useMemo(() => {
    if (!request) return [];
    return isBulkRequest ? request.lineItems || [] : [request];
  }, [isBulkRequest, request]);

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
      setError("Line item quantity must be greater than zero.");
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
      onSubmitted?.({ type: "success", message: `Updated quantity for line ${lineItem.lineNumber}.` });
    } catch (saveError) {
      setError(saveError.message || "Failed to update line quantity.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLineItem(lineItem) {
    if (!request?._id) return;

    const confirmed = window.confirm(`Delete line ${lineItem.lineNumber} (${lineItem.背番号}) from ${request.requestNumber}?`);
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
      onSubmitted?.({ type: "success", message: `Deleted line ${lineItem.lineNumber} from ${request.requestNumber}.` });
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete line item.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRequest() {
    if (!request?._id) return;

    const confirmed = window.confirm(`Delete ${request.requestNumber}? This cannot be undone.`);
    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      const actorName = await resolveActorName();
      await deleteNodaRequest(request._id, actorName);
      onSubmitted?.({ type: "success", message: `Deleted ${request.requestNumber}.` });
      onClose?.();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete the request.");
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
      setError("Part number, serial number, and quantity are required.");
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
      setError(loadError.message || "Failed to import additional items from CSV.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitAddedItems() {
    if (!request?._id || !addCart.length) {
      setError("Add at least one new item before submitting.");
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
      onSubmitted?.({ type: "success", message: `Added ${addCart.length} item${addCart.length === 1 ? "" : "s"} to ${request.requestNumber}.` });
    } catch (saveError) {
      setError(saveError.message || "Failed to add items to the request.");
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-on-surface-variant">
        {loading ? "Loading request…" : request ? request.requestNumber : ""}
      </div>
      <div className="flex flex-wrap gap-3">
        {viewMode === "edit" ? (
          <button
            type="button"
            onClick={() => setViewMode("view")}
            className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Cancel Edit
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-2xl border border-outline-variant/25 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <NodaModalFrame
      open={open}
      onClose={onClose}
      eyebrow="Noda Request"
      icon="description"
      showIcon={false}
      title={request?.requestNumber || "Noda Request"}
      subtitle={request ? `${isBulkRequest ? "Bulk" : "Single"} request details` : "Loading request details"}
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
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/35 px-6 py-12 text-center text-sm text-on-surface-variant">
            Loading request details…
          </div>
        ) : null}

        {!loading && request ? (
          <>
            <div className="glass-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Overview</div>
                    <StatusBadge request={request} />
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      {isBulkRequest ? "Bulk" : "Single"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Created {formatNodaDateTime(request.createdAt)} by {request.createdBy || "Unknown User"}
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Completed {formatNodaDateTime(request.completedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {canManageRequest && viewMode === "view" ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("edit")}
                      className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      Edit Request
                    </button>
                  ) : null}
                  {canManageRequest ? (
                    <button
                      type="button"
                      onClick={handleDeleteRequest}
                      disabled={busy}
                      className="rounded-2xl bg-error px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      Delete Request
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Pickup Date</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{formatNodaDate(request.pickupDate || request.date)}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Deadline</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{formatNodaDate(request.納入指示日)}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Delivery Order</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{request.便 || "—"}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Delivery Note</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{request.納品書番号 || "—"}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Completed Date</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{formatNodaDate(request.completedAt)}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Completed Time</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{formatNodaTime(request.completedAt)}</p>
                </div>
              </div>
            </div>

            {!isBulkRequest ? (
              <div className="glass-card rounded-2xl p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">Status</span>
                    {viewMode === "edit" ? (
                      <select
                        value={singleForm.status}
                        onChange={(event) => setSingleForm((current) => ({ ...current, status: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="complete">Complete</option>
                        <option value="failed">Failed</option>
                      </select>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-on-surface">{request.status}</p>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">品番</span>
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
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">背番号</span>
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
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">Pickup Date</span>
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
                    <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">Quantity</span>
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
                      className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                {canManageRequest && viewMode === "edit" ? (
                  <div className="glass-card rounded-2xl p-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <label className="block max-w-xs flex-1">
                        <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">Pickup Date</span>
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
                        className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        Save Pickup Date
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
                        "rounded-2xl px-4 py-2.5 text-sm font-bold transition",
                        bulkTab === "existing"
                          ? "bg-primary text-white"
                          : "border border-outline-variant/25 text-on-surface hover:bg-surface-container"
                      )}
                    >
                      Existing Items
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkTab("add")}
                      className={joinNodaClasses(
                        "rounded-2xl px-4 py-2.5 text-sm font-bold transition",
                        bulkTab === "add"
                          ? "bg-primary text-white"
                          : "border border-outline-variant/25 text-on-surface hover:bg-surface-container"
                      )}
                    >
                      Add More Items
                    </button>
                  </div>
                ) : null}

                {bulkTab === "existing" || !canEditBulkItems ? (
                  <div className="glass-card rounded-2xl p-5">
                    <div className="overflow-x-auto rounded-2xl border border-outline-variant/15">
                      <table className="min-w-full text-sm">
                        <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                          <tr>
                            <th className="px-4 py-3">Line</th>
                            <th className="px-4 py-3">品番</th>
                            <th className="px-4 py-3">背番号</th>
                            <th className="px-4 py-3">Quantity</th>
                            <th className="px-4 py-3">Reserved</th>
                            <th className="px-4 py-3">Shortfall</th>
                            <th className="px-4 py-3">Inventory</th>
                            <th className="px-4 py-3">Status</th>
                            {viewMode === "edit" ? <th className="px-4 py-3">Actions</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {summaryItems.map((lineItem) => {
                            const lineMeta = getNodaStatusMeta(lineItem.status);
                            return (
                              <tr key={lineItem.lineNumber} className="border-t border-outline-variant/10">
                                <td className="px-4 py-3 text-on-surface">{lineItem.lineNumber}</td>
                                <td className="px-4 py-3 text-on-surface">{lineItem.品番}</td>
                                <td className="px-4 py-3 text-on-surface">{lineItem.背番号}</td>
                                <td className="px-4 py-3">
                                  {canManageRequest && viewMode === "edit" ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="1"
                                        value={lineQuantities[lineItem.lineNumber] ?? lineItem.quantity}
                                        onChange={(event) => setLineQuantities((current) => ({
                                          ...current,
                                          [lineItem.lineNumber]: event.target.value,
                                        }))}
                                        className="h-10 w-24 rounded-2xl border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveLineQuantity(lineItem)}
                                        disabled={busy}
                                        className="rounded-2xl border border-outline-variant/25 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-on-surface">{lineItem.quantity}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-on-surface">{lineItem.reservedQuantity ?? lineItem.quantity}</td>
                                <td className="px-4 py-3 text-on-surface">{lineItem.shortfallQuantity ?? 0}</td>
                                <td className="px-4 py-3"><InventoryBadge lineItem={lineItem} /></td>
                                <td className="px-4 py-3">
                                  {canManageRequest && viewMode === "edit" ? (
                                    <select
                                      value={lineItem.status}
                                      onChange={(event) => handleUpdateLineStatus(lineItem, event.target.value)}
                                      disabled={busy}
                                      className="h-10 rounded-2xl border border-outline-variant/30 bg-white px-3 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="in-progress">In Progress</option>
                                      <option value="completed" disabled={lineItem.status === "in-progress"}>Completed</option>
                                    </select>
                                  ) : (
                                    <span className={joinNodaClasses("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", lineMeta.badgeClassName)}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{lineMeta.icon}</span>
                                      {lineMeta.label}
                                    </span>
                                  )}
                                </td>
                                {canManageRequest && viewMode === "edit" ? (
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateLineStatus(lineItem, "completed")}
                                        disabled={busy || lineItem.status === "completed" || lineItem.status === "in-progress"}
                                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-40 dark:text-emerald-300"
                                        title="Mark completed"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLineItem(lineItem)}
                                        disabled={busy}
                                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-error transition hover:bg-error/10 disabled:opacity-40"
                                        title="Delete line"
                                      >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                      </button>
                                    </div>
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {bulkTab === "add" && canEditBulkItems ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="glass-card rounded-2xl p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-black text-on-surface">Add Items</h3>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/40 hover:bg-primary/5">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
                          Import CSV
                          <input type="file" accept=".csv" className="hidden" onChange={handleCsvAddition} disabled={busy} />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <label className="block">
                          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">品番</span>
                          <input
                            type="text"
                            value={addForm.partNumber}
                            onChange={(event) => setAddForm((current) => ({ ...current, partNumber: event.target.value }))}
                            onBlur={handlePartNumberBlur}
                            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">背番号</span>
                          <input
                            type="text"
                            value={addForm.backNumber}
                            onChange={(event) => setAddForm((current) => ({ ...current, backNumber: event.target.value }))}
                            onBlur={handleBackNumberBlur}
                            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-outline">Quantity</span>
                          <input
                            type="number"
                            min="1"
                            value={addForm.quantity}
                            onChange={(event) => setAddForm((current) => ({ ...current, quantity: event.target.value }))}
                            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                          />
                        </label>
                      </div>

                      <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/35 px-4 py-3 text-sm text-on-surface-variant">
                        {inventoryPreview?.exists
                          ? `Available ${inventoryPreview.available} • Reserved now ${inventoryPreview.reserved} • Shortfall ${inventoryPreview.shortfall}`
                          : inventoryPreview?.message || "Enter a serial number to preview inventory availability."}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddSingleItem}
                          className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                        >
                          Add To Pending Cart
                        </button>
                      </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-black text-on-surface">Items To Add</h3>
                        {addCart.length ? (
                          <button
                            type="button"
                            onClick={() => setAddCart([])}
                            className="rounded-2xl border border-outline-variant/25 px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-3">
                        {addCart.length ? addCart.map((item) => (
                          <div key={item.背番号} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/35 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="font-black text-on-surface">{item.背番号}</div>
                                <div className="mt-1 text-sm text-on-surface-variant">{item.品番} • Qty {item.quantity}</div>
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
                          <div className="rounded-2xl border border-dashed border-outline-variant/25 px-6 py-12 text-center text-sm text-on-surface-variant">
                            No pending additions yet.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSubmitAddedItems}
                          disabled={busy || !addCart.length}
                          className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          Add {addCart.length || ""} Item{addCart.length === 1 ? "" : "s"}
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