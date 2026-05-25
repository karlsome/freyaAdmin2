import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  fetchCheckFormTemplates,
  fetchCheckFormReferenceImages,
  fetchCheckFormReferenceImageSource,
  createCheckFormTemplate,
  updateCheckFormTemplate,
  deleteCheckFormTemplate,
  uploadCheckFormReferenceImage,
} from "../services/api";
import CheckFormImageLightboxModal from "./CheckFormImageLightboxModal";
import CheckFormImageOverlayEditorModal from "./CheckFormImageOverlayEditorModal";
import { getAuthUser } from "../utils/masterDB";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function normalizeId(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.$oid ?? value._id?.$oid ?? value._id ?? "").trim();
  }
  return String(value).trim();
}

const FIELD_TYPES = [
  { value: "toggle", label: "Toggle Buttons", icon: "task_alt" },
  { value: "text", label: "Text", icon: "short_text" },
  { value: "number", label: "Number", icon: "pin" },
  { value: "select", label: "Select", icon: "list" },
];

const FIELD_TYPE_META = Object.fromEntries(FIELD_TYPES.map((type) => [type.value, type]));

const SCHEDULE_OPTIONS = [
  { value: "daily", label: "Daily", hint: "Every day", icon: "today" },
  { value: "weekly", label: "Weekly", hint: "Every Monday", icon: "date_range" },
  { value: "monthly", label: "Monthly", hint: "1st day of month", icon: "calendar_month" },
];

const NAME_FIELD = {
  id: "field-名前",
  label: "名前",
  type: "name",
  required: true,
  locked: true,
};

function newField(type = "toggle") {
  const id = crypto.randomUUID();

  return {
    id,
    label: "",
    description: "",
    imageURL: "",
    imageFolderKey: buildFieldImageFolderKey({ id }),
    type,
    required: true,
    photoRequired: false,
    options: [],
    min: null,
    max: null,
    unit: "",
  };
}

function normalizeField(field) {
  if (!field || typeof field !== "object") return field;

  const imageURL = normalizeImageURL(field.imageURL);
  return {
    ...field,
    imageURL,
    imageFolderKey: buildFieldImageFolderKey({ ...field, imageURL }),
  };
}

function ensureNameField(fields) {
  const normalizedFields = Array.isArray(fields) ? fields.map(normalizeField) : [];
  const has = normalizedFields.some((field) => field.type === "name");
  return has ? normalizedFields : [NAME_FIELD, ...normalizedFields];
}

function emptyDraft(presetSchedule = "") {
  return {
    name: "",
    description: "",
    工場: "",
    equipmentIds: [],
    schedule: presetSchedule,
    startDate: "",
    fields: [NAME_FIELD],
    status: "draft",
  };
}

function getFieldTypeMeta(type) {
  return FIELD_TYPE_META[type] ?? { label: type || "Field", icon: "list" };
}

function renderFieldTypeGlyph(typeMeta, size = 16) {
  if (typeMeta.value === "toggle") {
    return (
      <span className="inline-flex min-w-[1.9rem] items-center justify-center rounded-full border border-current/30 px-1.5 py-0.5 text-[10px] font-black leading-none tracking-[0.08em]">
        OK
      </span>
    );
  }

  return <span className="material-symbols-outlined" style={{ fontSize: size }}>{typeMeta.icon}</span>;
}

function getMachineNames(equipmentIds = [], allEquipment = []) {
  const selectedIds = equipmentIds.map(normalizeId).filter(Boolean);
  return allEquipment
    .filter((equipment) => selectedIds.includes(normalizeId(equipment._id)))
    .map((equipment) => equipment.name)
    .filter(Boolean);
}

function decodeRepeatedly(value, attempts = 3) {
  let nextValue = value;

  for (let index = 0; index < attempts; index += 1) {
    try {
      const decoded = decodeURIComponent(nextValue);
      if (decoded === nextValue) break;
      nextValue = decoded;
    } catch {
      break;
    }
  }

  return nextValue;
}

function normalizeImageURL(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (!raw.includes("firebasestorage.googleapis.com/")) return raw;

  const queryIndex = raw.indexOf("?");
  const base = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const query = queryIndex >= 0 ? raw.slice(queryIndex + 1) : "";
  const objectMarker = "/o/";
  const objectIndex = base.indexOf(objectMarker);

  if (objectIndex < 0) return raw;

  const prefix = base.slice(0, objectIndex + objectMarker.length);
  const objectPath = decodeRepeatedly(base.slice(objectIndex + objectMarker.length))
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("%2F");

  return query ? `${prefix}${objectPath}?${query}` : `${prefix}${objectPath}`;
}

function sanitizeFieldFolderSegment(value, fallback = "field") {
  const sanitized = String(value || "").trim().replace(/[^a-zA-Z0-9\u3000-\u9fff_-]+/g, "_");
  return sanitized || fallback;
}

function extractFieldImageFolderKeyFromURL(value) {
  const normalizedURL = normalizeImageURL(value);
  if (!normalizedURL) return "";

  try {
    const parsed = new URL(normalizedURL);
    const objectPath = decodeRepeatedly(parsed.pathname.split("/o/")[1] || "");
    const segments = objectPath.split("/").filter(Boolean);

    if (segments[0] !== "equipmentEvents" || segments[1] !== "checkform" || !segments[2]) {
      return "";
    }

    return sanitizeFieldFolderSegment(segments[2], "");
  } catch {
    return "";
  }
}

