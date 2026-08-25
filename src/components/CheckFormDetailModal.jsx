import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import { fetchNodaUserFullName } from "../services/nodaApi";

const STATUS_STYLES = {
  active: "bg-primary/10 text-primary",
  draft: "bg-outline/10 text-outline",
  archived: "bg-surface-container text-outline",
};

const FIELD_TYPE_META = {
  name: { label: "Name", icon: "person" },
  toggle: { label: "Toggle Buttons", icon: "task_alt" },
  text: { label: "Text", icon: "short_text" },
  number: { label: "Number", icon: "pin" },
  select: { label: "Select", icon: "list" },
  slider: { label: "Slider", icon: "linear_scale" },
  photo: { label: "Photo", icon: "photo_camera" },
};

const actorNameCache = new Map();

function renderFieldTypeGlyph(typeMeta, size = 16) {
  if (typeMeta.label === "Toggle Buttons") {
    return (
      <span className="inline-flex min-w-[1.9rem] items-center justify-center rounded-full border border-current/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.08em]">
        OK
      </span>
    );
  }

  return <span className="material-symbols-outlined" style={{ fontSize: size }}>{typeMeta.icon}</span>;
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function resolveActorName(username) {
  const normalizedUsername = String(username || "").trim();
  if (!normalizedUsername) return "Unknown user";
  if (actorNameCache.has(normalizedUsername)) return actorNameCache.get(normalizedUsername);

  const name = await fetchNodaUserFullName(normalizedUsername);
  actorNameCache.set(normalizedUsername, name || normalizedUsername);
  return actorNameCache.get(normalizedUsername);
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-separator/40 bg-surface px-4 py-3">
      <div className="flex items-center gap-2 text-outline">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function ActivityItem({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-separator/40 bg-surface px-4 py-3">
      <div className="flex items-center gap-2 text-outline">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function FieldRow({ field, order, onPreviewImage }) {
  const typeMeta = FIELD_TYPE_META[field.type] ?? { label: field.type || "Field", icon: "help" };
  const hasRange = field.type === "number" && (field.min != null || field.max != null);
  const orderLabel = order + 1;

  return (
    <div className="rounded-2xl border border-separator/40 bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-container text-sm font-semibold text-on-surface">
            {orderLabel}
          </span>
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {renderFieldTypeGlyph(typeMeta, 18)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-on-surface">{field.label || "Untitled field"}</p>
            </div>
            {field.description ? (
              <p className="mt-1 text-xs leading-5 text-outline">{field.description}</p>
            ) : null}
          </div>
        </div>

        <div className="grid w-[8.5rem] flex-shrink-0 grid-cols-[3rem_minmax(0,1fr)] items-center justify-items-end gap-2 self-start">
          {field.imageURL ? (
            <button
              type="button"
              onClick={() => onPreviewImage({
                eyebrow: "Reference Image",
                displayName: field.label || "Reference image",
                images: [{ url: field.imageURL, label: field.label || "Reference image" }],
                activeIndex: 0,
              })}
              className="flex h-12 w-12 overflow-hidden rounded-2xl border border-separator/40 bg-surface-container transition hover:border-primary/35 hover:shadow-[0_8px_20px_rgba(67,97,238,0.14)]"
              aria-label={`Preview reference image for ${field.label || "checklist field"}`}
            >
              <img src={field.imageURL} alt={field.label || "Reference image"} className="h-full w-full object-cover" />
            </button>
          ) : (
            <span className="h-12 w-12" aria-hidden="true" />
          )}

          <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {typeMeta.label}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
        {field.type !== "name" ? (
          <span className={`rounded-full px-2.5 py-1 ${
            field.timing === "post"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}>
            {field.timing === "post" ? "Post-Production" : "Pre-Production"}
          </span>
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
            Range: {field.min != null ? field.min : "—"} - {field.max != null ? field.max : "—"}
          </span>
        ) : null}
        {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 ? (
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface">{field.options.length} options</span>
        ) : null}
      </div>
    </div>
  );
}

export default function CheckFormDetailModal({ form, scheduleMeta, machineNames, onClose, onEdit }) {
  const [createdByName, setCreatedByName] = useState(form.createdBy || "Unknown user");
  const [updatedByName, setUpdatedByName] = useState(form.updatedBy || "");
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadActorNames() {
      const [createdName, updatedName] = await Promise.all([
        resolveActorName(form.createdBy),
        form.updatedBy ? resolveActorName(form.updatedBy) : Promise.resolve(""),
      ]);

      if (cancelled) return;
      setCreatedByName(createdName);
      setUpdatedByName(updatedName);
    }

    loadActorNames().catch(() => {
      if (cancelled) return;
      setCreatedByName(form.createdBy || "Unknown user");
      setUpdatedByName(form.updatedBy || "");
    });

    return () => {
      cancelled = true;
    };
  }, [form.createdBy, form.updatedBy]);

  const hasEdits = Boolean(form.updatedAt || form.updatedBy);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl dashboard-section">
        <div className="flex items-start justify-between border-b border-separator/40 px-6 py-5">
          <div className="min-w-0 flex-1 pr-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{scheduleMeta?.icon || "event_busy"}</span>
                {scheduleMeta?.label || form.schedule || "Unscheduled"}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border ${
                (form.timing || "pre") === "post"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                  : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
              }`}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                  {(form.timing || "pre") === "post" ? "task" : "play_circle"}
                </span>
                {(form.timing || "pre") === "post" ? "Post-Production" : "Pre-Production"}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}>
                {form.status}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-on-surface">{form.name}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-outline">
              {form.description || "No description has been added for this maintenance form yet."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl flex-shrink-0 text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard icon="factory" label="Factory" value={form.工場 || "Unassigned"} />
            <SummaryCard icon="event" label="Start Date" value={formatDate(form.startDate)} />
            <SummaryCard icon="list" label="Fields" value={`${form.fields?.length ?? 0} checks`} />
          </div>

          <section className="mt-5 rounded-2xl border border-separator/40 bg-surface-container/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Applies To</p>
            <div className="mt-3">
              <p className="text-sm font-semibold text-on-surface">Machines</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {machineNames.length > 0 ? (
                  machineNames.map((machineName) => (
                    <span
                      key={machineName}
                      className="inline-flex items-center gap-1 rounded-full border border-separator/40 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface"
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>precision_manufacturing</span>
                      {machineName}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-separator/40 bg-surface px-3 py-1.5 text-xs font-semibold text-outline">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>precision_manufacturing</span>
                    No machines assigned
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-separator/40 bg-surface-container/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Activity</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ActivityItem icon="person" label="Created By" value={createdByName || form.createdBy || "Unknown user"} />
              <ActivityItem icon="schedule" label="Created At" value={formatDateTime(form.createdAt)} />
              <ActivityItem icon="edit" label="Last Edited By" value={hasEdits ? (updatedByName || form.updatedBy || "Unknown user") : "Not edited yet"} />
              <ActivityItem icon="history" label="Last Edited At" value={hasEdits ? formatDateTime(form.updatedAt) : "Not edited yet"} />
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-separator/40 bg-surface-container/40 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Checks</p>
                <p className="mt-1 text-sm text-outline">Review the fields included in this form before editing.</p>
              </div>
              <p className="text-xs font-semibold text-primary">{form.fields?.length ?? 0} checks total</p>
            </div>
            <div className="mt-4 space-y-2">
              {(form.fields ?? []).map((field, index) => (
                <FieldRow key={field.id || field.label} field={field} order={index} onPreviewImage={setPreviewImage} />
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-separator/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-outline">Edit this form to update machine scope, cadence, metadata, or checklist fields.</p>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            Edit Form
          </button>
        </div>
      </div>

      <SensorDevicePhotoPreviewModal
        preview={previewImage}
        onClose={() => setPreviewImage(null)}
        onNavigate={() => {}}
      />
    </div>
  );

  return createPortal(modal, document.body);
}