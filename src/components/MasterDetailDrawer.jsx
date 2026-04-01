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
  const modalRef = useRef(null);
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
      if (modalRef.current && !modalRef.current.contains(event.target)) {
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

  const partNo = record["品番"] || record["品名"] || record["材料品番"] || "Master Record";
  const serialNo = record["背番号"];
  const title = serialNo ? `${partNo} - ${serialNo}` : partNo;
  const visibleFields = getVisibleFields(fieldDefinitions, record);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={modalRef} className="glass-card w-full max-w-2xl rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="border-b border-outline-variant/20 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">Master Record</div>
                <h3 className="text-base font-bold text-on-surface">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[72vh] overflow-y-auto scrollbar-hide">

            {/* Image */}
            <div className="relative overflow-hidden border-b border-outline-variant/20 bg-surface-container/40 backdrop-blur-sm">
              {record.imageURL ? (
                <img src={record.imageURL} alt={title} className="w-full max-h-48 object-contain" />
              ) : (
                <div className="flex h-20 items-center justify-center gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined" style={{ fontSize: 28 }}>image_not_supported</span>
                  <span className="text-sm font-medium">No image uploaded</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
                  <div className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold text-on-surface shadow-lg">Uploading…</div>
                </div>
              )}
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
                    disabled={uploading}
                    className="absolute bottom-3 right-3 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : record.imageURL ? "Update Image" : "Upload Image"}
                  </button>
                </>
              )}
            </div>

            {/* Fields */}
            <div className="px-4 py-4 grid gap-2 grid-cols-2 content-start">
              {visibleFields.map((field) => {
                const value = draft[field.field] ?? "";
                const multiline = field.type === "textarea" || String(value).length > 120;

                return (
                  <div key={field.field} className={`rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-2 ${multiline ? "col-span-2" : ""}`}>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-outline">{field.label}</div>
                    {editing ? (
                      multiline ? (
                        <textarea
                          value={value}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          rows={3}
                          className="w-full rounded-lg border border-outline-variant/30 bg-surface px-2 py-1.5 text-xs text-on-surface outline-none transition focus:border-primary/40"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
                          value={value}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          className="w-full rounded-lg border border-outline-variant/30 bg-surface px-2 py-1.5 text-xs text-on-surface outline-none transition focus:border-primary/40"
                        />
                      )
                    ) : (
                      <div className="whitespace-pre-wrap break-words text-sm font-bold text-on-surface">
                        {formatMasterValue(record[field.field])}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-outline-variant/20 px-5 py-3 flex items-center justify-between gap-3">
            <div className="text-sm text-on-surface-variant">
              {editing ? "Editing live master record." : "Read-only mode."}
            </div>
            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDraft = {};
                      visibleFields.forEach((field) => { nextDraft[field.field] = record[field.field] ?? ""; });
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
    </div>
  );
}