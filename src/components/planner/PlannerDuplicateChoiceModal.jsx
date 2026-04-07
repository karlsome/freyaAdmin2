import PlannerModalShell from "./PlannerModalShell";

export default function PlannerDuplicateChoiceModal({
  open,
  existingGoal,
  pendingGoal,
  busy = false,
  onClose,
  onResolve,
}) {
  return (
    <PlannerModalShell
      open={open}
      title="Duplicate Goal Found"
      subtitle="A goal for this product and date already exists. Choose how the new quantity should be applied."
      onClose={onClose}
      maxWidthClassName="max-w-xl"
    >
      <div className="planner-data-text space-y-4">
        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-low p-4 text-on-surface-variant">
          <div className="font-bold text-on-surface">{pendingGoal?.背番号 || pendingGoal?.品番}</div>
          <div className="mt-1">Existing: {Number(existingGoal?.targetQuantity || 0)} pcs</div>
          <div className="mt-1">Incoming: {Number(pendingGoal?.targetQuantity || 0)} pcs</div>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("overwrite")}
            className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-left transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-bold text-on-surface">Overwrite</div>
            <div className="mt-1 text-on-surface-variant">Replace the existing goal with the new quantity.</div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("add")}
            className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-left transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-bold text-on-surface">Add</div>
            <div className="mt-1 text-on-surface-variant">Increase the existing goal by the incoming quantity.</div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("cancel")}
            className="rounded-3xl border border-outline-variant/20 px-5 py-4 text-left transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-bold text-on-surface">Cancel</div>
            <div className="mt-1 text-on-surface-variant">Keep the existing goal unchanged.</div>
          </button>
        </div>
      </div>
    </PlannerModalShell>
  );
}