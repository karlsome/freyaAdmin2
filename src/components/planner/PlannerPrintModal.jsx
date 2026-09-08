import { useEffect, useMemo, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";
import EmptyState from "../EmptyState";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PlannerPrintModal({
  open,
  equipmentOptions = [],
  onClose,
  onConfirm,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const normalizedOptions = useMemo(
    () => [...new Set((Array.isArray(equipmentOptions) ? equipmentOptions : []).filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right), "ja")),
    [equipmentOptions],
  );
  const [selectedEquipment, setSelectedEquipment] = useState(normalizedOptions);

  useEffect(() => {
    if (open) {
      setSelectedEquipment(normalizedOptions);
    }
  }, [open, normalizedOptions]);

  const allSelected = normalizedOptions.length > 0 && selectedEquipment.length === normalizedOptions.length;

  function handleToggleEquipment(equipmentName) {
    setSelectedEquipment((current) => (
      current.includes(equipmentName)
        ? current.filter((item) => item !== equipmentName)
        : [...current, equipmentName].sort((left, right) => String(left).localeCompare(String(right), "ja"))
    ));
  }

  return (
    <PlannerModalShell
      open={open}
      title={isJa ? "印刷する設備を選択" : "Select Equipment to Print"}
      subtitle={isJa ? "印刷シートに含める設備レーンを選択してください。" : "Choose which equipment lanes should be included in the print sheet."}
      onClose={onClose}
      maxWidthClassName="max-w-xl"
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
            disabled={!selectedEquipment.length}
            onClick={() => onConfirm(selectedEquipment)}
            className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isJa ? "印刷" : "Print"}
          </button>
        </div>
      )}
    >
      <div className="space-y-3">
        {!normalizedOptions.length ? (
          <EmptyState className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-8 text-xs text-[var(--text-muted)]">
            {isJa ? "印刷可能な計画済み設備がありません。" : "No scheduled equipment is available for printing."}
          </EmptyState>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setSelectedEquipment(event.target.checked ? normalizedOptions : [])}
                className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
              />
              <span className="font-semibold">{isJa ? "すべて選択" : "Select All"}</span>
            </label>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {normalizedOptions.map((equipmentName) => {
                const checked = selectedEquipment.includes(equipmentName);
                return (
                  <label
                    key={equipmentName}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3.5 py-2.5 text-xs transition ${checked ? "border-[var(--freya-blue)]/40 bg-[var(--freya-blue)]/5 text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)]"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleEquipment(equipmentName)}
                      className="h-4 w-4 rounded-[4px] border-[var(--border)] text-[var(--freya-blue)] focus:ring-0"
                    />
                    <span className="font-medium">{equipmentName}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PlannerModalShell>
  );
}