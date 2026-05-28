import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadEquipmentEventImage } from "../services/api";
import FormField from "./FormField";
import ModalShell from "./ModalShell";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function buildInitialDraft(record) {
  if (!record) {
    return { name: "", 工場: "", installationDate: "", imageURL: "" };
  }
  return {
    name: record.name || "",
    工場: record["工場"] || "",
    installationDate: record.installationDate || "",
    imageURL: record.imageURL || "",
  };
}

/**
 * Reusable modal for creating and editing equipment (設備) records.
 *
 * Props:
 *   open            — boolean, controls visibility
 *   record          — existing record object for edit mode, or null for create
 *   submitting      — boolean, disables submit while saving
 *   factories       — string[], list of factory names for the dropdown
 *   defaultFactory  — string, pre-select a factory when opening in create mode
 *   onClose         — () => void
 *   onSubmit        — (draft: { name, 工場, installationDate }) => void
 */
export default function SetsubiRecordModal({
  open,
  record,
  submitting,
  factories = [],
  defaultFactory = "",
  username = "unknown",
  onClose,
  onSubmit,
  onArchive,
}) {
  const [draft, setDraft] = useState(() => buildInitialDraft(record));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const base = buildInitialDraft(record);
    if (!record && defaultFactory) base["工場"] = defaultFactory;
    setDraft(base);
    setUploadError("");
  }, [open, record, defaultFactory]);

  const hasData = useMemo(
    () => draft.name.trim() !== "",
    [draft]
  );

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    try {
      const base64 = await toBase64(file);
      const result = await uploadEquipmentEventImage({
        base64,
        factoryName: draft["工場"] || "",
        equipmentName: draft.name || "",
        username,
      });
      set("imageURL", result.imageURL);
    } catch (err) {
      const raw = err?.message || "";
      setUploadError(raw.startsWith("<") ? "Upload failed — server error. Check that the server is running." : raw || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  const isEdit = Boolean(record);

  return createPortal(
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? "Edit Equipment" : "Add Equipment"}
      title={isEdit ? "Edit Equipment Record" : "Add Equipment Record"}
      subtitle={isEdit ? "Update the selected equipment details." : "Create a new equipment entry in setsubiDB."}
      maxWidth="max-w-lg"
      align="start"
    >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!hasData) return;
              onSubmit(draft);
            }}
            className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
          >
            <div className="grid gap-4">

              <FormField label="設備名" variant="form" required>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. プレス機 #1"
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                  required
                />
              </FormField>

              <FormField label="工場 (Location)" variant="form">
                {factories.length > 0 ? (
                  <select
                    value={draft["工場"]}
                    onChange={(e) => set("工場", e.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                  >
                    <option value="">— Select factory —</option>
                    {factories.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={draft["工場"]}
                    onChange={(e) => set("工場", e.target.value)}
                    placeholder="Factory name"
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                  />
                )}
              </FormField>

              <FormField label="Installation Date" variant="form">
                <input
                  type="date"
                  value={draft.installationDate}
                  onChange={(e) => set("installationDate", e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                />
              </FormField>

              <FormField label="Image" variant="form">

                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50">
                  {uploading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                      アップロード中…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>attach_file</span>
                      {draft.imageURL ? "画像を変更" : "画像を添付"}
                    </>
                  )}
                </button>

                {uploadError && (
                  <p className="mt-2 text-xs text-error">{uploadError}</p>
                )}

                {draft.imageURL && (
                  <div className="mt-3 group relative inline-block">
                    <img src={draft.imageURL} alt="equipment"
                      className="h-16 w-16 rounded-xl object-cover border border-outline-variant/20" />
                    <button type="button"
                      onClick={() => set("imageURL", "")}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                    </button>
                  </div>
                )}
              </FormField>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-5">
              <div>
                {isEdit && onArchive ? (
                  <button
                    type="button"
                    onClick={onArchive}
                    disabled={submitting}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Archive
                  </button>
                ) : (
                  <p className="text-sm text-on-surface-variant">設備名 is required before saving.</p>
                )}
              </div>
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
                  {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Equipment"}
                </button>
              </div>
            </div>
          </form>

    </ModalShell>,
    document.body
  );
}
