import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";

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
            className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={scheduling || !equipmentNames.length}
            onClick={() => onConfirm(timeLimit)}
            className="rounded-2xl kinetic-gradient px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scheduling ? "Applying…" : "Apply Smart Schedule"}
          </button>
        </div>
      )}
    >
      <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-low p-4">
        <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Schedule Until</label>
        <input
          type="time"
          value={timeLimit}
          onChange={(event) => setTimeLimit(event.target.value)}
          className="mt-2 h-11 w-full max-w-xs rounded-2xl border border-outline-variant/20 px-4 text-sm outline-none transition focus:border-primary/40"
        />
        <p className="mt-2 text-xs text-on-surface-variant">The scheduler will fit complete boxes before this time, with the same grace-period logic used in the original planner.</p>
      </div>

      <div className="mt-5 space-y-5">
        {!equipmentNames.length ? (
          <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface px-4 py-12 text-center text-sm text-on-surface-variant">
            No historical equipment matches were found for the current goals.
          </div>
        ) : equipmentNames.map((equipment) => (
          <section key={equipment} className="rounded-3xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-base font-black text-on-surface">{equipment}</h4>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                {assignments[equipment].length} goal{assignments[equipment].length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {assignments[equipment].map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-on-surface">{item.背番号 || item.品番}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{item.品番} · {item.remainingQuantity} pcs remaining</div>
                  </div>
                  <div className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
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