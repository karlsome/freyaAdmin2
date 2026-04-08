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
            className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draftBreaks)}
            className="rounded-2xl kinetic-gradient px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Breaks"}
          </button>
        </div>
      )}
    >
      <div className="planner-data-text space-y-3">
        {draftBreaks.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4 lg:grid-cols-[minmax(180px,1.2fr)_140px_140px_minmax(180px,1fr)_auto] lg:items-center">
            <input
              type="text"
              value={item.name || ""}
              onChange={(event) => updateBreak(item.id, { name: event.target.value })}
              placeholder="Break name"
              className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
            />
            <input
              type="time"
              value={item.start || ""}
              onChange={(event) => updateBreak(item.id, { start: event.target.value })}
              className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
            />
            <input
              type="time"
              value={item.end || ""}
              onChange={(event) => updateBreak(item.id, { end: event.target.value })}
              className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
            />
            <select
              value={item.equipment || ""}
              onChange={(event) => updateBreak(item.id, { equipment: event.target.value || null })}
              className="planner-data-text h-11 rounded-2xl border border-outline-variant/20 px-4 outline-none transition focus:border-primary/40"
            >
              <option value="">All equipment</option>
              {equipmentOptions.map((equipment) => (
                <option key={equipment} value={equipment}>{equipment}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDraftBreaks((items) => items.filter((entry) => entry.id !== item.id))}
              className="rounded-2xl border border-error/20 bg-error/5 px-4 py-2 text-sm font-bold text-error transition hover:bg-error/10"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setDraftBreaks((items) => [...items, createDraftBreak()])}
          className="w-full rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-5 py-4 text-sm font-bold text-on-surface transition hover:border-primary/35 hover:text-primary"
        >
          Add Break Row
        </button>
      </div>
    </PlannerModalShell>
  );
}