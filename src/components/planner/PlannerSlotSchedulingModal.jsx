import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";

function QueueRow({ item, index, total, onMove, onQuantityChange, onRemove }) {
  return (
    <div className="planner-data-text rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-on-surface">{item.背番号 || item.品番}</div>
          <div className="mt-1 text-on-surface-variant">{item.品番}</div>
          <div className="mt-1 text-on-surface-variant">Remaining {item.remainingQuantity} pcs</div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className="rounded-2xl border border-outline-variant/20 px-2 py-1 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:opacity-40">↑</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} className="rounded-2xl border border-outline-variant/20 px-2 py-1 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:opacity-40">↓</button>
          <button type="button" onClick={() => onRemove(item._id)} className="rounded-2xl border border-error/20 px-2 py-1 text-xs font-bold text-error transition hover:bg-error/10">Remove</button>
        </div>
      </div>

      <div className="mt-3">
        <label className="planner-data-label text-outline">Schedule Quantity</label>
        <input
          type="number"
          min="1"
          max={item.remainingQuantity}
          value={item.quantity}
          onChange={(event) => onQuantityChange(item._id, Number(event.target.value || 0))}
          className="planner-data-text mt-2 h-11 w-full rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
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
            className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !queue.length}
            onClick={() => onConfirm(queue)}
            className="rounded-2xl kinetic-gradient px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : `Schedule ${queue.length} item${queue.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    >
      <div className="planner-data-text grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <div className="ui-control-surface flex h-11 items-center gap-3 rounded-2xl border border-outline-variant/20 px-4">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search goals for this date…"
              className="planner-data-text h-full flex-1 bg-transparent outline-none"
            />
          </div>

          <div className="mt-4 max-h-[58vh] space-y-2 overflow-y-auto">
            {availableGoals.map((goal) => {
              const queued = queue.some((item) => item._id === goal._id);
              return (
                <button
                  key={goal._id}
                  type="button"
                  onClick={() => addGoal(goal)}
                  disabled={queued}
                  className="w-full rounded-2xl border border-outline-variant/15 bg-surface px-4 py-4 text-left transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-on-surface">{goal.背番号 || goal.品番}</div>
                      <div className="mt-1 text-on-surface-variant">{goal.品番}</div>
                      <div className="mt-1 text-on-surface-variant">{goal.品名 || "Unnamed product"}</div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      {goal.remainingQuantity} pcs
                    </span>
                  </div>
                </button>
              );
            })}

            {!availableGoals.length ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface px-4 py-10 text-center text-on-surface-variant">
                No goals with remaining quantity are available for the selected date.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="planner-data-label text-outline">Queue</div>
              <div className="mt-1 text-on-surface-variant">Items run in the order shown here.</div>
            </div>
            <div className="rounded-full bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              {queue.length} selected
            </div>
          </div>

          <div className="max-h-[58vh] space-y-3 overflow-y-auto">
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
              <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface px-4 py-10 text-center text-on-surface-variant">
                Add goals from the left panel to build a scheduling queue.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PlannerModalShell>
  );
}