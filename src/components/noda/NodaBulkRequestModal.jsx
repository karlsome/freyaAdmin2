import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import NodaModalFrame from "./NodaModalFrame";
import {
  bulkCreateNodaRequests,
  checkNodaDuplicateRequest,
  checkNodaInventory,
  fetchNodaUserFullName,
  lookupNodaMasterData,
} from "../../services/nodaApi";
import {
  clearNodaCartDraftStorage,
  downloadCsvFile,
  loadNodaCartDraftFromStorage,
  normalizeCsvDate,
  normalizeQuotedCsvValue,
  saveNodaCartDraftToStorage,
  todayDateString,
  tomorrowDateString,
} from "../../utils/noda";
import { useLanguage } from "../../contexts/LanguageContext";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function detectCsvFormat(headers, t) {
  const hasHeader = (text) => headers.some((header) => header === text);

  if (hasHeader("納入指示日") && hasHeader("背番号") && hasHeader("納入指示数")) {
    return {
      formatType: "背番号",
      dateHeader: "納入指示日",
      itemHeader: "背番号",
      quantityHeader: "納入指示数",
      deliveryOrderHeader: headers.find((header) => header === "便") || null,
      deliveryNoteHeader: headers.find((header) => header === "納品書番号") || null,
    };
  }

  if (hasHeader("日付") && hasHeader("背番号") && hasHeader("収容数")) {
    return {
      formatType: "背番号",
      dateHeader: "日付",
      itemHeader: "背番号",
      quantityHeader: "収容数",
      deliveryOrderHeader: null,
      deliveryNoteHeader: null,
    };
  }

  if (hasHeader("日付") && hasHeader("品番") && hasHeader("収容数")) {
    return {
      formatType: "品番",
      dateHeader: "日付",
      itemHeader: "品番",
      quantityHeader: "収容数",
      deliveryOrderHeader: null,
      deliveryNoteHeader: null,
    };
  }

  throw new Error(t("invalidCsvFormatMessage"));
}

function parseCsvText(csvText, t) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeQuotedCsvValue,
    transform: normalizeQuotedCsvValue,
  });

  const headers = parsed.meta.fields || [];
  if (!headers.length || !parsed.data.length) {
    throw new Error(t("csvHeaderRequiredMessage"));
  }

  const format = detectCsvFormat(headers, t);
  const dates = new Set();
  const deliveryOrders = new Set();
  const deliveryNotes = new Set();

  const rows = parsed.data.reduce((items, row, rowIndex) => {
    const dateValue = normalizeCsvDate(row?.[format.dateHeader]);
    const itemCode = normalizeQuotedCsvValue(row?.[format.itemHeader]);
    const quantity = Number.parseInt(normalizeQuotedCsvValue(row?.[format.quantityHeader]), 10) || 0;
    const deliveryOrder = format.deliveryOrderHeader
      ? normalizeQuotedCsvValue(row?.[format.deliveryOrderHeader])
      : "";
    const deliveryNote = format.deliveryNoteHeader
      ? normalizeQuotedCsvValue(row?.[format.deliveryNoteHeader])
      : "";

    if (!dateValue || !itemCode || quantity <= 0) {
      return items;
    }

    dates.add(dateValue);
    if (deliveryOrder) deliveryOrders.add(deliveryOrder);
    if (deliveryNote) deliveryNotes.add(deliveryNote);

    items.push({
      rowIndex: rowIndex + 2,
      date: dateValue,
      quantity,
      requestedQuantity: quantity,
      deliveryOrder,
      deliveryNote,
      [format.formatType]: itemCode,
    });
    return items;
  }, []);

  if (!rows.length) {
    throw new Error(t("noValidCsvRowsMessage"));
  }

  if (dates.size > 1) {
    throw new Error(t("multipleDatesDetectedMessage", { dates: Array.from(dates).join(", ") }));
  }

  return {
    formatType: format.formatType,
    rows,
    deadlineDate: Array.from(dates)[0],
    deliveryOrder: deliveryOrders.size ? Array.from(deliveryOrders)[0] : "",
    deliveryNote: deliveryNotes.size ? Array.from(deliveryNotes)[0] : "",
  };
}

