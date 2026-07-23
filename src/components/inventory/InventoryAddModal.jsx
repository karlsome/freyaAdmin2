import { useEffect, useState } from "react";
import PlannerModalShell from "../planner/PlannerModalShell";
import { addInventoryStock, lookupInventoryMasterData } from "../../services/inventoryApi";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const { t } = useLanguage();
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
        setLookupHint(t("autoFilledSerialMessage", { value: record.背番号 }));
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
        setLookupHint(t("autoFilledPartMessage", { value: record.品番 }));
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

    if (!partNumber) nextErrors.partNumber = t("partNumberRequiredMessage");
    if (!backNumber) nextErrors.backNumber = t("serialNumberRequiredMessage");
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.quantity = t("quantityPositiveMessage");

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setLookupHint("");

    try {
      const masterRecord = await lookupInventoryMasterData({ 品番: partNumber, 背番号: backNumber });
      if (!masterRecord) {
        setErrors({ partNumber: t("partSerialNotFoundMessage") });
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
        message: result?.message || t("addedInventoryUnitsMessage", { count: quantity, serial: backNumber }),
      });
    } catch (submitError) {
      setErrors({ form: submitError.message || t("failedAddInventoryMessage") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PlannerModalShell
      open={open}
      title={t("addInventoryButton")}
      subtitle={t("addInventoryModalSubtitle")}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-separator/40 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("addingLabel") : t("addInventoryButton")}
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        {errors.form ? (
          <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {errors.form}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("partNumberLabel")}</span>
            <input
              type="text"
              value={form.partNumber}
              onChange={(event) => updateField("partNumber", event.target.value)}
              onBlur={() => {
                void handlePartNumberBlur();
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              placeholder={t("enterPartNumberPlaceholder")}
            />
            {errors.partNumber ? <p className="mt-2 text-sm text-error">{errors.partNumber}</p> : null}
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("serialNumberLabel")}</span>
            <input
              type="text"
              value={form.backNumber}
              onChange={(event) => updateField("backNumber", event.target.value)}
              onBlur={() => {
                void handleBackNumberBlur();
              }}
              className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
              placeholder={t("enterSerialNumberPlaceholder")}
            />
            {errors.backNumber ? <p className="mt-2 text-sm text-error">{errors.backNumber}</p> : null}
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{t("quantity")}</span>
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-outline-variant/30 bg-white px-4 text-sm text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
            placeholder={t("enterQuantityPlaceholder")}
          />
          {errors.quantity ? <p className="mt-2 text-sm text-error">{errors.quantity}</p> : null}
        </label>

        <div className="rounded-2xl border border-separator/40 bg-surface-container-low/35 px-4 py-3 text-sm text-on-surface-variant">
          {lookupBusy
            ? t("checkingMasterDataMessage")
            : lookupHint || t("blurToAutofillMessage")}
        </div>
      </div>
    </PlannerModalShell>
  );
}