function buildFieldImageFolderKey(field = {}) {
  const explicitKey = sanitizeFieldFolderSegment(field.imageFolderKey, "");
  if (explicitKey) return explicitKey;

  const imageKey = extractFieldImageFolderKeyFromURL(field.imageURL);
  if (imageKey) return imageKey;

  const safeLabel = sanitizeFieldFolderSegment(field.label, "field");
  const safeId = sanitizeFieldFolderSegment(field.id, "id");
  const suffix = safeId.slice(-8) || safeId || "field";
  return safeLabel === "field" ? `field_${suffix}` : `${safeLabel}_${suffix}`;
}

function normalizeReferenceLibraryImages(images = []) {
  if (!Array.isArray(images)) return [];

  const seen = new Set();

  return images.flatMap((image) => {
    const imageURL = normalizeImageURL(image?.imageURL);
    if (!imageURL || seen.has(imageURL)) return [];
    seen.add(imageURL);
    return [{ ...image, imageURL }];
  });
}

const inputClass =
  "w-full rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40";

function getBuilderViewportSize() {
  if (typeof window === "undefined") {
    return { width: 1280, height: 900 };
  }

  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3">
      <div className="flex items-center gap-2 text-outline">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-bold text-on-surface">{value}</p>
    </div>
  );
}

