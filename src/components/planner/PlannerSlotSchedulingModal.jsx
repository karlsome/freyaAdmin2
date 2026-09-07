import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";

function QueueRow({ item, index, total, onMove, onQuantityChange, onRemove }) {
  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番}</div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">{item.品番}</div>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">Remaining {item.remainingQuantity} pcs</div>
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-40">↑</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-40">↓</button>
          <button type="button" onClick={() => onRemove(item._id)} className="rounded-[4px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-2 py-0.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10">Remove</button>
        </div>
      </div>

      <div className="mt-2.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Schedule Quantity</label>
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

export default function PlannerSlotSchedulingModal({
  open,
  equipment,
  startTime,
  goals = [],
  currentDate,
  submitting = false,
  onClose,
  onConfirm,
}) {
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState([]);

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
      title={`Schedule at ${equipment || "Equipment"}`}
      subtitle={`Start queue at ${startTime}. Add one or more goals and they will be placed sequentially from this slot.`}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !queue.length}
            onClick={() => onConfirm(queue)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : `Schedule ${queue.length} item${queue.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="flex h-9 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--freya-blue)] focus-within:ring-1 focus-within:ring-[var(--freya-blue)]">
            <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search goals for this date…"
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
                      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{goal.品名 || "Unnamed product"}</div>
                    </div>
                    <span className="rounded-[4px] bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--freya-blue)]">
                      {goal.remainingQuantity} pcs
                    </span>
                  </div>
                </button>
              );
            })}

            {!availableGoals.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">No goals with remaining quantity are available for the selected date.</EmptyState>
            ) : null}
          </div>
        </div>

        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Queue</div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">Items run in the order shown here.</div>
            </div>
            <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {queue.length} selected
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
              />
            ))}

            {!queue.length ? (
              <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-xs text-[var(--text-muted)]">Add goals from the left panel to build a scheduling queue.</EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </PlannerModalShell>
  );
}