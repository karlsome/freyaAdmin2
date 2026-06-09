import { useEffect, useMemo, useRef, useState } from "react";
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
    return {
      name: "", 工場: "", installationDate: "", imageURL: "",
      model: "", size: "", serialNo: "", manufactureDate: "",
      voltage: "", manufacturer: "", contactVia: "",
      noOfHead: "", tableLength: "",
    };
  }
  return {
    name: record.name || "",
    工場: record["工場"] || "",
    installationDate: record.installationDate || "",
    imageURL: record.imageURL || "",
    model: record.model || "",
    size: record.size || "",
    serialNo: record.serialNo || "",
    manufactureDate: record.manufactureDate || "",
    voltage: record.voltage || "",
    manufacturer: record.manufacturer || "",
    contactVia: record.contactVia || "",
    noOfHead: record.noOfHead != null ? String(record.noOfHead) : "",
    tableLength: record.tableLength != null ? String(record.tableLength) : "",
  };
}

const FORM_ID = "setsubi-record-form";

const inputCls =
  "w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition-all duration-150 focus:border-primary/40";

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

  const hasData = useMemo(() => draft.name.trim() !== "", [draft]);

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
      setUploadError(
        raw.startsWith("<")
          ? "Upload failed — server error. Check that the server is running."
          : raw || "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  const isEdit = Boolean(record);

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div>
        {isEdit && onArchive ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={submitting}
            className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-500 hover:bg-amber-500/20 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="rounded-xl border border-separator/50 px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/30 active:scale-95 transition-all duration-150"
        >
          Cancel
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={!hasData || submitting}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Equipment"}
        </button>
      </div>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? "Edit Equipment" : "Add Equipment"}
      title={isEdit ? "Edit Equipment Record" : "Add Equipment Record"}
      subtitle={isEdit ? "Update the selected equipment details." : "Create a new equipment entry in setsubiDB."}
      maxWidth="max-w-3xl"
      align="start"
      footer={footer}
      footerClassName="border-t border-outline-variant/20 bg-surface-container-low/50 px-6 py-4"
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          if (!hasData) return;
          onSubmit(draft);
        }}
        className="overflow-y-auto px-6 py-5 scrollbar-hide"
        style={{ maxHeight: "calc(92vh - 180px)" }}
      >
        <div className="grid gap-3">

          <FormField label="設備名" variant="form" required>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. プレス機 #1"
              className={inputCls}
              required
            />
          </FormField>

          <FormField label="工場 (Location)" variant="form">
            {factories.length > 0 ? (
              <select
                value={draft["工場"]}
                onChange={(e) => set("工場", e.target.value)}
                className={inputCls}
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
                className={inputCls}
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Installation Date" variant="form">
              <input
                type="date"
                value={draft.installationDate}
                onChange={(e) => set("installationDate", e.target.value)}
                className={inputCls}
              />
            </FormField>

            <FormField label="Manufacture Date" variant="form">
              <input
                type="date"
                value={draft.manufactureDate}
                onChange={(e) => set("manufactureDate", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>

          <FormField label="Model" variant="form">
            <input
              type="text"
              value={draft.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder="e.g. XR-500"
              className={inputCls}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Size" variant="form">
              <input
                type="text"
                value={draft.size}
                onChange={(e) => set("size", e.target.value)}
                placeholder="e.g. 1200×800mm"
                className={inputCls}
              />
            </FormField>

            <FormField label="Voltage" variant="form">
              <input
                type="text"
                value={draft.voltage}
                onChange={(e) => set("voltage", e.target.value)}
                placeholder="e.g. 200V / 3φ"
                className={inputCls}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Number of Heads" variant="form">
              <select
                value={draft.noOfHead}
                onChange={(e) => set("noOfHead", e.target.value)}
                className={inputCls}
              >
                <option value="">— Select —</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </FormField>

            <FormField label="Length (mm)" variant="form">
              <input
                type="number"
                value={draft.tableLength}
                onChange={(e) => set("tableLength", e.target.value)}
                placeholder="e.g. 3500"
                min="0"
                className={inputCls}
              />
            </FormField>
          </div>

          <FormField label="Serial No." variant="form">
            <input
              type="text"
              value={draft.serialNo}
              onChange={(e) => set("serialNo", e.target.value)}
              placeholder="e.g. SN-20240001"
              className={inputCls}
            />
          </FormField>

          <FormField label="Manufacturer" variant="form">
            <input
              type="text"
              value={draft.manufacturer}
              onChange={(e) => set("manufacturer", e.target.value)}
              placeholder="e.g. Yamada Machinery Co."
              className={inputCls}
            />
          </FormField>

          <FormField label="Contact Via" variant="form">
            <input
              type="text"
              value={draft.contactVia}
              onChange={(e) => set("contactVia", e.target.value)}
              placeholder="e.g. sales@yamada.co.jp / 03-1234-5678"
              className={inputCls}
            />
          </FormField>

          <FormField label="Image" variant="form">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
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
                <img
                  src={draft.imageURL}
                  alt="equipment"
                  className="h-16 w-16 rounded-xl object-cover border border-separator/40"
                />
                <button
                  type="button"
                  onClick={() => set("imageURL", "")}
                  className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                </button>
              </div>
            )}
          </FormField>

        </div>
      </form>
    </ModalShell>
  );
}
