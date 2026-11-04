import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";
import { useLanguage } from "../../contexts/LanguageContext";

function QueueRow({ item, index, total, onMove, onQuantityChange, onRemove, isJa }) {
  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番}</div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">{item.品番}</div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">
            {isJa ? `残 ${item.remainingQuantity} 個` : `Remaining ${item.remainingQuantity} pcs`}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-40">↑</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-40">↓</button>
          <button type="button" onClick={() => onRemove(item._id)} className="rounded-[4px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-2 py-0.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10">
            {isJa ? "削除" : "Remove"}
          </button>
        </div>
      </div>

      <div className="mt-2.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          {isJa ? "計画数量" : "Schedule Quantity"}
        </label>
        <input
          type="number"
          min="1"
          max={item.remainingQuantity}
          value={item.quantity}
          onChange={(event) => onQuantityChange(item._id, Number(event.target.value || 0))}
          className="mt-1.5 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
        />
      </div>
    </div>
  );
}

import {
  getEquipmentUnavailableInfo,
  isEquipmentUnavailable,
} from "../../utils/planner";

export default function PlannerSlotSchedulingModal({
  open,
  equipment,
  startTime,
  goals = [],
  currentDate,
  unavailableEquipment = {},
  submitting = false,
  onClose,
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState([]);

  const isBroken = isEquipmentUnavailable(equipment, unavailableEquipment);
  const brokenInfo = isBroken ? getEquipmentUnavailableInfo(equipment, unavailableEquipment) : null;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setQueue([]);
  }, [open, equipment, startTime]);

  const availableGoals = goals.filter((goal) => {
    const query = search.toLowerCase();
    if (goal.date !== currentDate || Number(goal.remainingQuantity || 0) <= 0) return false;
    if (!query) return true;
    return (
      String(goal.背番号 || "").toLowerCase().includes(query)
      || String(goal.品番 || "").toLowerCase().includes(query)
      || String(goal.品名 || "").toLowerCase().includes(query)
    );
  });

  function addGoal(goal) {
    setQueue((items) => {
      if (items.some((item) => item._id === goal._id)) return items;
      return [...items, { ...goal, quantity: Number(goal.remainingQuantity || 0) }];
    });
  }

  function moveQueueItem(index, direction) {
    setQueue((items) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= items.length) return items;
      const next = [...items];
      const [entry] = next.splice(index, 1);
      next.splice(targetIndex, 0, entry);
      return next;
    });
  }

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? `${equipment || "設備"} にスケジュール追加` : `Schedule at ${equipment || "Equipment"}`}
      subtitle={isJa ? `開始時刻: ${startTime}。1つ以上の目標を追加すると、この枠から順次配置されます。` : `Start queue at ${startTime}. Add one or more goals and they will be placed sequentially from this slot.`}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
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
            disabled={submitting || !queue.length}
            onClick={() => onConfirm(queue)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? (isJa ? "スケジュール中…" : "Scheduling…")
              : (isJa ? `${queue.length} 件をスケジュール` : `Schedule ${queue.length} item${queue.length === 1 ? "" : "s"}`)}
          </button>
        </div>
      )}
    >
      {isBroken ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-200 shadow-2xs">
          <span className="material-symbols-outlined text-lg text-red-600 dark:text-red-400">warning</span>
          <div>
            <div className="font-bold">
              {isJa ? `【注意】${equipment} は現在、故障・保全停止中として登録されています。` : `[Warning] ${equipment} is currently reported as broken down / under maintenance.`}
            </div>
            {brokenInfo?.reason ? (
              <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-300">
                {isJa ? `停止理由: ${brokenInfo.reason}` : `Reason: ${brokenInfo.reason}`}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="flex h-9 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--freya-blue)] focus-within:ring-1 focus-within:ring-[var(--freya-blue)]">
            <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isJa ? "この日付の目標を検索…" : "Search goals for this date…"}
              className="h-full flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>

          <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto">
            {availableGoals.map((goal) => {
              const queued = queue.some((item) => item._id === goal._id);
              return (
                <button
                  key={goal._id}
                  type="button"
                  onClick={() => addGoal(goal)}
                  disabled={queued}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">{goal.背番号 || goal.品番}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{goal.品番}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{goal.品名 || (isJa ? "品名未設定" : "Unnamed product")}</div>
                    </div>
                    <span className="rounded-[4px] bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--freya-blue)]">
                      {goal.remainingQuantity} {isJa ? "個" : "pcs"}
                    </span>
                  </div>
                </button>
              );
            })}

            {!availableGoals.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">
                {isJa ? "選択された日付に未完了の目標はありません。" : "No goals with remaining quantity are available for the selected date."}
              </EmptyState>
            ) : null}
          </div>
        </div>

        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "投入キュー" : "Queue"}
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                {isJa ? "ここに表示されている順序で実行されます。" : "Items run in the order shown here."}
              </div>
            </div>
            <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? `${queue.length} 件選択中` : `${queue.length} selected`}
            </div>
          </div>

          <div className="max-h-[58vh] space-y-2 overflow-y-auto">
            {queue.map((item, index) => (
              <QueueRow
                key={item._id}
                item={item}
                index={index}
                total={queue.length}
                onMove={moveQueueItem}
                onQuantityChange={(id, nextQuantity) => {
                  setQueue((items) => items.map((entry) => {
                    if (entry._id !== id) return entry;
                    return { ...entry, quantity: Math.min(Math.max(1, nextQuantity), Number(entry.remainingQuantity || 0)) };
                  }));
                }}
                onRemove={(id) => setQueue((items) => items.filter((entry) => entry._id !== id))}
                isJa={isJa}
              />
            ))}

            {!queue.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">
                {isJa ? "左側のパネルから目標を追加してスケジュールキューを作成してください。" : "Add goals from the left panel to build a scheduling queue."}
              </EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </PlannerModalShell>
  );
}