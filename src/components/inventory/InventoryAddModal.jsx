import { useEffect, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import PlannerModalShell from "../planner/PlannerModalShell";
import { addInventoryStock, lookupInventoryMasterData } from "../../services/inventoryApi";

function buildTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export default function InventoryAddModal({
  open,
  authUser,
  actorName,
  onClose,
  onSubmitted,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [form, setForm] = useState({ partNumber: "", backNumber: "", quantity: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [lookupHint, setLookupHint] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ partNumber: "", backNumber: "", quantity: "" });
    setErrors({});
    setSubmitting(false);
    setLookupHint("");
    setLookupBusy(false);
  }, [open]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handlePartNumberBlur() {
    const partNumber = form.partNumber.trim();
    if (!partNumber || form.backNumber.trim()) return;

    setLookupBusy(true);
    setLookupHint("");

    try {
      const record = await lookupInventoryMasterData({ 品番: partNumber });
      if (record?.背番号) {
        setForm((current) => ({ ...current, backNumber: record.背番号 }));
        setLookupHint(isJa ? `背番号を自動補完しました: ${record.背番号}` : `Auto-filled serial number: ${record.背番号}`);
      }
    } catch {
      setLookupHint("");
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleBackNumberBlur() {
    const backNumber = form.backNumber.trim();
    if (!backNumber || form.partNumber.trim()) return;

    setLookupBusy(true);
    setLookupHint("");

    try {
      const record = await lookupInventoryMasterData({ 背番号: backNumber });
      if (record?.品番) {
        setForm((current) => ({ ...current, partNumber: record.品番 }));
        setLookupHint(isJa ? `品番を自動補完しました: ${record.品番}` : `Auto-filled part number: ${record.品番}`);
      }
    } catch {
      setLookupHint("");
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleSubmit() {
    const partNumber = form.partNumber.trim();
    const backNumber = form.backNumber.trim();
    const quantity = Number.parseInt(form.quantity, 10);
    const nextErrors = {};

    if (!partNumber) nextErrors.partNumber = isJa ? "品番は必須です。" : "Part number is required.";
    if (!backNumber) nextErrors.backNumber = isJa ? "背番号は必須です。" : "Serial number is required.";
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.quantity = isJa ? "数量は正の数値を入力してください。" : "Quantity must be a positive number.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setLookupHint("");

    try {
      const masterRecord = await lookupInventoryMasterData({ 品番: partNumber, 背番号: backNumber });
      if (!masterRecord) {
        setErrors({ partNumber: isJa ? "品番と背番号の組み合わせがマスターデータに見つかりません。" : "The part number and serial number combination was not found in master data." });
        return;
      }

      const result = await addInventoryStock({
        品番: partNumber,
        背番号: backNumber,
        physicalQuantityChange: quantity,
        action: "Manual Inventory Add",
        source: `Freya Admin - ${actorName || authUser?.username || "Unknown User"}`,
        Date: buildTodayDate(),
        timeStamp: new Date(),
      });

      onSubmitted?.({
        type: "success",
        message: result?.message || (isJa ? `${backNumber} に ${quantity} 個を追加しました。` : `Added ${quantity} units to ${backNumber}.`),
      });
    } catch (submitError) {
      setErrors({ form: submitError.message || (isJa ? "在庫の追加に失敗しました。" : "Failed to add inventory.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? "在庫追加" : "Add Inventory"}
      subtitle={isJa ? "品番・背番号のマスターデータを使用して新しい手動在庫取引を作成します。" : "Create a new manual inventory transaction using part and serial master data."}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (isJa ? "追加中..." : "Adding...") : (isJa ? "在庫追加" : "Add Inventory")}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        {errors.form ? (
          <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-2 text-xs text-[var(--status-danger)]">
            {errors.form}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "品番" : "Part Number"}</span>
            <input
              type="text"
              value={form.partNumber}
              onChange={(event) => updateField("partNumber", event.target.value)}
              onBlur={() => {
                void handlePartNumberBlur();
              }}
              className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
              placeholder={isJa ? "品番を入力" : "Enter part number"}
            />
            {errors.partNumber ? <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.partNumber}</p> : null}
          </label>

          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "背番号" : "Serial Number"}</span>
            <input
              type="text"
              value={form.backNumber}
              onChange={(event) => updateField("backNumber", event.target.value)}
              onBlur={() => {
                void handleBackNumberBlur();
              }}
              className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
              placeholder={isJa ? "背番号を入力" : "Enter serial number"}
            />
            {errors.backNumber ? <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.backNumber}</p> : null}
          </label>
        </div>

        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "数量" : "Quantity"}</span>
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
            className="mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            placeholder={isJa ? "数量を入力" : "Enter quantity"}
          />
          {errors.quantity ? <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.quantity}</p> : null}
        </label>

        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-muted)]">
          {lookupBusy
            ? (isJa ? "マスターデータを確認中..." : "Checking master data...")
            : lookupHint || (isJa ? "品番または背番号からフォーカスを外すとマスターデータから未入力項目が自動補完されます。" : "Blur part number or serial number to auto-fill the missing field from master data.")}
        </div>
      </div>
    </PlannerModalShell>
  );
}