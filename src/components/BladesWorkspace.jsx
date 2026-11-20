import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ModalShell from "./ModalShell";
import FormField from "./FormField";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import {
  createMasterRecord,
  deleteEquipmentEventImage,
  deleteMasterRecord,
  fetchBladeRecords,
  updateMasterRecord,
  uploadBladeImage,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";

const FORM_ID = "blade-record-form";

const inputCls =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

const DETAIL_FIELDS = [
  { key: "maker", labelJa: "メーカー", labelEn: "Maker", type: "text", placeholderJa: "例: 山田刃物株式会社", placeholderEn: "e.g. Yamada Blade Co." },
  { key: "contactName", labelJa: "担当者名", labelEn: "Contact Name", type: "text", placeholderJa: "例: 山田 太郎", placeholderEn: "e.g. Taro Yamada" },
  { key: "contactNumber", labelJa: "連絡先電話番号", labelEn: "Contact Number", type: "tel", placeholderJa: "例: 03-1234-5678", placeholderEn: "e.g. 03-1234-5678" },
  { key: "makerEmail", labelJa: "メーカーメール", labelEn: "Maker Email", type: "email", placeholderJa: "例: sales@maker.co.jp", placeholderEn: "e.g. sales@maker.co.jp" },
  { key: "makerWechatId", labelJa: "メーカー WeChat ID", labelEn: "Maker WeChat ID", type: "text", placeholderJa: "WeChat ID", placeholderEn: "WeChat ID" },
  { key: "makerLineId", labelJa: "メーカー LINE ID", labelEn: "Maker LINE ID", type: "text", placeholderJa: "LINE ID", placeholderEn: "LINE ID" },
];

const EMPTY_DETAILS = { maker: "", contactName: "", contactNumber: "", makerEmail: "", makerWechatId: "", makerLineId: "", description: "" };

function buildDetails(record) {
  return Object.fromEntries(Object.keys(EMPTY_DETAILS).map((k) => [k, record?.[k] != null ? String(record[k]) : ""]));
}

function noop() {}

function ViewValue({ label, value, multiline = false }) {
  const text = value != null && String(value).trim() !== "" ? String(value) : "";
  return (
    <FormField label={label} variant="form">
      <p className={`text-sm text-[var(--text-primary)] ${multiline ? "whitespace-pre-wrap" : "break-words"} ${text ? "" : "text-[var(--text-muted)]"}`}>
        {text || "—"}
      </p>
    </FormField>
  );
}

function deleteImageQuietly(url) {
  if (url) deleteEquipmentEventImage(url).catch(() => {});
}

function recordIdOf(record) {
  return record?._id?.$oid ?? record?._id ?? null;
}

function BladeModal({ open, record, canEdit, submitting, username, onClose, onSubmit, onDelete }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [name, setName] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("view"); // "view" | "edit"
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  // Images uploaded while this modal is open. Any not kept by a successful save get deleted from Firebase.
  const sessionUploadsRef = useRef([]);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (!open) return;
    sessionUploadsRef.current = [];
    setPreview(null);
    setMode(record ? "view" : "edit");
    resetDraft(record);
  }, [open, record]);

  function resetDraft(source) {
    setName(source?.name || "");
    setImageURL(source?.imageURL || "");
    setDetails(buildDetails(source));
    setUploadError("");
  }

  function discardSessionUploads() {
    sessionUploadsRef.current.forEach(deleteImageQuietly);
    sessionUploadsRef.current = [];
  }

  function openPreview(url) {
    setPreview({
      displayName: name.trim() || (isJa ? "刃物画像" : "Blade Image"),
      eyebrow: isJa ? "刃物画像" : "Blade Image",
      subtitle: details.maker.trim(),
      images: [{ url, label: name.trim() || "blade" }],
      activeIndex: 0,
    });
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    try {
      const base64 = await toBase64(file);
      const result = await uploadBladeImage({ base64, bladeName: name.trim(), username });
      if (!openRef.current) {
        // Modal was closed while the upload was in flight
        deleteImageQuietly(result.imageURL);
        return;
      }
      sessionUploadsRef.current.push(result.imageURL);
      setImageURL(result.imageURL);
    } catch (err) {
      const raw = err?.message || "";
      setUploadError(
        raw.startsWith("<")
          ? (isJa ? "アップロード失敗 — サーバーエラーです。" : "Upload failed — server error.")
          : raw || (isJa ? "アップロードに失敗しました。" : "Upload failed.")
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || uploading || submitting) return;
    const trimmed = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.trim()]));
    const finalURL = imageURL;
    const saved = await onSubmit({ name: name.trim(), imageURL: finalURL, ...trimmed });
    if (!saved) return;
    // Drop images uploaded this session that were replaced or removed, plus the old image if it changed.
    const stale = sessionUploadsRef.current.filter((url) => url && url !== finalURL);
    if (record?.imageURL && record.imageURL !== finalURL) stale.push(record.imageURL);
    sessionUploadsRef.current = [];
    stale.forEach(deleteImageQuietly);
  }

  // Close the whole modal (X / Escape / Cancel in view or create mode).
  function handleClose() {
    if (submitting) return;
    discardSessionUploads();
    onClose();
  }

  // Cancel while editing an existing blade: throw away changes and go back to the view.
  function handleCancelEdit() {
    if (submitting) return;
    if (!record) {
      handleClose();
      return;
    }
    discardSessionUploads();
    resetDraft(record);
    setMode("view");
  }

  const isEdit = Boolean(record);
  const isView = isEdit && mode === "view";

  const secondaryBtnCls =
    "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all shadow-2xs disabled:cursor-not-allowed disabled:opacity-50";
  const primaryBtnCls =
    "inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50";

  const viewFooter = (
    <div className="flex items-center justify-end gap-3">
      <button type="button" onClick={handleClose} className={secondaryBtnCls}>
        {isJa ? "キャンセル" : "Cancel"}
      </button>
      {canEdit && (
        <button type="button" onClick={() => setMode("edit")} className={primaryBtnCls}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
          {isJa ? "編集" : "Edit"}
        </button>
      )}
    </div>
  );

  const editFooter = (
    <div className="flex items-center justify-between gap-3">
      <div>
        {isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 active:scale-[0.98] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            {isJa ? "削除" : "Delete"}
          </button>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {isJa ? "保存する前に刃物名の入力が必要です。" : "Blade name is required before saving."}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancelEdit}
          disabled={submitting}
          className={secondaryBtnCls}
        >
          {isJa ? "キャンセル" : "Cancel"}
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={submitting || uploading || !name.trim()}
          className={primaryBtnCls}
        >
          {submitting ? (isJa ? "保存中…" : "Saving…") : (isJa ? "保存" : "Save")}
        </button>
      </div>
    </div>
  );

  return (
    <ModalShell
      open={open}
      // While the preview is open, Escape should only close the preview, not this form.
      onClose={preview ? noop : handleClose}
      eyebrow={isView ? (isJa ? "刃物" : "Blade") : isEdit ? (isJa ? "刃物を編集" : "Edit Blade") : (isJa ? "刃物を追加" : "Add Blade")}
      title={isView ? (record?.name || "—") : isEdit ? (isJa ? "刃物レコードの編集" : "Edit Blade Record") : (isJa ? "刃物レコードの追加" : "Add Blade Record")}
      subtitle={isView
        ? (record?.maker || "")
        : isEdit
          ? (isJa ? "選択した刃物の情報を更新します。" : "Update the selected blade's details.")
          : (isJa ? "NCBladeDBに新規刃物を登録します。" : "Create a new blade entry in NCBladeDB.")}
      maxWidth="max-w-xl"
      footer={isView ? viewFooter : editFooter}
      footerClassName="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4"
    >
      {isView ? (
        <div className="overflow-y-auto px-6 py-5 scrollbar-hide" style={{ maxHeight: "calc(92vh - 180px)" }}>
          <div className="grid gap-5">
            <FormField label={isJa ? "画像" : "Image"} variant="form">
              {record?.imageURL ? (
                <button
                  type="button"
                  onClick={() => openPreview(record.imageURL)}
                  aria-label={isJa ? "画像をプレビュー" : "Preview image"}
                  className="block cursor-zoom-in overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] shadow-2xs transition hover:border-[var(--freya-blue)]/60"
                >
                  <img src={record.imageURL} alt={record.name || "blade"} className="h-48 w-48 object-cover" />
                </button>
              ) : (
                <div className="flex h-48 w-48 flex-col items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                  <span className="material-symbols-outlined" style={{ fontSize: 32 }}>hide_image</span>
                  <span className="text-xs font-medium">{isJa ? "画像なし" : "No image"}</span>
                </div>
              )}
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <ViewValue label={isJa ? "刃物名" : "Blade Name"} value={record?.name} />
              {DETAIL_FIELDS.map((f) => (
                <ViewValue key={f.key} label={isJa ? f.labelJa : f.labelEn} value={record?.[f.key]} />
              ))}
            </div>

            <ViewValue label={isJa ? "説明・コメント" : "Description / Comment"} value={record?.description} multiline />
          </div>
        </div>
      ) : (
      <form
        id={FORM_ID}
        onSubmit={handleSubmit}
        className="overflow-y-auto px-6 py-5 scrollbar-hide"
        style={{ maxHeight: "calc(92vh - 180px)" }}
      >
        <div className="grid gap-3">
        <FormField label={isJa ? "刃物名" : "Blade Name"} variant="form" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isJa ? "例: トムソン刃 23.6mm" : "e.g. Thomson blade 23.6mm"}
            className={inputCls}
            autoFocus
            required
          />
          {isEdit && record?.name && name.trim() !== record.name && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {isJa
                ? `製品は刃物名で紐付いています。「${record.name}」を参照している製品は自動で更新されません。`
                : `Products link to blades by name. Products that reference "${record.name}" will not be updated automatically.`}
            </p>
          )}
        </FormField>

        <FormField label={isJa ? "画像" : "Image"} variant="form">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div className="flex flex-col items-start gap-3">
          {imageURL && (
            <div className="relative">
              <button
                type="button"
                onClick={() => openPreview(imageURL)}
                aria-label={isJa ? "画像をプレビュー" : "Preview image"}
                className="block cursor-zoom-in overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] shadow-2xs transition hover:border-[var(--freya-blue)]/60"
              >
                <img src={imageURL} alt="blade" className="h-40 w-40 object-cover" />
              </button>
              <button
                type="button"
                onClick={() => setImageURL("")}
                disabled={uploading}
                aria-label={isJa ? "画像を削除" : "Remove image"}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition hover:bg-red-600"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] active:scale-[0.98] transition-all shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                {isJa ? "アップロード中…" : "Uploading…"}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
                {imageURL ? (isJa ? "画像を変更" : "Change Image") : (isJa ? "画像を添付" : "Attach Image")}
              </>
            )}
          </button>
          {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}
          </div>
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          {DETAIL_FIELDS.map((f) => (
            <FormField key={f.key} label={isJa ? f.labelJa : f.labelEn} variant="form">
              <input
                type={f.type}
                value={details[f.key]}
                onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))}
                placeholder={isJa ? f.placeholderJa : f.placeholderEn}
                className={inputCls}
              />
            </FormField>
          ))}
        </div>

        <FormField label={isJa ? "説明・コメント" : "Description / Comment"} variant="form">
          <textarea
            value={details.description}
            onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))}
            rows={3}
            placeholder={isJa ? "メモ・備考" : "Notes"}
            className={`${inputCls} resize-y`}
          />
        </FormField>
        </div>
      </form>
      )}
      {preview && (
        <SensorDevicePhotoPreviewModal preview={preview} onClose={() => setPreview(null)} />
      )}
    </ModalShell>
  );
}

