import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchWorkerNames, createWorkerRecord, uploadEquipmentEventImage, createCheckFormRecord, createNgReport, fetchSetsubiDBRecords } from "../services/api";
import { getAuthUser } from "../utils/masterDB";

function normalizeId(id) {
  if (!id) return "";
  if (typeof id === "object" && id.$oid) return id.$oid;
  return String(id);
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function getPeriodBounds(schedule) {
  const now = new Date();
  let start, end;
  if (schedule === "weekly") {
    const dow = (now.getDay() + 6) % 7;
    start = new Date(now); start.setDate(now.getDate() - dow); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  } else if (schedule === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start); end.setHours(23, 59, 59, 999);
  }
  return {
    periodStart: start.toISOString().split("T")[0],
    periodEnd: end.toISOString().split("T")[0],
  };
}

function NameInput({ value, onChange, workerNames, onNewName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function handleBlur() {
    const trimmed = value.trim();
    if (trimmed && !workerNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      createWorkerRecord(trimmed).catch(() => {});
      onNewName(trimmed);
    }
  }

  const filtered = value.trim()
    ? workerNames.filter(n => n.toLowerCase().includes(value.toLowerCase()))
    : workerNames;

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder="名前を選択または入力…"
        autoComplete="off"
        className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-4 py-4 text-base text-on-surface outline-none transition focus:border-primary/50"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface shadow-xl">
          {filtered.map(name => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); onChange(name); setOpen(false); }}
                className="w-full px-4 py-3 text-left text-base text-on-surface transition hover:bg-surface-container"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhotoField({ fieldId, photoUrl, uploading, onUpload, onRemove }) {
  const fileRef = useRef(null);
  return (
    <div className="mt-3 border-t border-outline-variant/10 pt-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onUpload(f); } }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface py-8 text-sm font-bold text-outline transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
      >
        {uploading ? (
          <>
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
            アップロード中…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 40 }}>add</span>
            ファイルを添付
          </>
        )}
      </button>
      {photoUrl && (
        <div className="mt-2 group relative inline-block">
          <img src={photoUrl} alt="添付画像" className="h-24 w-24 rounded-2xl object-cover border border-outline-variant/20" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-error text-white group-hover:flex"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
          </button>
        </div>
      )}
    </div>
  );
}

