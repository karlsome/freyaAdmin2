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
    ? "border-error/20 bg-error/10 text-error"
    : flash.type === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={joinInventoryClasses("planner-data-text rounded-2xl border px-4 py-3", tone)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{flash.message}</p>
        <button type="button" onClick={onClose} className="text-current/70 transition hover:text-current">
          <span className="material-symbols-outlined">close</span>
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
            className="planner-data-text rounded-2xl border border-separator/40 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container"
          >
            Close
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <InlineBanner flash={flash} onClose={() => setFlash(null)} />

        {error ? (
          <div className="planner-data-text rounded-2xl border border-error/20 bg-error/10 px-5 py-4 text-sm text-error">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="planner-data-text rounded-2xl border border-separator/40 bg-surface-container-low/35 px-6 py-12 text-center text-sm text-on-surface-variant">
            Loading inventory transactions...
          </div>
        ) : null}

        {!loading && !error && !currentItem ? (
          <EmptyState variant="filled" className="planner-data-text">No inventory transactions were found for this serial number.</EmptyState>
        ) : null}

        {!loading && currentItem ? (
          <>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="planner-data-label text-outline">Current State</div>
                  <h3 className="planner-data-text mt-1 text-xl font-black text-on-surface">{currentItem.品番 || "Unknown Part"}</h3>
                  <p className="planner-data-text mt-1 text-sm text-on-surface-variant">
                    Serial {currentItem.背番号 || backNumber} {currentItem.工場 ? `· ${currentItem.工場}` : ""}
                  </p>
                </div>

                {canReset ? (
                  <button
                    type="button"
                    onClick={() => setResetPanelOpen((current) => !current)}
                    className="planner-data-text rounded-2xl border border-error/20 bg-white/80 px-4 py-2.5 text-sm font-bold text-error transition hover:bg-error/8 dark:bg-surface-container"
                  >
                    {resetPanelOpen ? "Hide Reset Controls" : "Reset Inventory"}
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                  <p className="planner-data-label text-outline">Part Number</p>
                  <p className="planner-data-text mt-2 text-sm font-semibold text-on-surface">{currentItem.品番 || "—"}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                  <p className="planner-data-label text-outline">Physical Stock</p>
                  <p className="planner-data-text mt-2 text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-300">{formatInventoryNumber(currentPhysical)}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                  <p className="planner-data-label text-outline">Reserved Stock</p>
                  <p className="planner-data-text mt-2 text-lg font-black tabular-nums text-amber-700 dark:text-amber-300">{formatInventoryNumber(currentReserved)}</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/15 bg-white/80 p-4 dark:bg-surface-container">
                  <p className="planner-data-label text-outline">Available Stock</p>
                  <p className="planner-data-text mt-2 text-lg font-black tabular-nums text-sky-700 dark:text-sky-300">{formatInventoryNumber(currentAvailable)}</p>
                </div>
              </div>
            </div>

            {canReset && resetPanelOpen ? (
              <div className="rounded-2xl border border-error/20 bg-error/6 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="planner-data-label text-error">Admin Reset</div>
                    <p className="planner-data-text mt-1 text-sm text-on-surface-variant">
                      This writes a new audit transaction and zeroes the selected inventory values.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="planner-data-text flex items-center gap-3 rounded-2xl border border-separator/40 bg-white/80 px-4 py-3 text-sm font-medium text-on-surface dark:bg-surface-container">
                    <input
                      type="checkbox"
                      checked={resetPhysical}
                      onChange={(event) => setResetPhysical(event.target.checked)}
                      className="h-4 w-4 rounded border-outline-variant/30 text-error"
                    />
                    Reset physical stock and available stock
                  </label>
                  <label className="planner-data-text flex items-center gap-3 rounded-2xl border border-separator/40 bg-white/80 px-4 py-3 text-sm font-medium text-on-surface dark:bg-surface-container">
                    <input
                      type="checkbox"
                      checked={resetReserved}
                      onChange={(event) => setResetReserved(event.target.checked)}
                      className="h-4 w-4 rounded border-outline-variant/30 text-error"
                    />
                    Reset reserved stock
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={resetSubmitting}
                    onClick={handleReset}
                    className="planner-data-text rounded-2xl bg-error px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resetSubmitting ? "Resetting..." : "Apply Reset"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="planner-data-label text-outline">History</div>
                  <h3 className="mt-1 text-base font-black text-on-surface">Transaction History</h3>
                </div>
                <div className="planner-data-text text-xs text-on-surface-variant">Newest first</div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-outline-variant/15 bg-white/80 dark:bg-surface-container">
                <table className="ui-table-data min-w-full border-separate border-spacing-0">
                  <thead className="border-b border-outline-variant/15 bg-surface-container-low/80">
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
                        <th key={label} className="ui-table-heading px-4 py-3 text-left text-outline">
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
                            "border-b border-outline-variant/10 align-top transition-colors last:border-b-0",
                            index === 0 ? "bg-primary/5" : "hover:bg-surface-container-low/30"
                          )}
                        >
                          <td className="planner-data-text px-4 py-3 text-on-surface-variant">{formatInventoryDateTime(transaction.timeStamp)}</td>
                          <td className="px-4 py-3">
                            <span className={joinInventoryClasses("planner-data-text inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", actionMeta.badgeClassName)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{actionMeta.icon}</span>
                              {transaction.action || "Unknown"}
                            </span>
                          </td>
                          <td className="planner-data-text px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-300">{formatInventoryNumber(physicalQuantity)}</td>
                          <td className="planner-data-text px-4 py-3 font-semibold text-amber-700 dark:text-amber-300">{formatInventoryNumber(reservedQuantity)}</td>
                          <td className="planner-data-text px-4 py-3 font-semibold text-sky-700 dark:text-sky-300">{formatInventoryNumber(availableQuantity)}</td>
                          <td className="planner-data-text px-4 py-3 text-on-surface-variant [overflow-wrap:anywhere]">{transaction.source || "System"}</td>
                          <td className="planner-data-text px-4 py-3 whitespace-pre-wrap text-on-surface-variant [overflow-wrap:anywhere]">{transaction.note || transaction.migrationNote || "—"}</td>
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