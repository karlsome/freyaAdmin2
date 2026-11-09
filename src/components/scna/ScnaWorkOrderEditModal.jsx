import { useEffect, useState } from "react";
import ModalShell from "../ModalShell";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchWorkOrderById, updateWorkOrder } from "../../services/scnaApi";
import { readStoredAuthUser } from "../../utils/auth";
import {
  formatWorkOrderDateInput,
  formatWorkOrderDateTime,
  parsePercentageValue,
} from "../../utils/scna";

// Field set mirrors SCNAWorkOrderDB documents (and legacy scnaWorkOrder.js edit form).
function buildInitialForm(wo = {}) {
  const material = wo["Material loading (%)"] ?? wo["Material loading %"];
  const finished = wo["Finished goods note (%)"] ?? wo["Finished goods note %"];
  return {
    Number: wo.Number || "",
    Status: wo.Status || "Entered",
    "Customer-Custom fields": wo["Customer-Custom fields"] || "",
    "P_SKU-Custom fields": wo["P_SKU-Custom fields"] || "",
    "Assign to-Custom fields": wo["Assign to-Custom fields"] || "",
    Owner: wo.Owner || "",
    Deadline: formatWorkOrderDateInput(wo.Deadline),
    "Material loading (%)": material == null ? "0" : String(parsePercentageValue(material)),
    "Finished goods note (%)": finished == null ? "0" : String(parsePercentageValue(finished)),
    "Quantity status": wo["Quantity status"] || "",
    "Time track": wo["Time track"] || "",
    "Estimated cost": wo["Estimated cost"] ?? "",
  };
}

