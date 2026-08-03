import { useEffect, useMemo, useState } from "react";
import IconButton from "./IconButton";
import MasterProductPickerModal from "./MasterProductPickerModal";
import FieldOptionPickerModal from "./FieldOptionPickerModal";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function deepClone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function getPathValue(target, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, segment) => (current != null ? current[segment] : undefined), target);
}

function setPathValue(target, path, value) {
  const segments = String(path || "").split(".").filter(Boolean);
  if (!segments.length) return;

  let current = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];

    if (Array.isArray(current)) {
      const arrayIndex = Number(segment);
      if (!Number.isInteger(arrayIndex)) return;
      if (current[arrayIndex] == null) {
        current[arrayIndex] = /^\d+$/.test(nextSegment) ? [] : {};
      }
      current = current[arrayIndex];
      continue;
    }

    if (!isPlainObject(current[segment]) && !Array.isArray(current[segment])) {
      current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    current = current[segment];
  }

  const lastSegment = segments[segments.length - 1];
  if (Array.isArray(current)) {
    const arrayIndex = Number(lastSegment);
    if (!Number.isInteger(arrayIndex)) return;
    current[arrayIndex] = value;
    return;
  }

  current[lastSegment] = value;
}

function removeArrayItem(target, path, index) {
  const items = getPathValue(target, path);
  if (!Array.isArray(items)) return;
  items.splice(index, 1);
}

function addArrayItem(target, path, template) {
  const items = getPathValue(target, path);
  if (!Array.isArray(items)) return;
  items.push(template);
}

function buildDefaultArrayTemplate(items, path) {
  if (path === "Maintenance_Data.records") {
    return {
      id: Date.now(),
      startTime: "",
      endTime: "",
      comment: "",
      timestamp: new Date().toISOString(),
      photos: [],
    };
  }
  if (String(path || "").endsWith("photos")) {
    return "";
  }

  const sample = items.find((item) => item != null);
  if (Array.isArray(sample)) return [];
  if (isPlainObject(sample)) {
    const template = deepClone(sample);
    Object.keys(template).forEach((key) => {
      if (typeof template[key] === "string") template[key] = "";
      else if (typeof template[key] === "number") template[key] = 0;
      else if (typeof template[key] === "boolean") template[key] = false;
      else if (Array.isArray(template[key])) template[key] = [];
      else if (isPlainObject(template[key])) template[key] = {};
    });
    return template;
  }
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}

function isImageLikePath(path) {
  return /(image|画像|photo)/i.test(String(path || ""));
}

function isImageUrl(value) {
  return typeof value === "string" && /^(https?:\/\/|data:image\/)/i.test(value.trim());
}

function inferFieldKind(path, value) {
  const leafKey = String(path || "").split(".").pop() || "";
  if (typeof value === "boolean") return "boolean";
  if (leafKey === "Date" || /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "date";
  if (["Time_start", "Time_end", "start", "end", "startTime", "endTime"].includes(leafKey) || /^\d{1,2}:\d{2}$/.test(String(value || ""))) return "time";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "string" && value.length > 120) return "textarea";
  return "text";
}

