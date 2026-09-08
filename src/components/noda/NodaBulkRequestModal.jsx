import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import NodaModalFrame from "./NodaModalFrame";
import { useLanguage } from "../../contexts/LanguageContext";
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

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function detectCsvFormat(headers) {
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

  throw new Error("Invalid CSV format. Expected headers for 日付/背番号/収容数, 日付/品番/収容数, or 納入指示日/背番号/納入指示数.");
}

function parseCsvText(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeQuotedCsvValue,
    transform: normalizeQuotedCsvValue,
  });

  const headers = parsed.meta.fields || [];
  if (!headers.length || !parsed.data.length) {
    throw new Error("CSV file must contain a header row and at least one data row.");
  }

  const format = detectCsvFormat(headers);
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
    throw new Error("No valid CSV rows were found.");
  }

  if (dates.size > 1) {
    throw new Error(`Multiple dates detected in CSV: ${Array.from(dates).join(", ")}`);
  }

  return {
    formatType: format.formatType,
    rows,
    deadlineDate: Array.from(dates)[0],
    deliveryOrder: deliveryOrders.size ? Array.from(deliveryOrders)[0] : "",
    deliveryNote: deliveryNotes.size ? Array.from(deliveryNotes)[0] : "",
  };
}

function StepIndicator({ currentStep, isJa }) {
  const steps = [
    { step: 1, label: isJa ? "品目追加" : "Add Items" },
    { step: 2, label: isJa ? "確認" : "Review" },
    { step: 3, label: isJa ? "送信" : "Submit" },
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
          setInventoryPreview({ exists: false, message: isJa ? "野田在庫に対象品目が見つかりません。" : "Item not found in Noda inventory." });
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
          setInventoryPreview({ exists: false, message: loadError.message || (isJa ? "在庫を確認できませんでした。" : "Could not check inventory.") });
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
  }, [itemForm.backNumber, itemForm.quantity, open, isJa]);

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
      setError(isJa ? "品番、背番号、数量、引取日、納入指示日は必須です。" : "Part number, serial number, quantity, pickup date, and deadline date are required.");
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
          message: result?.success ? "" : (isJa ? "野田在庫に対象品目が見つかりません。" : "Item not found in Noda inventory."),
        };
      } catch (loadError) {
        nextPreview = {
          exists: false,
          available: 0,
          reserved: 0,
          shortfall: quantity,
          message: loadError.message || (isJa ? "在庫を確認できませんでした。" : "Could not check inventory."),
        };
      }
    }

    if (nextPreview.shortfall > 0) {
      const proceed = window.confirm(
        isJa
          ? `この品目は在庫不足です。引当可能数: ${nextPreview.available} / 要求数: ${quantity}。\n\nリクエストは作成され、不足分は保留となります。カートに追加しますか？`
          : `This item has insufficient inventory. Available: ${nextPreview.available}. Requested: ${quantity}.\n\nThe request will still be created and the shortfall will remain pending. Add it anyway?`
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

      const overwrite = window.confirm(
        isJa
          ? `${backNumber} は既にカートにあります。数量を ${quantity} に上書きしますか？`
          : `${backNumber} is already in the cart. Replace its quantity with ${quantity}?`
      );
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
              ? (isJa ? "有効" : "Valid")
              : result?.success
                ? (isJa ? "在庫不足" : "Insufficient Stock")
                : (isJa ? "在庫確認失敗" : "Inventory Check Failed"),
        });
      } catch (loadError) {
        nextReviewItems.push({
          ...item,
          currentAvailable: 0,
          reviewStatus: loadError.message || (isJa ? "在庫確認失敗" : "Inventory Check Failed"),
        });
      }
    }

    setReviewItems(nextReviewItems);
  }

  async function handleGoToReview() {
    if (!draft.cart.length) {
      setError(isJa ? "続けるには最低1つの品目を追加してください。" : "Add at least one item before continuing.");
      return;
    }

    if (!draft.pickupDate || !draft.deadlineDate) {
      setError(isJa ? "引取日と納入指示日は必須です。" : "Pickup date and deadline date are required.");
      return;
    }

    setError("");
    await refreshReview();
    setStep(2);
  }

  function handleCsvReviewImport() {
    if (!csvReview?.validItems?.length) {
      setError(isJa ? "インポート可能な有効なCSV品目がありません。" : "No valid CSV items are available to import.");
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
      const parsed = parseCsvText(csvText);
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
              processedItem.error = isJa ? "マスターデータが見つかりません" : "Master data not found";
            }
          } else {
            const lookup = await lookupNodaMasterData({ 品番: row.品番 });
            if (lookup?.success && lookup.data) {
              processedItem.背番号 = lookup.data.背番号;
              processedItem.品名 = lookup.data.品名;
            } else {
              processedItem.error = isJa ? "マスターデータが見つかりません" : "Master data not found";
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
      setError(loadError.message || (isJa ? "CSVファイルの解析に失敗しました。" : "Failed to parse the CSV file."));
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
        message: isJa
          ? `${draft.cart.length}件の品目で野田一括リクエストを作成しました。`
          : `Created Noda bulk request with ${draft.cart.length} item${draft.cart.length === 1 ? "" : "s"}.`,
      });
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || (isJa ? "一括リクエストの作成に失敗しました。" : "Failed to create the bulk request."));
    } finally {
      setSubmitting(false);
      setDuplicateChoice(null);
    }
  }

  async function handleSubmitRequest() {
    if (!draft.cart.length) {
      setError(isJa ? "送信する品目がありません。" : "There are no items to submit.");
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
        setError(loadError.message || (isJa ? "重複CSVの確認に失敗しました。" : "Failed to check for duplicate CSV uploads."));
        return;
      }
    }

    await performSubmit("create");
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-on-surface-variant">
        {isJa ? `カート内 ${cartCount} 件` : `${cartCount} item${cartCount === 1 ? "" : "s"} in cart`}
        {insufficientCount ? (isJa ? ` • 在庫不足 ${insufficientCount} 件` : ` • ${insufficientCount} with inventory shortfall`) : ""}
      </div>
      <div className="flex flex-wrap gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            {isJa ? "戻る" : "Back"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
        >
          {isJa ? "閉じる" : "Close"}
        </button>
        {step === 1 ? (
          <button
            type="button"
            onClick={handleGoToReview}
            disabled={!draft.cart.length}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJa ? "品目を確認" : "Review Items"}
          </button>
        ) : null}
        {step === 2 ? (
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={!draft.cart.length}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJa ? "送信に進む" : "Continue To Submit"}
          </button>
        ) : null}
        {step === 3 ? (
          <button
            type="button"
            onClick={handleSubmitRequest}
            disabled={submitting}
            className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (isJa ? "送信中…" : "Submitting…") : (isJa ? "一括リクエスト作成" : "Create Bulk Request")}
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
      title={isJa ? "野田一括リクエスト作成" : "Create Noda Bulk Request"}
      subtitle={isJa ? "品目の個別追加またはCSVインポートを行い、引当状況を確認してリクエストを送信します。" : "Add individual items or import a CSV, review the reservation impact, then submit the request."}
      footer={footer}
    >
      <div className="space-y-6">
        <StepIndicator currentStep={step} isJa={isJa} />

        {error ? (
          <div className="rounded-[24px] border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        {duplicateChoice ? (
          <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5">
            <h3 className="text-base font-semibold text-on-surface">{isJa ? "重複リクエストを検出しました" : "Duplicate request detected"}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {isJa
                ? `納品書番号 ${duplicateChoice.納品書番号}、便 ${duplicateChoice.便}、納入指示日 ${duplicateChoice.納入指示日} のリクエストが既に存在します。`
                : `A request already exists for 納品書番号 ${duplicateChoice.納品書番号}, 便 ${duplicateChoice.便}, and deadline ${duplicateChoice.納入指示日}.`}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-on-surface-variant md:grid-cols-2">
              <span>{isJa ? "既存リクエスト: " : "Existing request: "}<strong className="text-on-surface">{duplicateChoice.requestNumber}</strong></span>
              <span>{isJa ? "ステータス: " : "Status: "}<strong className="text-on-surface">{duplicateChoice.status}</strong></span>
              <span>{isJa ? "合計品目数: " : "Total items: "}<strong className="text-on-surface">{duplicateChoice.totalItems}</strong></span>
              <span>{isJa ? "作成者: " : "Created by: "}<strong className="text-on-surface">{duplicateChoice.createdBy || (isJa ? "不明" : "Unknown")}</strong></span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => performSubmit("overwrite", duplicateChoice._id)}
                disabled={submitting}
                className="rounded-2xl bg-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {isJa ? "既存を上書き" : "Overwrite Existing"}
              </button>
              <button
                type="button"
                onClick={() => performSubmit("createNew")}
                disabled={submitting}
                className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isJa ? "接尾辞付きで新規作成" : "Create New With Suffix"}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateChoice(null)}
                className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {isJa ? "キャンセル" : "Cancel"}
              </button>
            </div>
          </div>
        ) : null}

        {csvReview ? (
          <div className="rounded-[28px] border border-separator/40 bg-surface-container-low/35 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{isJa ? "CSV確認" : "CSV Review"}</p>
                <h3 className="mt-1 text-lg font-semibold text-on-surface">
                  {isJa ? `${csvReview.validItems.length}件の品目をカートにインポート準備完了` : `${csvReview.validItems.length} items ready to import into the cart`}
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {isJa ? `形式: ${csvReview.formatType}基準CSV • 納入指示日: ${csvReview.deadlineDate}` : `Format: ${csvReview.formatType}-based CSV • Deadline: ${csvReview.deadlineDate}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {csvReview.insufficientItems.length ? (
                  <button
                    type="button"
                    onClick={() => downloadCsvFile(
                      `noda-shortfall-${csvReview.deadlineDate || todayDateString()}.csv`,
                      [
                        [isJa ? "行" : "Row", "品番", "背番号", "品名", isJa ? "要求数" : "Requested", isJa ? "在庫数" : "Available", isJa ? "不足" : "Shortfall"],
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
                    {isJa ? "不足分CSVエクスポート" : "Export Shortfall CSV"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setCsvReview(null)}
                  className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
                >
                  {isJa ? "確認をキャンセル" : "Cancel Review"}
                </button>
                <button
                  type="button"
                  onClick={handleCsvReviewImport}
                  className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                >
                  {isJa ? "確認済み品目を反映" : "Use Reviewed Items"}
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[24px] border border-outline-variant/15">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">{isJa ? "行" : "Row"}</th>
                    <th className="px-4 py-3">品番</th>
                    <th className="px-4 py-3">背番号</th>
                    <th className="px-4 py-3">品名</th>
                    <th className="px-4 py-3">{isJa ? "要求数" : "Requested"}</th>
                    <th className="px-4 py-3">{isJa ? "引当可能" : "Available"}</th>
                    <th className="px-4 py-3">{isJa ? "ステータス" : "Status"}</th>
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
                              {item.status}
                            </span>
                            {item.shortfallQuantity ? (
                              <span className="text-xs text-error">{isJa ? "不足: " : "Shortfall: "}{item.shortfallQuantity}</span>
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
              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{isJa ? "リクエスト詳細" : "Request Details"}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "引取日" : "Pickup Date"}</span>
                    <input
                      type="date"
                      value={draft.pickupDate}
                      onChange={(event) => setDraft((current) => ({ ...current, pickupDate: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "納入指示日" : "Deadline Date"}</span>
                    <input
                      type="date"
                      value={draft.deadlineDate}
                      onChange={(event) => setDraft((current) => ({ ...current, deadlineDate: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "便" : "Delivery Order (便)"}</span>
                    <input
                      type="text"
                      value={draft.deliveryOrder}
                      onChange={(event) => setDraft((current) => ({ ...current, deliveryOrder: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "納品書番号" : "Delivery Note (納品書番号)"}</span>
                    <input
                      type="text"
                      value={draft.deliveryNote}
                      onChange={(event) => setDraft((current) => ({ ...current, deliveryNote: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                </div>
              </div>

              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{isJa ? "品目追加" : "Add Item"}</h3>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-[6px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--freya-blue)]">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                    {csvBusy ? (isJa ? "CSV読込中…" : "Reading CSV…") : (isJa ? "CSVインポート" : "Import CSV")}
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={csvBusy} />
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">品番</span>
                    <input
                      type="text"
                      value={itemForm.partNumber}
                      onChange={(event) => setItemForm((current) => ({ ...current, partNumber: event.target.value }))}
                      onBlur={handlePartNumberBlur}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">背番号</span>
                    <input
                      type="text"
                      value={itemForm.backNumber}
                      onChange={(event) => setItemForm((current) => ({ ...current, backNumber: event.target.value }))}
                      onBlur={handleBackNumberBlur}
                      className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "数量" : "Quantity"}</span>
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
                    <span>{isJa ? "在庫確認中…" : "Checking inventory…"}</span>
                  ) : inventoryPreview?.exists ? (
                    <div className="flex flex-wrap gap-4">
                      <span>{isJa ? "引当可能: " : "Available: "}<strong>{inventoryPreview.available}</strong></span>
                      <span>{isJa ? "即時引当: " : "Reserved now: "}<strong>{inventoryPreview.reserved}</strong></span>
                      <span>{isJa ? "不足: " : "Shortfall: "}<strong>{inventoryPreview.shortfall}</strong></span>
                    </div>
                  ) : (
                    <span>{inventoryPreview?.message || (isJa ? "背番号を入力すると在庫状況が表示されます。" : "Enter a serial number to preview inventory availability.")}</span>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
                  >
                    {isJa ? "カートに追加" : "Add To Cart"}
                  </button>
                </div>
              </div>
            </div>

            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{isJa ? "カート" : "Cart"}</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {isJa ? `${cartCount}件の品目を確認準備完了` : `${cartCount} item${cartCount === 1 ? "" : "s"} ready for review`}
                  </p>
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
                    {isJa ? "下書きクリア" : "Clear Draft"}
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
                          <span>{isJa ? "数量 " : "Qty "}{item.quantity}</span>
                          <span>{isJa ? "引当可能 " : "Available "}{item.availableQuantity || 0}</span>
                          <span>{isJa ? "即時引当 " : "Reserved "}{item.reservedQuantity || 0}</span>
                          {item.shortfallQuantity ? <span className="text-error">{isJa ? "不足 " : "Shortfall "}{item.shortfallQuantity}</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.背番号)}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl text-outline transition hover:bg-error/10 hover:text-error"
                        aria-label={isJa ? `${item.背番号}を削除` : `Remove ${item.背番号}`}
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-outline-variant/25 px-6 py-12 text-center text-sm text-on-surface-variant">
                    {isJa ? "品目を手動で追加するか、CSVをインポートしてリクエストカートを作成してください。" : "Add items manually or import a CSV to build the request cart."}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">{isJa ? "在庫引当確認" : "Inventory Review"}</h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {isJa ? `引取日 ${draft.pickupDate} • 納入指示日 ${draft.deadlineDate}` : `Pickup date ${draft.pickupDate} • Deadline ${draft.deadlineDate}`}
                </p>
              </div>
              <button
                type="button"
                onClick={refreshReview}
                className="rounded-2xl border border-separator/40 px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {isJa ? "引当可能数を更新" : "Refresh Availability"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[24px] border border-outline-variant/15">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">品番</th>
                    <th className="px-4 py-3">背番号</th>
                    <th className="px-4 py-3">{isJa ? "要求数" : "Requested"}</th>
                    <th className="px-4 py-3">{isJa ? "現在庫数" : "Available Now"}</th>
                    <th className="px-4 py-3">{isJa ? "ステータス" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((item) => {
                    const tone = item.reviewStatus === "Valid" || item.reviewStatus === "有効"
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
                            {item.reviewStatus}
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
            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{isJa ? "送信サマリー" : "Submission Summary"}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "引取日" : "Pickup Date"}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.pickupDate}</p>
                </div>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "納入指示日" : "Deadline Date"}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.deadlineDate}</p>
                </div>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "便" : "Delivery Order"}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.deliveryOrder || "—"}</p>
                </div>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "納品書番号" : "Delivery Note"}</p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">{draft.deliveryNote || "—"}</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-outline-variant/15">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-container-high/50 text-left text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3">品番</th>
                      <th className="px-4 py-3">背番号</th>
                      <th className="px-4 py-3">{isJa ? "数量" : "Quantity"}</th>
                      <th className="px-4 py-3">{isJa ? "即時引当" : "Reserved"}</th>
                      <th className="px-4 py-3">{isJa ? "不足分" : "Shortfall"}</th>
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

            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{isJa ? "最終確認" : "Final Check"}</h3>
              <div className="mt-4 space-y-4 text-sm text-on-surface-variant">
                <p>
                  {isJa
                    ? "このリクエストは野田出庫一括リクエストとして作成されます。在庫不足の品目もリクエストに保持され、在庫が入庫され次第引き当てられます。"
                    : "The request will be created as a bulk Noda picking request. Items with shortfall remain attached to the request and will be filled when inventory becomes available."}
                </p>
                <div className="rounded-[24px] border border-outline-variant/15 bg-surface-container-low/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>{isJa ? "合計品目数" : "Total items"}</span>
                    <strong className="text-on-surface">{draft.cart.length}</strong>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span>{isJa ? "在庫不足行数" : "Shortfall lines"}</span>
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