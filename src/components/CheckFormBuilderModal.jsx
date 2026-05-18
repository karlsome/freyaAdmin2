import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchFactoryDBRecords, fetchSetsubiDBRecords, fetchCheckFormTemplates, createCheckFormTemplate, updateCheckFormTemplate, uploadEquipmentEventImage } from "../services/api";
import { getAuthUser } from "../utils/masterDB";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const FIELD_TYPES = [
  { value: "checkbox", label: "Checkbox", icon: "check_box" },
  { value: "text",     label: "Text",     icon: "short_text" },
  { value: "number",   label: "Number",   icon: "pin" },
  { value: "select",   label: "Select",   icon: "list" },
];

const NAME_FIELD = {
  id: "field-名前",
  label: "名前",
  type: "name",
  required: true,
  locked: true,
};

function newField() {
  return {
    id: crypto.randomUUID(),
    label: "",
    description: "",
    imageURL: "",
    type: "checkbox",
    required: false,
    photoRequired: false,
    options: [],
    min: null,
    max: null,
    unit: "",
  };
}

function ensureNameField(fields) {
  const has = fields.some((f) => f.type === "name");
  return has ? fields : [NAME_FIELD, ...fields];
}

function emptyDraft() {
  return {
    name: "",
    description: "",
    工場: "",
    equipmentIds: [],
    schedule: "",
    startDate: "",
    fields: [NAME_FIELD],
    status: "draft",
  };
}

const inputClass =
  "w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40";

