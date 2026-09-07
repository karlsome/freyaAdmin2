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
      <div className="space-y-3">
        <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-xs text-[var(--text-muted)]">
          <div className="text-xs font-semibold text-[var(--text-primary)]">{pendingGoal?.背番号 || pendingGoal?.品番}</div>
          <div className="mt-1">Existing: {Number(existingGoal?.targetQuantity || 0)} pcs</div>
          <div className="mt-0.5">Incoming: {Number(pendingGoal?.targetQuantity || 0)} pcs</div>
        </div>

        <div className="grid gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("overwrite")}
            className="rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-xs font-semibold text-[var(--text-primary)]">Overwrite</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Replace the existing goal with the new quantity.</div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("add")}
            className="rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-xs font-semibold text-[var(--text-primary)]">Add</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Increase the existing goal by the incoming quantity.</div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("cancel")}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-left transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-xs font-semibold text-[var(--text-primary)]">Cancel</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Keep the existing goal unchanged.</div>
          </button>
        </div>
      </div>
    </PlannerModalShell>
  );
}