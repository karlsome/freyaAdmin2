import { useLanguage } from "../../contexts/LanguageContext";
import PlannerModalShell from "./PlannerModalShell";
import {
  assignmentBoxCount,
  assignmentCapacity,
  assignmentLimitQuantity,
  assignmentMaxBoxes,
  blockLabel,
} from "../../utils/plannerPreviewEngine";

const fmt = (value) => Number(value || 0).toLocaleString();

// Adjust a draft block in box units.
export function PlannerDraftQuantityModal({ ctx, assignment, onAdjust, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  if (!assignment) return null;

  const boxes = assignmentBoxCount(ctx, assignment);
  const maxBoxes = assignmentMaxBoxes(ctx, assignment);
  const capacity = assignmentCapacity(ctx, assignment);
  const removed = Math.max(0, assignmentLimitQuantity(assignment) - Math.max(0, Number(assignment.quantity || 0)));
  const request = assignment.requestNumberLabel || assignment.requestNumber || (isJa ? "プレビュー追加" : "Preview insert");

  return (
    <PlannerModalShell
      open
      onClose={onClose}
      maxWidthClassName="max-w-sm"
      title={`${blockLabel(assignment, isJa ? "ブロック" : "Block")} (${request})`}
      subtitle={isJa
        ? "ブロックを箱単位で調整します。減らした分は時間超過リストに戻ります。"
        : "Adjust this draft block in box units. Removed boxes return to the time-limit list."}
      footer={(
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
            {isJa ? "完了" : "Done"}
          </button>
        </div>
      )}
    >
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          [isJa ? "箱数" : "Boxes", fmt(boxes)],
          [isJa ? "数量" : "Quantity", fmt(assignment.quantity)],
          [isJa ? "収容数" : "Per Box", fmt(capacity)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-[var(--text-primary)]">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[8px] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        {isJa
          ? `このブロックでスケジュール外になっている数量: ${fmt(removed)} 個`
          : `${fmt(removed)} pcs are currently outside the draft schedule for this block.`}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onAdjust(-1)}
          disabled={boxes <= 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 disabled:opacity-40"
          aria-label={isJa ? "1箱減らす" : "Remove one box"}
        >
          <span className="material-symbols-outlined">remove</span>
        </button>
        <div className="rounded-full bg-[var(--text-primary)] px-4 py-1.5 font-mono text-sm font-semibold text-[var(--surface)]">
          {fmt(boxes)} / {fmt(maxBoxes)} {isJa ? "箱" : "boxes"}
        </div>
        <button
          type="button"
          onClick={() => onAdjust(1)}
          disabled={boxes >= maxBoxes}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-40"
          aria-label={isJa ? "1箱増やす" : "Add one box"}
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>
    </PlannerModalShell>
  );
}

// Pick a time-limit shortage line to drop into an empty slot.
export function PlannerDraftInsertModal({ target, options = [], onPick, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  if (!target) return null;

  return (
    <PlannerModalShell
      open
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      title={`${target.equipment} · ${target.time}`}
      subtitle={isJa
        ? `時間超過リストから不足ラインを選び、${target.equipment} の ${target.time} から配置します。`
        : `Choose a shortage line from the time-limit list to place on ${target.equipment} from ${target.time}.`}
    >
      {options.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-amber-500/40 bg-amber-500/10 px-4 py-5 text-sm text-amber-700 dark:text-amber-300">
          {isJa
            ? `${target.equipment} の ${target.time} 以降に入る時間超過の不足ラインはありません。`
            : `No time-limit shortage lines can fit on ${target.equipment} from ${target.time}.`}
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((option) => {
            const request = option.priorityRow?.requestNumberLabel || option.priorityRow?.requestNumber || option.exception?.requestNumber || "-";
            return (
              <button
                key={option.exception?.id}
                type="button"
                onClick={() => onPick(option.exception)}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-left transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {request} - {blockLabel(option.priorityRow, isJa ? "ブロック" : "Block")}
                    </div>
                    <div className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      {isJa
                        ? `追加: ${fmt(option.quantity)} 個 · ${fmt(option.boxes)} 箱`
                        : `Adds ${fmt(option.quantity)} pcs · ${fmt(option.boxes)} boxes`}
                    </div>
                    <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
                      {option.remainingQuantity > 0
                        ? (isJa ? `挿入後も ${fmt(option.remainingQuantity)} 個が枠外に残ります。` : `${fmt(option.remainingQuantity)} pcs will remain outside the draft window after this insert.`)
                        : (isJa ? "この不足ラインの残り全量が入ります。" : "This insert fits the full remaining shortage for this line.")}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--text-primary)] px-3 py-1 text-xs font-semibold text-[var(--surface)]">
                    {isJa ? "ここに追加" : "Add Here"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </PlannerModalShell>
  );
}