export default function CheckFormBuilderModal({ initial, onClose, onSaved }) {
  const [draft, setDraft] = useState(() =>
    initial
      ? { name: initial.name, description: initial.description ?? "", 工場: initial.工場 ?? "", equipmentIds: initial.equipmentIds ?? (initial.equipmentId ? [initial.equipmentId] : []), schedule: initial.schedule ?? "", startDate: initial.startDate ?? "", fields: ensureNameField(initial.fields ?? []), status: initial.status ?? "draft" }
      : emptyDraft()
  );
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchFactoryDBRecords().then((data) => setFactories(Array.isArray(data) ? data : [])).catch(() => {});
    fetchSetsubiDBRecords().then((data) => setAllEquipment(Array.isArray(data) ? data : [])).catch(() => {});
    fetchCheckFormTemplates().then((data) => setAllTemplates(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const nameConflict = draft.name.trim()
    ? allTemplates.some(
        (t) => t.name.toLowerCase() === draft.name.trim().toLowerCase() && t._id !== initial?._id
      )
    : false;

  const filteredEquipment = draft.工場
    ? allEquipment.filter((e) => e.工場 === draft.工場)
    : [];

  const selectedField = draft.fields.find((f) => f.id === selectedFieldId) ?? null;

  function setTop(key, val) {
    setDraft((d) => ({
      ...d,
      [key]: val,
      ...(key === "工場" ? { equipmentIds: allEquipment.filter((e) => e.工場 === val).map((e) => e._id) } : {}),
    }));
  }

  function addField() {
    const f = newField();
    setDraft((d) => ({ ...d, fields: [...d.fields, f] }));
    setSelectedFieldId(f.id);
  }

  function removeField(id) {
    setDraft((d) => {
      const next = d.fields.filter((f) => f.id !== id);
      return { ...d, fields: next };
    });
    setSelectedFieldId((cur) => (cur === id ? null : cur));
  }

  function updateField(id, patch) {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  function moveField(id, dir) {
    setDraft((d) => {
      const idx = d.fields.findIndex((f) => f.id === id);
      if (idx < 0) return d;
      const next = [...d.fields];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return d;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...d, fields: next };
    });
  }

  async function save(deployStatus) {
    if (!draft.name.trim()) { setError("Form name is required."); return; }
    if (nameConflict) { setError("Please choose a unique form name before saving."); return; }
    setBusy(true);
    setError(null);
    const authUser = getAuthUser();
    const username = authUser?.username || "unknown";
    const payload = { ...draft, status: deployStatus };
    try {
      if (initial?._id) {
        await updateCheckFormTemplate(initial._id, payload, username);
        onSaved();
      } else {
        await createCheckFormTemplate(payload, username);
        setShowSuccess(true);
        setTimeout(() => { setShowSuccess(false); onSaved(); }, 2500);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const FIELD_TYPE_ICONS = { ...Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.icon])), name: "person" };
  const username = getAuthUser()?.username || "";

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-outline-variant/20 bg-surface shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
              {initial ? "Edit Form" : "New Form"}
            </p>
            <h2 className="mt-0.5 text-lg font-black text-on-surface">Form Builder</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-outline hover:bg-primary/5 hover:text-primary transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: form meta + field list */}
          <div className="flex w-72 flex-shrink-0 flex-col border-r border-outline-variant/20 overflow-y-auto p-4 gap-3">
            {/* Form name */}
            <div>
              <input
                type="text"
                placeholder="Form name *"
                value={draft.name}
                onChange={(e) => setTop("name", e.target.value)}
                className={`${inputClass} ${nameConflict ? "border-error/50 focus:border-error/60" : ""}`}
              />
              {nameConflict && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-error">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
                  This form name is already in use.
                </p>
              )}
            </div>
            {/* Factory */}
            <select value={draft.工場} onChange={(e) => setTop("工場", e.target.value)} className={inputClass}>
              <option value="" disabled>Factory</option>
              {factories.map((f) => (
                <option key={f._id ?? f.工場} value={f.工場}>{f.工場}</option>
              ))}
            </select>
            {/* Machine — multi-select checkboxes */}
            <div className={`rounded-2xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm transition ${!draft.工場 ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-outline">Machine</span>
                {filteredEquipment.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = filteredEquipment.map((e) => e._id);
                      const allSelected = allIds.every((id) => draft.equipmentIds.includes(id));
                      setTop("equipmentIds", allSelected ? [] : allIds);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {filteredEquipment.length > 0 && filteredEquipment.every((e) => draft.equipmentIds.includes(e._id)) ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              {!draft.工場 && <p className="text-xs text-outline py-1">Select a factory first</p>}
              {draft.工場 && filteredEquipment.length === 0 && <p className="text-xs text-outline py-1">No machines found</p>}
              {filteredEquipment.length > 0 && (
                <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5 mt-1">
                  {filteredEquipment.map((e) => (
                    <label key={e._id} className="flex items-center gap-2 cursor-pointer rounded-lg px-1 py-1 hover:bg-primary/5 transition">
                      <input
                        type="checkbox"
                        checked={draft.equipmentIds.includes(e._id)}
                        onChange={() => {
                          const ids = draft.equipmentIds.includes(e._id)
                            ? draft.equipmentIds.filter((id) => id !== e._id)
                            : [...draft.equipmentIds, e._id];
                          setTop("equipmentIds", ids);
                        }}
                        className="accent-primary h-3.5 w-3.5 flex-shrink-0"
                      />
                      <span className="text-xs text-on-surface truncate">{e.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {/* Schedule */}
            <select value={draft.schedule} onChange={(e) => setTop("schedule", e.target.value)} className={inputClass}>
              <option value="" disabled>Frequency</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.15em] text-outline">Start Date</p>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setTop("startDate", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="mt-1 border-t border-outline-variant/20 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-outline">Fields</p>
              {draft.fields.length === 0 && (
                <p className="text-xs text-outline py-2">No fields yet.</p>
              )}
              {draft.fields.map((f, idx) => (
                <div
                  key={f.id}
                  onClick={() => !f.locked && setSelectedFieldId(f.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 mb-1 transition ${
                    f.locked
                      ? "bg-surface-container text-outline cursor-default"
                      : selectedFieldId === f.id
                        ? "bg-primary/10 text-primary cursor-pointer"
                        : "hover:bg-surface-container text-on-surface cursor-pointer"
                  }`}
                >
                  <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 16 }}>
                    {FIELD_TYPE_ICONS[f.type] ?? "list"}
                  </span>
                  <span className="flex-1 truncate text-xs font-medium">{f.label}</span>
                  {f.locked ? (
                    <span className="material-symbols-outlined flex-shrink-0 text-outline/50" style={{ fontSize: 13 }}>lock</span>
                  ) : (
                    <div className="flex gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button type="button" disabled={idx === 0} onClick={() => moveField(f.id, -1)} className="flex h-5 w-5 items-center justify-center rounded text-outline hover:text-primary disabled:opacity-30 transition">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_upward</span>
                      </button>
                      <button type="button" disabled={idx === draft.fields.length - 1} onClick={() => moveField(f.id, 1)} className="flex h-5 w-5 items-center justify-center rounded text-outline hover:text-primary disabled:opacity-30 transition">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_downward</span>
                      </button>
                      <button type="button" onClick={() => removeField(f.id)} className="flex h-5 w-5 items-center justify-center rounded text-outline hover:text-error transition">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addField}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant/40 px-3 py-2.5 text-xs font-bold text-outline hover:border-primary/40 hover:text-primary transition"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                Add field
              </button>
            </div>
          </div>

          {/* Right: field editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedField ? (
              <FieldEditor field={selectedField} onChange={(patch) => updateField(selectedField.id, patch)} username={username} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-outline">
                <span className="material-symbols-outlined" style={{ fontSize: 36 }}>edit_note</span>
                <p className="text-sm">Select a field to edit it, or add a new one.</p>
                <p className="text-xs opacity-60">The 名前 field is added automatically to every form.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-outline-variant/20 px-6 py-4 gap-3">
          <div className="flex-1">
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container-high">
              Cancel
            </button>
            <button type="button" disabled={busy || nameConflict} onClick={() => save("draft")} className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container-high disabled:opacity-50">
              {busy ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" disabled={busy || nameConflict} onClick={() => save("active")} className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50">
              {busy ? "Saving…" : "Deploy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const toast = showSuccess && (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-on-surface px-5 py-3.5 shadow-2xl">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check</span>
        </span>
        <span className="text-sm font-semibold text-surface">Form created successfully</span>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modal, document.body)}
      {toast && createPortal(toast, document.body)}
    </>
  );
}

function FieldEditor({ field, onChange, username }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    try {
      const base64 = await toBase64(file);
      const result = await uploadEquipmentEventImage({ base64, factoryName: "checkform", equipmentName: field.label || "field", username });
      onChange({ imageURL: result.imageURL });
    } catch (err) {
      const raw = err?.message || "";
      setUploadError(raw.startsWith("<") ? "Upload failed — check server is running." : raw || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Title</label>
        <input
          type="text"
          placeholder="Describe this check…"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Instruction</label>
        <input
          type="text"
          placeholder="What should be checked…"
          value={field.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Reference Image</label>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface px-4 py-2.5 text-xs font-bold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
              アップロード中…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>attach_file</span>
              {field.imageURL ? "画像を変更" : "画像を添付"}
            </>
          )}
        </button>
        {uploadError && <p className="mt-2 text-xs text-error">{uploadError}</p>}
        {field.imageURL && (
          <div className="mt-3 group relative inline-block">
            <img src={field.imageURL} alt="reference" className="h-20 w-20 rounded-xl object-cover border border-outline-variant/20" />
            <button
              type="button"
              onClick={() => onChange({ imageURL: "" })}
              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Type</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FIELD_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value })}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-xs font-bold transition ${
                field.type === t.value
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-outline-variant/30 bg-surface text-outline hover:border-primary/30 hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={field.photoRequired}
          onClick={() => onChange({ photoRequired: !field.photoRequired })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            field.photoRequired ? "bg-primary" : "bg-outline/30"
          }`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${field.photoRequired ? "translate-x-5" : "translate-x-0"}`} />
        </button>
        <span className="text-sm font-medium text-on-surface">Photo required</span>
      </div>

      {(field.type === "number") && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Min</label>
            <input type="number" value={field.min ?? ""} onChange={(e) => onChange({ min: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Max</label>
            <input type="number" value={field.max ?? ""} onChange={(e) => onChange({ max: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Unit</label>
            <input type="text" placeholder="e.g. °C" value={field.unit ?? ""} onChange={(e) => onChange({ unit: e.target.value })}
              className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40" />
          </div>
        </div>
      )}

      {field.type === "select" && (
        <SelectOptionsEditor options={field.options ?? []} onChange={(opts) => onChange({ options: opts })} />
      )}
    </div>
  );
}

function SelectOptionsEditor({ options, onChange }) {
  const [newOpt, setNewOpt] = useState("");

  function addOpt() {
    const val = newOpt.trim();
    if (!val || options.includes(val)) return;
    onChange([...options, val]);
    setNewOpt("");
  }

  function removeOpt(val) {
    onChange(options.filter((o) => o !== val));
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Options</label>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <span key={o} className="flex items-center gap-1 rounded-full bg-surface-container border border-outline-variant/20 px-2.5 py-0.5 text-xs font-medium text-on-surface">
            {o}
            <button type="button" onClick={() => removeOpt(o)} className="ml-0.5 text-outline hover:text-error transition">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add option…"
          value={newOpt}
          onChange={(e) => setNewOpt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOpt(); } }}
          className="flex-1 rounded-2xl border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
        <button type="button" onClick={addOpt} className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90">
          Add
        </button>
      </div>
    </div>
  );
}
