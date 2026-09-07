import { useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "../EmptyState";
import PlannerModalShell from "../planner/PlannerModalShell";
import { fetchInventoryTransactions, resetInventoryItem } from "../../services/inventoryApi";
import {
  formatInventoryDateTime,
  formatInventoryNumber,
  getInventoryTransactionActionMeta,
  joinInventoryClasses,
} from "../../utils/inventory";

function InlineBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone = flash.type === "error"
    ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
    : flash.type === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={joinInventoryClasses("rounded-[6px] border px-3.5 py-2.5 text-xs", tone)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{flash.message}</p>
        <button type="button" onClick={onClose} className="flex h-5 w-5 items-center justify-center rounded-[4px] text-current/70 transition hover:bg-[var(--surface-hover)] hover:text-current">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
    </div>
  );
}

export default function InventoryTransactionsModal({
  open,
  backNumber,
  authUser,
  actorName,
  canReset = false,
  onClose,
  onUpdated,
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null);
  const [resetPanelOpen, setResetPanelOpen] = useState(false);
  const [resetPhysical, setResetPhysical] = useState(true);
  const [resetReserved, setResetReserved] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!backNumber) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const nextTransactions = await fetchInventoryTransactions(backNumber);
      setTransactions(Array.isArray(nextTransactions) ? nextTransactions : []);
    } catch (loadError) {
      setTransactions([]);
      setError(loadError.message || "Failed to load inventory transactions.");
    } finally {
      setLoading(false);
    }
  }, [backNumber]);

  useEffect(() => {
    if (!open) return;
    void loadTransactions();
  }, [loadTransactions, open]);

  useEffect(() => {
    if (!open) return;
    setFlash(null);
    setResetPanelOpen(false);
    setResetPhysical(true);
    setResetReserved(false);
  }, [open, backNumber]);

  const orderedTransactions = useMemo(() => (
    [...transactions].sort((left, right) => new Date(right.timeStamp) - new Date(left.timeStamp))
  ), [transactions]);

  const currentItem = orderedTransactions[0] || null;
  const currentPhysical = Number(currentItem?.physicalQuantity ?? currentItem?.runningQuantity ?? 0) || 0;
  const currentReserved = Number(currentItem?.reservedQuantity ?? 0) || 0;
  const currentAvailable = Number(currentItem?.availableQuantity ?? currentItem?.runningQuantity ?? 0) || 0;

  async function handleReset() {
    if (!currentItem) return;

    if (!resetPhysical && !resetReserved) {
      setFlash({ type: "warning", message: "Select at least one inventory value to reset." });
      return;
    }

    const hasPhysicalToReset = resetPhysical && (currentPhysical !== 0 || currentAvailable !== 0);
    const hasReservedToReset = resetReserved && currentReserved !== 0;

    if (!hasPhysicalToReset && !hasReservedToReset) {
      setFlash({ type: "warning", message: "The selected inventory values are already zero." });
      return;
    }

    const resetLines = [];
    if (resetPhysical) {
      resetLines.push(`Physical: ${formatInventoryNumber(currentPhysical)} -> 0`);
      resetLines.push(`Available: ${formatInventoryNumber(currentAvailable)} -> 0`);
    }
    if (resetReserved) {
      resetLines.push(`Reserved: ${formatInventoryNumber(currentReserved)} -> 0`);
    }

    const firstConfirm = window.confirm(
      `Reset inventory for ${backNumber}?\n\n${resetLines.join("\n")}\n\nThis creates an audit transaction.`
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "This action writes a new reset transaction and should be used carefully. Continue?"
    );
    if (!secondConfirm) return;

    setResetSubmitting(true);
    setFlash(null);

    try {
      const result = await resetInventoryItem({
        backNumber,
        partNumber: currentItem.品番,
        currentPhysical,
        currentReserved,
        currentAvailable,
        resetPhysical,
        resetReserved,
        resetAvailable: resetPhysical,
        factory: currentItem.工場 || "",
        submittedBy: authUser?.username || "admin",
        fullName: actorName || authUser?.username || "admin",
      });

      await loadTransactions();
      setResetPanelOpen(false);
      setFlash({ type: "success", message: result?.message || "Inventory reset completed." });
      onUpdated?.({ type: "success", message: result?.message || `Inventory reset completed for ${backNumber}.` });
    } catch (resetError) {
      setFlash({ type: "error", message: resetError.message || "Failed to reset inventory." });
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <PlannerModalShell
      open={open}
      title={backNumber ? `Inventory Transactions · ${backNumber}` : "Inventory Transactions"}
      subtitle={currentItem ? `${orderedTransactions.length} transaction${orderedTransactions.length === 1 ? "" : "s"} found` : "Review the current state and full transaction history."}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Close
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <InlineBanner flash={flash} onClose={() => setFlash(null)} />

        {error ? (
          <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-4 py-3 text-xs text-[var(--status-danger)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-6 py-12 text-center text-xs text-[var(--text-muted)]">
            Loading inventory transactions...
          </div>
        ) : null}

        {!loading && !error && !currentItem ? (
          <EmptyState variant="filled" className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] py-8 text-xs text-[var(--text-muted)]">No inventory transactions were found for this serial number.</EmptyState>
        ) : null}

        {!loading && currentItem ? (
          <>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Current State</div>
                  <h3 className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">{currentItem.品番 || "Unknown Part"}</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Serial {currentItem.背番号 || backNumber} {currentItem.工場 ? `· ${currentItem.工場}` : ""}
                  </p>
                </div>

                {canReset ? (
                  <button
                    type="button"
                    onClick={() => setResetPanelOpen((current) => !current)}
                    className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10"
                  >
                    {resetPanelOpen ? "Hide Reset Controls" : "Reset Inventory"}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Part Number</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{currentItem.品番 || "—"}</p>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Physical Stock</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatInventoryNumber(currentPhysical)}</p>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Reserved Stock</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatInventoryNumber(currentReserved)}</p>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Available Stock</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-sky-600 dark:text-sky-400">{formatInventoryNumber(currentAvailable)}</p>
                </div>
              </div>
            </div>

            {canReset && resetPanelOpen ? (
              <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--status-danger)]">Admin Reset</div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      This writes a new audit transaction and zeroes the selected inventory values.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={resetPhysical}
                      onChange={(event) => setResetPhysical(event.target.checked)}
                      className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--status-danger)]"
                    />
                    Reset physical stock and available stock
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={resetReserved}
                      onChange={(event) => setResetReserved(event.target.checked)}
                      className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--status-danger)]"
                    />
                    Reset reserved stock
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={resetSubmitting}
                    onClick={handleReset}
                    className="rounded-[6px] bg-[var(--status-danger)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetSubmitting ? "Resetting..." : "Apply Reset"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">History</div>
                  <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">Transaction History</h3>
                </div>
                <div className="text-xs text-[var(--text-muted)]">Newest first</div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
                <table className="min-w-full">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                    <tr>
                      {[
                        "Date & Time",
                        "Action",
                        "Physical",
                        "Reserved",
                        "Available",
                        "Source",
                        "Note",
                      ].map((label) => (
                        <th key={label} className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orderedTransactions.map((transaction, index) => {
                      const actionMeta = getInventoryTransactionActionMeta(transaction.action);
                      const physicalQuantity = Number(transaction.physicalQuantity ?? transaction.runningQuantity ?? 0) || 0;
                      const reservedQuantity = Number(transaction.reservedQuantity ?? 0) || 0;
                      const availableQuantity = Number(transaction.availableQuantity ?? transaction.runningQuantity ?? 0) || 0;

                      return (
                        <tr
                          key={`${transaction._id || transaction.timeStamp || index}`}
                          className={joinInventoryClasses(
                            "border-b border-[var(--border)] align-top transition-colors hover:bg-[var(--surface-hover)] last:border-b-0",
                            index === 0 ? "bg-[var(--freya-blue)]/5" : ""
                          )}
                        >
                          <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)]">{formatInventoryDateTime(transaction.timeStamp)}</td>
                          <td className="px-3.5 py-2.5">
                            <span className={joinInventoryClasses("inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-xs font-semibold", actionMeta.badgeClassName)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{actionMeta.icon}</span>
                              {transaction.action || "Unknown"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatInventoryNumber(physicalQuantity)}</td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{formatInventoryNumber(reservedQuantity)}</td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold text-sky-600 dark:text-sky-400">{formatInventoryNumber(availableQuantity)}</td>
                          <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)] [overflow-wrap:anywhere]">{transaction.source || "System"}</td>
                          <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)] whitespace-pre-wrap [overflow-wrap:anywhere]">{transaction.note || transaction.migrationNote || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </PlannerModalShell>
  );
}