function coerceValue(kind, rawValue) {
  if (kind === "integer") {
    if (rawValue === "") return 0;
    const normalized = String(rawValue).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
    const parsed = Number.parseInt(normalized.replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (kind === "number") {
    if (rawValue === "") return 0;
    const parsed = Number.parseFloat(String(rawValue).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (kind === "boolean") {
    return Boolean(rawValue);
  }

  return rawValue;
}

function formatDisplayValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function buildDefaultSections(record, hiddenFieldSet) {
  const scalarItems = [];
  const structuredItems = [];

  Object.keys(record || {})
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey, "ja"))
    .forEach((key) => {
      if (hiddenFieldSet.has(key)) return;
      const value = record[key];
      if (Array.isArray(value) || isPlainObject(value)) {
        structuredItems.push({ kind: "structured", path: key, label: key, span: "full" });
      } else {
        scalarItems.push({ kind: "field", path: key, label: key });
      }
    });

  return [
    { key: "fields", title: "Fields", icon: "list_alt", items: scalarItems },
    { key: "structured", title: "Structured Data", icon: "dataset", items: structuredItems },
  ].filter((section) => section.items.length);
}

export default function RecordEditModal({
  open,
  title,
  subtitle,
  record,
  busy = false,
  onClose,
  onSave,
  onSoftDelete,
  canSoftDelete = false,
  saveLabel = "Save Changes",
  softDeleteLabel = "Soft Delete",
  noteLabel = "Edit Note",
  notePlaceholder = "Enter the reason for this change...",
  buildSections,
  resolveFieldKind,
  computeDraft,
  schemaContext,
  hiddenFields,
  linkedProductPaths,
  loadLinkedProductOptions,
  loadFieldPickerOptions,
}) {
  const hiddenFieldSet = useMemo(() => {
    if (hiddenFields instanceof Set) return hiddenFields;
    return new Set(Array.isArray(hiddenFields) ? hiddenFields : []);
  }, [hiddenFields]);

  const [draft, setDraft] = useState(null);
  const [note, setNote] = useState("");
  const [pickerState, setPickerState] = useState({ open: false, focusField: "品番", initialQuery: "" });
  const [fieldPickerState, setFieldPickerState] = useState({
    open: false,
    path: "",
    label: "",
    title: "",
    initialQuery: "",
  });
  const [revealedKeys, setRevealedKeys] = useState(() => new Set());

  useEffect(() => {
    if (!open || !record) {
      setDraft(null);
      setNote("");
      setRevealedKeys(new Set());
      return;
    }

    const nextDraft = deepClone(record);
    setDraft(typeof computeDraft === "function" ? computeDraft(nextDraft, schemaContext) : nextDraft);
    setNote("");
  }, [computeDraft, open, record, schemaContext]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (pickerState.open || fieldPickerState.open) return;
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [fieldPickerState.open, onClose, open, pickerState.open]);

  const sections = useMemo(() => {
    if (!draft) return [];
    if (typeof buildSections === "function") {
      return buildSections(draft, schemaContext) || [];
    }

    return buildDefaultSections(draft, hiddenFieldSet);
  }, [buildSections, draft, hiddenFieldSet, schemaContext]);

  if (!open || !draft) return null;

  function isHiddenPath(path) {
    const leafKey = String(path || "").split(".").pop() || "";
    if (leafKey === "id" || leafKey === "timestamp") return true;
    const rootKey = String(path || "").split(".")[0] || "";
    return hiddenFieldSet.has(path) || hiddenFieldSet.has(rootKey);
  }

  function applyDraftMutation(mutator) {
    setDraft((currentDraft) => {
      const nextDraft = deepClone(currentDraft);
      mutator(nextDraft);
      return typeof computeDraft === "function" ? computeDraft(nextDraft, schemaContext) : nextDraft;
    });
  }

  function handleFieldChange(path, value, kind) {
    applyDraftMutation((nextDraft) => {
      setPathValue(nextDraft, path, coerceValue(kind, value));
    });
  }

  function handleArrayAdd(path) {
    applyDraftMutation((nextDraft) => {
      const items = getPathValue(nextDraft, path);
      if (!Array.isArray(items)) return;
      addArrayItem(nextDraft, path, buildDefaultArrayTemplate(items, path));
    });
  }

  function handleArrayRemove(path, index) {
    applyDraftMutation((nextDraft) => {
      removeArrayItem(nextDraft, path, index);
    });
  }

  function openLinkedPicker(focusField) {
    const linkedPath = focusField === "背番号"
      ? linkedProductPaths?.serialNumberPath
      : linkedProductPaths?.partNumberPath;
    const currentQuery = linkedPath ? formatDisplayValue(getPathValue(draft, linkedPath)).replace(/^—$/, "") : "";

    setPickerState({
      open: true,
      focusField,
      initialQuery: currentQuery,
    });
  }

  function handleLinkedProductSelect(selection) {
    applyDraftMutation((nextDraft) => {
      if (linkedProductPaths?.partNumberPath) {
        setPathValue(nextDraft, linkedProductPaths.partNumberPath, selection?.品番 || "");
      }

      if (linkedProductPaths?.serialNumberPath) {
        setPathValue(nextDraft, linkedProductPaths.serialNumberPath, selection?.背番号 || "");
      }
    });

    setPickerState({ open: false, focusField: "品番", initialQuery: "" });
  }

  function openFieldPicker(item) {
    const currentValue = formatDisplayValue(getPathValue(draft, item.path)).replace(/^—$/, "");

    setFieldPickerState({
      open: true,
      path: item.path,
      label: item.label,
      title: item.pickerTitle || item.label,
      initialQuery: "",
    });
  }

  function handleFieldPickerSelect(nextValue) {
    applyDraftMutation((nextDraft) => {
      setPathValue(nextDraft, fieldPickerState.path, nextValue);
    });

    setFieldPickerState({ open: false, path: "", label: "", title: "", initialQuery: "" });
  }

  function renderPrimitiveField(path, label, value, options = {}) {
    const kind = options.inputKind
      || (typeof resolveFieldKind === "function" ? resolveFieldKind(path, value, schemaContext) : inferFieldKind(path, value));
    const imagePreview = isImageLikePath(path) && isImageUrl(value);

    if (kind === "auto") {
      return (
        <div>
          {options.hideLabel ? null : <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{label}</div>}
          <div className="planner-data-text rounded-2xl border border-primary/15 bg-primary/8 px-3 py-2.5 font-medium text-primary">
            {formatDisplayValue(value)}
          </div>
        </div>
      );
    }

    if (kind === "boolean") {
      return (
        <label className="planner-data-text flex items-center gap-3 rounded-2xl border border-separator/40 bg-white px-3 py-3 font-medium text-on-surface dark:bg-surface-container">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => handleFieldChange(path, event.target.checked, kind)}
            className="h-4 w-4 rounded border-outline-variant/40"
          />
          <span>{label}</span>
        </label>
      );
    }

    const inputClassName = "planner-data-text w-full rounded-2xl border border-separator/40 bg-white px-3 py-2.5 text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container";

    return (
      <div>
        {options.hideLabel ? null : <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{label}</div>}
        {imagePreview ? (
          <div className="mb-2 overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low">
            <img src={value} alt={label} className="h-32 w-full object-contain bg-black/5" />
          </div>
        ) : null}

        {kind === "textarea" ? (
          <textarea
            rows={3}
            value={value ?? ""}
            onChange={(event) => handleFieldChange(path, event.target.value, kind)}
            className={inputClassName}
          />
        ) : (
          <input
            type={kind === "date" ? "date" : kind === "time" ? "time" : kind === "number" || kind === "integer" ? "number" : "text"}
            step={kind === "number" ? "0.01" : kind === "integer" ? "1" : undefined}
            min={kind === "number" || kind === "integer" ? "0" : undefined}
            value={kind === "number" || kind === "integer" ? (value ?? 0) : (value ?? "")}
            onChange={(event) => handleFieldChange(path, event.target.value, kind)}
            className={inputClassName}
          />
        )}
      </div>
    );
  }

  function renderStructuredNode(path, value, depth = 0) {
    if (Array.isArray(value)) {
      const isMaintenanceRecords = path === "Maintenance_Data.records";
      return (
        <div className="space-y-3">
          {value.length ? value.map((item, index) => {
            const itemPath = `${path}.${index}`;
            const structured = Array.isArray(item) || isPlainObject(item);

            return (
              <div key={itemPath} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                {isMaintenanceRecords ? (
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">MAINTENANCE {index + 1}</div>
                    <button
                      type="button"
                      onClick={() => handleArrayRemove(path, index)}
                      className="text-error transition-opacity hover:opacity-80 flex items-center justify-center"
                      title="Remove Row"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ) : (
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Item {index + 1}</div>
                    <button
                      type="button"
                      onClick={() => handleArrayRemove(path, index)}
                      disabled={busy}
                      className="rounded-2xl border border-error/20 bg-error/10 px-3 py-1.5 text-[11px] font-semibold text-error transition hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {structured
                  ? renderStructuredNode(itemPath, item, depth + 1)
                  : renderPrimitiveField(itemPath, `Item ${index + 1}`, item, { hideLabel: true })}
              </div>
            );
          }) : (
            <div className="planner-data-text rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-4 text-on-surface-variant">
              No items have been added yet.
            </div>
          )}

          {isMaintenanceRecords ? (
            <div className="flex justify-center mt-1">
              <button
                type="button"
                onClick={() => handleArrayAdd(path)}
                disabled={busy}
                className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
              >
                + Add Another Maintenance Row
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleArrayAdd(path)}
              disabled={busy}
              className="rounded-2xl border border-separator/40 bg-white px-4 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-container"
            >
              Add Item
            </button>
          )}
        </div>
      );
    }

    if (isPlainObject(value)) {
      let entries = Object.entries(value).filter(([childKey]) => !isHiddenPath(`${path}.${childKey}`));

      const isIncrementalGroup = path === "Break_Time_Data";
      const hiddenKeys = [];

      if (isIncrementalGroup) {
        entries.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
        const visibleEntries = [];
        const hasData = (v) => Object.values(v).some((val) => val !== "" && val !== null && val !== undefined);
        
        entries.forEach(([k, v], i) => {
          if (i === 0 || hasData(v) || revealedKeys.has(`${path}.${k}`)) {
            visibleEntries.push([k, v]);
          } else {
            hiddenKeys.push(k);
          }
        });
        entries = visibleEntries;
      }

      if (!entries.length) {
        return (
          <div className="planner-data-text rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-4 text-on-surface-variant">
            No editable fields are available in this group.
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {entries.map(([childKey, childValue]) => {
              const childPath = `${path}.${childKey}`;
              const structured = Array.isArray(childValue) || isPlainObject(childValue);

              return (
                <div key={childPath} className={structured ? "md:col-span-2" : ""}>
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                    {structured ? (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{childKey}</div>
                          {isIncrementalGroup && (
                            <button
                              type="button"
                              onClick={() => {
                                applyDraftMutation((nextDraft) => {
                                  Object.keys(childValue).forEach((k) => {
                                    setPathValue(nextDraft, `${childPath}.${k}`, "");
                                  });
                                });
                                setRevealedKeys((prev) => {
                                  const next = new Set(prev);
                                  next.delete(childPath);
                                  return next;
                                });
                              }}
                              className="text-error transition-opacity hover:opacity-80 flex items-center justify-center"
                              title="Clear & Remove Row"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          )}
                        </div>
                        {renderStructuredNode(childPath, childValue, depth + 1)}
                      </>
                    ) : renderPrimitiveField(childPath, childKey, childValue)}
                  </div>
                </div>
              );
            })}
          </div>
          {isIncrementalGroup && hiddenKeys.length > 0 && (
            <div className="flex justify-center mt-1">
              <button
                type="button"
                onClick={() => setRevealedKeys((prev) => new Set(prev).add(`${path}.${hiddenKeys[0]}`))}
                className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
              >
                + Add Another {path === "Break_Time_Data" ? "Break Time" : "Maintenance"} Row
              </button>
            </div>
          )}
        </div>
      );
    }

    return renderPrimitiveField(path, path.split(".").pop() || path, value, { hideLabel: true });
  }

  function renderSectionItem(item) {
    if (item.kind === "linkedPair") {
      const partNumberValue = getPathValue(draft, item.partNumberPath);
      const serialNumberValue = getPathValue(draft, item.serialNumberPath);

      return (
        <div key={`${item.partNumberPath}-${item.serialNumberPath}`} className={joinClasses("grid gap-3 md:grid-cols-2", item.span === "full" ? "md:col-span-2" : "")}>
          {[
            { label: item.partNumberLabel, value: partNumberValue, focusField: "品番" },
            { label: item.serialNumberLabel, value: serialNumberValue, focusField: "背番号" },
          ].map((field) => (
            <div key={field.focusField} className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{field.label}</div>
              <div className="flex items-center gap-2">
                <div className="planner-data-text min-h-[42px] flex-1 rounded-2xl border border-separator/40 bg-white px-3 py-2.5 font-medium text-on-surface dark:bg-surface-container">
                  {formatDisplayValue(field.value)}
                </div>
                <button
                  type="button"
                  onClick={() => openLinkedPicker(field.focusField)}
                  disabled={busy || !linkedProductPaths || typeof loadLinkedProductOptions !== "function"}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (item.kind === "pickerField") {
      const value = getPathValue(draft, item.path);
      return (
        <div key={item.path} className={item.span === "full" ? "md:col-span-2" : ""}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{item.label}</div>
          <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
            <div className="planner-data-text min-h-[42px] flex-1 rounded-2xl border border-separator/40 bg-white px-3 py-2.5 font-medium text-on-surface dark:bg-surface-container">
              {formatDisplayValue(value)}
            </div>
            <button
              type="button"
              onClick={() => openFieldPicker(item)}
              disabled={busy || typeof loadFieldPickerOptions !== "function"}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Change
            </button>
          </div>
        </div>
      );
    }

    if (item.kind === "structured") {
      const value = getPathValue(draft, item.path);
      return (
        <div key={item.path} className={item.span === "full" ? "md:col-span-2" : ""}>
          <div className="mb-3 mt-1 text-sm font-bold text-on-surface tracking-wide">{item.label}</div>
          {renderStructuredNode(item.path, value)}
        </div>
      );
    }

    const value = getPathValue(draft, item.path);
    return (
      <div key={item.path} className={item.span === "full" ? "md:col-span-2" : ""}>
        {renderPrimitiveField(item.path, item.label, value, { inputKind: item.inputKind })}
      </div>
    );
  }

  return (
    <>
      <div 
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" 
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <div 
          className="flex min-h-full items-center justify-center p-4 lg:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <div
            className="dashboard-section flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-separator/40 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Edit Record</div>
                  <h2 className="mt-1 text-xl font-semibold text-on-surface">{title}</h2>
                  {subtitle ? <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p> : null}
                </div>

                <IconButton
                  icon="close"
                  onClick={() => onClose?.()}
                  variant="outlined"
                  ariaLabel="Close dialog"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                {sections.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-outline-variant/15 bg-white/80 px-4 py-4 dark:bg-surface-container">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>{section.icon || "edit_square"}</span>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Section</div>
                        <h3 className="text-base font-semibold text-on-surface">{section.title}</h3>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {section.items.map((item) => renderSectionItem(item))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-outline-variant/20 bg-surface-container-low/50 px-6 py-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-end">
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{noteLabel}</div>
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={notePlaceholder}
                    className="planner-data-text h-11 w-full rounded-2xl border border-separator/40 bg-white px-4 text-on-surface outline-none transition focus:border-primary/40 dark:bg-surface-container"
                  />
                </div>

                {canSoftDelete && typeof onSoftDelete === "function" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSoftDelete?.({ draft, note })}
                    className="rounded-2xl border border-error/20 bg-error/10 px-4 py-2.5 text-xs font-semibold text-error transition hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {softDeleteLabel}
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onClose?.()}
                  className="rounded-2xl border border-separator/40 bg-white px-4 py-2.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-container"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSave?.({ draft, note })}
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MasterProductPickerModal
        open={pickerState.open}
        focusField={pickerState.focusField}
        initialQuery={pickerState.initialQuery}
        busy={busy}
        loadOptions={loadLinkedProductOptions}
        onClose={() => setPickerState({ open: false, focusField: "品番", initialQuery: "" })}
        onSelect={handleLinkedProductSelect}
      />

      <FieldOptionPickerModal
        open={fieldPickerState.open}
        title={fieldPickerState.title}
        helperText={fieldPickerState.label ? `${fieldPickerState.label}を選択します` : ""}
        initialQuery={fieldPickerState.initialQuery}
        currentValue={formatDisplayValue(getPathValue(draft, fieldPickerState.path)).replace(/^—$/, "")}
        loadOptions={() => loadFieldPickerOptions?.(fieldPickerState.path, draft, schemaContext)}
        onClose={() => setFieldPickerState({ open: false, path: "", label: "", title: "", initialQuery: "" })}
        onSelect={handleFieldPickerSelect}
      />
    </>
  );
}