import { useEffect, useRef, useState } from "react";
import { formatMasterValue } from "../utils/masterDB";

function getVisibleFields(fieldDefinitions, record) {
  const seen = new Set();
  const ordered = [];

  fieldDefinitions.forEach((field) => {
    if (field.field === "imageURL") return;
    seen.add(field.field);
    ordered.push(field);
  });

  Object.keys(record || {}).forEach((field) => {
    if (field === "_id" || field === "imageURL" || seen.has(field)) return;
    ordered.push({ field, label: field, type: "text" });
  });

  return ordered;
}

export default function MasterDetailDrawer({
  open,
  record,
  fieldDefinitions,
  saving,
  uploading,
  onClose,
  onSave,
  onUploadImage,
}) {
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => {
    const nextDraft = {};
    getVisibleFields(fieldDefinitions, record).forEach((field) => {
      nextDraft[field.field] = record[field.field] ?? "";
    });
    return nextDraft;
  });

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    function handleMouseDown(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [open, onClose]);

  if (!open || !record) return null;

  const title = record["品番"] || record["品名"] || record["材料品番"] || "Master Record";
  const visibleFields = getVisibleFields(fieldDefinitions, record);

  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm">
      <aside
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-full max-w-[720px] border-l border-outline-variant/20 bg-surface shadow-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Master Record</div>
                <h3 className="mt-2 text-2xl font-black text-on-surface">{title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Open record detail, edit inline fields, and upload a new product image.</p>
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

          <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-hide">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4 mb-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">製品画像</div>
                  <div className="mt-1 text-sm text-on-surface-variant">Keep the master photo current for downstream verification and labeling.</div>
                </div>

                {editing && (
                  <>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        onUploadImage(file);
                        event.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50"
                      disabled={uploading}
                    >
                      {uploading ? "Uploading…" : record.imageURL ? "Update Image" : "Upload Image"}
                    </button>
                  </>
                )}
              </div>

              <div className="relative overflow-hidden rounded-xl border border-outline-variant/20 bg-surface min-h-[220px]">
                {record.imageURL ? (
                  <img src={record.imageURL} alt={title} className="h-[280px] w-full object-contain bg-surface-container-lowest" />
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-on-surface-variant">
                    <div className="text-center">
                      <span className="material-symbols-outlined" style={{ fontSize: 36 }}>image_not_supported</span>
                      <p className="mt-3 text-sm font-medium">No image uploaded</p>
                    </div>
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
                    <div className="rounded-full bg-surface-container px-4 py-3 text-sm font-bold text-on-surface shadow-lg">
                      Uploading image…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {visibleFields.map((field) => {
                const value = draft[field.field] ?? "";
                const multiline = field.type === "textarea" || String(value).length > 120;

                return (
                  <div key={field.field} className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">{field.label}</div>
                    {editing ? (
                      multiline ? (
                        <textarea
                          value={value}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          rows={4}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
                          value={value}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
                        />
                      )
                    ) : (
                      <div className="whitespace-pre-wrap break-words text-sm text-on-surface">
                        {formatMasterValue(record[field.field])}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-outline-variant/20 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-on-surface-variant">
                {editing ? "You are editing the live master record." : "Record is currently in read-only mode."}
              </div>

              <div className="flex items-center gap-3">
                {editing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDraft = {};
                        visibleFields.forEach((field) => {
                          nextDraft[field.field] = record[field.field] ?? "";
                        });
                        setDraft(nextDraft);
                        setEditing(false);
                      }}
                      className="rounded-xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onSave(draft)}
                      disabled={saving}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
                  >
                    Edit Record
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}