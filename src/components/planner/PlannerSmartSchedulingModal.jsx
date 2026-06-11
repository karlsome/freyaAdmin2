import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";

export default function PlannerSmartSchedulingModal({
  open,
  assignments = {},
  totalAssigned = 0,
  totalUnassigned = 0,
  initialTimeLimit = "17:30",
  scheduling = false,
  onClose,
  onConfirm,
}) {
  const [timeLimit, setTimeLimit] = useState(initialTimeLimit);

  useEffect(() => {
    if (open) {
      setTimeLimit(initialTimeLimit);
    }
  }, [open, initialTimeLimit]);

  const equipmentNames = Object.keys(assignments);

  return (
    <PlannerModalShell
      open={open}
      title="Smart Scheduling"
      subtitle={`${totalAssigned} goals assigned from press history, ${totalUnassigned} without a strong match.`}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-separator/40 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={scheduling || !equipmentNames.length}
            onClick={() => onConfirm(timeLimit)}
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scheduling ? "Applying…" : "Apply Smart Schedule"}
          </button>
        </div>
      )}
    >
      <div className="planner-data-text rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
        <label className="planner-data-label text-outline">Schedule Until</label>
        <input
          type="time"
          value={timeLimit}
          onChange={(event) => setTimeLimit(event.target.value)}
          className="planner-data-text mt-2 h-11 w-full max-w-xs rounded-2xl border border-separator/40 px-4 outline-none transition focus:border-primary/40"
        />
        <p className="mt-2 text-on-surface-variant">The scheduler will fit complete boxes before this time, with the same grace-period logic used in the original planner.</p>
      </div>

      <div className="mt-5 space-y-5">
        {!equipmentNames.length ? (
          <EmptyState className="planner-data-text bg-surface px-4">No historical equipment matches were found for the current goals.</EmptyState>
        ) : equipmentNames.map((equipment) => (
          <section key={equipment} className="planner-data-text rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-semibold text-on-surface">{equipment}</h4>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                {assignments[equipment].length} goal{assignments[equipment].length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {assignments[equipment].map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
                  <div>
                    <div className="font-semibold text-on-surface">{item.背番号 || item.品番}</div>
                    <div className="mt-1 text-on-surface-variant">{item.品番} · {item.remainingQuantity} pcs remaining</div>
                  </div>
                  <div className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    {Math.round(Number(item.confidence || 0) * 100)}% confidence
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PlannerModalShell>
  );
}