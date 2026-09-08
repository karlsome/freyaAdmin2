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
  translateTextApi,
} from "../services/api";
import FilePreviewModal from "./FilePreviewModal";
import CheckFormImageOverlayEditorModal from "./CheckFormImageOverlayEditorModal";
import { getAuthUser } from "../utils/masterDB";
import { useLanguage } from "../contexts/LanguageContext";

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
  { value: "toggle", label: "Toggle Buttons", label_ja: "トグル判定", icon: "task_alt" },
  { value: "text", label: "Text", label_ja: "テキスト", icon: "short_text" },
  { value: "number", label: "Number", label_ja: "数値", icon: "pin" },
  { value: "select", label: "Select", label_ja: "選択肢", icon: "list" },
];

const FIELD_TYPE_META = Object.fromEntries(FIELD_TYPES.map((type) => [type.value, type]));

const SCHEDULE_OPTIONS = [
  { value: "daily", label: "Daily", label_ja: "日次", hint: "Every day", hint_ja: "毎日", icon: "today" },
  { value: "weekly", label: "Weekly", label_ja: "週次", hint: "Every Monday", hint_ja: "毎週月曜日", icon: "date_range" },
  { value: "monthly", label: "Monthly", label_ja: "月次", hint: "1st day of month", hint_ja: "毎月1日", icon: "calendar_month" },
];

const TIMING_OPTIONS = [
  { value: "pre", label: "Pre-Production", label_ja: "製造前", hint: "Before starting production", hint_ja: "製造開始前", icon: "play_circle" },
  { value: "post", label: "Post-Production", label_ja: "製造後", hint: "After completing production", hint_ja: "製造完了後", icon: "task" },
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
    timing: "pre",
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
    timing: field.timing || "pre",
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
    schedule: presetSchedule || "daily",
    timing: "pre",
    startDate: "",
    fields: [NAME_FIELD],
    status: "draft",
  };
}

async function buildParallelTranslations(draftPayload) {
  const cloned = JSON.parse(JSON.stringify(draftPayload));
  const tasks = [];

  const nameText = (cloned.name || "").trim();
  const descText = (cloned.description || "").trim();

  if (nameText) {
    tasks.push((async () => {
      try {
        const ja = await translateTextApi(nameText, "en|ja");
        const en = await translateTextApi(nameText, "ja|en");
        cloned.name_ja = ja || nameText;
        cloned.name_en = en || nameText;
      } catch {
        cloned.name_ja = nameText;
        cloned.name_en = nameText;
      }
    })());
  }

  if (descText) {
    tasks.push((async () => {
      try {
        const ja = await translateTextApi(descText, "en|ja");
        const en = await translateTextApi(descText, "ja|en");
        cloned.description_ja = ja || descText;
        cloned.description_en = en || descText;
      } catch {
        cloned.description_ja = descText;
        cloned.description_en = descText;
      }
    })());
  }

  if (Array.isArray(cloned.fields)) {
    cloned.fields.forEach((field) => {
      const lbl = (field.label || "").trim();
      const desc = (field.description || "").trim();

      if (lbl) {
        tasks.push((async () => {
          try {
            const ja = await translateTextApi(lbl, "en|ja");
            const en = await translateTextApi(lbl, "ja|en");
            field.label_ja = ja || lbl;
            field.label_en = en || lbl;
          } catch {
            field.label_ja = lbl;
            field.label_en = lbl;
          }
        })());
      }
      if (desc) {
        tasks.push((async () => {
          try {
            const ja = await translateTextApi(desc, "en|ja");
            const en = await translateTextApi(desc, "ja|en");
            field.description_ja = ja || desc;
            field.description_en = en || desc;
          } catch {
            field.description_ja = desc;
            field.description_en = desc;
          }
        })());
      }
    });
  }

  await Promise.allSettled(tasks);
  return cloned;
}

function getFieldTypeMeta(type) {
  return FIELD_TYPE_META[type] ?? { label: type || "Field", icon: "list" };
}

