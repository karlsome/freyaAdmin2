import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";
import {
  archiveEquipmentRecord,
  createMasterRecord,
  fetchAllEquipmentHistory,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  updateMasterRecord,
  softDeleteEquipmentHistory,
  uploadEquipmentEventImage,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";

const EVENT_CATEGORY_TAGS = ["メンテナンス", "修理", "部品交換", "テスト", "その他"];

function isVideoUrl(url) {
  return /\.(mp4|mov)$/i.test(url.split("?")[0]);
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}
import EquipmentHistoryBinWorkspace from "./EquipmentHistoryBinWorkspace";
import SetsubiRecordModal from "./SetsubiRecordModal";

// ── Shared sub-components ────────────────────────────────────────────────────

function SuccessModal({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Success</h3>
        </div>
        <div className="p-5">
          <p className="text-xs text-[var(--text-secondary)]">{message}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaLightbox({ url, onClose }) {
  if (!url) return null;
  const isVideo = isVideoUrl(url);
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xs"
      onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={url} controls autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-[12px] border border-[var(--border)] shadow-2xl" />
        ) : (
          <img src={url} alt="full size"
            className="max-h-[90vh] max-w-[90vw] rounded-[12px] border border-[var(--border)] object-contain shadow-2xl" />
        )}
        <button type="button" onClick={onClose}
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white shadow-lg transition hover:bg-white/40">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── Event detail / edit popup ────────────────────────────────────────────────

function EventDetailModal({ event, canEdit, username, role, onClose, onSaved, onDeleted }) {
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lightboxURL, setLightboxURL] = useState(null);
  const fileInputRef = useRef(null);

  function enterEdit() {
    setDraft({
      発生事案: event["発生事案"] || "",
      詳細: event["詳細"] || "",
      名前: event["名前"] || "",
      eventDate: event.eventDate || "",
      tags: Array.isArray(event.tags) ? [...event.tags] : [],
      imageURLs: Array.isArray(event.imageURLs) ? [...event.imageURLs] : [],
    });
    setUploadError("");
    setMode("edit");
  }

  function setField(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function toggleTag(tag) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
    }));
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const base64 = await toBase64(file);
        const result = await uploadEquipmentEventImage({
          base64,
          factoryName: event["工場"] || "",
          equipmentName: event.equipmentName || "",
          username,
        });
        return result.imageURL;
      })
    );
    const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failedCount = results.filter((r) => r.status === "rejected").length;
    if (urls.length) {
      setDraft((d) => ({ ...d, imageURLs: [...d.imageURLs, ...urls] }));
    }
    if (failedCount) {
      const raw = results.find((r) => r.status === "rejected")?.reason?.message || "";
      setUploadError(raw.startsWith("<") ? "Upload failed — server error." : raw || `${failedCount} file(s) failed to upload.`);
    }
    setUploading(false);
  }

  function removeImage(url) {
    setDraft((d) => ({ ...d, imageURLs: d.imageURLs.filter((u) => u !== url) }));
  }

  async function handleSave() {
    if (!draft) return;
    const recordId = event._id?.$oid ?? event._id;
    if (!recordId) return;
    setBusy(true);
    try {
      await updateMasterRecord({
        recordId,
        updates: {
          発生事案: draft.発生事案 || undefined,
          詳細: draft.詳細 || undefined,
          名前: draft.名前 || undefined,
          eventDate: draft.eventDate || undefined,
          tags: draft.tags.length ? draft.tags : undefined,
          imageURLs: draft.imageURLs.length ? draft.imageURLs : undefined,
        },
        username,
        role,
        tabKey: "equipmentHistoryDB",
      });
      onSaved();
      onClose();
    } catch (err) {
      setUploadError(err?.message || "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const reason = window.prompt("Enter the reason for deleting this record.");
    if (!reason?.trim()) return;
    const recordId = event._id?.$oid ?? event._id;
    if (!recordId) return;
    setBusy(true);
    try {
      await softDeleteEquipmentHistory({
        recordId,
        username,
        role,
        reason: reason.trim(),
      });
      onDeleted();
      onClose();
    } catch (err) {
      setUploadError(err?.message || "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  const tags = mode === "edit" ? draft?.tags ?? [] : (Array.isArray(event.tags) ? event.tags : []);
  const imageURLs = mode === "edit" ? draft?.imageURLs ?? [] : (Array.isArray(event.imageURLs) ? event.imageURLs : []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">事案詳細</div>
              <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                {mode === "edit" ? "事案を編集" : (event["発生事案"] || "—")}
              </h3>
              {mode === "view" && event["工場"] && (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{event["工場"]}</p>
              )}
            </div>
            <IconButton icon="close" onClick={onClose} size="md" ariaLabel="Close dialog" />
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 scrollbar-hide">
          {mode === "view" ? (
            <div className="grid gap-5">
              {/* Meta row */}
              <div className="flex flex-wrap gap-2.5">
                {event.eventDate && (
                  <span className="rounded-[6px] border border-[var(--freya-blue)]/20 bg-[var(--freya-blue)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--freya-blue)]">{event.eventDate}</span>
                )}
                {event["名前"] && (
                  <span className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">{event["名前"]}</span>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">{tag}</span>
                  ))}
                </div>
              )}

              {/* Details */}
              {event["詳細"] && (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">詳細</p>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">{event["詳細"]}</p>
                </div>
              )}

              {/* Images / Videos */}
              {imageURLs.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">画像 / 動画</p>
                  <div className="flex flex-wrap gap-2">
                    {imageURLs.map((url) => (
                      <button key={url} type="button" onClick={() => setLightboxURL(url)}
                        className="overflow-hidden rounded-[8px] border border-[var(--border)] transition hover:opacity-80">
                        {isVideoUrl(url) ? (
                          <video src={url} className="h-16 w-16 object-cover bg-black" muted playsInline />
                        ) : (
                          <img src={url} alt="添付画像" className="h-16 w-16 object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="block">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">発生事案 <span className="text-[var(--status-danger)]">*</span></div>
                <input type="text" value={draft.発生事案}
                  onChange={(e) => setField("発生事案", e.target.value)}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]" />
              </label>

              <label className="block">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">詳細</div>
                <textarea value={draft.詳細}
                  onChange={(e) => setField("詳細", e.target.value)}
                  rows={4}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)] resize-none" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">名前</div>
                  <input type="text" value={draft.名前}
                    onChange={(e) => setField("名前", e.target.value)}
                    className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]" />
                </label>
                <label className="block">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">発生日</div>
                  <input type="date" value={draft.eventDate}
                    onChange={(e) => setField("eventDate", e.target.value)}
                    className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]" />
                </label>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">カテゴリ</div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_CATEGORY_TAGS.map((tag) => {
                    const selected = draft.tags.includes(tag);
                    return (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${selected ? "bg-[var(--freya-blue)] text-white shadow-xs" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}>
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">画像 / 動画</div>
                <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple className="hidden" onChange={handleFileChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:opacity-50 shadow-2xs">
                  {uploading
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>アップロード中…</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>ファイルを添付</>}
                </button>
                {uploadError && <p className="mt-2 text-xs text-[var(--status-danger)]">{uploadError}</p>}
                {imageURLs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imageURLs.map((url) => (
                      <div key={url} className="group relative">
                        {isVideoUrl(url) ? (
                          <video src={url} className="h-16 w-16 rounded-[8px] object-cover border border-[var(--border)] bg-black" muted playsInline />
                        ) : (
                          <img src={url} alt="添付画像" className="h-16 w-16 rounded-[8px] object-cover border border-[var(--border)]" />
                        )}
                        <button type="button" onClick={() => removeImage(url)}
                          className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--status-danger)] text-white group-hover:flex">
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4">
          {canEdit && mode === "edit" ? (
            <button type="button" onClick={handleDelete} disabled={busy}
              className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger)]/20 disabled:opacity-50 shadow-2xs">
              Delete
            </button>
          ) : <div />}

          <div className="flex items-center gap-2.5">
            <button type="button" onClick={mode === "edit" ? () => setMode("view") : onClose}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs">
              {mode === "edit" ? "Cancel" : "Close"}
            </button>
            {canEdit && mode === "view" && (
              <button type="button" onClick={enterEdit}
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs">
                Edit
              </button>
            )}
            {mode === "edit" && (
              <button type="button" onClick={handleSave} disabled={busy || uploading || !draft?.発生事案?.trim()}
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:opacity-50">
                {busy ? "保存中…" : "変更を保存"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

// ── Right-hand detail panel (inline, not a popup) ────────────────────────────

function EquipmentDetailPanel({ equipment, onClose, onEdit }) {
  if (!equipment) return null;

  const fields = [
    { label: "設備名",            value: equipment.name },
    { label: "工場",              value: equipment["工場"] },
    { label: "設置日",            value: equipment.installationDate },
    { label: "Model",            value: equipment.model },
    { label: "Size",             value: equipment.size },
    { label: "Serial No.",       value: equipment.serialNo },
    { label: "Manufacture Date", value: equipment.manufactureDate },
    { label: "Voltage",          value: equipment.voltage },
    { label: "Manufacturer",     value: equipment.manufacturer },
    { label: "Contact Via",      value: equipment.contactVia },
    { label: "No. of Heads",     value: equipment.noOfHead },
    { label: "Length",           value: equipment.tableLength ? `${equipment.tableLength} mm` : undefined },
  ];

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">設備詳細</p>
          <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{equipment.name || "—"}</h3>
          {equipment["工場"] && (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{equipment["工場"]}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onEdit && (
            <button type="button" onClick={() => onEdit(equipment)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
              Edit
            </button>
          )}
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {equipment.imageURL && (
          <div className="mb-4 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)]">
            <img
              src={equipment.imageURL}
              alt={equipment.name || "equipment"}
              className="h-44 w-full object-contain p-3"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
        )}

        <section>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">設備情報</p>
          <dl className="grid grid-cols-2 gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3.5">
            {fields.map(({ label, value }) =>
              value ? (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</dt>
                  <dd className="text-xs font-medium text-[var(--text-primary)]">{value}</dd>
                </div>
              ) : null
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}

// ── Factory-box sub-components ───────────────────────────────────────────────

function EquipmentRow({ equipment, isSelected, onView }) {
  return (
    <button
      type="button"
      onClick={() => onView(equipment)}
      className={`w-full rounded-[6px] border px-3 py-2 text-left transition ${
        isSelected
          ? "border-[var(--freya-blue)] bg-[var(--freya-blue)]/10"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] shadow-2xs"
      }`}
    >
      <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{equipment.name || "—"}</p>
      {equipment.installationDate && (
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">設置日: {equipment.installationDate}</p>
      )}
    </button>
  );
}

function FactoryBox({ factory, equipment, selectedId, onView }) {
  const [expanded, setExpanded] = useState(false);
  const name = factory["工場"] || "—";
  const hasMore = equipment.length > 1;
  const visible = expanded ? equipment : equipment.slice(0, 1);

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      {/* Header + equipment rows */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[var(--freya-blue)]/10 text-[var(--freya-blue)]">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>factory</span>
          </div>
          <h4 className="text-xs font-bold text-[var(--text-primary)]">{name}</h4>
        </div>

        <div className="flex flex-col gap-1.5">
          {equipment.length === 0 ? (
            <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-center">
              <p className="text-[10px] italic text-[var(--text-muted)]">No equipment recorded yet.</p>
            </div>
          ) : (
            visible.map((eq) => {
              const id = eq._id?.$oid ?? eq._id ?? eq.name;
              return (
                <EquipmentRow key={id} equipment={eq}
                  isSelected={(eq._id?.$oid ?? eq._id) === selectedId}
                  onView={onView} />
              );
            })
          )}
        </div>
      </div>

      {/* Expand / collapse chevron */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-[var(--border)] py-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <span
            className="material-symbols-outlined transition-transform duration-200"
            style={{ fontSize: 16, transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>
          {!expanded && (
            <span className="text-[10px] font-medium text-[var(--text-muted)]">
              +{equipment.length - 1} more
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// ── Main workspace ───────────────────────────────────────────────────────────

export default function SetsubiDBWorkspace({ refreshToken, onFlash }) {
  const authUser = getAuthUser();
  const canEdit = authUser?.role === "admin";

  const [factories, setFactories] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localRefresh, setLocalRefresh] = useState(0);

  // Equipment create/edit modal
  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [defaultFactory, setDefaultFactory] = useState("");
  const [equipSubmitting, setEquipSubmitting] = useState(false);

  // Inline detail panel
  const [viewingEquipment, setViewingEquipment] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Event detail / edit popup
  const [viewingEvent, setViewingEvent] = useState(null);

  // Recycle bin modal
  const [binOpen, setBinOpen] = useState(false);
  const [binRefresh, setBinRefresh] = useState(0);

  // View toggle + all-records list
  const [listViewMode, setListViewMode] = useState("factory");
  const [allHistory, setAllHistory] = useState([]);
  const [allHistoryLoading, setAllHistoryLoading] = useState(false);
  const [allHistoryError, setAllHistoryError] = useState("");
  const [listSortDir, setListSortDir] = useState("desc");
  const [listFilterTag, setListFilterTag] = useState("");
  const [listFilterFactory, setListFilterFactory] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [factoryRecords, equipmentRecords] = await Promise.all([
          fetchFactoryDBRecords(),
          fetchSetsubiDBRecords(),
        ]);
        if (!active) return;
        setFactories(Array.isArray(factoryRecords) ? factoryRecords : []);
        setEquipment(Array.isArray(equipmentRecords) ? equipmentRecords : []);
      } catch (err) {
        if (!active) return;
        const message = err?.message || "Failed to load data.";
        setError(message);
        onFlash?.({ type: "error", message });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [refreshToken, localRefresh, onFlash]);

  useEffect(() => {
    if (listViewMode !== "all") return undefined;
    let active = true;
    setAllHistoryLoading(true);
    setAllHistoryError("");
    fetchAllEquipmentHistory()
      .then((rows) => { if (active) setAllHistory(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setAllHistoryError(err?.message || "Failed to load records."); })
      .finally(() => { if (active) setAllHistoryLoading(false); });
    return () => { active = false; };
  }, [listViewMode, localRefresh, historyRefreshKey]);

  const factoryNames = useMemo(
    () => factories.map((f) => f["工場"]).filter(Boolean),
    [factories]
  );

  const equipmentByFactory = useMemo(() => {
    const map = new Map();
    factories.forEach((f) => map.set(f["工場"] || "", []));
    equipment.forEach((eq) => {
      const key = eq["工場"] || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(eq);
    });
    map.forEach((list) => list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja")));
    return map;
  }, [factories, equipment]);

  const filteredSortedHistory = useMemo(() => {
    let rows = allHistory;
    if (listFilterFactory) rows = rows.filter((r) => (r["工場"] || "") === listFilterFactory);
    if (listFilterTag) rows = rows.filter((r) => Array.isArray(r.tags) && r.tags.includes(listFilterTag));
    return [...rows].sort((a, b) => {
      const da = a.eventDate || "";
      const db = b.eventDate || "";
      return listSortDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
  }, [allHistory, listFilterFactory, listFilterTag, listSortDir]);

  // ── Equipment CRUD ──────────────────────────────────────────────────────────

  function openCreateEquipModal(factoryName = "") {
    setEditingRecord(null);
    setDefaultFactory(factoryName);
    setEquipModalOpen(true);
  }

  function openEditEquipModal(record) {
    setEditingRecord(record);
    setDefaultFactory("");
    setEquipModalOpen(true);
  }

  function closeEquipModal() {
    setEquipModalOpen(false);
    setEditingRecord(null);
    setDefaultFactory("");
  }

  async function handleSaveEquipment(draft) {
    setEquipSubmitting(true);
    try {
      const payload = {
        name: draft.name || undefined,
        工場: draft["工場"] || undefined,
        installationDate: draft.installationDate || undefined,
        imageURL: draft.imageURL || undefined,
        model: draft.model || undefined,
        size: draft.size || undefined,
        serialNo: draft.serialNo || undefined,
        manufactureDate: draft.manufactureDate || undefined,
        voltage: draft.voltage || undefined,
        manufacturer: draft.manufacturer || undefined,
        contactVia: draft.contactVia || undefined,
        noOfHead: draft.noOfHead || undefined,
        tableLength: draft.tableLength || undefined,
      };
      const username = authUser?.username || "unknown";
      if (editingRecord) {
        const recordId = editingRecord._id?.$oid ?? editingRecord._id;
        await updateMasterRecord({ recordId, updates: payload, username, role: authUser?.role, tabKey: "setsubiDB" });
        setSuccessMessage("Record edited successfully.");
        if (viewingEquipment && (viewingEquipment._id?.$oid ?? viewingEquipment._id) === recordId) {
          setViewingEquipment({ ...viewingEquipment, ...payload });
        }
      } else {
        await createMasterRecord({ data: payload, username, role: authUser?.role, tabKey: "setsubiDB" });
        setSuccessMessage("Record created successfully.");
      }
      closeEquipModal();
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to save equipment record." });
    } finally {
      setEquipSubmitting(false);
    }
  }

  async function handleArchiveEquipment() {
    if (!editingRecord) return;
    const recordId = editingRecord._id?.$oid ?? editingRecord._id;
    if (!recordId) return;
    if (!window.confirm(`Archive "${editingRecord.name || recordId}"? The record will be moved to the equipment archive and its maintenance history will remain intact.`)) return;
    setEquipSubmitting(true);
    try {
      await archiveEquipmentRecord({ recordId, username: authUser?.username || "unknown", role: authUser?.role });
      setSuccessMessage("Equipment archived successfully.");
      if (viewingEquipment && (viewingEquipment._id?.$oid ?? viewingEquipment._id) === recordId) {
        setViewingEquipment(null);
      }
      closeEquipModal();
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || "Failed to archive equipment record." });
    } finally {
      setEquipSubmitting(false);
    }
  }

  const selectedId = viewingEquipment ? (viewingEquipment._id?.$oid ?? viewingEquipment._id) : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      {/* Page header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">設備</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">Equipment by Factory</h3>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !error && listViewMode === "factory" && (
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {equipment.length} items · {factories.length} factories
            </span>
          )}
          <button type="button" onClick={() => setBinOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            Recycle Bin
          </button>
          {canEdit && (
            <button type="button" onClick={() => openCreateEquipModal()}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Add Equipment
            </button>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="mb-6 flex items-center">
        <div className="flex overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5">
          {[
            { key: "factory", label: "View by factory", icon: "factory" },
            { key: "all",     label: "View all records", icon: "list" },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setListViewMode(key)}
              className={`inline-flex items-center gap-2 rounded-[4px] px-3.5 py-1.5 text-xs font-semibold transition ${
                listViewMode === key
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Factory grid view ── */}
      {listViewMode === "factory" && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-16 text-xs font-medium text-[var(--text-muted)]">
              <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 18 }}>progress_activity</span>
              Loading…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-5 py-4 text-xs font-medium text-[var(--status-danger)]">{error}</div>
          )}
          {!loading && !error && factories.length === 0 && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-8 text-center text-xs text-[var(--text-muted)]">
              No factory records found in factoryDB.
            </div>
          )}
          {!loading && !error && factories.length > 0 && (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className={viewingEquipment ? "lg:w-[58%] lg:shrink-0" : "w-full"}>
                <div className="grid grid-cols-4 gap-4">
                  {factories.map((factory, index) => {
                    const key = factory._id?.$oid ?? factory._id ?? String(index);
                    const factoryName = factory["工場"] || "";
                    const factoryEquipment = equipmentByFactory.get(factoryName) ?? [];
                    return (
                      <FactoryBox
                        key={key}
                        factory={factory}
                        equipment={factoryEquipment}
                        selectedId={selectedId}
                        onView={setViewingEquipment}
                      />
                    );
                  })}
                </div>
              </div>
              {viewingEquipment && (
                <div className="flex-1 min-w-0 lg:sticky lg:top-6">
                  <EquipmentDetailPanel
                    equipment={viewingEquipment}
                    onClose={() => setViewingEquipment(null)}
                    onEdit={canEdit ? openEditEquipModal : undefined}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── All records view ── */}
      {listViewMode === "all" && (
        <div>
          {/* Filter + sort bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={listFilterFactory}
              onChange={(e) => setListFilterFactory(e.target.value)}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)]"
            >
              <option value="">All Factories</option>
              {factoryNames.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>

            <div className="flex flex-wrap gap-1.5">
              {EVENT_CATEGORY_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setListFilterTag(listFilterTag === tag ? "" : tag)}
                  className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
                    listFilterTag === tag
                      ? "bg-[var(--freya-blue)] text-white shadow-xs"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] shadow-2xs"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setListSortDir((d) => d === "desc" ? "asc" : "desc")}
              className="ml-auto inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] shadow-2xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {listSortDir === "desc" ? "arrow_downward" : "arrow_upward"}
              </span>
              Date {listSortDir === "desc" ? "Newest first" : "Oldest first"}
            </button>
          </div>

          {allHistoryLoading && (
            <div className="flex items-center gap-2 py-12 text-xs font-medium text-[var(--text-muted)]">
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
              読み込み中…
            </div>
          )}
          {!allHistoryLoading && allHistoryError && (
            <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-5 py-4 text-xs font-medium text-[var(--status-danger)]">{allHistoryError}</div>
          )}
          {!allHistoryLoading && !allHistoryError && filteredSortedHistory.length === 0 && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-10 text-center text-xs text-[var(--text-muted)]">
              {allHistory.length === 0 ? "事案の記録はまだありません。" : "No records matched the current filters."}
            </div>
          )}
          {!allHistoryLoading && !allHistoryError && filteredSortedHistory.length > 0 && (
            <div className="flex flex-col gap-2">
              {filteredSortedHistory.map((event, i) => {
                const key = event._id?.$oid ?? event._id ?? i;
                const tags = Array.isArray(event.tags) ? event.tags : [];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setViewingEvent(event)}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--freya-blue)]/50 hover:bg-[var(--surface-hover)]/50 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{event["発生事案"] || "—"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {event["工場"] && <span className="text-[11px] text-[var(--text-secondary)]">{event["工場"]}</span>}
                          {event.equipmentName && <span className="text-[11px] text-[var(--text-muted)]">/ {event.equipmentName}</span>}
                          {event["名前"] && <span className="text-[11px] text-[var(--text-muted)]">· {event["名前"]}</span>}
                        </div>
                        {tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span key={tag} className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {event.eventDate && (
                        <span className="shrink-0 rounded-[4px] border border-[var(--freya-blue)]/20 bg-[var(--freya-blue)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--freya-blue)]">{event.eventDate}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SetsubiRecordModal
        open={equipModalOpen}
        record={editingRecord}
        submitting={equipSubmitting}
        factories={factoryNames}
        defaultFactory={defaultFactory}
        username={authUser?.username || "unknown"}
        onClose={closeEquipModal}
        onSubmit={handleSaveEquipment}
        onArchive={editingRecord ? handleArchiveEquipment : undefined}
      />

      <SuccessModal message={successMessage} onClose={() => setSuccessMessage("")} />

      {viewingEvent && (
        <EventDetailModal
          event={viewingEvent}
          canEdit={canEdit}
          username={authUser?.username || "unknown"}
          role={authUser?.role}
          onClose={() => setViewingEvent(null)}
          onSaved={() => {
            setSuccessMessage("事案を更新しました。");
            setHistoryRefreshKey((k) => k + 1);
          }}
          onDeleted={() => {
            setSuccessMessage("事案をリサイクルビンに移動しました。");
            setHistoryRefreshKey((k) => k + 1);
            setBinRefresh((k) => k + 1);
          }}
        />
      )}

      {binOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl my-8">
            <div className="mb-3 flex justify-end">
              <IconButton icon="close" onClick={() => setBinOpen(false)} variant="light" ariaLabel="Close" className="bg-white/20 hover:bg-white/30" />
            </div>
            <EquipmentHistoryBinWorkspace
              refreshToken={binRefresh}
              onFlash={(msg) => { onFlash?.(msg); setBinRefresh((n) => n + 1); }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
