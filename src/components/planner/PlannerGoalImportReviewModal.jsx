import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";

export default function PlannerGoalImportReviewModal({
  open,
  rows = [],
  importing = false,
  onClose,
  onConfirm,
}) {
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

  return (
    <PlannerModalShell
      open={open}
      title="Review Imported Goals"
      subtitle={`${validCount} new, ${duplicateCount} duplicate, ${errorCount} invalid row${errorCount === 1 ? "" : "s"}`}
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
            disabled={importing || !rows.some((row) => row.status === "valid" || row.status === "duplicate")}
            onClick={() => onConfirm(decisions)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? "Importing…" : "Apply Import"}
          </button>
        </div>
      )}
    >
      <div className="overflow-x-auto rounded-[6px] border border-[var(--border)]">
        <table className="min-w-full">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
            <tr>
              {[
                "Date",
                "背番号",
                "品番",
                "品名",
                "Target",
                "Status",
                "Action",
              ].map((label) => (
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
                  {row.status === "valid" ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ready</span> : null}
                  {row.status === "duplicate" ? <span className="font-semibold text-amber-600 dark:text-amber-400">Duplicate</span> : null}
                  {row.status === "error" ? <span className="font-semibold text-[var(--status-danger)]">Invalid</span> : null}
                </td>
                <td className="px-3.5 py-2.5 text-xs text-[var(--text-primary)]">
                  {row.status === "duplicate" ? (
                    <select
                      value={decisions[row.id] || "add"}
                      onChange={(event) => setDecisions((state) => ({ ...state, [row.id]: event.target.value }))}
                      className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                    >
                      <option value="add">Add</option>
                      <option value="overwrite">Overwrite</option>
                      <option value="skip">Skip</option>
                    </select>
                  ) : row.status === "error" ? row.error : "Create new goal"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlannerModalShell>
  );
}