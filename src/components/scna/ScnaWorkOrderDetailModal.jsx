import { useEffect, useState } from "react";
import ModalShell from "../ModalShell";
import StatusChip from "../StatusChip";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchWorkOrderById } from "../../services/scnaApi";
import {
  formatWorkOrderDate,
  getWorkOrderDeadlineMeta,
  getWorkOrderFinishedGoods,
  getWorkOrderMaterialLoading,
  getWorkOrderStatusBadgeClass,
  parsePercentageValue,
} from "../../utils/scna";

export default function ScnaWorkOrderDetailModal({
  open,
  workOrderId,
  initialWorkOrder,
  onClose,
  onEdit,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [workOrder, setWorkOrder] = useState(initialWorkOrder || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWorkOrder(initialWorkOrder || null);
  }, [initialWorkOrder]);

  useEffect(() => {
    if (!open || !workOrderId) return undefined;
    let cancelled = false;
    setLoading(true);

    fetchWorkOrderById(workOrderId)
      .then((fresh) => {
        if (!cancelled && fresh) {
          setWorkOrder(fresh);
        }
      })
      .catch(() => {
        // Keep initialWorkOrder fallback if fetch fails
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, workOrderId]);

  if (!open || !workOrder) return null;

  const deadlineMeta = getWorkOrderDeadlineMeta(workOrder);
  const materialPercent = Math.min(
    100,
    Math.max(0, parsePercentageValue(getWorkOrderMaterialLoading(workOrder)))
  );
  const finishedPercent = Math.min(
    100,
    Math.max(0, parsePercentageValue(getWorkOrderFinishedGoods(workOrder)))
  );

  const estimatedCost = parseFloat(workOrder["Estimated cost"]) || 0;
  const actualCost = parseFloat(workOrder["Cost"]) || 0;
  const costVariance = actualCost - estimatedCost;

  const hasAdditionalDetails = Boolean(
    workOrder["Production Status-Custom fields"] ||
      workOrder["Pick List Status"] ||
      workOrder["Order Type-Custom fields"] ||
      workOrder["Same Day Delivery-Custom fields"] ||
      workOrder["Invoice number"]
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isJa ? "SCNA ワークオーダー" : "SCNA Work Order"}
      title={
        isJa
          ? `ワークオーダー詳細 - ${workOrder.Number || "N/A"}`
          : `Work Order Details - ${workOrder.Number || "N/A"}`
      }
      subtitle={`${workOrder["Customer-Custom fields"] || "N/A"} • ${workOrder["P_SKU-Custom fields"] || "N/A"}`}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={() => onEdit?.(workOrder)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 text-xs font-semibold text-white shadow-xs transition hover:opacity-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              edit
            </span>
            {isJa ? "ワークオーダーを編集" : "Edit Work Order"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "閉じる" : "Close"}
          </button>
        </div>
      }
    >
      <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5 relative">
        {loading && (
          <div className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
            <span
              className="material-symbols-outlined animate-spin"
              style={{ fontSize: 14 }}
            >
              progress_activity
            </span>
            {isJa ? "最新データを取得中..." : "Syncing latest work order details..."}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Basic Information */}
          <div className="rounded-[8px] border border-blue-500/25 bg-blue-500/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                info
              </span>
              <h4 className="text-sm font-semibold">
                {isJa ? "基本情報 (Basic Information)" : "Basic Information"}
              </h4>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">
                  Work Order Number:
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {workOrder.Number || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">Status:</span>
                <StatusChip
                  label={workOrder.Status || "Unknown"}
                  className={getWorkOrderStatusBadgeClass(workOrder.Status)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">Customer:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {workOrder["Customer-Custom fields"] || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">
                  Product SKU:
                </span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  {workOrder["P_SKU-Custom fields"] || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">
                  Created Date:
                </span>
                <span className="font-mono text-[var(--text-primary)]">
                  {formatWorkOrderDate(workOrder["Date"])}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-0.5">
                <span className="font-medium text-[var(--text-muted)]">Owner:</span>
                <span className="text-[var(--text-primary)]">
                  {workOrder.Owner || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Assignment & Progress */}
          <div className="rounded-[8px] border border-purple-500/25 bg-purple-500/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                trending_up
              </span>
              <h4 className="text-sm font-semibold">
                {isJa
                  ? "担当・進捗 (Assignment & Progress)"
                  : "Assignment & Progress"}
              </h4>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">
                  Assigned To:
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {workOrder["Assign to-Custom fields"] || "Unassigned"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">Deadline:</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-mono font-semibold ${
                      deadlineMeta.isOverdue
                        ? "text-rose-600 dark:text-rose-400"
                        : deadlineMeta.isDueSoon
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-[var(--text-primary)]"
                    }`}
                  >
                    {deadlineMeta.formatted}
                  </span>
                  {deadlineMeta.isOverdue && (
                    <StatusChip
                      label={isJa ? "期限超過" : "Overdue"}
                      className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                    />
                  )}
                  {deadlineMeta.isDueSoon && (
                    <StatusChip
                      label={isJa ? "期限間近" : "Due Soon"}
                      className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">
                  Time Track:
                </span>
                <span className="font-mono text-[var(--text-primary)]">
                  {workOrder["Time track"] || "00:00:00"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                <span className="font-medium text-[var(--text-muted)]">
                  Quantity Status:
                </span>
                <span className="font-mono text-[var(--text-primary)]">
                  {workOrder["Quantity status"] || "N/A"}
                </span>
              </div>

              {/* Material Loading Bar */}
              <div className="pt-1">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-[var(--text-muted)]">
                    Material Loading:
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {getWorkOrderMaterialLoading(workOrder)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${materialPercent}%` }}
                  />
                </div>
              </div>

              {/* Finished Goods Note Bar */}
              <div className="pt-1">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-[var(--text-muted)]">
                    Finished Goods Note:
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {getWorkOrderFinishedGoods(workOrder)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${finishedPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Information */}
        <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-3 text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              payments
            </span>
            <h4 className="text-sm font-semibold">
              {isJa
                ? "コスト情報 (Financial Information)"
                : "Financial Information"}
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                Estimated Cost
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ${estimatedCost.toFixed(2)}
              </div>
            </div>
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                Actual Cost
              </div>
              <div className="mt-1 text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                ${actualCost.toFixed(2)}
              </div>
            </div>
            <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <div className="text-[11px] font-medium text-[var(--text-muted)]">
                Cost Variance
              </div>
              <div
                className={`mt-1 text-lg font-bold font-mono ${
                  costVariance > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                ${costVariance.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        {hasAdditionalDetails && (
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-2 mb-3 text-[var(--text-primary)]">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                list_alt
              </span>
              <h4 className="text-sm font-semibold">
                {isJa ? "追加詳細 (Additional Details)" : "Additional Details"}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {workOrder["Production Status-Custom fields"] && (
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    Production Status:
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {workOrder["Production Status-Custom fields"]}
                  </span>
                </div>
              )}
              {workOrder["Pick List Status"] && (
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    Pick List Status:
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {workOrder["Pick List Status"]}
                  </span>
                </div>
              )}
              {workOrder["Order Type-Custom fields"] && (
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    Order Type:
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {workOrder["Order Type-Custom fields"]}
                  </span>
                </div>
              )}
              {workOrder["Same Day Delivery-Custom fields"] && (
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    Same Day Delivery:
                  </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {workOrder["Same Day Delivery-Custom fields"]}
                  </span>
                </div>
              )}
              {workOrder["Invoice number"] && (
                <div className="flex justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5">
                  <span className="font-medium text-[var(--text-muted)]">
                    Invoice Number:
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {workOrder["Invoice number"]}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

