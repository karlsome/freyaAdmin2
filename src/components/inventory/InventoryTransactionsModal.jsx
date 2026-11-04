import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
      setError(loadError.message || (isJa ? "在庫トランザクションの読み込みに失敗しました。" : "Failed to load inventory transactions."));
    } finally {
      setLoading(false);
    }
  }, [backNumber, isJa]);

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
      setFlash({ type: "warning", message: isJa ? "リセットする在庫の項目を少なくとも1つ選択してください。" : "Select at least one inventory value to reset." });
      return;
    }

    const hasPhysicalToReset = resetPhysical && (currentPhysical !== 0 || currentAvailable !== 0);
    const hasReservedToReset = resetReserved && currentReserved !== 0;

    if (!hasPhysicalToReset && !hasReservedToReset) {
      setFlash({ type: "warning", message: isJa ? "選択された在庫の値はすでに0です。" : "The selected inventory values are already zero." });
      return;
    }

    const resetLines = [];
    if (resetPhysical) {
      resetLines.push(isJa ? `実在庫: ${formatInventoryNumber(currentPhysical)} -> 0` : `Physical: ${formatInventoryNumber(currentPhysical)} -> 0`);
      resetLines.push(isJa ? `利用可能: ${formatInventoryNumber(currentAvailable)} -> 0` : `Available: ${formatInventoryNumber(currentAvailable)} -> 0`);
    }
    if (resetReserved) {
      resetLines.push(isJa ? `引当: ${formatInventoryNumber(currentReserved)} -> 0` : `Reserved: ${formatInventoryNumber(currentReserved)} -> 0`);
    }

    const firstConfirm = window.confirm(
      isJa
        ? `${backNumber} の在庫をリセットしますか？\n\n${resetLines.join("\n")}\n\n監査トランザクションが作成されます。`
        : `Reset inventory for ${backNumber}?\n\n${resetLines.join("\n")}\n\nThis creates an audit transaction.`
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      isJa
        ? "この操作は新しいリセットトランザクションを書き込みます。慎重に使用してください。続行しますか？"
        : "This action writes a new reset transaction and should be used carefully. Continue?"
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
      setFlash({ type: "success", message: result?.message || (isJa ? "在庫のリセットが完了しました。" : "Inventory reset completed.") });
      onUpdated?.({ type: "success", message: result?.message || (isJa ? `${backNumber} の在庫リセットが完了しました。` : `Inventory reset completed for ${backNumber}.`) });
    } catch (resetError) {
      setFlash({ type: "error", message: resetError.message || (isJa ? "在庫のリセットに失敗しました。" : "Failed to reset inventory.") });
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <PlannerModalShell
      open={open}
      title={backNumber ? (isJa ? `在庫履歴 · ${backNumber}` : `Inventory Transactions · ${backNumber}`) : (isJa ? "在庫履歴" : "Inventory Transactions")}
      subtitle={currentItem ? (isJa ? `${orderedTransactions.length} 件の取引履歴` : `${orderedTransactions.length} transaction${orderedTransactions.length === 1 ? "" : "s"} found`) : (isJa ? "現在の状態と取引履歴を確認します。" : "Review the current state and full transaction history.")}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "閉じる" : "Close"}
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
            {isJa ? "在庫トランザクションを読み込み中..." : "Loading inventory transactions..."}
          </div>
        ) : null}

        {!loading && !error && !currentItem ? (
          <EmptyState variant="filled" className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] py-8 text-xs text-[var(--text-muted)]">
            {isJa ? "この背番号の在庫履歴は見つかりませんでした。" : "No inventory transactions were found for this serial number."}
          </EmptyState>
        ) : null}

        {!loading && currentItem ? (
          <>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "現在の状態" : "Current State"}</div>
                  <h3 className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">{currentItem.品番 || (isJa ? "不明な品番" : "Unknown Part")}</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {isJa ? "背番号" : "Serial"} {currentItem.背番号 || backNumber} {currentItem.工場 ? `· ${currentItem.工場}` : ""}
                  </p>
                </div>

                {canReset ? (
                  <button
                    type="button"
                    onClick={() => setResetPanelOpen((current) => !current)}
                    className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10"
                  >
                    {resetPanelOpen ? (isJa ? "リセット設定を閉じる" : "Hide Reset Controls") : (isJa ? "在庫リセット" : "Reset Inventory")}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "品番" : "Part Number"}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{currentItem.品番 || "—"}</p>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "実在庫数" : "Physical Stock"}</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatInventoryNumber(currentPhysical)}</p>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "引当在庫数" : "Reserved Stock"}</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatInventoryNumber(currentReserved)}</p>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "利用可能在庫数" : "Available Stock"}</p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-sky-600 dark:text-sky-400">{formatInventoryNumber(currentAvailable)}</p>
                </div>
              </div>
            </div>

            {canReset && resetPanelOpen ? (
              <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--status-danger)]">{isJa ? "管理者リセット" : "Admin Reset"}</div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {isJa ? "新しい監査トランザクションを記録し、選択した在庫値をゼロにします。" : "This writes a new audit transaction and zeroes the selected inventory values."}
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
                    {isJa ? "実在庫および利用可能在庫をリセット" : "Reset physical stock and available stock"}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={resetReserved}
                      onChange={(event) => setResetReserved(event.target.checked)}
                      className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--status-danger)]"
                    />
                    {isJa ? "引当在庫をリセット" : "Reset reserved stock"}
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={resetSubmitting}
                    onClick={handleReset}
                    className="rounded-[6px] bg-[var(--status-danger)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetSubmitting ? (isJa ? "リセット中..." : "Resetting...") : (isJa ? "リセットを実行" : "Apply Reset")}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "履歴" : "History"}</div>
                  <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{isJa ? "取引履歴" : "Transaction History"}</h3>
                </div>
                <div className="text-xs text-[var(--text-muted)]">{isJa ? "新しい順" : "Newest first"}</div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
                <table className="min-w-full">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                    <tr>
                      {[
                        { key: "time", label: isJa ? "日時" : "Date & Time" },
                        { key: "action", label: isJa ? "アクション" : "Action" },
                        { key: "physical", label: isJa ? "実在庫" : "Physical" },
                        { key: "reserved", label: isJa ? "引当" : "Reserved" },
                        { key: "available", label: isJa ? "利用可能" : "Available" },
                        { key: "source", label: isJa ? "発生元" : "Source" },
                        { key: "note", label: isJa ? "備考" : "Note" },
                      ].map((col) => (
                        <th key={col.key} className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                          {col.label}
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
                              {transaction.action || (isJa ? "不明" : "Unknown")}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatInventoryNumber(physicalQuantity)}</td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{formatInventoryNumber(reservedQuantity)}</td>
                          <td className="px-3.5 py-2.5 text-xs font-semibold text-sky-600 dark:text-sky-400">{formatInventoryNumber(availableQuantity)}</td>
                          <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)] [overflow-wrap:anywhere]">{transaction.source || (isJa ? "システム" : "System")}</td>
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