function FieldCard({ field, value, onChange, photoUrl, photoUploading, onPhotoUpload, onPhotoRemove }) {
  const [refImageOpen, setRefImageOpen] = useState(false);

  if (field.type === "name") {
    return null; // handled separately
  }

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-bold text-base text-on-surface leading-tight">{field.label || <span className="italic text-outline">Untitled field</span>}</p>
          {field.description && (
            <p className="mt-1 text-sm text-outline">{field.description}</p>
          )}
        </div>
        {field.imageURL && (
          <button
            type="button"
            onClick={() => setRefImageOpen(o => !o)}
            className="flex-shrink-0 rounded-xl overflow-hidden border border-outline-variant/20 hover:opacity-80 transition"
          >
            <img src={field.imageURL} alt="reference" className="h-14 w-14 object-cover" />
          </button>
        )}
      </div>

      {refImageOpen && field.imageURL && (
        <div className="mb-3 rounded-2xl overflow-hidden border border-outline-variant/20">
          <img src={field.imageURL} alt="reference" className="w-full object-contain max-h-64" />
        </div>
      )}

      {field.type === "checkbox" && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onChange(value === "ok" ? "" : "ok")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-black transition ${
              value === "ok"
                ? "bg-primary text-on-primary"
                : "border border-outline-variant/30 bg-surface text-outline hover:border-primary/40 hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: value === "ok" ? "'FILL' 1" : "'FILL' 0" }}>check_circle</span>
            OK
          </button>
          <button
            type="button"
            onClick={() => onChange(value === "ng" ? "" : "ng")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-black transition ${
              value === "ng"
                ? "bg-error text-white"
                : "border border-outline-variant/30 bg-surface text-outline hover:border-error/40 hover:text-error"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: value === "ng" ? "'FILL' 1" : "'FILL' 0" }}>cancel</span>
            NG
          </button>
        </div>
      )}

      {field.type === "text" && (
        <input
          type="text"
          placeholder="Enter text…"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-4 py-3.5 text-base text-on-surface outline-none transition focus:border-primary/50"
        />
      )}

      {field.type === "number" && (
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="—"
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-36 rounded-2xl border border-outline-variant/30 bg-surface px-4 py-3.5 text-base text-on-surface outline-none transition focus:border-primary/50"
          />
          {field.unit && <span className="text-sm text-outline font-medium">{field.unit}</span>}
          {(field.min != null || field.max != null) && (
            <span className="text-xs text-outline">
              {field.min != null ? field.min : "—"} – {field.max != null ? field.max : "—"}
            </span>
          )}
        </div>
      )}

      {field.type === "select" && (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-4 py-3.5 text-base text-on-surface outline-none transition focus:border-primary/50"
        >
          <option value="">選択…</option>
          {(field.options ?? []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {(field.photoRequired || (field.type === "checkbox" && value === "ng")) && (
        <>
          {field.type === "checkbox" && value === "ng" && !field.photoRequired && (
            <p className="mt-3 text-xs font-bold text-error">Attach a photo of the fault (optional)</p>
          )}
          <PhotoField
            fieldId={field.id}
            photoUrl={photoUrl}
            uploading={photoUploading}
            onUpload={onPhotoUpload}
            onRemove={onPhotoRemove}
          />
        </>
      )}
    </div>
  );
}

export default function CheckFormSimulatorModal({ form, onClose }) {
  const [workerNames, setWorkerNames] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [values, setValues] = useState({});
  const [fieldPhotos, setFieldPhotos] = useState({});
  const [photoUploading, setPhotoUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitTime, setSubmitTime] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const username = getAuthUser()?.username || "simulator";
  const nameField = (form.fields ?? []).find(f => f.type === "name");
  const otherFields = (form.fields ?? []).filter(f => f.type !== "name");

  useEffect(() => {
    fetchWorkerNames().then(setWorkerNames).catch(() => {});
    fetchSetsubiDBRecords().then(data => setAllEquipment(Array.isArray(data) ? data : [])).catch(() => {});
    const init = {};
    for (const f of (form.fields ?? [])) {
      init[f.id] = "";
    }
    setValues(init);
  }, [form]);

  const formEquipment = allEquipment.filter(e =>
    (form.equipmentIds ?? []).some(id => normalizeId(id) === normalizeId(e._id))
  );

  useEffect(() => {
    if (formEquipment.length === 1) setSelectedMachineId(normalizeId(formEquipment[0]._id));
  }, [formEquipment.length]);

  function setValue(fieldId, val) {
    setValues(v => ({ ...v, [fieldId]: val }));
  }

  async function handlePhotoUpload(fieldId, file) {
    setPhotoUploading(u => ({ ...u, [fieldId]: true }));
    try {
      const base64 = await toBase64(file);
      const result = await uploadEquipmentEventImage({ base64, factoryName: form.工場 || "", equipmentName: form.name || "", username });
      setFieldPhotos(p => ({ ...p, [fieldId]: result.imageURL }));
    } catch {
      // silent — user can retry
    } finally {
      setPhotoUploading(u => ({ ...u, [fieldId]: false }));
    }
  }

  const nameValue = nameField ? (values[nameField.id] ?? "") : "";
  const needsMachineSelect = formEquipment.length > 1;
  const canSubmit = nameValue.trim() !== "" && !submitting && (!needsMachineSelect || !!selectedMachineId);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    const { periodStart, periodEnd } = getPeriodBounds(form.schedule || "daily");
    const formId = String(form._id?.$oid ?? form._id ?? "");
    const now = new Date().toISOString();
    const responses = { ...values };
    for (const [fid, url] of Object.entries(fieldPhotos)) {
      responses[`${fid}_photo`] = url;
    }
    const selectedMachine = formEquipment.find(e => normalizeId(e._id) === selectedMachineId);
    const machineId = selectedMachine ? normalizeId(selectedMachine._id) : "";
    const machineName = selectedMachine?.name ?? "";
    const ngFields = otherFields
      .filter(f => f.type === "checkbox" && values[f.id] === "ng")
      .map(f => ({ fieldId: f.id, fieldLabel: f.label, photoUrl: fieldPhotos[f.id] ?? "" }));
    try {
      const result = await createCheckFormRecord({
        formId,
        formName: form.name,
        工場: form.工場 || "",
        schedule: form.schedule || "",
        machineId,
        machineName,
        completedBy: nameValue.trim(),
        completedAt: now,
        periodStart,
        periodEnd,
        hasNG: ngFields.length > 0,
        ngFields,
        responses,
        deviceId: "simulator",
      });
      if (ngFields.length > 0) {
        const recordId = String(result?._id?.$oid ?? result?._id ?? result?.insertedId ?? "");
        await Promise.all(ngFields.map(({ fieldId, fieldLabel, photoUrl }) =>
          createNgReport({
            formId,
            formName: form.name,
            工場: form.工場 || "",
            recordId,
            machineId,
            machineName,
            fieldId,
            fieldLabel,
            photoUrl,
            completedBy: nameValue.trim(),
            completedAt: now,
          })
        ));
      }
      setSubmitTime(now);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    const init = {};
    for (const f of (form.fields ?? [])) {
      init[f.id] = "";
    }
    setValues(init);
    setFieldPhotos({});
    setSubmitted(false);
    setSubmitTime(null);
    setSubmitError(null);
    if (formEquipment.length > 1) setSelectedMachineId("");
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-8">
      {/* Tablet device frame */}
      <div className="relative flex w-full max-w-[768px] flex-col rounded-[2.5rem] border-4 border-on-surface/10 bg-surface shadow-2xl" style={{ height: "min(90vh, 1024px)" }}>

        {/* Tablet top bar (decorative) */}
        <div className="flex flex-shrink-0 items-center justify-center rounded-t-[2rem] bg-surface-container px-6 py-2.5">
          <div className="h-1.5 w-16 rounded-full bg-outline/20" />
          <div className="absolute right-5 top-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-outline/50">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>devices</span>
            Simulator
          </div>
        </div>

        {/* Form header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-outline-variant/20 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-on-surface">{form.name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-outline">
              {form.工場 && <span>{form.工場}</span>}
              {form.schedule && <span className="capitalize">{form.schedule}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {submitted ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 48, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <p className="text-2xl font-black text-on-surface">提出完了</p>
                <p className="mt-1 text-sm text-outline">Check submitted successfully</p>
                {submitTime && (
                  <p className="mt-2 text-xs text-outline">
                    {new Date(submitTime).toLocaleString("ja-JP")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-4 rounded-2xl border border-outline-variant/30 bg-surface-container px-6 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
              >
                新しいチェックを開始
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Machine selector */}
              {formEquipment.length > 1 && (
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-5">
                  <p className="mb-3 font-bold text-base text-on-surface">
                    Machine
                    <span className="ml-1.5 text-error">*</span>
                  </p>
                  <select
                    value={selectedMachineId}
                    onChange={e => setSelectedMachineId(e.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/30 bg-surface px-4 py-4 text-base text-on-surface outline-none transition focus:border-primary/50"
                  >
                    <option value="" disabled>Select machine…</option>
                    {formEquipment.map(e => (
                      <option key={normalizeId(e._id)} value={normalizeId(e._id)}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name field */}
              {nameField && (
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-5">
                  <p className="mb-3 font-bold text-base text-on-surface">
                    {nameField.label}
                    <span className="ml-1.5 text-error">*</span>
                  </p>
                  <NameInput
                    value={nameValue}
                    onChange={v => setValue(nameField.id, v)}
                    workerNames={workerNames}
                    onNewName={name => setWorkerNames(prev => [...new Set([...prev, name])].sort((a, b) => a.localeCompare(b, "ja")))}
                  />
                </div>
              )}

              {/* Other fields */}
              {otherFields.map(field => (
                <FieldCard
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ""}
                  onChange={val => setValue(field.id, val)}
                  photoUrl={fieldPhotos[field.id]}
                  photoUploading={!!photoUploading[field.id]}
                  onPhotoUpload={file => handlePhotoUpload(field.id, file)}
                  onPhotoRemove={() => setFieldPhotos(p => { const n = { ...p }; delete n[field.id]; return n; })}
                />
              ))}

              {submitError && (
                <p className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">{submitError}</p>
              )}
            </div>
          )}
        </div>

        {/* Submit button — sticky footer */}
        {!submitted && (
          <div className="flex-shrink-0 border-t border-outline-variant/20 px-6 py-4">
            {!canSubmit && needsMachineSelect && !selectedMachineId && (
              <p className="mb-2 text-center text-xs text-outline">Select a machine to continue</p>
            )}
            {!canSubmit && nameValue.trim() === "" && (
              <p className="mb-2 text-center text-xs text-outline">名前を入力してください</p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full rounded-2xl bg-primary py-4 text-base font-black text-on-primary transition hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 20 }}>progress_activity</span>
                  送信中…
                </span>
              ) : "送信する"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
