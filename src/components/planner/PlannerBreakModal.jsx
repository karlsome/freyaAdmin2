import { useEffect, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import { cloneBreaks, createScheduleId } from "../../utils/planner";
import { useLanguage } from "../../contexts/LanguageContext";

function createDraftBreak(isJa = false, isDefault = false) {
  return {
    id: createScheduleId("break"),
    name: isJa ? "休憩" : "Break",
    start: "12:00",
    end: "12:15",
    equipment: null,
    isDefault,
  };
}

export default function PlannerBreakModal({
  open,
  breaks = [],
  defaults = [],
  equipmentOptions = [],
  saving = false,
  onClose,
  onSave,
  onSaveDefaults,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [tab, setTab] = useState("day");
  const [dayBreaks, setDayBreaks] = useState(() => cloneBreaks(breaks));
  const [defaultBreaks, setDefaultBreaks] = useState(() => cloneBreaks(defaults));
  const isDefaultsTab = tab === "defaults";
  const draftBreaks = isDefaultsTab ? defaultBreaks : dayBreaks;
  const setDraftBreaks = isDefaultsTab ? setDefaultBreaks : setDayBreaks;

  useEffect(() => {
    if (open) {
      setDayBreaks(cloneBreaks(breaks));
      setDefaultBreaks(cloneBreaks(defaults));
      setTab("day");
    }
  }, [open, breaks, defaults]);

  function updateBreak(id, patch) {
    setDraftBreaks((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function invalid(list) {
    return list.some((item) => !item.start || !item.end || item.end <= item.start);
  }

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? "休憩時間設定" : "Manage Break Times"}
      subtitle={isDefaultsTab
        ? (isJa ? "デフォルト休憩は工場ごとに保存され、新しい日の計画に自動で適用されます。" : "Defaults are saved per factory and applied to every new day's plan.")
        : (isJa ? "この日の休憩時間です。タイムライン計算、稼働率、自動スケジューリングに反映されます。" : "Breaks for this day. They drive the timeline, utilization, and smart scheduling.")}
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
            disabled={saving || invalid(draftBreaks)}
            onClick={() => (isDefaultsTab ? onSaveDefaults?.(defaultBreaks) : onSave(dayBreaks))}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (isJa ? "保存中…" : "Saving…") : (isDefaultsTab ? (isJa ? "デフォルトを保存" : "Save Defaults") : (isJa ? "休憩時間を保存" : "Save Breaks"))}
          </button>
        </div>
      )}
    >
      <div className="mb-3 inline-flex rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5">
        {[["day", isJa ? "この日の休憩" : "This day"], ["defaults", isJa ? "デフォルト休憩" : "Default breaks"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-[5px] px-3 py-1 text-xs font-semibold transition ${tab === key ? "bg-[var(--freya-blue)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {invalid(draftBreaks) ? (
        <div className="mb-2 text-xs text-[var(--status-danger)]">{isJa ? "終了時刻は開始時刻より後にしてください。" : "End time must be after start time."}</div>
      ) : null}
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
          onClick={() => setDraftBreaks((items) => [...items, createDraftBreak(isJa, isDefaultsTab)])}
          className="w-full rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:text-[var(--freya-blue)]"
        >
          {isJa ? "+ 休憩時間を追加" : "+ Add Break Row"}
        </button>
        {!isDefaultsTab ? (
          <button
            type="button"
            onClick={() => setDayBreaks(cloneBreaks(defaults))}
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
          >
            {isJa ? "デフォルトに戻す" : "Reset to defaults"}
          </button>
        ) : null}
      </div>
    </PlannerModalShell>
  );
}