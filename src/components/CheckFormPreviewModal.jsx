import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchWorkerNames, createWorkerRecord } from "../services/api";

const TYPE_ICONS = {
  name:     "person",
  checkbox: "check_box",
  text:     "short_text",
  number:   "pin",
  select:   "list",
  slider:   "linear_scale",
  photo:    "photo_camera",
};

const STATUS_STYLES = {
  active:   "bg-primary/10 text-primary",
  draft:    "bg-outline/10 text-outline",
  archived: "bg-surface-container text-outline",
};

function NameFieldPreview({ field, workerNames, onNewName }) {
  const [value, setValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleBlur() {
    const trimmed = value.trim();
    if (trimmed && !workerNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      createWorkerRecord(trimmed).catch(() => {});
      onNewName(trimmed);
    }
  }

  const query = value.toLowerCase();
  const filtered = query
    ? workerNames.filter((n) => n.toLowerCase().includes(query))
    : workerNames;

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="material-symbols-outlined flex-shrink-0 text-primary" style={{ fontSize: 18 }}>person</span>
        <div className="flex-1">
          <span className="text-sm font-semibold text-on-surface">{field.label}</span>
          <span className="ml-1.5 text-xs text-error">*</span>
        </div>
      </div>
      <div ref={containerRef} className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={handleBlur}
          placeholder="名前を選択または入力…"
          autoComplete="off"
          className="w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
        {showDropdown && filtered.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface shadow-lg">
            {filtered.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setValue(name); setShowDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-on-surface transition hover:bg-surface-container"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FieldPreview({ field, workerNames, onNewName }) {
  const [value, setValue] = useState(field.type === "checkbox" ? false : "");

  if (field.type === "name") {
    return <NameFieldPreview field={field} workerNames={workerNames} onNewName={onNewName} />;
  }

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="material-symbols-outlined flex-shrink-0 text-primary" style={{ fontSize: 18 }}>
          {TYPE_ICONS[field.type] ?? "help"}
        </span>
        <div className="flex-1">
          <span className="text-sm font-semibold text-on-surface">{field.label || <span className="italic text-outline">Untitled field</span>}</span>
          {field.required && <span className="ml-1.5 text-xs text-error">*</span>}
          {field.unit && <span className="ml-2 text-xs text-outline">({field.unit})</span>}
        </div>
      </div>

      {field.type === "checkbox" && (
        <button
          type="button"
          role="checkbox"
          aria-checked={value}
          onClick={() => setValue((v) => !v)}
          className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition ${
            value ? "border-primary bg-primary text-on-primary" : "border-outline/40 bg-surface"
          }`}
        >
          {value && <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>check</span>}
        </button>
      )}

      {field.type === "text" && (
        <input
          type="text"
          placeholder="Enter text…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40"
        />
      )}

      {field.type === "number" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="—"
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-32 rounded-xl border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40"
          />
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
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {field.type === "photo" && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-outline-variant/30 bg-surface px-4 py-3 text-xs text-outline">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
          Photo capture (tablet only)
        </div>
      )}
    </div>
  );
}

export default function CheckFormPreviewModal({ form, onClose }) {
  const [workerNames, setWorkerNames] = useState([]);

  useEffect(() => {
    fetchWorkerNames().then(setWorkerNames).catch(() => {});
  }, []);

  function handleNewName(name) {
    setWorkerNames((prev) =>
      [...new Set([...prev, name])].sort((a, b) => a.localeCompare(b, "ja"))
    );
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-outline-variant/20 bg-surface shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-outline-variant/20 px-6 py-5">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-on-surface truncate">{form.name}</h2>
              <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}>
                {form.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-outline">
              {form.工場 && <span>{form.工場}</span>}
              {form.schedule && <span className="capitalize">{form.schedule}</span>}
              {form.description && <span className="text-on-surface-variant">{form.description}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-outline hover:bg-primary/5 hover:text-primary transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3">
          {(!form.fields || form.fields.length === 0) && (
            <p className="text-sm text-outline py-6 text-center">This form has no fields.</p>
          )}
          {(form.fields ?? []).map((field) => (
            <FieldPreview
              key={field.id}
              field={field}
              workerNames={workerNames}
              onNewName={handleNewName}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-outline-variant/20 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-2xl border border-outline-variant/20 bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface transition hover:bg-surface-container-high">
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
