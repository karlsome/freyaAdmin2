import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadEquipmentEventImage } from "../services/api";

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
    return { name: "", 工場: "", location: "", purchaseDate: "", serialNumber: "", model: "", type: "", colour: "", imageURL: "" };
  }
  return {
    name: record.name || "",
    工場: record["工場"] || "",
    location: record.location || "",
    purchaseDate: record.purchaseDate || "",
    serialNumber: record.serialNumber || "",
    model: record.model || "",
    type: record.type || "",
    colour: record.colour || "",
    imageURL: record.imageURL || "",
  };
}

export default function DeviceRecordModal({
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

  const inputClass = "w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40";
  const labelClass = "mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline";

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-4 pb-4 pt-10">
        <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden">

          <div className="border-b border-outline-variant/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
                  {isEdit ? "Edit Device" : "Add Device"}
                </div>
                <h3 className="mt-2 text-2xl font-black text-on-surface">
                  {isEdit ? "Edit Device Record" : "Add Device Record"}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isEdit ? "Update the selected device details." : "Create a new device entry in deviceDB."}
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
            onSubmit={(e) => { e.preventDefault(); onSubmit(draft); }}
            className="max-h-[82vh] overflow-y-auto px-6 py-6 scrollbar-hide"
          >
            <div className="grid gap-4">

              <label className="block">
                <div className={labelClass}>デバイス名</div>
                <input type="text" value={draft.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. iPad Pro #1" className={inputClass} />
              </label>

              <label className="block">
                <div className={labelClass}>工場</div>
                {factories.length > 0 ? (
                  <select value={draft["工場"]} onChange={(e) => set("工場", e.target.value)} className={inputClass}>
                    <option value="">— Select factory —</option>
                    {factories.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                ) : (
                  <input type="text" value={draft["工場"]} onChange={(e) => set("工場", e.target.value)}
                    placeholder="Factory name" className={inputClass} />
                )}
              </label>

              <label className="block">
                <div className={labelClass}>Location</div>
                <input type="text" value={draft.location} onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Production floor, Office 2F" className={inputClass} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className={labelClass}>Purchase Date</div>
                  <input type="date" value={draft.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className={inputClass} />
                </label>

                <label className="block">
                  <div className={labelClass}>Type</div>
                  <input type="text" value={draft.type} onChange={(e) => set("type", e.target.value)}
                    placeholder="e.g. Tablet, Scanner" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className={labelClass}>Model</div>
                  <input type="text" value={draft.model} onChange={(e) => set("model", e.target.value)}
                    placeholder="e.g. iPad Pro 12.9" className={inputClass} />
                </label>

                <label className="block">
                  <div className={labelClass}>Colour</div>
                  <input type="text" value={draft.colour} onChange={(e) => set("colour", e.target.value)}
                    placeholder="e.g. Space Grey" className={inputClass} />
                </label>
              </div>

              <label className="block">
                <div className={labelClass}>Serial Number</div>
                <input type="text" value={draft.serialNumber} onChange={(e) => set("serialNumber", e.target.value)}
                  placeholder="e.g. DMQXX9ABCDEF" className={inputClass} />
              </label>

              <div>
                <div className={labelClass}>Image</div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50">
                  {uploading ? (
                    <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>アップロード中…</>
                  ) : (
                    <><span className="material-symbols-outlined" style={{ fontSize: 15 }}>attach_file</span>{draft.imageURL ? "画像を変更" : "画像を添付"}</>
                  )}
                </button>
                {uploadError && <p className="mt-2 text-xs text-error">{uploadError}</p>}
                {draft.imageURL && (
                  <div className="mt-3 group relative inline-block">
                    <img src={draft.imageURL} alt="device"
                      className="h-16 w-16 rounded-xl object-cover border border-outline-variant/20" />
                    <button type="button" onClick={() => set("imageURL", "")}
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-5">
              <div>
                {isEdit && onArchive ? (
                  <button type="button" onClick={onArchive} disabled={submitting}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-500/20 disabled:opacity-50">
                    Archive
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose}
                  className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50">
                  {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Device"}
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>,
    document.body
  );
}
