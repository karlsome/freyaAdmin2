import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";
import { useLanguage } from "../../contexts/LanguageContext";

const btn = "rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-40";

function Metrics({ metrics, quantity, remaining, isJa }) {
  if (!metrics) return null;
  return (
    <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)]">
      <div>{isJa ? "箱数" : "Boxes"}: <strong className="text-[var(--text-primary)]">{metrics.boxes}</strong></div>
      <div>{isJa ? "時間" : "Time"}: <strong className="text-[var(--text-primary)]">{metrics.time}</strong></div>
      {remaining != null ? <div className="col-span-2">{quantity > 0 && remaining <= 0 ? (isJa ? "目標完了 ✓" : "Goal complete ✓") : (isJa ? `残り ${remaining} 個` : `Remaining: ${remaining} pcs`)}</div> : null}
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
  onOpenScanner,
  getMetrics,
  productColors = {},
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [queue, setQueue] = useState([]);

  const isBroken = isEquipmentUnavailable(equipment, unavailableEquipment);
  const brokenInfo = isBroken ? getEquipmentUnavailableInfo(equipment, unavailableEquipment) : null;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected([]);
    setQueue([]);
  }, [open, equipment, startTime]);

  const availableGoals = goals.filter((goal) => {
    const query = search.toLowerCase();
    if (goal.date !== currentDate || Number(goal.remainingQuantity || 0) <= 0) return false;
    if (selected.some((item) => item._id === goal._id) || queue.some((item) => item._id === goal._id)) return false;
    if (!query) return true;
    return (
      String(goal.背番号 || "").toLowerCase().includes(query)
      || String(goal.品番 || "").toLowerCase().includes(query)
      || String(goal.品名 || "").toLowerCase().includes(query)
    );
  });

  function addGoal(goal) {
    const capacity = parseInt(goal["収容数"], 10) || 1;
    const remaining = Number(goal.remainingQuantity || 0);
    setSelected((items) => [...items, { ...goal, quantity: Math.min(capacity, remaining) }]);
  }

  function setSelectedQuantity(id, value) {
    setSelected((items) => items.map((entry) => {
      if (entry._id !== id) return entry;
      const max = Number(entry.remainingQuantity || 0);
      return { ...entry, quantity: Math.min(Math.max(1, Number(value) || 1), max) };
    }));
  }

  function moveToOrder(id) {
    const entry = selected.find((item) => item._id === id);
    if (!entry) return;
    setSelected((items) => items.filter((item) => item._id !== id));
    setQueue((items) => [...items, entry]);
  }

  function backToSelected(id) {
    const entry = queue.find((item) => item._id === id);
    if (!entry) return;
    setQueue((items) => items.filter((item) => item._id !== id));
    setSelected((items) => [...items, entry]);
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

  const colorOf = (goal) => productColors[goal.背番号] || "#6B7280";

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? `${equipment || "設備"} にスケジュール追加` : `Schedule at ${equipment || "Equipment"}`}
      subtitle={isJa ? `開始時刻: ${startTime}。1つ以上の目標を追加すると、この枠から順次配置されます。` : `Start queue at ${startTime}. Pick products, set quantities, then arrange the production order; they are placed sequentially from this slot.`}
      onClose={onClose}
      maxWidthClassName="max-w-7xl"
      footer={(
        <div className="flex justify-end gap-3">
          {onOpenScanner ? (
            <button
              type="button"
              onClick={onOpenScanner}
              disabled={submitting}
              className="mr-auto flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>qr_code_scanner</span>
              {isJa ? "バーコードで追加" : "Scan to Add"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={submitting || isBroken || !queue.length}
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Column 1: available */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "選択可能な製品" : "Available Products"}</div>
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
          <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto">
            {availableGoals.map((goal) => {
              const capacity = parseInt(goal["収容数"], 10) || 1;
              const boxes = Math.ceil(Number(goal.remainingQuantity || 0) / capacity);
              return (
                <button
                  key={goal._id}
                  type="button"
                  onClick={() => addGoal(goal)}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition hover:border-[var(--freya-blue)] hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorOf(goal) }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{goal.背番号 || goal.品番}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">{goal.品番}</div>
                      <div className="mt-1 text-xs font-semibold text-[var(--freya-blue)]">
                        {goal.remainingQuantity} {isJa ? "個" : "pcs"} / {boxes} {isJa ? "箱" : (boxes === 1 ? "box" : "boxes")}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 18 }}>add_circle</span>
                  </div>
                </button>
              );
            })}
            {!availableGoals.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">
                {isJa ? "選択可能な目標はありません。" : "No products found."}
              </EmptyState>
            ) : null}
          </div>
        </div>

        {/* Column 2: selected with quantities */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "選択 & 数量" : "Selected & Quantities"}</div>
          <div className="max-h-[56vh] space-y-2 overflow-y-auto">
            {selected.map((item) => {
              const metrics = getMetrics?.(item, item.quantity);
              const remaining = Math.max(0, Number(item.remainingQuantity || 0) - Number(item.quantity || 0));
              return (
                <div key={item._id} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorOf(item) }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">{item.品名 || item.品番}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{isJa ? `目標 残 ${item.remainingQuantity} 個` : `Goal remaining ${item.remainingQuantity} pcs`}</div>
                    </div>
                    <button type="button" onClick={() => setSelected((items) => items.filter((e) => e._id !== item._id))} className="text-[var(--status-danger)]" aria-label={isJa ? "削除" : "Remove"}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  </div>
                  <label className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "数量" : "Quantity"}</label>
                  <input
                    type="number"
                    min="1"
                    max={item.remainingQuantity}
                    value={item.quantity}
                    onChange={(event) => setSelectedQuantity(item._id, event.target.value)}
                    className="mt-1 h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                  />
                  <Metrics metrics={metrics} quantity={item.quantity} remaining={remaining} isJa={isJa} />
                  <button type="button" onClick={() => moveToOrder(item._id)} className="mt-2 w-full rounded-[4px] bg-emerald-500/10 px-2 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300">
                    {isJa ? "順序に移動 →" : "Move to Order →"}
                  </button>
                </div>
              );
            })}
            {!selected.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">
                {isJa ? "左の製品をクリックして追加" : "Click products to add"}
              </EmptyState>
            ) : null}
          </div>
        </div>

        {/* Column 3: production order */}
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "生産順序" : "Production Order"}</div>
            <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
              {isJa ? `${selected.length + queue.length} 件選択 | ${queue.length} 件準備完了` : `${selected.length + queue.length} selected | ${queue.length} ready`}
            </div>
          </div>
          <div className="max-h-[56vh] space-y-2 overflow-y-auto">
            {queue.map((item, index) => {
              const metrics = getMetrics?.(item, item.quantity);
              return (
                <div key={item._id} className="relative rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 pl-9">
                  <span className="absolute left-2 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--freya-blue)] text-[10px] font-bold text-white">{index + 1}</span>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorOf(item) }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">{item.品名 || item.品番}</div>
                    </div>
                    <button type="button" onClick={() => backToSelected(item._id)} className="text-[var(--status-danger)]" aria-label={isJa ? "選択に戻す" : "Back to selected"}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">{isJa ? "数量" : "Qty"}: <strong className="text-[var(--text-primary)]">{item.quantity}</strong></div>
                  <Metrics metrics={metrics} quantity={item.quantity} isJa={isJa} />
                  <div className="mt-2 flex gap-1">
                    <button type="button" onClick={() => moveQueueItem(index, -1)} disabled={index === 0} className={`${btn} flex-1`}>↑ {isJa ? "上へ" : "Up"}</button>
                    <button type="button" onClick={() => moveQueueItem(index, 1)} disabled={index === queue.length - 1} className={`${btn} flex-1`}>↓ {isJa ? "下へ" : "Down"}</button>
                  </div>
                </div>
              );
            })}
            {!queue.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">
                {isJa ? "先に数量を設定して順序に移動してください" : "Add quantities first, then move them here"}
              </EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </PlannerModalShell>
  );
}