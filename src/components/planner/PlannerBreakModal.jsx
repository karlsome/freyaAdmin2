import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { cloneBreaks, createScheduleId } from "../../utils/planner";

function createDraftBreak() {
  return {
    id: createScheduleId("break"),
    name: "Break",
    start: "12:00",
    end: "12:15",
    equipment: null,
    isDefault: false,
  };
}

export default function PlannerBreakModal({
  open,
  breaks = [],
  equipmentOptions = [],
  saving = false,
  onClose,
  onSave,
}) {
  const [draftBreaks, setDraftBreaks] = useState(() => cloneBreaks(breaks));

  useEffect(() => {
    if (open) {
      setDraftBreaks(cloneBreaks(breaks));
    }
  }, [open, breaks]);

  function updateBreak(id, patch) {
    setDraftBreaks((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <PlannerModalShell
      open={open}
      title="Manage Break Times"
      subtitle="Breaks are shared across timeline calculations, utilization, and smart scheduling."
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
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
            disabled={saving}
            onClick={() => onSave(draftBreaks)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Breaks"}
          </button>
        </div>
      )}
    >
      <div className="space-y-2.5">
        {draftBreaks.map((item) => (
          <div key={item.id} className="grid gap-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 lg:grid-cols-[minmax(180px,1.2fr)_130px_130px_minmax(180px,1fr)_auto] lg:items-center">
            <input
              type="text"
              value={item.name || ""}
              onChange={(event) => updateBreak(item.id, { name: event.target.value })}
              placeholder="Break name"
              className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
            <input
              type="time"
              value={item.start || ""}
              onChange={(event) => updateBreak(item.id, { start: event.target.value })}
              className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
            <input
              type="time"
              value={item.end || ""}
              onChange={(event) => updateBreak(item.id, { end: event.target.value })}
              className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
            <select
              value={item.equipment || ""}
              onChange={(event) => updateBreak(item.id, { equipment: event.target.value || null })}
              className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            >
              <option value="">All equipment</option>
              {equipmentOptions.map((equipment) => (
                <option key={equipment} value={equipment}>{equipment}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDraftBreaks((items) => items.filter((entry) => entry.id !== item.id))}
              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setDraftBreaks((items) => [...items, createDraftBreak()])}
          className="w-full rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:text-[var(--freya-blue)]"
        >
          + Add Break Row
        </button>
      </div>
    </PlannerModalShell>
  );
}