function ToggleRow({ checked, onToggle, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <p className="mt-1 text-xs leading-5 text-outline">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-primary" : "bg-outline/30"
        }`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function FieldPreviewCard({ field }) {
  const typeMeta = getFieldTypeMeta(field.type);
  const hasRange = field.type === "number" && (field.min != null || field.max != null);

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-primary">{renderFieldTypeGlyph(typeMeta, 16)}</span>
            <p className="truncate text-sm font-semibold text-on-surface">{field.label || "Untitled check"}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-outline">
            {field.description || "No field instruction has been added yet."}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
          {typeMeta.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
        {field.locked ? (
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">Locked</span>
        ) : null}
        {field.required ? (
          <span className="rounded-full bg-error/10 px-2.5 py-1 text-error">Required</span>
        ) : null}
        {field.photoRequired ? (
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">Photo required</span>
        ) : null}
        {field.unit ? (
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">Unit: {field.unit}</span>
        ) : null}
        {hasRange ? (
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">
            Range: {field.min != null ? field.min : "-"} - {field.max != null ? field.max : "-"}
          </span>
        ) : null}
        {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 ? (
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">{field.options.length} options</span>
        ) : null}
      </div>

      {field.imageURL ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container">
          <img src={normalizeImageURL(field.imageURL)} alt={field.label || "Field reference"} className="h-40 w-full object-cover" />
        </div>
      ) : null}

      {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Options</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {field.options.map((option) => (
              <span key={option} className="rounded-full border border-outline-variant/20 bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface">
                {option}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CheckFormBuilderModal({ initial, onClose, onSaved, presetSchedule = "" }) {
  const [viewportSize, setViewportSize] = useState(() => getBuilderViewportSize());
  const [draft, setDraft] = useState(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          工場: initial.工場 ?? "",
          equipmentIds: (initial.equipmentIds ?? (initial.equipmentId ? [initial.equipmentId] : [])).map(normalizeId),
          schedule: initial.schedule ?? "",
          startDate: initial.startDate ?? "",
          fields: ensureNameField(initial.fields ?? []),
          status: initial.status ?? "draft",
        }
      : emptyDraft(presetSchedule)
  );
  const [expandedFieldId, setExpandedFieldId] = useState(null);
  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncViewportSize = () => setViewportSize(getBuilderViewportSize());
    syncViewportSize();

    window.addEventListener("resize", syncViewportSize);
    window.visualViewport?.addEventListener("resize", syncViewportSize);

    return () => {
      window.removeEventListener("resize", syncViewportSize);
      window.visualViewport?.removeEventListener("resize", syncViewportSize);
    };
  }, []);

  useEffect(() => {
    fetchFactoryDBRecords().then((data) => setFactories(Array.isArray(data) ? data : [])).catch(() => {});
    fetchSetsubiDBRecords().then((data) => setAllEquipment(Array.isArray(data) ? data : [])).catch(() => {});
    fetchCheckFormTemplates().then((data) => setAllTemplates(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (expandedFieldId == null) return;

    const exists = draft.fields.some((field) => field.id === expandedFieldId);
    if (!exists) {
      setExpandedFieldId(draft.fields.find((field) => !field.locked)?.id ?? draft.fields[0]?.id ?? null);
    }
  }, [draft.fields, expandedFieldId]);

  const username = getAuthUser()?.username || "";
  const initialId = normalizeId(initial?._id);
  const nameConflict = draft.name.trim()
    ? allTemplates.some(
        (template) =>
          template.name.toLowerCase() === draft.name.trim().toLowerCase() && normalizeId(template._id) !== initialId
      )
    : false;

  const filteredEquipment = draft.工場
    ? allEquipment.filter((equipment) => equipment.工場 === draft.工場)
    : [];

  const selectedScheduleOption = SCHEDULE_OPTIONS.find((option) => option.value === draft.schedule) ?? null;
  const selectedMachineIds = draft.equipmentIds.map(normalizeId).filter(Boolean);
  const selectedMachineNames = getMachineNames(draft.equipmentIds, allEquipment);
  const allFilteredSelected =
    filteredEquipment.length > 0 &&
    filteredEquipment.every((equipment) => selectedMachineIds.includes(normalizeId(equipment._id)));
  const expandedField = draft.fields.find((field) => field.id === expandedFieldId) ?? null;
  const editableFieldCount = draft.fields.filter((field) => !field.locked).length;
  const requiredFieldCount = draft.fields.filter((field) => field.required).length;
  const modalVerticalInset = viewportSize.width >= 640 ? 32 : 24;
  const modalHeight = Math.max(viewportSize.height - modalVerticalInset, 320);

  function setTop(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "工場" ? { equipmentIds: [] } : {}),
    }));
  }

  function toggleMachine(machineId) {
    const normalizedMachineId = normalizeId(machineId);
    setDraft((current) => {
      const currentIds = current.equipmentIds.map(normalizeId).filter(Boolean);
      const nextIds = currentIds.includes(normalizedMachineId)
        ? currentIds.filter((id) => id !== normalizedMachineId)
        : [...currentIds, normalizedMachineId];
      return { ...current, equipmentIds: nextIds };
    });
  }

  function toggleAllMachines() {
    const allIds = filteredEquipment.map((equipment) => normalizeId(equipment._id)).filter(Boolean);
    setTop("equipmentIds", allFilteredSelected ? [] : allIds);
  }

  function addField(type = "toggle") {
    const field = newField(type);
    setDraft((current) => ({ ...current, fields: [...current.fields, field] }));
    setExpandedFieldId(field.id);
  }

  function removeField(id) {
    const nextFields = draft.fields.filter((field) => field.id !== id);
    setDraft((current) => ({ ...current, fields: nextFields }));
    if (expandedFieldId === id) {
      setExpandedFieldId(nextFields.find((field) => !field.locked)?.id ?? nextFields[0]?.id ?? null);
    }
  }

  function updateField(id, patch) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    }));
  }

  function moveField(id, direction) {
    setDraft((current) => {
      const index = current.fields.findIndex((field) => field.id === id);
      if (index < 0) return current;

      const nextFields = [...current.fields];
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= nextFields.length) return current;

      [nextFields[index], nextFields[swapIndex]] = [nextFields[swapIndex], nextFields[index]];
      return { ...current, fields: nextFields };
    });
  }

  async function save(deployStatus) {
    if (!draft.name.trim()) {
      setError("Form name is required.");
      return;
    }
    if (nameConflict) {
      setError("Please choose a unique form name before saving.");
      return;
    }

    setBusy(true);
    setError(null);

    const authUser = getAuthUser();
    const activeUsername = authUser?.username || "unknown";
    const payload = { ...draft, fields: ensureNameField(draft.fields ?? []), status: deployStatus };

    try {
      if (initial?._id) {
        await updateCheckFormTemplate(initial._id, payload, activeUsername);
        onSaved();
      } else {
        await createCheckFormTemplate(payload, activeUsername);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSaved();
        }, 2500);
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteForm() {
    setBusy(true);
    setError(null);

    try {
      await deleteCheckFormTemplate(initial._id, username || "unknown");
      onSaved();
      onClose();
    } catch (deleteError) {
      setError(deleteError.message);
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/40 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4">
      <div
        className="relative flex min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-outline-variant/20 glass-card"
        style={{ height: `${modalHeight}px`, maxHeight: `${modalHeight}px` }}
      >
        <div className="flex items-start justify-between border-b border-outline-variant/20 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">
              {initial ? "Edit Form" : "New Form"}
            </p>
            <h2 className="mt-1 text-xl font-black text-on-surface">Maintenance Form Builder</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-outline">
              Keep the setup simple, then shape each check inline so the form reads clearly before you save it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden">
          <div className="grid h-full min-h-0 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="px-4 py-5 sm:px-6 xl:min-h-0 xl:overflow-y-auto">
              <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                      {initial ? "Update Flow" : "Start Here"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-on-surface">
                      Start with the basics, then expand any field card below to adjust its instructions, type, rules, and reference image.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-surface px-3 py-1.5 text-on-surface">{draft.fields.length} total fields</span>
                    <span className="rounded-full bg-surface px-3 py-1.5 text-on-surface">{editableFieldCount} editable</span>
                    <span className="rounded-full bg-surface px-3 py-1.5 text-on-surface">{requiredFieldCount} required</span>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-outline-variant/20 bg-surface-container/40 p-4">
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Form Setup</p>
                  <p className="mt-1 text-sm text-outline">Define the name, description, factory, cadence, and activation date before editing the checks.</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Form Name</label>
                    <input
                      type="text"
                      placeholder="Form name *"
                      value={draft.name}
                      onChange={(event) => setTop("name", event.target.value)}
                      className={`${inputClass} ${nameConflict ? "border-error/50 focus:border-error/60" : ""}`}
                    />
                    {nameConflict ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-error">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
                        This form name is already in use.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Factory</label>
                    <select value={draft.工場} onChange={(event) => setTop("工場", event.target.value)} className={inputClass}>
                      <option value="">Select a factory</option>
                      {factories.map((factory) => (
                        <option key={factory._id ?? factory.工場} value={factory.工場}>{factory.工場}</option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Description</label>
                    <textarea
                      rows={3}
                      placeholder="Tell admins and operators what this maintenance form is for."
                      value={draft.description}
                      onChange={(event) => setTop("description", event.target.value)}
                      className={`${inputClass} resize-y`}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Frequency</label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {SCHEDULE_OPTIONS.map((option) => {
                        const isActive = draft.schedule === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setTop("schedule", option.value)}
                            className={`rounded-2xl border px-4 py-4 text-left transition ${
                              isActive
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-outline-variant/30 bg-surface text-on-surface hover:border-primary/30 hover:bg-surface-container"
                            }`}
                          >
                            <span className="material-symbols-outlined mb-2 block" style={{ fontSize: 18 }}>{option.icon}</span>
                            <span className="block text-xs font-bold uppercase tracking-[0.12em]">{option.label}</span>
                            <span className={`mt-1 block text-[11px] ${isActive ? "text-primary/80" : "text-outline"}`}>{option.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">First Active Date</label>
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(event) => setTop("startDate", event.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-xs text-outline">
                      {selectedScheduleOption
                        ? `${selectedScheduleOption.label} forms repeat ${selectedScheduleOption.hint.toLowerCase()}.`
                        : "Choose a cadence so operators know when this form should appear."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-outline-variant/20 bg-surface-container/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Machine Scope</p>
                    <p className="mt-1 text-sm text-outline">Select the machines this form applies to. Switch factories first if needed.</p>
                  </div>
                  {filteredEquipment.length > 0 ? (
                    <button
                      type="button"
                      onClick={toggleAllMachines}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{allFilteredSelected ? "remove_done" : "done_all"}</span>
                      {allFilteredSelected ? "Clear all" : "Select all"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!draft.工場 ? (
                    <span className="rounded-full border border-dashed border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-semibold text-outline">
                      Select a factory first
                    </span>
                  ) : null}

                  {draft.工場 && filteredEquipment.length === 0 ? (
                    <span className="rounded-full border border-dashed border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-semibold text-outline">
                      No machines found
                    </span>
                  ) : null}

                  {filteredEquipment.map((equipment) => {
                    const equipmentId = normalizeId(equipment._id);
                    const isSelected = selectedMachineIds.includes(equipmentId);
                    return (
                      <button
                        key={equipmentId || equipment.name}
                        type="button"
                        onClick={() => toggleMachine(equipment._id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : "border-outline-variant/20 bg-surface text-on-surface hover:border-primary/30 hover:bg-surface-container"
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>precision_manufacturing</span>
                        {equipment.name}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-outline-variant/20 bg-surface-container/40 p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Checks</p>
                  <p className="mt-1 text-sm text-outline">Each field card contains the full setup for that check. Use the number on the left to track checklist order, then add a new item at the bottom when needed.</p>
                </div>

                <div className="mt-4 space-y-3">
                  {draft.fields.map((field, index) => (
                    <FieldCard
                      key={field.id}
                      field={field}
                      index={index}
                      expanded={expandedFieldId === field.id}
                      onToggle={() => setExpandedFieldId((current) => (current === field.id ? null : field.id))}
                      onChange={(patch) => updateField(field.id, patch)}
                      onMoveUp={() => moveField(field.id, -1)}
                      onMoveDown={() => moveField(field.id, 1)}
                      onDelete={() => removeField(field.id)}
                      canMoveUp={index > 0}
                      canMoveDown={index < draft.fields.length - 1}
                      username={username}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => addField()}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-outline-variant/30 bg-surface px-5 py-4 text-sm font-bold text-on-surface transition hover:border-primary/35 hover:bg-surface-container hover:text-primary"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                    </span>
                    Add checklist item
                  </button>
                </div>
              </section>
            </div>

            <aside className="border-t border-outline-variant/20 bg-surface/50 px-4 py-5 sm:px-6 xl:min-h-0 xl:overflow-y-auto xl:border-l xl:border-t-0">
              <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{selectedScheduleOption?.icon || "event_busy"}</span>
                    {selectedScheduleOption?.label || draft.schedule || "Unscheduled"}
                  </span>
                  <span className="inline-flex rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-outline">
                    {draft.status}
                  </span>
                </div>
                <h3 className="text-lg font-black text-on-surface">{draft.name.trim() || "Untitled maintenance form"}</h3>
                <p className="mt-2 text-sm leading-6 text-outline">
                  {draft.description.trim() || "Add a description so admins know the purpose and scope of this form at a glance."}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SummaryCard icon="factory" label="Factory" value={draft.工場 || "Not selected"} />
                <SummaryCard icon="event" label="Start Date" value={draft.startDate || "Not set"} />
                <SummaryCard icon="list" label="Checks" value={`${draft.fields.length} total`} />
                <SummaryCard icon="priority_high" label="Required" value={`${requiredFieldCount} fields`} />
              </div>

              <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Selected Machines</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedMachineNames.length > 0 ? (
                    selectedMachineNames.map((machineName) => (
                      <span
                        key={machineName}
                        className="inline-flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface"
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>precision_manufacturing</span>
                        {machineName}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-outline">No machines selected yet.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Field Focus</p>
                    <p className="mt-1 text-xs leading-5 text-outline">Use this preview to sanity-check the current field while editing inline.</p>
                  </div>
                </div>

                {expandedField ? (
                  <FieldPreviewCard field={expandedField} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container/60 px-4 py-5 text-sm leading-6 text-outline">
                    Select a field card to preview it here.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-outline-variant/20 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center">
            {error ? <p className="text-xs text-error">{error}</p> : null}
            {initial && !error && !confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="w-fit rounded-2xl border border-error/30 px-3 py-2 text-xs font-bold text-error transition hover:bg-error/10 disabled:opacity-50"
              >
                Delete Form
              </button>
            ) : null}
            {initial && confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-error">Delete this form?</p>
                <button
                  type="button"
                  onClick={deleteForm}
                  disabled={busy}
                  className="rounded-2xl bg-error px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="rounded-2xl border border-outline-variant/20 px-3 py-1.5 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container-high sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || nameConflict}
              onClick={() => save("draft")}
              className="flex-1 rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container-high disabled:opacity-50 sm:flex-none"
            >
              {busy ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={busy || nameConflict}
              onClick={() => save("active")}
              className="flex-1 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50 sm:flex-none"
            >
              {busy ? "Saving..." : "Deploy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const toast = showSuccess ? (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-on-surface px-5 py-3.5 shadow-2xl">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check</span>
        </span>
        <span className="text-sm font-semibold text-surface">Form created successfully</span>
      </div>
    </div>
  ) : null;

  return (
    <>
      {createPortal(modal, document.body)}
      {toast ? createPortal(toast, document.body) : null}
    </>
  );
}

function FieldCard({
  field,
  index,
  expanded,
  onToggle,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  username,
}) {
  const typeMeta = getFieldTypeMeta(field.type);
  const hasRange = field.type === "number" && (field.min != null || field.max != null);
  const fieldImageURL = normalizeImageURL(field.imageURL);
  const [thumbnailPreviewImage, setThumbnailPreviewImage] = useState(null);

  return (
    <>
      <div className={`overflow-hidden rounded-2xl border transition ${expanded ? "border-primary/35 bg-primary/5" : "border-outline-variant/20 bg-surface"}`}>
        <div className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-black ${expanded ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"}`}>
                  {index + 1}
                </span>
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${expanded ? "bg-primary text-on-primary" : "bg-surface-container text-primary"}`}>
                  {renderFieldTypeGlyph(typeMeta, 18)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {field.label || (field.locked ? "名前" : `Untitled ${typeMeta.label.toLowerCase()} check`)}
                    </p>
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {typeMeta.label}
                    </span>
                    {field.locked ? (
                      <span className="inline-flex rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-outline">
                        Locked
                      </span>
                    ) : null}
                    {field.required ? (
                      <span className="inline-flex rounded-full bg-error/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-error">
                        Required
                      </span>
                    ) : null}
                    {field.photoRequired ? (
                      <span className="inline-flex rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface">
                        Photo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-outline">
                    {field.description || (field.locked ? "Every form includes the operator name field." : "Add a short instruction so operators know exactly what to check.")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                    {field.unit ? <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">Unit: {field.unit}</span> : null}
                    {hasRange ? (
                      <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">
                        Range: {field.min != null ? field.min : "-"} - {field.max != null ? field.max : "-"}
                      </span>
                    ) : null}
                    {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 ? (
                      <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">{field.options.length} options</span>
                    ) : null}
                    {field.imageURL ? <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">Reference image</span> : null}
                  </div>
                </div>
              </button>

              {fieldImageURL ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setThumbnailPreviewImage({ imageURL: fieldImageURL, name: field.label || "Reference image" });
                  }}
                  className="mt-0.5 flex h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container transition hover:border-primary/35 hover:shadow-[0_8px_20px_rgba(67,97,238,0.14)]"
                  aria-label={`Preview reference image for ${field.label || "checklist field"}`}
                >
                  <img src={fieldImageURL} alt={field.label || "Reference image"} className="h-full w-full object-cover" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-2" onClick={(event) => event.stopPropagation()}>
              {!field.locked ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!canMoveUp}
                    onClick={onMoveUp}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-primary disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveDown}
                    onClick={onMoveDown}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-primary disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-error/10 hover:text-error"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface px-3 py-1.5 text-[11px] font-bold text-on-surface transition hover:bg-surface-container"
              >
                {expanded ? "Collapse" : "Edit"}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{expanded ? "expand_less" : "expand_more"}</span>
              </button>
            </div>
          </div>
        </div>

        {expanded ? (
          <div className="border-t border-outline-variant/20 px-4 py-4">
            {field.locked ? (
              <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
                <p className="text-sm font-semibold text-on-surface">This field is fixed</p>
                <p className="mt-1 text-sm leading-6 text-outline">
                  The operator name field is added automatically to every maintenance form and cannot be removed or edited.
                </p>
              </div>
            ) : (
              <FieldEditor field={field} onChange={onChange} username={username} />
            )}
          </div>
        ) : null}
      </div>

      <CheckFormImageLightboxModal image={thumbnailPreviewImage} onClose={() => setThumbnailPreviewImage(null)} />
    </>
  );
}

function OverlayDialog({
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  maxWidthClass = "max-w-5xl",
  zIndexClass = "z-[90]",
  overlayClassName = "bg-black/45 backdrop-blur-sm",
  panelClassName = "border border-outline-variant/20 bg-surface text-on-surface",
  dividerClassName = "border-outline-variant/20",
  titleClassName = "text-on-surface",
  descriptionClassName = "text-outline",
  closeButtonClassName = "bg-surface-container text-on-surface hover:bg-surface-container-high",
}) {
  return createPortal(
    <div className={`fixed inset-0 ${zIndexClass} ${overlayClassName}`} onMouseDown={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => event.stopPropagation()}
          className={`flex w-full max-h-[88vh] flex-col overflow-hidden rounded-[28px] shadow-[0_32px_100px_rgba(15,23,42,0.22)] ${maxWidthClass} ${panelClassName}`}
        >
          <div className={`flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6 ${dividerClassName}`}>
            <div className="min-w-0 flex-1">
              {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p> : null}
              <h3 className={`mt-1 text-lg font-black ${titleClassName}`}>{title}</h3>
              {description ? <p className={`mt-1 text-sm leading-6 ${descriptionClassName}`}>{description}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${closeButtonClassName}`}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <div className={`border-t px-5 py-4 sm:px-6 ${dividerClassName}`}>{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReferenceImageLibraryModal({
  open,
  onClose,
  fieldLabel,
  folderKey,
  images,
  selectedImageURL,
  loading,
  uploading,
  onUploadNew,
  onPreviewImage,
  onSelectImage,
}) {
  if (!open) return null;

  return (
    <OverlayDialog
      onClose={onClose}
      eyebrow="Reference Image"
      title="Image Library"
      description="Upload a new reference image or reuse one already saved in this checklist folder."
      maxWidthClass="max-w-6xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-outline">{images.length} saved images available in this folder.</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
          >
            Done
          </button>
        </div>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Folder</span>
          <span className="rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface">{folderKey || "Unassigned"}</span>
        </div>

        {!loading && images.length === 0 ? (
          <div className="rounded-3xl border border-outline-variant/20 bg-surface-container/50 px-4 py-4 text-sm leading-6 text-outline">
            No saved images were found in this checklist folder yet. Start by uploading a new one.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={onUploadNew}
            disabled={uploading}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/35 bg-primary/5 px-5 text-center transition hover:border-primary/60 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-primary ${uploading ? "animate-spin" : ""}`} style={{ fontSize: 30 }}>
              {uploading ? "progress_activity" : "add_photo_alternate"}
            </span>
            <div>
              <p className="text-sm font-black text-primary">{uploading ? "Uploading..." : "Upload new image"}</p>
              <p className="mt-1 text-xs leading-5 text-primary/80">This will be added to the same checklist folder for reuse later.</p>
            </div>
          </button>

          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`image-loading-${index}`} className="overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface">
                <div className="aspect-[4/3] animate-pulse bg-surface-container" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-container" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-surface-container" />
                </div>
              </div>
            ))
          ) : null}

          {!loading && images.map((image) => {
            const isSelected = image.imageURL === selectedImageURL;

            return (
              <div
                key={image.storagePath || image.imageURL}
                className={`overflow-hidden rounded-3xl border bg-surface transition ${
                  isSelected
                    ? "border-primary shadow-[0_0_0_2px_rgba(67,97,238,0.14)]"
                    : "border-outline-variant/20"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onPreviewImage(image)}
                  className="group relative block aspect-[4/3] w-full overflow-hidden bg-surface-container"
                >
                  <img
                    src={image.imageURL}
                    alt={image.name || fieldLabel || "Reference image"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">
                    {isSelected ? "Current" : "Saved"}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 px-3 py-3 text-left text-xs font-bold text-white">
                    Preview image
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-on-surface">{image.name || fieldLabel || "Saved image"}</p>
                    <p className="mt-1 text-[11px] leading-5 text-outline">
                      {isSelected ? "Currently selected for this check." : "Preview it first or assign it directly."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectImage(image.imageURL)}
                    className={`rounded-2xl px-3 py-2 text-xs font-bold transition ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-primary text-on-primary hover:opacity-90"
                    }`}
                  >
                    {isSelected ? "Selected" : "Use image"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </OverlayDialog>
  );
}

function ReferenceImagePreviewModal({ image, selectedImageURL, onClose, onSelectImage, onEditOverlay, editingOverlay }) {
  if (!image?.imageURL) return null;

  const normalizedImageURL = normalizeImageURL(image.imageURL);
  const isSelected = normalizedImageURL === selectedImageURL;

  return (
    <OverlayDialog
      onClose={onClose}
      eyebrow="Preview"
      title={image.name || "Reference image"}
      description="Inspect the image at full size before assigning it to the checklist field."
      maxWidthClass="max-w-5xl"
      zIndexClass="z-[100]"
      overlayClassName="bg-black/75 backdrop-blur-sm"
      panelClassName="border border-white/10 bg-slate-950/95 text-white"
      dividerClassName="border-white/10"
      titleClassName="text-white"
      descriptionClassName="text-white/65"
      closeButtonClassName="bg-white/10 text-white hover:bg-white/15"
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onEditOverlay?.(image)}
            disabled={!onEditOverlay || editingOverlay}
            className={`rounded-2xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition ${
              !onEditOverlay || editingOverlay ? "opacity-50" : "hover:bg-white/10"
            }`}
          >
            {editingOverlay ? "Preparing editor..." : "Edit overlay"}
          </button>
          <a
            href={normalizedImageURL}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
          >
            Open in new tab
          </a>
          <button
            type="button"
            onClick={() => {
              onSelectImage(normalizedImageURL);
              onClose();
            }}
            disabled={isSelected}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition ${
              isSelected
                ? "bg-white/10 text-white/60"
                : "bg-primary text-on-primary hover:opacity-90"
            }`}
          >
            {isSelected ? "Already selected" : "Use this image"}
          </button>
        </div>
      )}
    >
      <div className="flex min-h-[50vh] items-center justify-center bg-black/25 p-4 sm:p-6">
        <img src={normalizedImageURL} alt={image.name || "Reference image"} className="max-h-[72vh] max-w-full rounded-[24px] object-contain shadow-2xl" />
      </div>
    </OverlayDialog>
  );
}

function FieldEditor({ field, onChange, username }) {
  const [preparingEditor, setPreparingEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [editorSession, setEditorSession] = useState(null);
  const [availableImages, setAvailableImages] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const fileInputRef = useRef(null);
  const imageFolderKey = buildFieldImageFolderKey(field);
  const selectedImageURL = normalizeImageURL(field.imageURL);

  async function loadImageLibrary(folderKey = imageFolderKey) {
    if (!folderKey) {
      setAvailableImages([]);
      return;
    }

    setLoadingLibrary(true);
    setLibraryError("");

    try {
      const result = await fetchCheckFormReferenceImages(folderKey);
      setAvailableImages(normalizeReferenceLibraryImages(result?.images));
    } catch (error) {
      const raw = error?.message || "";
      setAvailableImages([]);
      setLibraryError(raw.startsWith("<") ? "Unable to load saved images - check server is running." : raw || "Unable to load saved images.");
    } finally {
      setLoadingLibrary(false);
    }
  }

  async function handleLibraryToggle() {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }

    setPickerOpen(true);
    setUploadError("");
    await loadImageLibrary();
  }

  function handleOpenPreview(image) {
    const imageURL = normalizeImageURL(image?.imageURL);
    if (!imageURL) return;

    setPreviewImage({
      imageURL,
      storagePath: image?.storagePath || "",
      name: image?.name || field.label || "Reference image",
    });
  }

  async function openEditorForNewUpload(file) {
    if (!file) return;

    setPreparingEditor(true);
    setUploadError("");

    try {
      const dataURL = await toBase64(file);
      setPickerOpen(false);
      setPreviewImage(null);
      setEditorSession({
        mode: "new",
        dataURL,
        name: file.name || field.label || "Reference image",
      });
    } catch (error) {
      const raw = error?.message || "";
      setUploadError(raw.startsWith("<") ? "Unable to open the editor - check server is running." : raw || "Unable to open the editor.");
    } finally {
      setPreparingEditor(false);
    }
  }

  async function openEditorForExistingImage(image) {
    const imageURL = normalizeImageURL(image?.imageURL);
    if (!imageURL) return;

    setPreparingEditor(true);
    setUploadError("");

    try {
      const result = await fetchCheckFormReferenceImageSource(imageURL);
      setPickerOpen(false);
      setPreviewImage(null);
      setEditorSession({
        mode: "edit",
        dataURL: result?.dataURL,
        name: result?.fileName || image?.name || field.label || "Reference image",
      });
    } catch (error) {
      const raw = error?.message || "";
      setUploadError(raw.startsWith("<") ? "Unable to load the image into the editor - check server is running." : raw || "Unable to open the editor.");
    } finally {
      setPreparingEditor(false);
    }
  }

  function handleSelectImage(imageURL) {
    onChange({ imageURL: normalizeImageURL(imageURL), imageFolderKey });
    setUploadError("");
    setLibraryError("");
    setPreviewImage(null);
    setPickerOpen(false);
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";
    await openEditorForNewUpload(file);
  }

  async function handleOverlaySave(flattenedBase64) {
    setUploading(true);
    setUploadError("");
    setLibraryError("");

    try {
      const result = await uploadCheckFormReferenceImage({
        base64: flattenedBase64,
        folderKey: imageFolderKey,
        username,
      });
      const nextImageURL = normalizeImageURL(result?.imageURL);

      onChange({ imageURL: nextImageURL, imageFolderKey: result?.folderKey || imageFolderKey });
      setAvailableImages((current) => normalizeReferenceLibraryImages([
        {
          imageURL: nextImageURL,
          name: result?.fileName || "Latest upload",
          storagePath: result?.storagePath || "",
        },
        ...current,
      ]));
      setEditorSession(null);
      setPickerOpen(false);
      setPreviewImage(null);
    } catch (error) {
      const raw = error?.message || "";
      const message = raw.startsWith("<") ? "Upload failed - check server is running." : raw || "Upload failed.";
      setUploadError(message);
      throw new Error(message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Title</label>
          <input
            type="text"
            placeholder="Describe this check..."
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange({ type: type.value })}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-bold transition ${
                  field.type === type.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-outline-variant/30 bg-surface text-outline hover:border-primary/30 hover:text-primary"
                }`}
              >
                {renderFieldTypeGlyph(type, 16)}
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Instruction</label>
        <textarea
          rows={3}
          placeholder="What should be checked and how should operators interpret it?"
          value={field.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-outline">Rules</p>
          <ToggleRow
            checked={field.required}
            onToggle={() => onChange({ required: !field.required })}
            label="Required"
            description="Operators must answer this field before they can submit the form."
          />
          <ToggleRow
            checked={field.photoRequired}
            onToggle={() => onChange({ photoRequired: !field.photoRequired })}
            label="Photo Required"
            description="Ask the operator to attach an image when this check is completed."
          />
        </div>

        <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-outline">Reference Image</p>
              <p className="mt-1 text-xs leading-5 text-outline">Choose a saved image for this checklist or upload a new one into its folder.</p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLibraryToggle}
              disabled={uploading || preparingEditor}
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading || loadingLibrary || preparingEditor ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 15 }}>progress_activity</span>
                  {uploading ? "Uploading..." : preparingEditor ? "Preparing editor..." : "Loading images..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>photo_library</span>
                  {field.imageURL ? "Replace image" : "Choose image"}
                </>
              )}
            </button>

            {selectedImageURL ? (
              <button
                type="button"
                onClick={() => handleOpenPreview({ imageURL: selectedImageURL, name: field.label || "Reference image" })}
                className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_full</span>
                Preview image
              </button>
            ) : null}
          </div>

          {uploadError ? <p className="mt-2 text-xs text-error">{uploadError}</p> : null}
          {libraryError ? <p className="mt-2 text-xs text-error">{libraryError}</p> : null}

          {selectedImageURL ? (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container">
              <img src={selectedImageURL} alt="reference" className="h-40 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 via-black/15 to-transparent px-3 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/80">Current image</p>
                  <p className="mt-1 text-xs font-semibold text-white">Open a preview to inspect details.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPreview({ imageURL: selectedImageURL, name: field.label || "Reference image" })}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_full</span>
                  Preview
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange({ imageURL: "", imageFolderKey })}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-error text-white"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {field.type === "number" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Min</label>
            <input
              type="number"
              value={field.min ?? ""}
              onChange={(event) => onChange({ min: event.target.value === "" ? null : Number(event.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Max</label>
            <input
              type="number"
              value={field.max ?? ""}
              onChange={(event) => onChange({ max: event.target.value === "" ? null : Number(event.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.15em] text-outline">Unit</label>
            <input
              type="text"
              placeholder="e.g. °C"
              value={field.unit ?? ""}
              onChange={(event) => onChange({ unit: event.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      ) : null}

      {field.type === "select" ? (
        <SelectOptionsEditor options={field.options ?? []} onChange={(options) => onChange({ options })} />
      ) : null}
      </div>

      <ReferenceImageLibraryModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        fieldLabel={field.label}
        folderKey={imageFolderKey}
        images={availableImages}
        selectedImageURL={selectedImageURL}
        loading={loadingLibrary}
        uploading={uploading || preparingEditor}
        onUploadNew={() => fileInputRef.current?.click()}
        onPreviewImage={handleOpenPreview}
        onSelectImage={handleSelectImage}
      />

      <ReferenceImagePreviewModal
        image={previewImage}
        selectedImageURL={selectedImageURL}
        onClose={() => setPreviewImage(null)}
        onSelectImage={handleSelectImage}
        onEditOverlay={openEditorForExistingImage}
        editingOverlay={preparingEditor}
      />

      <CheckFormImageOverlayEditorModal
        open={Boolean(editorSession)}
        sourceImage={editorSession}
        mode={editorSession?.mode || "new"}
        onClose={() => setEditorSession(null)}
        onSave={handleOverlaySave}
      />
    </>
  );
}

function SelectOptionsEditor({ options, onChange }) {
  const [newOption, setNewOption] = useState("");

  function addOption() {
    const value = newOption.trim();
    if (!value || options.includes(value)) return;
    onChange([...options, value]);
    setNewOption("");
  }

  function removeOption(value) {
    onChange(options.filter((option) => option !== value));
  }

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-outline">Options</p>
          <p className="mt-1 text-xs leading-5 text-outline">Add the choices operators can select for this field.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <span key={option} className="flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface">
            {option}
            <button type="button" onClick={() => removeOption(option)} className="text-outline transition hover:text-error">
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="Add option..."
          value={newOption}
          onChange={(event) => setNewOption(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOption();
            }
          }}
          className="flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
        <button type="button" onClick={addOption} className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:opacity-90">
          Add
        </button>
      </div>
    </div>
  );
}