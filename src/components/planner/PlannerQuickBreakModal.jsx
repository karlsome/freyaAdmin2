import { useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { createScheduleId, minutesToTime, timeToMinutes } from "../../utils/planner";
import { useLanguage } from "../../contexts/LanguageContext";

const inputClass = "h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]";

// Add or edit one break for the current day, opened from the timeline.
// target: { breakItem?: existing break, equipment, start }. Mount only while open.
export default function PlannerQuickBreakModal({ target, saving = false, onSave, onDelete, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const existing = target?.breakItem || null;
  const [name, setName] = useState(existing?.name || (isJa ? "休憩" : "Break"));
  const [start, setStart] = useState(existing?.start || target?.start || "12:00");
  const [end, setEnd] = useState(existing?.end || minutesToTime(timeToMinutes(target?.start || "12:00") + 15));
  const [allEquipment, setAllEquipment] = useState(existing ? !existing.equipment : false);
  const equipment = existing?.equipment || target?.equipment || null;
  const invalid = !start || !end || end <= start;

  function submit() {
    onSave({
      ...(existing || {}),
      id: existing?.id || createScheduleId("break"),
      name: name.trim() || (isJa ? "休憩" : "Break"),
      start,
      end,
      equipment: allEquipment ? null : equipment,
      isDefault: false,
    });
  }

  return (
    <PlannerModalShell
      open
      onClose={saving ? undefined : onClose}
      maxWidthClassName="max-w-md"
      title={existing ? (isJa ? "休憩を編集" : "Edit Break") : (isJa ? "休憩を追加" : "Add Break")}
      subtitle={equipment ? `${equipment} · ${start}` : undefined}
      footer={(
        <div className="flex items-center justify-between gap-3">
          {existing ? (
            <button type="button" disabled={saving} onClick={() => onDelete(existing.id)} className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 disabled:opacity-50">
              {isJa ? "削除" : "Remove"}
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
              {isJa ? "キャンセル" : "Cancel"}
            </button>
            <button type="button" onClick={submit} disabled={saving || invalid} className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "保存" : "Save")}
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-3">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          {isJa ? "休憩名" : "Name"}
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {isJa ? "開始" : "Start"}
            <input type="time" value={start} onChange={(event) => setStart(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {isJa ? "終了" : "End"}
            <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className={`${inputClass} mt-1`} />
          </label>
        </div>
        {invalid ? <div className="text-xs text-[var(--status-danger)]">{isJa ? "終了時刻は開始時刻より後にしてください。" : "End time must be after start time."}</div> : null}
        <label className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
          <input type="checkbox" checked={allEquipment} onChange={(event) => setAllEquipment(event.target.checked)} disabled={!equipment} />
          {isJa ? "すべての設備に適用" : "Apply to all equipment"}
          {equipment && !allEquipment ? <span className="text-[var(--text-muted)]">({isJa ? `${equipment} のみ` : `${equipment} only`})</span> : null}
        </label>
      </div>
    </PlannerModalShell>
  );
}