function StepIndicator({ currentStep }) {
  const { t } = useLanguage();
  const steps = [
    { step: 1, label: t("addItemsStepLabel") },
    { step: 2, label: t("reviewStepLabel") },
    { step: 3, label: t("submitStepLabel") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {steps.map((item, index) => {
        const active = currentStep === item.step;
        const done = currentStep > item.step;

        return (
          <div key={item.step} className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div
                className={joinClasses(
                  "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition",
                  active || done
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant/30 bg-surface-container text-on-surface-variant"
                )}
              >
                {item.step}
              </div>
              <span className={joinClasses("text-sm font-semibold", active || done ? "text-on-surface" : "text-on-surface-variant")}>
                {item.label}
              </span>
            </div>
            {index < steps.length - 1 ? <div className="h-px w-8 bg-outline-variant/20" /> : null}
          </div>
        );
      })}
    </div>
  );
}

const CSV_STATUS_LABEL_KEY = {
  Valid: "validStatusLabel",
  Partial: "partialBadgeLabel",
  Invalid: "invalidStatusLabel",
  Error: "errorStatusLabel",
};

const REVIEW_STATUS_LABEL_KEY = {
  Valid: "validStatusLabel",
  "Insufficient Stock": "insufficientStockLabel",
  "Inventory Check Failed": "inventoryCheckFailedLabel",
};

function getInventoryTone(preview) {
  if (!preview) return "border-outline-variant/20 bg-surface-container-low/30 text-on-surface-variant";
  if (!preview.exists) return "border-error/20 bg-error/10 text-error";
  if (preview.shortfall > 0 && preview.reserved > 0) return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (preview.shortfall > 0) return "border-error/20 bg-error/10 text-error";
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

async function readCsvFile(file) {
  const text = await file.text();

  if (text.includes("�")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read CSV file."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsText(file, "Shift_JIS");
    });
  }

  return text;
}

