import { useRef, useState } from "react";
import ModalShell from "./ModalShell";
import { formatMasterValue, getMasterRecordIdentity, getMasterTabUI } from "../utils/masterDB";

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
  tabKey = "masterDB",
}) {
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => {
    const nextDraft = {};
    getVisibleFields(fieldDefinitions, record).forEach((field) => {
      nextDraft[field.field] = record[field.field] ?? "";
    });
    return nextDraft;
  });

  if (!open || !record) return null;

  const tabUI = getMasterTabUI(tabKey);
  const identity = getMasterRecordIdentity(record, tabKey);
  const title = tabKey === "masterDB"
    ? (() => {
        const partNo = record["品番"] || record["品名"] || record["材料品番"] || tabUI.recordLabel;
        const serialNo = record["背番号"];
        return serialNo ? `${partNo} - ${serialNo}` : partNo;
      })()
    : identity.subtitle
      ? `${identity.title} - ${identity.subtitle}`
      : identity.title;
  const visibleFields = getVisibleFields(fieldDefinitions, record);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={tabUI.recordLabel}
      title={title}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
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
                  className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onSave(draft)}
                  disabled={saving}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
              >
                Edit Record
              </button>
            )}
          </div>
        </div>
      }
    >
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
                    className="absolute bottom-3 right-3 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-50"
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
                  <div key={field.field} className={`rounded-2xl border border-outline-variant/15 bg-surface-container-low px-3 py-2 ${multiline ? "col-span-2" : ""}`}>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-outline">{field.label}</div>
                    {editing ? (
                      multiline ? (
                        <textarea
                          value={value}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          rows={3}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-2 py-1.5 text-xs text-on-surface outline-none transition focus:border-primary/40"
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
                          value={value}
                          onChange={(event) => setDraft((current) => ({ ...current, [field.field]: event.target.value }))}
                          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-2 py-1.5 text-xs text-on-surface outline-none transition focus:border-primary/40"
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

    </ModalShell>
  );
}