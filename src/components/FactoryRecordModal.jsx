import { useEffect, useMemo, useState } from "react";

function buildInitialDraft(record) {
  if (!record) {
    return {
      工場: "",
      location: "",
      geotag: "",
      latitude: "",
      longitude: "",
      phone: "",
    };
  }

  return {
    工場: record["工場"] || "",
    location: record.location || "",
    geotag: record.geotag || "",
    latitude: record.coordinates?.lat ?? "",
    longitude: record.coordinates?.lon ?? "",
    phone: record.phone || "",
  };
}

export default function FactoryRecordModal({
  open,
  record,
  submitting,
  onClose,
  onSubmit,
}) {
  const [draft, setDraft] = useState(() => buildInitialDraft(record));

  useEffect(() => {
    if (!open) return undefined;
    setDraft(buildInitialDraft(record));
  }, [open, record]);

  const hasData = useMemo(
    () => Object.values(draft).some((value) => String(value).trim() !== ""),
    [draft]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="glass-card w-full max-w-3xl rounded-2xl overflow-hidden">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">{record ? "Edit Factory" : "Create Factory"}</div>
                <h3 className="mt-2 text-2xl font-black text-on-surface">
                  {record ? "Edit Factory Record" : "Add Factory Record"}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {record ? "Update the selected factory details." : "Create a new factory entry."}
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
            onSubmit={(event) => {
              event.preventDefault();
              if (!hasData) return;
              onSubmit(draft);
            }}
            className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">工場</div>
                <input
                  type="text"
                  value={draft["工場"]}
                  onChange={(event) => setDraft((current) => ({ ...current, 工場: event.target.value }))}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Location</div>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Geo Tag</div>
                <input
                  type="text"
                  value={draft.geotag}
                  onChange={(event) => setDraft((current) => ({ ...current, geotag: event.target.value }))}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Phone</div>
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Latitude</div>
                <input
                  type="text"
                  value={draft.latitude}
                  onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Longitude</div>
                <input
                  type="text"
                  value={draft.longitude}
                  onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-5">
              <p className="text-sm text-on-surface-variant">At least one field must be filled before saving.</p>
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
                  {submitting ? "Saving…" : record ? "Save Changes" : "Create Factory"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