export default function BladesWorkspace({ refreshToken, onFlash }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const authUser = getAuthUser();
  const canEdit = authUser?.role === "admin";
  const username = authUser?.username || "unknown";

  const [blades, setBlades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localRefresh, setLocalRefresh] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchBladeRecords()
      .then((rows) => { if (active) setBlades(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setError(err?.message || (isJa ? "刃物の読み込みに失敗しました。" : "Failed to load blades.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshToken, localRefresh, isJa]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(record) {
    setEditing(record);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSave({ name, imageURL, ...details }) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateMasterRecord({
          recordId: recordIdOf(editing),
          updates: { name, imageURL: imageURL || "", ...details, updatedAt: new Date().toISOString(), updatedBy: username },
          username,
          role: authUser?.role,
          tabKey: "ncBladeDB",
        }).catch((err) => {
          // 304 = nothing changed; treat as success
          if (!String(err?.message || "").includes("304")) throw err;
        });
      } else {
        await createMasterRecord({
          data: { name, imageURL: imageURL || "", ...details, createdAt: new Date().toISOString(), createdBy: username },
          username,
          role: authUser?.role,
          tabKey: "ncBladeDB",
        });
      }
      onFlash?.({ type: "success", message: editing ? (isJa ? "刃物を更新しました。" : "Blade updated.") : (isJa ? "刃物を追加しました。" : "Blade added.") });
      closeModal();
      setLocalRefresh((n) => n + 1);
      return true;
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || (isJa ? "刃物の保存に失敗しました。" : "Failed to save blade.") });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    const label = editing.name || recordIdOf(editing);
    if (!window.confirm(isJa ? `「${label}」を削除しますか？ この操作は元に戻せません。` : `Delete "${label}"? This cannot be undone.`)) return;
    setSubmitting(true);
    try {
      await deleteMasterRecord({ recordId: recordIdOf(editing), username, role: authUser?.role, tabKey: "ncBladeDB" });
      let imageError = "";
      if (editing.imageURL) {
        try {
          await deleteEquipmentEventImage(editing.imageURL);
        } catch (err) {
          imageError = err?.message || "unknown error";
        }
      }
      onFlash?.(imageError
        ? { type: "error", message: isJa ? `刃物を削除しましたが、画像の削除に失敗しました: ${imageError}` : `Blade deleted, but its image could not be removed from storage: ${imageError}` }
        : { type: "success", message: isJa ? "刃物を削除しました。" : "Blade deleted." });
      closeModal();
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || (isJa ? "刃物の削除に失敗しました。" : "Failed to delete blade.") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="freya-card mt-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{isJa ? "刃物" : "Blades"}</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {isJa ? "刃物一覧" : "Blades"}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !error && (
            <span className="text-xs font-medium text-[var(--text-muted)]">
              {blades.length} {isJa ? "件" : "items"}
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              {isJa ? "刃物を追加" : "Add Blade"}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-xs font-medium text-[var(--text-muted)]">
          <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 18 }}>progress_activity</span>
          {isJa ? "読み込み中…" : "Loading…"}
        </div>
      )}
      {!loading && error && (
        <div className="rounded-[8px] border border-red-500/20 bg-red-500/10 px-5 py-4 text-xs font-medium text-red-600 dark:text-red-400">{error}</div>
      )}
      {!loading && !error && blades.length === 0 && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-8 text-center text-xs text-[var(--text-muted)]">
          {isJa ? "刃物の登録がありません。" : "No blades registered yet."}
        </div>
      )}
      {!loading && !error && blades.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {blades.map((blade, i) => (
            <button
              key={recordIdOf(blade) ?? i}
              type="button"
              onClick={() => openEdit(blade)}
              className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-left shadow-2xs transition hover:border-[var(--freya-blue)]/50 hover:bg-[var(--surface-hover)]/50"
            >
              <div className="flex aspect-square items-center justify-center bg-[var(--surface-subtle)]">
                {blade.imageURL ? (
                  <img src={blade.imageURL} alt={blade.name || "blade"} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
                    <span className="material-symbols-outlined" style={{ fontSize: 28 }}>hide_image</span>
                    <span className="text-[11px] font-medium">{isJa ? "画像なし" : "No image"}</span>
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{blade.name || "—"}</p>
                {blade.maker && <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{blade.maker}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <BladeModal
        open={modalOpen}
        record={editing}
        canEdit={canEdit}
        submitting={submitting}
        username={username}
        onClose={closeModal}
        onSubmit={handleSave}
        onDelete={canEdit ? handleDelete : undefined}
      />
    </div>
  );
}
