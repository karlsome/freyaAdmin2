import { useEffect, useMemo, useState } from "react";
import PlannerModalShell from "./PlannerModalShell";

export default function PlannerPrintModal({
  open,
  equipmentOptions = [],
  onClose,
  onConfirm,
}) {
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
      title="Select Equipment to Print"
      subtitle="Choose which equipment lanes should be included in the print sheet."
      onClose={onClose}
      maxWidthClassName="max-w-xl"
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
            disabled={!selectedEquipment.length}
            onClick={() => onConfirm(selectedEquipment)}
            className="rounded-2xl kinetic-gradient px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print
          </button>
        </div>
      )}
    >
      <div className="planner-data-text space-y-4">
        {!normalizedOptions.length ? (
          <div className="rounded-3xl border border-dashed border-outline-variant/20 bg-surface-container-low px-5 py-8 text-center text-on-surface-variant">
            No scheduled equipment is available for printing.
          </div>
        ) : (
          <>
            <label className="flex items-center gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3 text-on-surface">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setSelectedEquipment(event.target.checked ? normalizedOptions : [])}
                className="h-4 w-4 rounded border-outline-variant/40"
              />
              <span className="font-bold">Select All</span>
            </label>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {normalizedOptions.map((equipmentName) => {
                const checked = selectedEquipment.includes(equipmentName);
                return (
                  <label
                    key={equipmentName}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${checked ? "border-primary/25 bg-primary/10" : "border-outline-variant/15 bg-surface-container-low hover:bg-surface-container"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleEquipment(equipmentName)}
                      className="h-4 w-4 rounded border-outline-variant/40"
                    />
                    <span className="font-medium text-on-surface">{equipmentName}</span>
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