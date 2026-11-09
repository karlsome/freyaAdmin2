import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { cloneBreaks, createScheduleId } from "../../utils/planner";
import { useLanguage } from "../../contexts/LanguageContext";

function createDraftBreak(isJa = false) {
  return {
    id: createScheduleId("break"),
    name: isJa ? "休憩" : "Break",
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
      title={isJa ? "休憩時間設定" : "Manage Break Times"}
      subtitle={isJa ? "休憩時間はタイムライン計算、稼働率、自動スケジューリング全体で共有されます。" : "Breaks are shared across timeline calculations, utilization, and smart scheduling."}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
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
            disabled={saving}
            onClick={() => onSave(draftBreaks)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "休憩時間を保存" : "Save Breaks")}
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
              placeholder={isJa ? "休憩名" : "Break name"}
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
              <option value="">{isJa ? "すべての設備" : "All equipment"}</option>
              {equipmentOptions.map((equipment) => (
                <option key={equipment} value={equipment}>{equipment}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setDraftBreaks((items) => items.filter((entry) => entry.id !== item.id))}
              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-2.5 py-1 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10"
            >
              {isJa ? "削除" : "Remove"}
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setDraftBreaks((items) => [...items, createDraftBreak(isJa)])}
          className="w-full rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:text-[var(--freya-blue)]"
        >
          {isJa ? "+ 休憩時間を追加" : "+ Add Break Row"}
        </button>
      </div>
    </PlannerModalShell>
  );
}