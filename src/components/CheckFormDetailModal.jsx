import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import { fetchNodaUserFullName } from "../services/nodaApi";
import { useLanguage } from "../contexts/LanguageContext";

const STATUS_STYLES = {
  active: "bg-primary/10 text-primary",
  draft: "bg-outline/10 text-outline",
  archived: "bg-surface-container text-outline",
};

const FIELD_TYPE_META = {
  name: { label: "Name", label_ja: "名前", icon: "person" },
  toggle: { label: "Toggle Buttons", label_ja: "トグル判定", icon: "task_alt" },
  text: { label: "Text", label_ja: "テキスト", icon: "short_text" },
  number: { label: "Number", label_ja: "数値", icon: "pin" },
  select: { label: "Select", label_ja: "選択", icon: "list" },
  slider: { label: "Slider", label_ja: "スライダー", icon: "linear_scale" },
  photo: { label: "Photo", label_ja: "写真", icon: "photo_camera" },
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

function formatDateTime(value, language = "en") {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(language === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value, language = "en") {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(language === "ja" ? "ja-JP" : "en-US", {
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
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">{label}</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function ActivityItem({ icon, label, value }) {
  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">{label}</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function FieldRow({ field, order, onPreviewImage, language }) {
  const isJa = language === "ja";
  const typeMeta = FIELD_TYPE_META[field.type] ?? { label: field.type || "Field", label_ja: field.type || "項目", icon: "help" };
  const hasRange = field.type === "number" && (field.min != null || field.max != null);
  const orderLabel = order + 1;

  const fieldLabel = isJa
    ? (field.label_ja || field.label || field.label_en || "無題の項目")
    : (field.label_en || field.label || field.label_ja || "Untitled field");

  const fieldDescription = isJa
    ? (field.description_ja || field.description || field.description_en)
    : (field.description_en || field.description || field.description_ja);

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text-primary)]">
            {orderLabel}
          </span>
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]">
            {renderFieldTypeGlyph(typeMeta, 16)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{fieldLabel}</p>
            </div>
            {fieldDescription ? (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)] whitespace-pre-line">{fieldDescription}</p>
            ) : null}
          </div>
        </div>

        <div className="grid w-[8.5rem] flex-shrink-0 grid-cols-[3rem_minmax(0,1fr)] items-center justify-items-end gap-2 self-start">
          {field.imageURL ? (
            <button
              type="button"
              onClick={() => onPreviewImage({
                eyebrow: isJa ? "参考画像" : "Reference Image",
                displayName: fieldLabel,
                images: [{ url: field.imageURL, label: fieldLabel }],
                activeIndex: 0,
              })}
              className="flex h-10 w-10 overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] transition hover:border-[var(--freya-blue)] hover:shadow-sm"
              aria-label={`Preview reference image for ${fieldLabel}`}
            >
              <img src={field.imageURL} alt={fieldLabel} className="h-full w-full object-cover" />
            </button>
          ) : (
            <span className="h-10 w-10" aria-hidden="true" />
          )}

          <span className="inline-flex rounded-[6px] bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--freya-blue)]">
            {isJa ? (typeMeta.label_ja || typeMeta.label) : typeMeta.label}
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        {field.type !== "name" ? (
          <span className={`rounded-[6px] px-2 py-0.5 ${
            field.timing === "post"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}>
            {field.timing === "post" ? (isJa ? "作業後点検" : "Post-Production") : (isJa ? "作業前点検" : "Pre-Production")}
          </span>
        ) : null}
        {field.required ? (
          <span className="rounded-[6px] bg-[var(--status-danger)]/10 px-2 py-0.5 text-[var(--status-danger)]">
            {isJa ? "必須" : "Required"}
          </span>
        ) : null}
        {field.photoRequired ? (
          <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[var(--text-secondary)]">
            {isJa ? "写真必須" : "Photo required"}
          </span>
        ) : null}
        {field.unit ? (
          <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[var(--text-secondary)]">
            {isJa ? `単位: ${field.unit}` : `Unit: ${field.unit}`}
          </span>
        ) : null}
        {hasRange ? (
          <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[var(--text-secondary)]">
            {isJa ? `範囲: ${field.min != null ? field.min : "—"} - ${field.max != null ? field.max : "—"}` : `Range: ${field.min != null ? field.min : "—"} - ${field.max != null ? field.max : "—"}`}
          </span>
        ) : null}
        {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 ? (
          <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[var(--text-secondary)]">
            {isJa ? `${field.options.length} 個の選択肢` : `${field.options.length} options`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function CheckFormDetailModal({
  form,
  scheduleMeta,
  machineNames = [],
  onClose,
  onEdit,
  onClone,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [createdByName, setCreatedByName] = useState(form.createdBy || (isJa ? "不明なユーザー" : "Unknown user"));
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
      setCreatedByName(form.createdBy || (isJa ? "不明なユーザー" : "Unknown user"));
      setUpdatedByName(form.updatedBy || "");
    });

    return () => {
      cancelled = true;
    };
  }, [form.createdBy, form.updatedBy, isJa]);

  const hasEdits = Boolean(form.updatedAt || form.updatedBy);

  const formName = isJa
    ? (form.name_ja || form.name || form.name_en)
    : (form.name_en || form.name || form.name_ja);

  const formDescription = isJa
    ? (form.description_ja || form.description || form.description_en)
    : (form.description_en || form.description || form.description_ja);

  const statusLabel = isJa
    ? (form.status === "active" ? "アクティブ" : form.status === "draft" ? "下書き" : form.status === "archived" ? "アーカイブ" : form.status)
    : (form.status || "draft");

  const timing = form.timing || "pre";
  const timingLabel = isJa
    ? (timing === "post" ? "作業後点検" : "作業前点検")
    : (timing === "post" ? "Post-Production" : "Pre-Production");

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--freya-blue)]">
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{scheduleMeta?.icon || "event_busy"}</span>
                {scheduleMeta?.label || form.schedule || (isJa ? "未スケジュール" : "Unscheduled")}
              </span>
              <span className={`inline-flex rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[form.status] ?? STATUS_STYLES.draft}`}>
                {statusLabel}
              </span>
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{formName}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--text-muted)] whitespace-pre-line">
              {formDescription || (isJa ? "この点検フォームの説明はまだ追加されていません。" : "No description has been added for this checklist form yet.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid gap-2.5 md:grid-cols-3">
            <SummaryCard icon="factory" label={isJa ? "工場" : "Factory"} value={form.工場 || (isJa ? "未設定" : "Unassigned")} />
            <SummaryCard icon="event" label={isJa ? "開始日" : "Start Date"} value={formatDate(form.startDate, language)} />
            <SummaryCard icon="list" label={isJa ? "点検項目数" : "Fields"} value={isJa ? `${form.fields?.length ?? 0} 項目` : `${form.fields?.length ?? 0} checks`} />
          </div>

          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "対象設備" : "Applies To"}</p>
            <div className="mt-2">
              <p className="text-xs font-semibold text-[var(--text-primary)]">{isJa ? "設備一覧" : "Machines"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {machineNames.length > 0 ? (
                  machineNames.map((machineName) => (
                    <span
                      key={machineName}
                      className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 14 }}>precision_manufacturing</span>
                      {machineName}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>precision_manufacturing</span>
                    {isJa ? "設備が割り当てられていません" : "No machines assigned"}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "アクティビティ" : "Activity"}</p>
            <div className="mt-2 grid gap-2.5 md:grid-cols-2">
              <ActivityItem icon="person" label={isJa ? "作成者" : "Created By"} value={createdByName || form.createdBy || (isJa ? "不明なユーザー" : "Unknown user")} />
              <ActivityItem icon="schedule" label={isJa ? "作成日時" : "Created At"} value={formatDateTime(form.createdAt, language)} />
              <ActivityItem icon="edit" label={isJa ? "最終編集者" : "Last Edited By"} value={hasEdits ? (updatedByName || form.updatedBy || (isJa ? "不明なユーザー" : "Unknown user")) : (isJa ? "未編集" : "Not edited yet")} />
              <ActivityItem icon="history" label={isJa ? "最終編集日時" : "Last Edited At"} value={hasEdits ? formatDateTime(form.updatedAt, language) : (isJa ? "未編集" : "Not edited yet")} />
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "点検項目" : "Checks"}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {isJa ? "編集前にこのフォームに含まれる項目を確認してください。" : "Review the fields included in this form before editing."}
                </p>
              </div>
              <p className="text-xs font-semibold text-[var(--freya-blue)]">
                {isJa ? `合計 ${form.fields?.length ?? 0} 項目` : `${form.fields?.length ?? 0} checks total`}
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {(form.fields ?? []).map((field, index) => (
                <FieldRow
                  key={field.id || field.label}
                  field={field}
                  order={index}
                  onPreviewImage={setPreviewImage}
                  language={language}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            {isJa ? "このフォームを編集・複製して、適用設備、周期、メタデータ、または点検項目を更新します。" : "Edit or clone this form to update machine scope, cadence, metadata, or checklist fields."}
          </p>
          <div className="flex items-center gap-2">
            {onClone && (
              <button
                type="button"
                onClick={() => onClone(form)}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>copy_all</span>
                {isJa ? "複製" : "Clone"}
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
              {isJa ? "フォームを編集" : "Edit Form"}
            </button>
          </div>
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