import { useLanguage } from "../../contexts/LanguageContext";
import PlannerModalShell from "./PlannerModalShell";

export default function PlannerDuplicateChoiceModal({
  open,
  existingGoal,
  pendingGoal,
  busy = false,
  onClose,
  onResolve,
}) {
  const { t } = useLanguage();
  return (
    <PlannerModalShell
      open={open}
      title={t("duplicateGoalFound")}
      subtitle={t("goalForProductExists")}
      onClose={onClose}
      maxWidthClassName="max-w-xl"
    >
      <div className="planner-data-text space-y-4">
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4 text-on-surface-variant">
          <div className="font-semibold text-on-surface">{pendingGoal?.背番号 || pendingGoal?.品番}</div>
          <div className="mt-1">Existing: {Number(existingGoal?.targetQuantity || 0)} pcs</div>
          <div className="mt-1">Incoming: {Number(pendingGoal?.targetQuantity || 0)} pcs</div>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("overwrite")}
            className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-left transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-semibold text-on-surface">{t("overwrite")}</div>
            <div className="mt-1 text-on-surface-variant">{t("replaceExistingGoal")}</div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("add")}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-left transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-semibold text-on-surface">{t("add")}</div>
            <div className="mt-1 text-on-surface-variant">{t("increaseExistingGoal")}</div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve("cancel")}
            className="rounded-2xl border border-separator/40 px-5 py-4 text-left transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="font-semibold text-on-surface">{t("cancel")}</div>
            <div className="mt-1 text-on-surface-variant">{t("keepExistingGoalUnchanged")}</div>
          </button>
        </div>
      </div>
    </PlannerModalShell>
  );
}