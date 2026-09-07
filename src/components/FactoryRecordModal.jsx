import { useEffect, useMemo, useState } from "react";
import FormField from "./FormField";
import ModalShell from "./ModalShell";

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
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={record ? "Edit Factory" : "Create Factory"}
      title={record ? "Edit Factory Record" : "Add Factory Record"}
      subtitle={record ? "Update the selected factory details." : "Create a new factory entry."}
      maxWidth="max-w-3xl"
    >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!hasData) return;
              onSubmit(draft);
            }}
            className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="工場" variant="form">
                <input
                  type="text"
                  value={draft["工場"]}
                  onChange={(event) => setDraft((current) => ({ ...current, 工場: event.target.value }))}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                />
              </FormField>

              <FormField label="Location" variant="form">
                <input
                  type="text"
                  value={draft.location}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                />
              </FormField>

              <FormField label="Geo Tag" variant="form">
                <input
                  type="text"
                  value={draft.geotag}
                  onChange={(event) => setDraft((current) => ({ ...current, geotag: event.target.value }))}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                />
              </FormField>

              <FormField label="Phone" variant="form">
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                />
              </FormField>

              <FormField label="Latitude" variant="form">
                <input
                  type="text"
                  value={draft.latitude}
                  onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                />
              </FormField>

              <FormField label="Longitude" variant="form">
                <input
                  type="text"
                  value={draft.longitude}
                  onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
                />
              </FormField>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--text-muted)]">At least one field must be filled before saving.</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasData || submitting}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Saving…" : record ? "Save Changes" : "Create Factory"}
                </button>
              </div>
            </div>
          </form>
    </ModalShell>
  );
}
