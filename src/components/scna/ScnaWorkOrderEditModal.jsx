import { useEffect, useState } from "react";
import ModalShell from "../ModalShell";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchWorkOrderById, updateWorkOrder } from "../../services/scnaApi";
import { readStoredAuthUser } from "../../utils/auth";
import {
  formatWorkOrderDateInput,
  getWorkOrderFinishedGoods,
  getWorkOrderMaterialLoading,
} from "../../utils/scna";

function buildInitialForm(wo = {}) {
  return {
    Status: wo.Status || "Entered",
    "Customer-Custom fields": wo["Customer-Custom fields"] || "",
    "P_SKU-Custom fields": wo["P_SKU-Custom fields"] || "",
    "Assign to-Custom fields": wo["Assign to-Custom fields"] || "",
    Owner: wo.Owner || "",
    Deadline: formatWorkOrderDateInput(wo["Deadline"]),
    Date: wo["Date"] || "",
    "Material loading %": getWorkOrderMaterialLoading(wo) === "0%" && !wo["Material loading %"] && !wo["Material loading (%)"]
      ? ""
      : String(wo["Material loading %"] ?? wo["Material loading (%)"] ?? ""),
    "Finished goods note %": getWorkOrderFinishedGoods(wo) === "0%" && !wo["Finished goods note %"] && !wo["Finished goods note (%)"]
      ? ""
      : String(wo["Finished goods note %"] ?? wo["Finished goods note (%)"] ?? ""),
    "Quantity status": wo["Quantity status"] || "",
    "Time track": wo["Time track"] || "",
    "Estimated cost": wo["Estimated cost"] ?? "",
    Cost: wo["Cost"] ?? "",
    "Production Status-Custom fields": wo["Production Status-Custom fields"] || "",
    "Pick List Status": wo["Pick List Status"] || "",
    "Order Type-Custom fields": wo["Order Type-Custom fields"] || "",
    "Same Day Delivery-Custom fields": wo["Same Day Delivery-Custom fields"] || "",
    "Invoice number": wo["Invoice number"] || "",
  };
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
    if (!form["Customer-Custom fields"]?.trim() || !form["P_SKU-Custom fields"]?.trim()) {
      onFlash?.({
        type: "warning",
        message: isJa
          ? "必須項目（ステータス・顧客・製品SKU）を入力してください。"
          : "Customer and Product SKU are required fields.",
      });
      return;
    }

    setSaving(true);
    try {
      const updatedData = {
        ...form,
        "Estimated cost":
          form["Estimated cost"] !== "" ? parseFloat(form["Estimated cost"]) : 0,
        Cost: form.Cost !== "" ? parseFloat(form.Cost) : 0,
        Deadline: form.Deadline ? new Date(form.Deadline).toISOString() : null,
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
          ? "ステータス・担当者・納期・進捗率・コスト情報を更新します"
          : "Update status, assignment, deadline, progress percentages, and financial metrics"
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
              <label className={labelClass}>Work Order Number</label>
              <input
                type="text"
                value={workOrder.Number || ""}
                disabled
                className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-hover)] px-3 text-xs font-mono text-[var(--text-muted)] cursor-not-allowed"
              />
            </div>

            <div>
              <label className={labelClass}>Status *</label>
              <select
                value={form.Status}
                onChange={(e) => updateField("Status", e.target.value)}
                required
                className={inputClass}
              >
                <option value="Entered">Entered</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Customer *</label>
              <input
                type="text"
                value={form["Customer-Custom fields"]}
                onChange={(e) =>
                  updateField("Customer-Custom fields", e.target.value)
                }
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Product SKU *</label>
              <input
                type="text"
                value={form["P_SKU-Custom fields"]}
                onChange={(e) =>
                  updateField("P_SKU-Custom fields", e.target.value)
                }
                required
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className={labelClass}>Created Date</label>
                <input
                  type="text"
                  value={form.Date}
                  onChange={(e) => updateField("Date", e.target.value)}
                  placeholder="MM/DD/YYYY or YYYY-MM-DD"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Progress & Financial */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-[var(--border)] pb-2">
              {isJa
                ? "進捗・コスト (Progress & Financial)"
                : "Progress & Financial"}
            </h4>

            <div>
              <label className={labelClass}>Material Loading %</label>
              <input
                type="text"
                value={form["Material loading %"]}
                onChange={(e) =>
                  updateField("Material loading %", e.target.value)
                }
                placeholder="e.g., 75%"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Finished Goods Note %</label>
              <input
                type="text"
                value={form["Finished goods note %"]}
                onChange={(e) =>
                  updateField("Finished goods note %", e.target.value)
                }
                placeholder="e.g., 50%"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Quantity Status</label>
              <input
                type="text"
                value={form["Quantity status"]}
                onChange={(e) => updateField("Quantity status", e.target.value)}
                placeholder="e.g., 100 / 200"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Time Track</label>
              <input
                type="text"
                value={form["Time track"]}
                onChange={(e) => updateField("Time track", e.target.value)}
                placeholder="e.g., 02:30:00"
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

            <div>
              <label className={labelClass}>Actual Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.Cost}
                onChange={(e) => updateField("Cost", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Additional Fields */}
        <div className="pt-2 border-t border-[var(--border)]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3.5">
            {isJa ? "追加フィールド (Additional Fields)" : "Additional Fields"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className={labelClass}>Production Status</label>
              <input
                type="text"
                value={form["Production Status-Custom fields"]}
                onChange={(e) =>
                  updateField("Production Status-Custom fields", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Pick List Status</label>
              <input
                type="text"
                value={form["Pick List Status"]}
                onChange={(e) =>
                  updateField("Pick List Status", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Order Type</label>
              <input
                type="text"
                value={form["Order Type-Custom fields"]}
                onChange={(e) =>
                  updateField("Order Type-Custom fields", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Same Day Delivery</label>
              <select
                value={form["Same Day Delivery-Custom fields"]}
                onChange={(e) =>
                  updateField("Same Day Delivery-Custom fields", e.target.value)
                }
                className={inputClass}
              >
                <option value="">Not Set</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Invoice Number</label>
              <input
                type="text"
                value={form["Invoice number"]}
                onChange={(e) => updateField("Invoice number", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

