import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerGoalImportReviewModal({
  open,
  rows = [],
  importing = false,
  onClose,
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    if (!open) return;

    const defaults = {};
    rows.forEach((row) => {
      if (row.status === "duplicate") defaults[row.id] = "add";
    });
    setDecisions(defaults);
  }, [open, rows]);

  const validCount = rows.filter((row) => row.status === "valid").length;
  const duplicateCount = rows.filter((row) => row.status === "duplicate").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  const headings = isJa
    ? ["日付", "背番号", "品番", "品名", "目標数量", "状態", "処理"]
    : ["Date", "背番号", "品番", "品名", "Target", "Status", "Action"];

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? "インポート目標の確認" : "Review Imported Goals"}
      subtitle={
        isJa
          ? `${validCount} 件新規、${duplicateCount} 件重複、${errorCount} 件無効`
          : `${validCount} new, ${duplicateCount} duplicate, ${errorCount} invalid row${errorCount === 1 ? "" : "s"}`
      }
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
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
            disabled={importing || !rows.some((row) => row.status === "valid" || row.status === "duplicate")}
            onClick={() => onConfirm(decisions)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (isJa ? "インポート中…" : "Importing…") : (isJa ? "インポートを適用" : "Apply Import")}
          </button>
        </div>
      )}
    >
      <div className="overflow-x-auto rounded-[6px] border border-[var(--border)]">
        <table className="min-w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
            <tr>
              {headings.map((label) => (
                <th key={label} className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-b border-[var(--border)] transition hover:bg-[var(--surface-hover)] ${row.status === "error" ? "bg-[var(--status-danger)]/5" : row.status === "duplicate" ? "bg-amber-500/5" : ""}`}>
                <td className="px-3.5 py-2.5 text-xs text-[var(--text-primary)]">{row.date}</td>
                <td className="px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]">{row.背番号 || "-"}</td>
                <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)]">{row.品番 || "-"}</td>
                <td className="px-3.5 py-2.5 text-xs text-[var(--text-muted)]">{row.品名 || row.error || "-"}</td>
                <td className="px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)]">{row.targetQuantity}</td>
                <td className="px-3.5 py-2.5 text-xs">
                  {row.status === "valid" ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">{isJa ? "登録可" : "Ready"}</span> : null}
                  {row.status === "duplicate" ? <span className="font-semibold text-amber-600 dark:text-amber-400">{isJa ? "重複" : "Duplicate"}</span> : null}
                  {row.status === "error" ? <span className="font-semibold text-[var(--status-danger)]">{isJa ? "無効" : "Invalid"}</span> : null}
                </td>
                <td className="px-3.5 py-2.5 text-xs text-[var(--text-primary)]">
                  {row.status === "duplicate" ? (
                    <select
                      value={decisions[row.id] || "add"}
                      onChange={(event) => setDecisions((state) => ({ ...state, [row.id]: event.target.value }))}
                      className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                    >
                      <option value="add">{isJa ? "加算" : "Add"}</option>
                      <option value="overwrite">{isJa ? "上書き" : "Overwrite"}</option>
                      <option value="skip">{isJa ? "スキップ" : "Skip"}</option>
                    </select>
                  ) : row.status === "error" ? row.error : (isJa ? "新規目標作成" : "Create new goal")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlannerModalShell>
  );
}