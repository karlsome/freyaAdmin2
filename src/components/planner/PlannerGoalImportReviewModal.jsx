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
            className="rounded-2xl border border-separator/40 px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={importing || !rows.some((row) => row.status === "valid" || row.status === "duplicate")}
            onClick={() => onConfirm(decisions)}
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? "Importing…" : "Apply Import"}
          </button>
        </div>
      )}
    >
      <div className="overflow-x-auto">
        <table className="ui-table-data min-w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant/20">
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
                <th key={label} className="ui-table-heading px-4 py-3 text-left text-on-surface-variant">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-b border-outline-variant/10 ${row.status === "error" ? "bg-error/5" : row.status === "duplicate" ? "bg-amber-500/5" : ""}`}>
                <td className="px-4 py-3 text-on-surface">{row.date}</td>
                <td className="px-4 py-3 text-on-surface">{row.背番号 || "-"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{row.品番 || "-"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{row.品名 || row.error || "-"}</td>
                <td className="px-4 py-3 font-semibold text-on-surface">{row.targetQuantity}</td>
                <td className="px-4 py-3">
                  {row.status === "valid" ? <span className="text-emerald-600 dark:text-emerald-300">Ready</span> : null}
                  {row.status === "duplicate" ? <span className="text-amber-600 dark:text-amber-300">Duplicate</span> : null}
                  {row.status === "error" ? <span className="text-error">Invalid</span> : null}
                </td>
                <td className="px-4 py-3 text-on-surface">
                  {row.status === "duplicate" ? (
                    <select
                      value={decisions[row.id] || "add"}
                      onChange={(event) => setDecisions((state) => ({ ...state, [row.id]: event.target.value }))}
                      className="planner-data-text h-10 rounded-2xl border border-separator/40 px-3 outline-none transition focus:border-primary/40"
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