function clampPercent(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

export default function ScnaWorkOrderEditModal({
  open,
  workOrderId,
  initialWorkOrder,
  assigneeOptions = [],
  onClose,
  onSaved,
  onFlash,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const authUser = readStoredAuthUser();
  const [workOrder, setWorkOrder] = useState(initialWorkOrder || null);
  const [form, setForm] = useState(() => buildInitialForm(initialWorkOrder || {}));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialWorkOrder) {
      setWorkOrder(initialWorkOrder);
      setForm(buildInitialForm(initialWorkOrder));
    }
  }, [initialWorkOrder]);

  useEffect(() => {
    if (!open || !workOrderId) return undefined;
    let cancelled = false;

    fetchWorkOrderById(workOrderId)
      .then((fresh) => {
        if (!cancelled && fresh) {
          setWorkOrder(fresh);
          setForm(buildInitialForm(fresh));
        }
      })
      .catch(() => {
        // Use initialWorkOrder fallback
      });

    return () => {
      cancelled = true;
    };
  }, [open, workOrderId]);

  if (!open || !workOrder) return null;

  const mergedAssignees = Array.from(
    new Set(
      [
        ...assigneeOptions,
        workOrder["Assign to-Custom fields"],
        form["Assign to-Custom fields"],
      ].filter(Boolean)
    )
  ).sort();

  function updateField(fieldKey, value) {
    setForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.Number.trim()) {
      onFlash?.({
        type: "warning",
        message: isJa
          ? "ワークオーダー番号を入力してください。"
          : "Work Order Number is required.",
      });
      return;
    }

    setSaving(true);
    try {
      const updatedData = {
        Number: form.Number.trim(),
        Status: form.Status,
        "Customer-Custom fields": form["Customer-Custom fields"],
        "P_SKU-Custom fields": form["P_SKU-Custom fields"],
        "Assign to-Custom fields": form["Assign to-Custom fields"],
        Owner: form.Owner,
        "Estimated cost": parseFloat(form["Estimated cost"]) || 0,
        // Same YYYY-MM-DD format the bulk upload endpoint stores
        Deadline: form.Deadline || null,
        "Material loading (%)": clampPercent(form["Material loading (%)"]),
        "Finished goods note (%)": clampPercent(form["Finished goods note (%)"]),
        "Quantity status": form["Quantity status"],
        "Time track": form["Time track"],
      };

      const username =
        authUser?.username ||
        localStorage.getItem("username") ||
        "admin";

      const result = await updateWorkOrder(workOrder._id, {
        data: updatedData,
        username,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Failed to update work order");
      }

      onFlash?.({
        type: "success",
        message: isJa
          ? "ワークオーダーを更新しました。"
          : "Work order updated successfully!",
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      onFlash?.({
        type: "error",
        message:
          err.message ||
          (isJa
            ? "ワークオーダーの更新に失敗しました。"
            : "Error updating work order."),
      });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]";
  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isJa ? "SCNA ワークオーダー編集" : "SCNA Work Order Editor"}
      title={
        isJa
          ? `ワークオーダー編集 - ${workOrder.Number || "N/A"}`
          : `Edit Work Order - ${workOrder.Number || "N/A"}`
      }
      subtitle={
        isJa
          ? `作成日時: ${formatWorkOrderDateTime(workOrder["Date and time"])}`
          : `Created: ${formatWorkOrderDateTime(workOrder["Date and time"])}`
      }
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="submit"
            form="scna-edit-workorder-form"
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {saving ? "progress_activity" : "save"}
            </span>
            {saving
              ? isJa
                ? "保存中..."
                : "Saving..."
              : isJa
                ? "変更を保存"
                : "Save Changes"}
          </button>
        </div>
      }
    >
      <form
        id="scna-edit-workorder-form"
        onSubmit={handleSubmit}
        className="max-h-[75vh] overflow-y-auto p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-[var(--border)] pb-2">
              {isJa ? "基本情報 (Basic Information)" : "Basic Information"}
            </h4>

            <div>
              <label className={labelClass}>Work Order Number *</label>
              <input
                type="text"
                value={form.Number}
                onChange={(e) => updateField("Number", e.target.value)}
                required
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.Status}
                onChange={(e) => updateField("Status", e.target.value)}
                className={inputClass}
              >
                <option value="Entered">Entered</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Customer</label>
              <input
                type="text"
                value={form["Customer-Custom fields"]}
                onChange={(e) =>
                  updateField("Customer-Custom fields", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Product SKU</label>
              <input
                type="text"
                value={form["P_SKU-Custom fields"]}
                onChange={(e) =>
                  updateField("P_SKU-Custom fields", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Assigned To</label>
              <select
                value={form["Assign to-Custom fields"]}
                onChange={(e) =>
                  updateField("Assign to-Custom fields", e.target.value)
                }
                className={inputClass}
              >
                <option value="">Select Assignee</option>
                {mergedAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Owner</label>
              <input
                type="text"
                value={form.Owner}
                onChange={(e) => updateField("Owner", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Progress & Financial */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-[var(--border)] pb-2">
              {isJa
                ? "納期・進捗・コスト (Schedule, Progress & Cost)"
                : "Schedule, Progress & Cost"}
            </h4>

            <div>
              <label className={labelClass}>Deadline</label>
              <input
                type="date"
                value={form.Deadline}
                onChange={(e) => updateField("Deadline", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Estimated Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={form["Estimated cost"]}
                onChange={(e) => updateField("Estimated cost", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Material Loading (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form["Material loading (%)"]}
                  onChange={(e) =>
                    updateField("Material loading (%)", e.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Finished Goods Note (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form["Finished goods note (%)"]}
                  onChange={(e) =>
                    updateField("Finished goods note (%)", e.target.value)
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Quantity Status</label>
              <input
                type="text"
                value={form["Quantity status"]}
                onChange={(e) => updateField("Quantity status", e.target.value)}
                placeholder="e.g., Available quantity"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Time Track</label>
              <input
                type="text"
                value={form["Time track"]}
                onChange={(e) => updateField("Time track", e.target.value)}
                placeholder="e.g., Assigned"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
