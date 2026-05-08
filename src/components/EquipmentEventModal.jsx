import { useEffect, useMemo, useState } from "react";

function buildInitialDraft(preselectedEquipmentId) {
  return {
    equipmentId: preselectedEquipmentId || "",
    発生事案: "",
    名前: "",
    eventDate: "",
  };
}

/**
 * Reusable modal for logging a 事案 (incident / maintenance event) against a piece of equipment.
 *
 * Props:
 *   open                   — boolean
 *   factoryEquipment       — array of setsubiDB records for the current factory (used to build dropdown)
 *   preselectedEquipmentId — string, pre-select a specific piece of equipment
 *   submitting             — boolean
 *   onClose                — () => void
 *   onSubmit               — (draft: { equipmentId, equipmentName, 工場, 発生事案, 名前, eventDate }) => void
 */
export default function EquipmentEventModal({
  open,
  factoryEquipment = [],
  preselectedEquipmentId = "",
  submitting,
  onClose,
  onSubmit,
}) {
  const [draft, setDraft] = useState(() => buildInitialDraft(preselectedEquipmentId));

  useEffect(() => {
    if (!open) return undefined;
    setDraft(buildInitialDraft(preselectedEquipmentId));
  }, [open, preselectedEquipmentId]);

  const hasData = useMemo(
    () => draft.equipmentId !== "" && draft.発生事案.trim() !== "",
    [draft]
  );

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  if (!open) return null;

  const selectedEquipment = factoryEquipment.find((eq) => {
    const id = eq._id?.$oid ?? eq._id;
    return id === draft.equipmentId;
  });

  function handleSubmit(event) {
    event.preventDefault();
    if (!hasData) return;
    onSubmit({
      ...draft,
      equipmentName: selectedEquipment?.name || "",
      工場: selectedEquipment?.["工場"] || "",
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden">

          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">事案登録</div>
                <h3 className="mt-2 text-2xl font-black text-on-surface">事案を追加</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  設備に関する故障・修理・アップグレードなどを記録します。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
          >
            <div className="grid gap-4">

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
                  設備 <span className="text-error">*</span>
                </div>
                {factoryEquipment.length > 0 ? (
                  <select
                    value={draft.equipmentId}
                    onChange={(e) => set("equipmentId", e.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                    required
                  >
                    <option value="">— 設備を選択 —</option>
                    {factoryEquipment.map((eq) => {
                      const id = eq._id?.$oid ?? eq._id ?? eq.name;
                      return (
                        <option key={id} value={eq._id?.$oid ?? eq._id}>{eq.name || id}</option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface-variant italic">
                    この工場には設備が登録されていません。先に設備を追加してください。
                  </div>
                )}
              </label>

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
                  発生事案 <span className="text-error">*</span>
                </div>
                <textarea
                  value={draft["発生事案"]}
                  onChange={(e) => set("発生事案", e.target.value)}
                  placeholder="例：ベルト交換、モーター修理、定期点検…"
                  rows={4}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40 resize-none"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">名前</div>
                  <input
                    type="text"
                    value={draft["名前"]}
                    onChange={(e) => set("名前", e.target.value)}
                    placeholder="担当者名"
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">発生日</div>
                  <input
                    type="date"
                    value={draft.eventDate}
                    onChange={(e) => set("eventDate", e.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                  />
                </label>
              </div>

            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-5">
              <p className="text-sm text-on-surface-variant">設備と発生事案は必須です。</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasData || submitting}
                  className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "保存中…" : "事案を登録"}
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