export default function NodaBulkRequestModal({ open, authUser, onClose, onSubmitted }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [itemForm, setItemForm] = useState({ partNumber: "", backNumber: "", quantity: "" });
  const [draft, setDraft] = useState({
    cart: [],
    pickupDate: todayDateString(),
    deadlineDate: tomorrowDateString(),
    deliveryOrder: "",
    deliveryNote: "",
  });
  const [reviewItems, setReviewItems] = useState([]);
  const [inventoryPreview, setInventoryPreview] = useState(null);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvReview, setCsvReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateChoice, setDuplicateChoice] = useState(null);

  useEffect(() => {
    if (!open) return;

    const storedDraft = loadNodaCartDraftFromStorage();
    setStep(1);
    setItemForm({ partNumber: "", backNumber: "", quantity: "" });
    setDraft({
      cart: storedDraft.cart,
      pickupDate: storedDraft.pickupDate || todayDateString(),
      deadlineDate: storedDraft.deadlineDate || tomorrowDateString(),
      deliveryOrder: storedDraft.deliveryOrder || "",
      deliveryNote: storedDraft.deliveryNote || "",
    });
    setReviewItems([]);
    setInventoryPreview(null);
    setCheckingInventory(false);
    setCsvBusy(false);
    setCsvReview(null);
    setSubmitting(false);
    setError("");
    setDuplicateChoice(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    saveNodaCartDraftToStorage(draft);
  }, [draft, open]);

  useEffect(() => {
    if (!open || !itemForm.backNumber.trim()) {
      setInventoryPreview(null);
      return undefined;
    }

    const quantity = Number.parseInt(itemForm.quantity, 10) || 0;
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setCheckingInventory(true);
      try {
        const result = await checkNodaInventory(itemForm.backNumber.trim());
        if (cancelled) return;

        if (!result?.success || !result.inventory) {
          setInventoryPreview({ exists: false, message: t("itemNotFoundInventoryMessage") });
          return;
        }

        const available = result.inventory.availableQuantity || 0;
        const requested = quantity;
        const reserved = Math.min(available, requested || available);
        const shortfall = Math.max(0, requested - available);

        setInventoryPreview({
          exists: true,
          available,
          reserved,
          shortfall,
          inventory: result.inventory,
        });
      } catch (loadError) {
        if (!cancelled) {
          setInventoryPreview({ exists: false, message: loadError.message || t("couldNotCheckInventoryMessage") });
        }
      } finally {
        if (!cancelled) {
          setCheckingInventory(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [itemForm.backNumber, itemForm.quantity, open]);

  const cartCount = draft.cart.length;
  const insufficientCount = useMemo(
    () => draft.cart.filter((item) => (item.shortfallQuantity || 0) > 0).length,
    [draft.cart]
  );

  async function handlePartNumberBlur() {
    const partNumber = itemForm.partNumber.trim();
    if (!partNumber || itemForm.backNumber.trim()) return;

    try {
      const result = await lookupNodaMasterData({ 品番: partNumber });
      if (result?.success && result.data?.背番号) {
        setItemForm((current) => ({
          ...current,
          partNumber: current.partNumber.trim() || result.data.品番,
          backNumber: current.backNumber.trim() || result.data.背番号,
        }));
      }
    } catch {
      // Keep the current value; lookup is a convenience only.
    }
  }

  async function handleBackNumberBlur() {
    const backNumber = itemForm.backNumber.trim();
    if (!backNumber || itemForm.partNumber.trim()) return;

    try {
      const result = await lookupNodaMasterData({ 背番号: backNumber });
      if (result?.success && result.data?.品番) {
        setItemForm((current) => ({
          ...current,
          partNumber: current.partNumber.trim() || result.data.品番,
          backNumber: current.backNumber.trim() || result.data.背番号,
        }));
      }
    } catch {
      // Keep the current value; lookup is a convenience only.
    }
  }

  async function handleAddItem() {
    const partNumber = itemForm.partNumber.trim();
    const backNumber = itemForm.backNumber.trim();
    const quantity = Number.parseInt(itemForm.quantity, 10) || 0;

    if (!partNumber || !backNumber || quantity <= 0 || !draft.pickupDate || !draft.deadlineDate) {
      setError(t("requiredFieldsBulkMessage"));
      return;
    }

    let nextPreview = inventoryPreview;
    if (!nextPreview || nextPreview.inventory?.背番号 !== backNumber) {
      try {
        const result = await checkNodaInventory(backNumber);
        const available = result?.inventory?.availableQuantity || 0;
        nextPreview = {
          exists: Boolean(result?.success && result.inventory),
          available,
          reserved: Math.min(available, quantity),
          shortfall: Math.max(0, quantity - available),
          inventory: result?.inventory,
          message: result?.success ? "" : t("itemNotFoundInventoryMessage"),
        };
      } catch (loadError) {
        nextPreview = {
          exists: false,
          available: 0,
          reserved: 0,
          shortfall: quantity,
          message: loadError.message || t("couldNotCheckInventoryMessage"),
        };
      }
    }

    if (nextPreview.shortfall > 0) {
      const proceed = window.confirm(
        t("insufficientInventoryConfirm", { available: nextPreview.available, requested: quantity })
      );
      if (!proceed) return;
    }

    setDraft((current) => {
      const existingIndex = current.cart.findIndex((item) => item.背番号 === backNumber);
      const nextItem = {
        品番: partNumber,
        背番号: backNumber,
        quantity,
        availableQuantity: nextPreview.available || 0,
        reservedQuantity: nextPreview.reserved || 0,
        shortfallQuantity: nextPreview.shortfall || 0,
        addedAt: new Date().toISOString(),
      };

      if (existingIndex === -1) {
        return {
          ...current,
          cart: [...current.cart, nextItem],
        };
      }

      const overwrite = window.confirm(t("alreadyInCartConfirm", { backNumber, quantity }));
      if (!overwrite) return current;

      const nextCart = [...current.cart];
      nextCart[existingIndex] = nextItem;
      return {
        ...current,
        cart: nextCart,
      };
    });

    setItemForm({ partNumber: "", backNumber: "", quantity: "" });
    setInventoryPreview(null);
    setError("");
  }

  function handleRemoveItem(serialNumber) {
    setDraft((current) => ({
      ...current,
      cart: current.cart.filter((item) => item.背番号 !== serialNumber),
    }));
  }

  async function refreshReview() {
    const nextReviewItems = [];

    for (const item of draft.cart) {
      try {
        const result = await checkNodaInventory(item.背番号);
        const available = result?.inventory?.availableQuantity || 0;
        nextReviewItems.push({
          ...item,
          currentAvailable: available,
          reviewStatus:
            result?.success && available >= item.quantity
              ? "Valid"
              : result?.success
                ? "Insufficient Stock"
                : "Inventory Check Failed",
        });
      } catch (loadError) {
        nextReviewItems.push({
          ...item,
          currentAvailable: 0,
          reviewStatus: loadError.message || "Inventory Check Failed",
        });
      }
    }

    setReviewItems(nextReviewItems);
  }

  async function handleGoToReview() {
    if (!draft.cart.length) {
      setError(t("addAtLeastOneItemMessage"));
      return;
    }

    if (!draft.pickupDate || !draft.deadlineDate) {
      setError(t("pickupDeadlineRequiredMessage"));
      return;
    }

    setError("");
    await refreshReview();
    setStep(2);
  }

  function handleCsvReviewImport() {
    if (!csvReview?.validItems?.length) {
      setError(t("noValidCsvItemsMessage"));
      return;
    }

    setDraft((current) => ({
      ...current,
      cart: csvReview.validItems.map((item) => ({
        品番: item.品番,
        背番号: item.背番号,
        quantity: item.requestedQuantity || item.quantity,
        availableQuantity: item.availableQuantity || 0,
        reservedQuantity: item.reservedQuantity || 0,
        shortfallQuantity: item.shortfallQuantity || 0,
        addedAt: new Date().toISOString(),
      })),
      deadlineDate: csvReview.deadlineDate || current.deadlineDate,
      deliveryOrder: csvReview.deliveryOrder || current.deliveryOrder,
      deliveryNote: csvReview.deliveryNote || current.deliveryNote,
      pickupDate: current.pickupDate || todayDateString(),
    }));
    setCsvReview(null);
    setError("");
  }

  async function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCsvBusy(true);
    setError("");

    try {
      const csvText = await readCsvFile(file);
      const parsed = parseCsvText(csvText, t);
      const processedItems = [];

      for (const row of parsed.rows) {
        const processedItem = {
          ...row,
          availableQuantity: 0,
          reservedQuantity: 0,
          shortfallQuantity: row.requestedQuantity,
          status: "Invalid",
          inventoryStatus: "none",
        };

        try {
          if (parsed.formatType === "背番号") {
            const lookup = await lookupNodaMasterData({ 背番号: row.背番号 });
            if (lookup?.success && lookup.data) {
              processedItem.品番 = lookup.data.品番;
              processedItem.品名 = lookup.data.品名;
            } else {
              processedItem.error = t("masterDataNotFoundMessage");
            }
          } else {
            const lookup = await lookupNodaMasterData({ 品番: row.品番 });
            if (lookup?.success && lookup.data) {
              processedItem.背番号 = lookup.data.背番号;
              processedItem.品名 = lookup.data.品名;
            } else {
              processedItem.error = t("masterDataNotFoundMessage");
            }
          }

          if (processedItem.背番号 && processedItem.背番号 !== "Not found") {
            const inventoryResult = await checkNodaInventory(processedItem.背番号);
            if (inventoryResult?.success && inventoryResult.inventory) {
              const available = inventoryResult.inventory.availableQuantity || 0;
              processedItem.availableQuantity = available;
              processedItem.reservedQuantity = Math.min(available, processedItem.requestedQuantity);
              processedItem.shortfallQuantity = Math.max(0, processedItem.requestedQuantity - available);
              processedItem.inventoryStatus =
                available === 0 ? "none" : available < processedItem.requestedQuantity ? "insufficient" : "sufficient";
              processedItem.status = processedItem.inventoryStatus === "sufficient" ? "Valid" : processedItem.inventoryStatus === "insufficient" ? "Partial" : "Valid";
            } else {
              processedItem.status = "Valid";
            }
          }
        } catch (loadError) {
          processedItem.error = loadError.message;
          processedItem.status = "Error";
        }

        processedItems.push(processedItem);
      }

      const validItems = processedItems.filter((item) => item.背番号 && item.品番);
      const insufficientItems = processedItems
        .filter((item) => (item.shortfallQuantity || 0) > 0 && item.背番号 && item.品番)
        .map((item) => ({
          ...item,
          quantity: item.shortfallQuantity,
          originalQuantity: item.requestedQuantity,
          fulfilledQuantity: item.reservedQuantity,
        }));

      setCsvReview({
        ...parsed,
        allItems: processedItems,
        validItems,
        insufficientItems,
      });
    } catch (loadError) {
      setError(loadError.message || t("failedParseCsvMessage"));
    } finally {
      setCsvBusy(false);
    }
  }

  async function performSubmit(mode = "create", existingRequestId = null) {
    setSubmitting(true);
    setError("");

    try {
      const actorName = authUser?.username
        ? await fetchNodaUserFullName(authUser.username)
        : (authUser?.username || "Unknown User");

      await bulkCreateNodaRequests(
        {
          pickupDate: draft.pickupDate,
          deadlineDate: draft.deadlineDate,
          deliveryOrder: draft.deliveryOrder || null,
          deliveryNote: draft.deliveryNote || null,
          mode,
          existingRequestId,
          items: draft.cart.map((item) => ({
            品番: item.品番,
            背番号: item.背番号,
            quantity: Number(item.quantity),
            reservedQuantity: item.reservedQuantity || 0,
            shortfallQuantity: item.shortfallQuantity || 0,
          })),
        },
        actorName
      );

      clearNodaCartDraftStorage();
      onSubmitted?.({
        type: "success",
        message: t("createdBulkRequestMessage", { count: draft.cart.length, plural: draft.cart.length === 1 ? "" : "s" }),
      });
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || t("failedCreateBulkRequestMessage"));
    } finally {
      setSubmitting(false);
      setDuplicateChoice(null);
    }
  }

  async function handleSubmitRequest() {
    if (!draft.cart.length) {
      setError(t("noItemsToSubmitMessage"));
      return;
    }

    if (draft.deliveryNote && draft.deliveryOrder && draft.deadlineDate) {
      try {
        const duplicateResult = await checkNodaDuplicateRequest({
          deliveryNote: draft.deliveryNote,
          deliveryOrder: draft.deliveryOrder,
          deadlineDate: draft.deadlineDate,
        });

        if (duplicateResult?.success && duplicateResult.exists && duplicateResult.request) {
          setDuplicateChoice(duplicateResult.request);
          return;
        }
      } catch (loadError) {
        setError(loadError.message || t("failedCheckDuplicateMessage"));
        return;
      }
    }

    await performSubmit("create");
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-on-surface-variant">
        {t("itemsInCartLabel", { count: cartCount, plural: cartCount === 1 ? "" : "s" })}
        {insufficientCount ? t("shortfallSuffixLabel", { count: insufficientCount }) : ""}
      </div>
      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            {t("back")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
        >
          {t("close")}
        </button>
        {step === 1 ? (
          <button
            type="button"
            onClick={handleGoToReview}
            disabled={!draft.cart.length}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("reviewItemsButton")}
          </button>
        ) : null}
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={!draft.cart.length}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("continueToSubmitButton")}
          </button>
        ) : null}
        {step === 3 ? (
          <button
            type="button"
            onClick={handleSubmitRequest}
            disabled={submitting}
            className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("submittingLabel") : t("createBulkRequestButton")}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <NodaModalFrame
      open={open}
      onClose={onClose}
      icon="playlist_add_check_circle"
      title={t("createNodaBulkRequestTitle")}
      subtitle={t("createNodaBulkRequestSubtitle")}
      footer={footer}
    >
      <div className="space-y-6">
        <StepIndicator currentStep={step} />

        {error ? (
          <div className="rounded-[24px] border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        {duplicateChoice ? (
          <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5">
            <h3 className="text-base font-semibold text-on-surface">{t("duplicateRequestDetectedTitle")}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {t("duplicateRequestMessage", { note: duplicateChoice.納品書番号, order: duplicateChoice.便, deadline: duplicateChoice.納入指示日 })}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-on-surface-variant md:grid-cols-2">
              <span>{t("existingRequestLabel")} <strong className="text-on-surface">{duplicateChoice.requestNumber}</strong></span>
              <span>{t("status")}: <strong className="text-on-surface">{duplicateChoice.status}</strong></span>
              <span>{t("totalItemsLabel")}: <strong className="text-on-surface">{duplicateChoice.totalItems}</strong></span>
              <span>{t("createdByLabel")} <strong className="text-on-surface">{duplicateChoice.createdBy || t("unknownLabel")}</strong></span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => performSubmit("overwrite", duplicateChoice._id)}
                disabled={submitting}
                className="rounded-2xl bg-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {t("overwriteExistingButton")}
              </button>
              <button
                type="button"
                onClick={() => performSubmit("createNew")}
                disabled={submitting}
                className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {t("createNewWithSuffixButton")}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateChoice(null)}
                className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {csvReview ? (
          <div className="rounded-[28px] border border-separator/40 bg-surface-container-low/35 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{t("csvReviewLabel")}</p>
                <h3 className="mt-1 text-lg font-semibold text-on-surface">
                  {t("itemsReadyToImportLabel", { count: csvReview.validItems.length })}
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {t("csvFormatDeadlineLabel", { type: csvReview.formatType, deadline: csvReview.deadlineDate })}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {csvReview.insufficientItems.length ? (
                  <button
                    type="button"
                    onClick={() => downloadCsvFile(
                      `noda-shortfall-${csvReview.deadlineDate || todayDateString()}.csv`,
                      [
                        ["Row", "品番", "背番号", "品名", "Requested", "Available", "Shortfall"],
                        ...csvReview.insufficientItems.map((item) => [
                          item.rowIndex,
                          item.品番 || "",
                          item.背番号 || "",
                          item.品名 || "",
                          item.originalQuantity || item.requestedQuantity || item.quantity,
                          item.availableQuantity || 0,
                          item.quantity,
                        ]),
                      ]
                    )}
                    className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                  >
                    {t("exportShortfallCsvButton")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCsvReview(null)}
                  className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                >
                  {t("cancelReviewButton")}
                </button>
                <button
                  type="button"
                  onClick={handleCsvReviewImport}
                  className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                >
                  {t("useReviewedItemsButton")}
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[24px] border border-outline-variant/15">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">{t("lineLabel")}</th>
                    <th className="px-4 py-3">{t("partNumberLabel")}</th>
                    <th className="px-4 py-3">{t("serialNumberLabel")}</th>
                    <th className="px-4 py-3">{t("productName")}</th>
                    <th className="px-4 py-3">{t("requestedLabel")}</th>
                    <th className="px-4 py-3">{t("availableLabel")}</th>
                    <th className="px-4 py-3">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {csvReview.allItems.map((item) => {
                    const statusTone = item.inventoryStatus === "sufficient"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : item.inventoryStatus === "insufficient"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "bg-error/10 text-error";

                    return (
                      <tr key={`${item.rowIndex}-${item.背番号 || item.品番}`} className="border-t border-outline-variant/10">
                        <td className="px-4 py-3 text-on-surface-variant">{item.rowIndex}</td>
                        <td className="px-4 py-3 text-on-surface">{item.品番 || "-"}</td>
                        <td className="px-4 py-3 text-on-surface">{item.背番号 || "-"}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{item.品名 || "-"}</td>
                        <td className="px-4 py-3 text-on-surface">{item.requestedQuantity || item.quantity}</td>
                        <td className="px-4 py-3 text-on-surface">{item.availableQuantity || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={joinClasses("inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold", statusTone)}>
                              {t(CSV_STATUS_LABEL_KEY[item.status] ?? item.status)}
                            </span>
                            {item.shortfallQuantity ? (
                              <span className="text-xs text-error">{t("shortfallColonLabel")} {item.shortfallQuantity}</span>
                            ) : null}
                            {item.error ? (
                              <span className="text-xs text-error">{item.error}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <div className="space-y-6">
              <div className="glass-card rounded-[28px] p-5">
                <h3 className="text-base font-semibold text-on-surface">{t("requestDetailsHeading")}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("pickupDateLabel")}</span>
                    <input
                      type="date"
                      value={draft.pickupDate}
                      onChange={(event) => setDraft((current) => ({ ...current, pickupDate: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("deadlineDateLabel")}</span>
                    <input
                      type="date"
                      value={draft.deadlineDate}
                      onChange={(event) => setDraft((current) => ({ ...current, deadlineDate: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("deliveryOrderFieldLabel")}</span>
                    <input
                      type="text"
                      value={draft.deliveryOrder}
                      onChange={(event) => setDraft((current) => ({ ...current, deliveryOrder: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("deliveryNoteFieldLabel")}</span>
                    <input
                      type="text"
                      value={draft.deliveryNote}
                      onChange={(event) => setDraft((current) => ({ ...current, deliveryNote: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                </div>
              </div>

              <div className="glass-card rounded-[28px] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-on-surface">{t("addItemHeading")}</h3>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary/40 hover:bg-primary/5">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
                    {csvBusy ? t("readingCsvLabel") : t("importCsvButton")}
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={csvBusy} />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("partNumberLabel")}</span>
                    <input
                      type="text"
                      value={itemForm.partNumber}
                      onChange={(event) => setItemForm((current) => ({ ...current, partNumber: event.target.value }))}
                      onBlur={handlePartNumberBlur}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("serialNumberLabel")}</span>
                    <input
                      type="text"
                      value={itemForm.backNumber}
                      onChange={(event) => setItemForm((current) => ({ ...current, backNumber: event.target.value }))}
                      onBlur={handleBackNumberBlur}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("quantity")}</span>
                    <input
                      type="number"
                      min="1"
                      value={itemForm.quantity}
                      onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                </div>

                <div className={joinClasses("mt-4 rounded-[24px] border px-4 py-3 text-sm", getInventoryTone(inventoryPreview))}>
                  {checkingInventory ? (
                    <span>{t("checkingInventoryLabel")}</span>
                  ) : inventoryPreview?.exists ? (
                    <div className="flex flex-wrap gap-4">
                      <span>{t("availableColonLabel")} <strong>{inventoryPreview.available}</strong></span>
                      <span>{t("reservedNowColonLabel")} <strong>{inventoryPreview.reserved}</strong></span>
                      <span>{t("shortfallColonLabel")} <strong>{inventoryPreview.shortfall}</strong></span>
                    </div>
                  ) : (
                    <span>{inventoryPreview?.message || t("enterSerialToPreviewMessage")}</span>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                  >
                    {t("addToCartButton")}
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-on-surface">{t("cartHeading")}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">{t("itemsReadyForReviewLabel", { count: cartCount, plural: cartCount === 1 ? "" : "s" })}</p>
                </div>
                {draft.cart.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft((current) => ({ ...current, cart: [] }));
                      clearNodaCartDraftStorage();
                    }}
                    className="rounded-2xl border border-separator/40 px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                  >
                    {t("clearDraftButton")}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {draft.cart.length ? draft.cart.map((item) => (
                  <div key={item.背番号} className="rounded-[24px] border border-separator/40 bg-surface-container-low/35 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-on-surface">{item.背番号}</span>
                          <span className="text-sm text-on-surface-variant">{item.品番}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-on-surface-variant">
                          <span>{t("qtyInlineLabel", { n: item.quantity })}</span>
                          <span>{t("availableInlineLabel", { n: item.availableQuantity || 0 })}</span>
                          <span>{t("reservedInlineLabel", { n: item.reservedQuantity || 0 })}</span>
                          {item.shortfallQuantity ? <span className="text-error">{t("shortfallInlineLabel", { n: item.shortfallQuantity })}</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.背番号)}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl text-outline transition hover:bg-error/10 hover:text-error"
                        aria-label={t("removeItemAria", { serial: item.背番号 })}
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-outline-variant/25 px-6 py-12 text-center text-sm text-on-surface-variant">
                    {t("addItemsManuallyMessage")}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="glass-card rounded-[28px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-on-surface">{t("inventoryReviewHeading")}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {t("pickupDeadlineSummary", { pickup: draft.pickupDate, deadline: draft.deadlineDate })}
                </p>
              </div>
              <button
                type="button"
                onClick={refreshReview}
                className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {t("refreshAvailabilityButton")}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[24px] border border-outline-variant/15">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">{t("partNumberLabel")}</th>
                    <th className="px-4 py-3">{t("serialNumberLabel")}</th>
                    <th className="px-4 py-3">{t("requestedLabel")}</th>
                    <th className="px-4 py-3">{t("availableNowLabel")}</th>
                    <th className="px-4 py-3">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((item) => {
                    const tone = item.reviewStatus === "Valid"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300";

                    return (
                      <tr key={item.背番号} className="border-t border-outline-variant/10">
                        <td className="px-4 py-3 text-on-surface">{item.品番}</td>
                        <td className="px-4 py-3 text-on-surface">{item.背番号}</td>
                        <td className="px-4 py-3 text-on-surface">{item.quantity}</td>
                        <td className="px-4 py-3 text-on-surface">{item.currentAvailable}</td>
                        <td className="px-4 py-3">
                          <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
                            {REVIEW_STATUS_LABEL_KEY[item.reviewStatus] ? t(REVIEW_STATUS_LABEL_KEY[item.reviewStatus]) : item.reviewStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="glass-card rounded-[28px] p-5">
              <h3 className="text-base font-semibold text-on-surface">{t("submissionSummaryHeading")}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("pickupDateLabel")}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.pickupDate}</p>
                </div>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("deadlineDateLabel")}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.deadlineDate}</p>
                </div>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("deliveryOrderLabel")}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.deliveryOrder || "—"}</p>
                </div>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("deliveryNoteLabel")}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.deliveryNote || "—"}</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-outline-variant/15">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3">{t("partNumberLabel")}</th>
                      <th className="px-4 py-3">{t("serialNumberLabel")}</th>
                      <th className="px-4 py-3">{t("quantity")}</th>
                      <th className="px-4 py-3">{t("reservedColumnLabel")}</th>
                      <th className="px-4 py-3">{t("shortfallColumnLabel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.cart.map((item) => (
                      <tr key={item.背番号} className="border-t border-outline-variant/10">
                        <td className="px-4 py-3 text-on-surface">{item.品番}</td>
                        <td className="px-4 py-3 text-on-surface">{item.背番号}</td>
                        <td className="px-4 py-3 text-on-surface">{item.quantity}</td>
                        <td className="px-4 py-3 text-on-surface">{item.reservedQuantity || 0}</td>
                        <td className="px-4 py-3 text-on-surface">{item.shortfallQuantity || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-card rounded-[28px] p-5">
              <h3 className="text-base font-semibold text-on-surface">{t("finalCheckHeading")}</h3>
              <div className="mt-4 space-y-4 text-sm text-on-surface-variant">
                <p>
                  {t("finalCheckDescription")}
                </p>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>{t("totalItemsLabel")}</span>
                    <strong className="text-on-surface">{draft.cart.length}</strong>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span>{t("shortfallLinesLabel")}</span>
                    <strong className="text-on-surface">{insufficientCount}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </NodaModalFrame>
  );
}