function renderFieldTypeGlyph(typeMeta, size = 16) {
  if (typeMeta.value === "toggle") {
    return (
      <span className="inline-flex min-w-[1.9rem] items-center justify-center rounded-full border border-current/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.08em]">
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
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]";

function getBuilderViewportSize() {
  if (typeof window === "undefined") {
    return { width: 1280, height: 900 };
  }

  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
}

function ToggleRow({ checked, onToggle, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3.5 py-2.5">
      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--freya-blue)] ${
          checked ? "bg-[var(--freya-blue)] shadow-xs" : "bg-[var(--surface-subtle)] border border-[var(--border)]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}


export default function CheckFormBuilderModal({
  initial,
  isClone = false,
  onClose,
  onSaved,
  presetSchedule = "",
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [viewportSize, setViewportSize] = useState(() => getBuilderViewportSize());
  const [draft, setDraft] = useState(() => {
    if (initial) {
      if (isClone) {
        const clonedFields = (initial.fields ?? []).map((f) => {
          if (f.locked || f.type === "name") return { ...f };
          const newId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return { ...f, id: newId };
        });
        return {
          name: initial.name ? `${initial.name} (Copy)` : "New Checklist Form (Copy)",
          name_ja: initial.name_ja ? `${initial.name_ja} (コピー)` : (initial.name ? `${initial.name} (コピー)` : ""),
          name_en: initial.name_en ? `${initial.name_en} (Copy)` : (initial.name ? `${initial.name} (Copy)` : ""),
          description: initial.description ?? "",
          description_ja: initial.description_ja ?? "",
          description_en: initial.description_en ?? "",
          工場: initial.工場 ?? "",
          equipmentIds: (initial.equipmentIds ?? (initial.equipmentId ? [initial.equipmentId] : [])).map(normalizeId),
          schedule: initial.schedule ?? presetSchedule ?? "daily",
          startDate: initial.startDate ?? new Date().toISOString().slice(0, 10),
          fields: ensureNameField(clonedFields),
          status: "draft",
        };
      }
      return {
        name: initial.name,
        name_ja: initial.name_ja ?? "",
        name_en: initial.name_en ?? "",
        description: initial.description ?? "",
        description_ja: initial.description_ja ?? "",
        description_en: initial.description_en ?? "",
        工場: initial.工場 ?? "",
        equipmentIds: (initial.equipmentIds ?? (initial.equipmentId ? [initial.equipmentId] : [])).map(normalizeId),
        schedule: initial.schedule ?? "",
        startDate: initial.startDate ?? "",
        fields: ensureNameField(initial.fields ?? []),
        status: initial.status ?? "draft",
      };
    }
    return emptyDraft(presetSchedule);
  });
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
  const initialId = isClone ? "" : normalizeId(initial?._id);
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
  const allFilteredSelected =
    filteredEquipment.length > 0 &&
    filteredEquipment.every((equipment) => selectedMachineIds.includes(normalizeId(equipment._id)));
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

  function duplicateField(id) {
    const fieldIndex = draft.fields.findIndex((f) => f.id === id);
    if (fieldIndex === -1) return;
    const target = draft.fields[fieldIndex];
    const newId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned = {
      ...target,
      id: newId,
      label: target.label ? `${target.label} (Copy)` : "Copied check",
      label_ja: target.label_ja ? `${target.label_ja} (コピー)` : (target.label ? `${target.label} (コピー)` : ""),
      label_en: target.label_en ? `${target.label_en} (Copy)` : (target.label ? `${target.label} (Copy)` : ""),
      locked: false,
    };
    const nextFields = [...draft.fields];
    nextFields.splice(fieldIndex + 1, 0, cloned);
    setDraft((current) => ({ ...current, fields: nextFields }));
    setExpandedFieldId(newId);
  }

  function removeField(id) {
    const nextFields = draft.fields.filter((field) => field.id !== id);
    setDraft((current) => ({ ...current, fields: nextFields }));
    if (expandedFieldId === id) {
      setExpandedFieldId(nextFields.find((field) => !field.locked)?.id ?? nextFields[0]?.id ?? null);
    }
  }

  function moveField(id, delta) {
    const index = draft.fields.findIndex((field) => field.id === id);
    if (index === -1) return;

    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= draft.fields.length) return;

    const nextFields = [...draft.fields];
    const [moved] = nextFields.splice(index, 1);
    nextFields.splice(targetIndex, 0, moved);
    setDraft((current) => ({ ...current, fields: nextFields }));
  }

  function updateField(id, patch) {
    setDraft((current) => {
      const nextFields = current.fields.map((field) => {
        if (field.id !== id) return field;
        const merged = { ...field, ...patch };
        if (patch.type && patch.type !== field.type) {
          if (patch.type === "number") {
            merged.min = 0;
            merged.max = 100;
            merged.unit = "";
          } else {
            delete merged.min;
            delete merged.max;
            delete merged.unit;
          }
          if (patch.type === "select") {
            merged.options = field.options?.length ? field.options : ["Option 1", "Option 2"];
          } else {
            delete merged.options;
          }
        }
        return merged;
      });
      return { ...current, fields: nextFields };
    });
  }

  async function save(deployStatus) {
    if (!draft.name.trim()) {
      setError(isJa ? "フォーム名は必須です。" : "Form name is required.");
      return;
    }
    if (nameConflict) {
      setError(isJa ? "保存する前に固有のフォーム名を選択してください。" : "Please choose a unique form name before saving.");
      return;
    }

    setBusy(true);
    setError(null);

    const authUser = getAuthUser();
    const activeUsername = authUser?.username || "unknown";
    const basePayload = { ...draft, fields: ensureNameField(draft.fields ?? []), status: deployStatus };

    try {
      const payload = await buildParallelTranslations(basePayload);
      const isExistingEdit = Boolean(initial?._id && !isClone);
      if (isExistingEdit) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-4">
      <div
        className="relative flex min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
        style={{ height: `${modalHeight}px`, maxHeight: `${modalHeight}px` }}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--freya-blue)]">
              {isClone ? (isJa ? "テンプレートを複製" : "Clone Template") : initial ? (isJa ? "フォームを編集" : "Edit Form") : (isJa ? "新規フォーム" : "New Form")}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--text-primary)]">
              {isClone ? (isJa ? "点検フォームを複製" : "Clone Checklist Form") : (isJa ? "点検フォームビルダー" : "Checklist Form Builder")}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-muted)]">
              {isClone
                ? (isJa ? "コピーした項目や対象範囲を確認・カスタマイズし、新しい点検フォームとして適用します。" : "Review and customize the copied checks and scope, then deploy as a new checklist form.")
                : (isJa ? "基本設定を行い、各点検項目をインラインで調整してわかりやすいフォームを作成します。" : "Keep the setup simple, then shape each check inline so the form reads clearly before you save it.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isJa ? "閉じる" : "Close"}
            className="p-1 rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-4">
          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "フォーム設定" : "Form Setup"}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{isJa ? "点検項目を編集する前に、フォーム名、説明、工場、頻度、開始日を設定します。" : "Define the name, description, factory, cadence, and activation date before editing the checks."}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "フォーム名" : "Form Name"}</label>
                <input
                  type="text"
                  placeholder={isJa ? "フォーム名 *" : "Form name *"}
                  value={draft.name}
                  onChange={(event) => setTop("name", event.target.value)}
                  className={`${inputClass} ${nameConflict ? "border-error/50 focus:border-error/60" : ""}`}
                />
                {nameConflict ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                    {isJa ? "このフォーム名は既に使用されています。" : "This form name is already in use."}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "工場" : "Factory"}</label>
                <select value={draft.工場} onChange={(event) => setTop("工場", event.target.value)} className={inputClass}>
                  <option value="">{isJa ? "工場を選択" : "Select a factory"}</option>
                  {factories.map((factory) => (
                    <option key={factory._id ?? factory.工場} value={factory.工場}>{factory.工場}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "説明" : "Description"}</label>
                <textarea
                  rows={3}
                  placeholder={isJa ? "管理者や作業者にこの点検フォームの用途を伝えます。" : "Tell admins and operators what this checklist form is for."}
                  value={draft.description}
                  onChange={(event) => setTop("description", event.target.value)}
                  className={`${inputClass} resize-y`}
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "頻度" : "Frequency"}</label>
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
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em]">{isJa ? (option.label_ja || option.label) : option.label}</span>
                        <span className={`mt-1 block text-[11px] ${isActive ? "text-primary/80" : "text-outline"}`}>{isJa ? (option.hint_ja || option.hint) : option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "開始日" : "First Active Date"}</label>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setTop("startDate", event.target.value)}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-outline">
                  {selectedScheduleOption
                    ? (isJa
                        ? `${selectedScheduleOption.label_ja || selectedScheduleOption.label}フォームは${(selectedScheduleOption.hint_ja || selectedScheduleOption.hint)}繰り返されます。`
                        : `${selectedScheduleOption.label} forms repeat ${selectedScheduleOption.hint.toLowerCase()}.`)
                    : (isJa ? "作業者がいつこのフォームを実施すべきか分かるよう、頻度を選択してください。" : "Choose a cadence so operators know when this form should appear.")}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-separator/40 bg-surface-container/40 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "対象設備" : "Machine Scope"}</p>
                <p className="mt-1 text-sm text-outline">{isJa ? "このフォームを適用する設備を選択します。必要に応じて先に工場を切り替えてください。" : "Select the machines this form applies to. Switch factories first if needed."}</p>
              </div>
              {filteredEquipment.length > 0 ? (
                <button
                  type="button"
                  onClick={toggleAllMachines}
                  className="inline-flex items-center gap-2 rounded-full border border-separator/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{allFilteredSelected ? "remove_done" : "done_all"}</span>
                  {allFilteredSelected ? (isJa ? "すべて解除" : "Clear all") : (isJa ? "すべて選択" : "Select all")}
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!draft.工場 ? (
                <span className="rounded-full border border-dashed border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-semibold text-outline">
                  {isJa ? "先に工場を選択してください" : "Select a factory first"}
                </span>
              ) : null}

              {draft.工場 && filteredEquipment.length === 0 ? (
                <span className="rounded-full border border-dashed border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-semibold text-outline">
                  {isJa ? "設備が見つかりません" : "No machines found"}
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

          <section className="rounded-2xl border border-separator/40 bg-surface-container/40 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "点検項目" : "Checks"}</p>
                <p className="mt-1 text-sm text-outline">{isJa ? "各カードで点検項目の詳細を設定します。左側の番号で順序を確認できます。" : "Each field card contains the full setup for that check. Use the number on the left to track checklist order."}</p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {isJa ? `合計 ${draft.fields.length} 項目` : `${draft.fields.length} checks total`}
              </span>
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
                  onDuplicate={() => duplicateField(field.id)}
                  onDelete={() => removeField(field.id)}
                  canMoveUp={index > 0}
                  canMoveDown={index < draft.fields.length - 1}
                  username={username}
                />
              ))}

              <button
                type="button"
                onClick={() => addField()}
                className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--freya-blue)]/50 hover:bg-[var(--surface-hover)] hover:text-[var(--freya-blue)]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                </span>
                {isJa ? "点検項目を追加" : "Add checklist item"}
              </button>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center">
            {error ? <p className="text-xs text-[var(--status-danger)]">{error}</p> : null}
            {initial && !isClone && !error && !confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="w-fit rounded-[6px] border border-[var(--status-danger)]/30 px-3 py-1.5 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/10 disabled:opacity-50"
              >
                {isJa ? "フォームを削除" : "Delete Form"}
              </button>
            ) : null}
            {initial && !isClone && confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[var(--status-danger)]">{isJa ? "このフォームを削除しますか？" : "Delete this form?"}</p>
                <button
                  type="button"
                  onClick={deleteForm}
                  disabled={busy}
                  className="rounded-[6px] bg-[var(--status-danger)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isJa ? "はい、削除します" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  {isJa ? "キャンセル" : "Cancel"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
            >
              {isJa ? "キャンセル" : "Cancel"}
            </button>
            <button
              type="button"
              disabled={busy || nameConflict}
              onClick={() => save("draft")}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {busy ? (isJa ? "保存中..." : "Saving...") : (isJa ? "下書き保存" : "Save Draft")}
            </button>
            <button
              type="button"
              disabled={busy || nameConflict}
              onClick={() => save("active")}
              className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors disabled:opacity-50 shadow-xs"
            >
              {busy ? (isJa ? "保存中..." : "Saving...") : isClone ? (isJa ? "複製して適用" : "Clone & Deploy") : initial ? (isJa ? "変更を保存" : "Save Changes") : (isJa ? "適用" : "Deploy")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const toast = showSuccess ? (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-on-surface px-5 py-3 shadow-2xl">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary">
          <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>check</span>
        </span>
        <span className="text-sm font-semibold text-surface">{isJa ? "フォームを作成しました" : "Form created successfully"}</span>
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
  onDuplicate,
  onDelete,
  canMoveUp,
  canMoveDown,
  username,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
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
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${expanded ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"}`}>
                  {index + 1}
                </span>
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${expanded ? "bg-primary text-on-primary" : "bg-surface-container text-primary"}`}>
                  {renderFieldTypeGlyph(typeMeta, 18)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {field.label || (field.locked ? "名前" : (isJa ? `無題の${typeMeta.label_ja || typeMeta.label}項目` : `Untitled ${typeMeta.label.toLowerCase()} check`))}
                    </p>
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {isJa ? (typeMeta.label_ja || typeMeta.label) : typeMeta.label}
                    </span>
                    {field.locked ? (
                      <span className="inline-flex rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-outline">
                        {isJa ? "固定" : "Locked"}
                      </span>
                    ) : null}
                    {field.required ? (
                      <span className="inline-flex rounded-full bg-error/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-error">
                        {isJa ? "必須" : "Required"}
                      </span>
                    ) : null}
                    {field.photoRequired ? (
                      <span className="inline-flex rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface">
                        {isJa ? "写真" : "Photo"}
                      </span>
                    ) : null}
                    {!field.locked ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        field.timing === "post"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      }`}>
                        {field.timing === "post" ? (isJa ? "製造後" : "Post-Prod") : (isJa ? "製造前" : "Pre-Prod")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-outline">
                    {field.description || (field.locked ? (isJa ? "すべてのフォームに作業者名項目が含まれます。" : "Every form includes the operator name field.") : (isJa ? "作業者が確認すべき内容を指示として入力します。" : "Add a short instruction so operators know exactly what to check."))}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                    {field.unit ? <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">{isJa ? `単位: ${field.unit}` : `Unit: ${field.unit}`}</span> : null}
                    {hasRange ? (
                      <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">
                        {isJa ? `範囲: ${field.min != null ? field.min : "-"} ～ ${field.max != null ? field.max : "-"}` : `Range: ${field.min != null ? field.min : "-"} - ${field.max != null ? field.max : "-"}`}
                      </span>
                    ) : null}
                    {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 ? (
                      <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">{isJa ? `${field.options.length} 個の選択肢` : `${field.options.length} options`}</span>
                    ) : null}
                    {field.imageURL ? <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">{isJa ? "参考画像" : "Reference image"}</span> : null}
                  </div>
                </div>
              </button>

              {fieldImageURL ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setThumbnailPreviewImage({ imageURL: fieldImageURL, name: field.label || (isJa ? "参考画像" : "Reference image") });
                  }}
                  className="mt-0.5 flex h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-separator/40 bg-surface-container transition hover:border-primary/35 hover:shadow-[0_8px_20px_rgba(67,97,238,0.14)]"
                  aria-label={isJa ? `${field.label || "点検項目"}の参考画像をプレビュー` : `Preview reference image for ${field.label || "checklist field"}`}
                >
                  <img src={fieldImageURL} alt={field.label || (isJa ? "参考画像" : "Reference image")} className="h-full w-full object-cover" />
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
                    title={isJa ? "上に移動" : "Move up"}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-primary disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_upward</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canMoveDown}
                    onClick={onMoveDown}
                    title={isJa ? "下に移動" : "Move down"}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-primary disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_downward</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDuplicate}
                    title={isJa ? "項目を複製" : "Duplicate step"}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-primary/10 hover:text-primary"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    title={isJa ? "項目を削除" : "Delete step"}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-outline transition hover:bg-error/10 hover:text-error"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onToggle}
                className="inline-flex items-center gap-1 rounded-full border border-separator/40 bg-surface px-3 py-1.5 text-[11px] font-semibold text-on-surface transition hover:bg-surface-container"
              >
                {expanded ? (isJa ? "閉じる" : "Collapse") : (isJa ? "編集" : "Edit")}
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{expanded ? "expand_less" : "expand_more"}</span>
              </button>
            </div>
          </div>
        </div>

        {expanded ? (
          <div className="border-t border-outline-variant/20 px-4 py-4">
            {field.locked ? (
              <div className="rounded-2xl border border-separator/40 bg-surface px-4 py-4">
                <p className="text-sm font-semibold text-on-surface">{isJa ? "この項目は固定されています" : "This field is fixed"}</p>
                <p className="mt-1 text-sm leading-6 text-outline">
                  {isJa ? "作業者名項目はすべての点検フォームに自動的に追加され、削除や編集はできません。" : "The operator name field is added automatically to every checklist form and cannot be removed or edited."}
                </p>
              </div>
            ) : (
              <FieldEditor field={field} onChange={onChange} username={username} />
            )}
          </div>
        ) : null}
      </div>

      <FilePreviewModal url={thumbnailPreviewImage?.imageURL} name={thumbnailPreviewImage?.name} onClose={() => setThumbnailPreviewImage(null)} />
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
  overlayClassName = "bg-black/50 backdrop-blur-md",
  panelClassName = "border border-separator/40 bg-surface text-on-surface",
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
              {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
              <h3 className={`mt-1 text-lg font-semibold ${titleClassName}`}>{title}</h3>
              {description ? <p className={`mt-1 text-sm leading-6 ${descriptionClassName}`}>{description}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
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
  const { language } = useLanguage();
  const isJa = language === "ja";

  if (!open) return null;

  return (
    <OverlayDialog
      onClose={onClose}
      eyebrow={isJa ? "参考画像" : "Reference Image"}
      title={isJa ? "画像ライブラリ" : "Image Library"}
      description={isJa ? "新しい参考画像をアップロードするか、この点検フォルダーに保存されている画像を選択します。" : "Upload a new reference image or reuse one already saved in this checklist folder."}
      maxWidthClass="max-w-6xl"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-outline">{isJa ? `このフォルダーに保存されている画像: ${images.length} 件` : `${images.length} saved images available in this folder.`}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
          >
            {isJa ? "完了" : "Done"}
          </button>
        </div>
      )}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{isJa ? "フォルダー" : "Folder"}</span>
          <span className="rounded-full border border-separator/40 bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface">{folderKey || (isJa ? "未割り当て" : "Unassigned")}</span>
        </div>

        {!loading && images.length === 0 ? (
          <div className="rounded-3xl border border-separator/40 bg-surface-container/50 px-4 py-4 text-sm leading-6 text-outline">
            {isJa ? "この点検フォルダーには保存された画像がまだありません。新しくアップロードしてください。" : "No saved images were found in this checklist folder yet. Start by uploading a new one."}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={onUploadNew}
            disabled={uploading}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-primary/35 bg-primary/5 px-5 text-center transition hover:border-primary/60 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-primary ${uploading ? "animate-spin" : ""}`} style={{ fontSize: 28 }}>
              {uploading ? "progress_activity" : "add_photo_alternate"}
            </span>
            <div>
              <p className="text-sm font-semibold text-primary">{uploading ? (isJa ? "アップロード中..." : "Uploading...") : (isJa ? "新しい画像をアップロード" : "Upload new image")}</p>
              <p className="mt-1 text-xs leading-5 text-primary/80">{isJa ? "同じ点検フォルダーに追加され、後で再利用できます。" : "This will be added to the same checklist folder for reuse later."}</p>
            </div>
          </button>

          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`image-loading-${index}`} className="overflow-hidden rounded-3xl border border-separator/40 bg-surface">
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
                    alt={image.name || fieldLabel || (isJa ? "参考画像" : "Reference image")}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-900">
                    {isSelected ? (isJa ? "現在選択中" : "Current") : (isJa ? "保存済み" : "Saved")}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 px-3 py-3 text-left text-xs font-semibold text-white">
                    {isJa ? "画像をプレビュー" : "Preview image"}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-on-surface">{image.name || fieldLabel || (isJa ? "保存済み画像" : "Saved image")}</p>
                    <p className="mt-1 text-[11px] leading-5 text-outline">
                      {isSelected ? (isJa ? "この項目に現在設定されています。" : "Currently selected for this check.") : (isJa ? "プレビューで確認するか、直接指定します。" : "Preview it first or assign it directly.")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectImage(image.imageURL)}
                    className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-primary text-on-primary hover:opacity-90"
                    }`}
                  >
                    {isSelected ? (isJa ? "選択中" : "Selected") : (isJa ? "画像を使用" : "Use image")}
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
  const { language } = useLanguage();
  const isJa = language === "ja";

  if (!image?.imageURL) return null;

  const normalizedImageURL = normalizeImageURL(image.imageURL);
  const isSelected = normalizedImageURL === selectedImageURL;

  return (
    <OverlayDialog
      onClose={onClose}
      eyebrow={isJa ? "プレビュー" : "Preview"}
      title={image.name || (isJa ? "参考画像" : "Reference image")}
      description={isJa ? "点検項目に指定する前にフルサイズで画像を確認します。" : "Inspect the image at full size before assigning it to the checklist field."}
      maxWidthClass="max-w-5xl"
      zIndexClass="z-[100]"
      overlayClassName="bg-black/75 backdrop-blur-sm"
      panelClassName="border border-separator/40 bg-slate-950/95 text-white"
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
            className={`rounded-2xl border border-white/15 px-4 py-2 text-xs font-semibold text-white transition ${
              !onEditOverlay || editingOverlay ? "opacity-50" : "hover:bg-white/10"
            }`}
          >
            {editingOverlay ? (isJa ? "エディター準備中..." : "Preparing editor...") : (isJa ? "注釈を編集" : "Edit overlay")}
          </button>
          <a
            href={normalizedImageURL}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            {isJa ? "新しいタブで開く" : "Open in new tab"}
          </a>
          <button
            type="button"
            onClick={() => {
              onSelectImage(normalizedImageURL);
              onClose();
            }}
            disabled={isSelected}
            className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
              isSelected
                ? "bg-white/10 text-white/60"
                : "bg-primary text-on-primary hover:opacity-90"
            }`}
          >
            {isSelected ? (isJa ? "既に選択済み" : "Already selected") : (isJa ? "この画像を使用" : "Use this image")}
          </button>
        </div>
      )}
    >
      <div className="flex min-h-[50vh] items-center justify-center bg-black/25 p-4 sm:p-6">
        <img src={normalizedImageURL} alt={image.name || (isJa ? "参考画像" : "Reference image")} className="max-h-[72vh] max-w-full rounded-[24px] object-contain shadow-2xl" />
      </div>
    </OverlayDialog>
  );
}

function FieldEditor({ field, onChange, username }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
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
      setLibraryError(raw.startsWith("<") ? (isJa ? "保存済み画像を読み込めません。サーバーが稼働しているか確認してください。" : "Unable to load saved images - check server is running.") : raw || (isJa ? "保存済み画像を読み込めません。" : "Unable to load saved images."));
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
      name: image?.name || field.label || (isJa ? "参考画像" : "Reference image"),
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
        name: file.name || field.label || (isJa ? "参考画像" : "Reference image"),
      });
    } catch (error) {
      const raw = error?.message || "";
      setUploadError(raw.startsWith("<") ? (isJa ? "エディターを開けません。サーバーが稼働しているか確認してください。" : "Unable to open the editor - check server is running.") : raw || (isJa ? "エディターを開けません。" : "Unable to open the editor."));
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
        name: result?.fileName || image?.name || field.label || (isJa ? "参考画像" : "Reference image"),
      });
    } catch (error) {
      const raw = error?.message || "";
      setUploadError(raw.startsWith("<") ? (isJa ? "エディターに画像を読み込めません。サーバーが稼働しているか確認してください。" : "Unable to load the image into the editor - check server is running.") : raw || (isJa ? "エディターに画像を読み込めません。" : "Unable to open the editor."));
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
          name: result?.fileName || (isJa ? "最新のアップロード" : "Latest upload"),
          storagePath: result?.storagePath || "",
        },
        ...current,
      ]));
      setEditorSession(null);
      setPickerOpen(false);
      setPreviewImage(null);
    } catch (error) {
      const raw = error?.message || "";
      const message = raw.startsWith("<") ? (isJa ? "アップロードに失敗しました。サーバーが稼働しているか確認してください。" : "Upload failed - check server is running.") : raw || (isJa ? "アップロードに失敗しました。" : "Upload failed.");
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
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "タイトル" : "Title"}</label>
          <input
            type="text"
            placeholder={isJa ? "この点検項目を説明..." : "Describe this check..."}
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "種類" : "Type"}</label>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange({ type: type.value })}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-semibold transition ${
                  field.type === type.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-outline-variant/30 bg-surface text-outline hover:border-primary/30 hover:text-primary"
                }`}
              >
                {renderFieldTypeGlyph(type, 16)}
                {isJa ? (type.label_ja || type.label) : type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "指示・注意事項" : "Instruction"}</label>
        <textarea
          rows={3}
          placeholder={isJa ? "点検する内容と、作業者がどのように判断すべきかを記載します。" : "What should be checked and how should operators interpret it?"}
          value={field.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "ルール" : "Rules"}</p>
          <ToggleRow
            checked={field.required}
            onToggle={() => onChange({ required: !field.required })}
            label={isJa ? "必須" : "Required"}
            description={isJa ? "作業者がフォームを送信する前に、この項目への回答が必須になります。" : "Operators must answer this field before they can submit the form."}
          />
          <ToggleRow
            checked={field.photoRequired}
            onToggle={() => onChange({ photoRequired: !field.photoRequired })}
            label={isJa ? "写真必須" : "Photo Required"}
            description={isJa ? "この項目の点検時に作業者へ画像の添付を求めます。" : "Ask the operator to attach an image when this check is completed."}
          />

          <div className="pt-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "実施タイミング" : "Step Timing"}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ timing: "pre" })}
                className={`flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${
                  (field.timing || "pre") !== "post"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-outline-variant/30 bg-surface text-outline hover:border-primary/30 hover:text-primary"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_circle</span>
                {isJa ? "製造前" : "Pre-Production"}
              </button>
              <button
                type="button"
                onClick={() => onChange({ timing: "post" })}
                className={`flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${
                  field.timing === "post"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-outline-variant/30 bg-surface text-outline hover:border-amber-500/30 hover:text-amber-600"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>task</span>
                {isJa ? "製造後" : "Post-Production"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-separator/40 bg-surface px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "参考画像" : "Reference Image"}</p>
              <p className="mt-1 text-xs leading-5 text-outline">{isJa ? "この点検項目用に保存された画像を選択するか、フォルダーに新しい画像をアップロードします。" : "Choose a saved image for this checklist or upload a new one into its folder."}</p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLibraryToggle}
              disabled={uploading || preparingEditor}
              className="inline-flex items-center gap-2 rounded-2xl border border-separator/40 bg-surface-container px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading || loadingLibrary || preparingEditor ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                  {uploading ? (isJa ? "アップロード中..." : "Uploading...") : preparingEditor ? (isJa ? "エディター準備中..." : "Preparing editor...") : (isJa ? "画像を読み込み中..." : "Loading images...")}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_library</span>
                  {field.imageURL ? (isJa ? "画像を変更" : "Replace image") : (isJa ? "画像を選択" : "Choose image")}
                </>
              )}
            </button>

            {selectedImageURL ? (
              <button
                type="button"
                onClick={() => handleOpenPreview({ imageURL: selectedImageURL, name: field.label || (isJa ? "参考画像" : "Reference image") })}
                className="inline-flex items-center gap-2 rounded-2xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_full</span>
                {isJa ? "画像をプレビュー" : "Preview image"}
              </button>
            ) : null}
          </div>

          {uploadError ? <p className="mt-2 text-xs text-error">{uploadError}</p> : null}
          {libraryError ? <p className="mt-2 text-xs text-error">{libraryError}</p> : null}

          {selectedImageURL ? (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-separator/40 bg-surface-container">
              <img src={selectedImageURL} alt="reference" className="h-40 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 via-black/15 to-transparent px-3 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">{isJa ? "現在の画像" : "Current image"}</p>
                  <p className="mt-1 text-xs font-semibold text-white">{isJa ? "詳細を確認するにはプレビューを開きます。" : "Open a preview to inspect details."}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPreview({ imageURL: selectedImageURL, name: field.label || (isJa ? "参考画像" : "Reference image") })}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_full</span>
                  {isJa ? "プレビュー" : "Preview"}
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
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "最小値" : "Min"}</label>
            <input
              type="number"
              value={field.min ?? ""}
              onChange={(event) => onChange({ min: event.target.value === "" ? null : Number(event.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "最大値" : "Max"}</label>
            <input
              type="number"
              value={field.max ?? ""}
              onChange={(event) => onChange({ max: event.target.value === "" ? null : Number(event.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "単位" : "Unit"}</label>
            <input
              type="text"
              placeholder={isJa ? "例: °C" : "e.g. °C"}
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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
    <div className="rounded-2xl border border-separator/40 bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">{isJa ? "選択肢" : "Options"}</p>
          <p className="mt-1 text-xs leading-5 text-outline">{isJa ? "作業者がこの項目で選択できる選択肢を追加します。" : "Add the choices operators can select for this field."}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <span key={option} className="flex items-center gap-1 rounded-full border border-separator/40 bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface">
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
          placeholder={isJa ? "選択肢を追加..." : "Add option..."}
          value={newOption}
          onChange={(event) => setNewOption(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOption();
            }
          }}
          className="flex-1 rounded-2xl border border-separator/40 bg-surface-container px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
        <button type="button" onClick={addOption} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150">
          {isJa ? "追加" : "Add"}
        </button>
      </div>
    </div>
  );
}