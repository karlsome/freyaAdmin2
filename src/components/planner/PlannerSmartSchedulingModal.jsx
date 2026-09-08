import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";
import { useLanguage } from "../../contexts/LanguageContext";

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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
      title={isJa ? "スマートスケジューリング" : "Smart Scheduling"}
      subtitle={
        isJa
          ? `プレス履歴から ${totalAssigned} 件の目標を割当済、一致なし ${totalUnassigned} 件。`
          : `${totalAssigned} goals assigned from press history, ${totalUnassigned} without a strong match.`
      }
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
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
            disabled={scheduling || !equipmentNames.length}
            onClick={() => onConfirm(timeLimit)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scheduling
              ? (isJa ? "適用中…" : "Applying…")
              : (isJa ? "スマートスケジュールを適用" : "Apply Smart Schedule")}
          </button>
        </div>
      )}
    >
      <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          {isJa ? "終了時刻の指定" : "Schedule Until"}
        </label>
        <input
          type="time"
          value={timeLimit}
          onChange={(event) => setTimeLimit(event.target.value)}
          className="mt-1.5 h-9 w-full max-w-xs rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
        />
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
          {isJa
            ? "スケジューラはこの時刻までに収まる箱数を自動計算し、元の計画ロジックと同じ猶予期間を適用します。"
            : "The scheduler will fit complete boxes before this time, with the same grace-period logic used in the original planner."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {!equipmentNames.length ? (
          <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-xs text-[var(--text-muted)]">
            {isJa ? "現在の目標に合致する過去の設備履歴が見つかりませんでした。" : "No historical equipment matches were found for the current goals."}
          </EmptyState>
        ) : equipmentNames.map((equipment) => (
          <section key={equipment} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">{equipment}</h4>
              <span className="rounded-[4px] bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--freya-blue)]">
                {isJa
                  ? `${assignments[equipment].length} 目標`
                  : `${assignments[equipment].length} goal${assignments[equipment].length === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="space-y-1.5">
              {assignments[equipment].map((item) => (
                <div key={item._id} className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">{item.背番号 || item.品番}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {item.品番} · {isJa ? `残 ${item.remainingQuantity} 個` : `${item.remainingQuantity} pcs remaining`}
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa
                      ? `信頼度 ${Math.round(Number(item.confidence || 0) * 100)}%`
                      : `${Math.round(Number(item.confidence || 0) * 100)}% confidence`}
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