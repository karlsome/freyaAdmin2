import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ModalShell from "./ModalShell";
import FormField from "./FormField";
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
  { key: "contactNumber", labelJa: "連絡先電話番号", labelEn: "Contact Number", type: "tel", placeholderJa: "例: 03-1234-5678", placeholderEn: "e.g. 03-1234-5678" },
  { key: "makerEmail", labelJa: "メーカーメール", labelEn: "Maker Email", type: "email", placeholderJa: "例: sales@maker.co.jp", placeholderEn: "e.g. sales@maker.co.jp" },
  { key: "makerWechatId", labelJa: "メーカー WeChat ID", labelEn: "Maker WeChat ID", type: "text", placeholderJa: "WeChat ID", placeholderEn: "WeChat ID" },
  { key: "makerLineId", labelJa: "メーカー LINE ID", labelEn: "Maker LINE ID", type: "text", placeholderJa: "LINE ID", placeholderEn: "LINE ID" },
];

const EMPTY_DETAILS = { maker: "", contactNumber: "", makerEmail: "", makerWechatId: "", makerLineId: "", comment: "" };

function buildDetails(record) {
  return Object.fromEntries(Object.keys(EMPTY_DETAILS).map((k) => [k, record?.[k] != null ? String(record[k]) : ""]));
}

function recordIdOf(record) {
  return record?._id?.$oid ?? record?._id ?? null;
}

function BladeModal({ open, record, submitting, username, onClose, onSubmit, onDelete }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [name, setName] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(record?.name || "");
    setImageURL(record?.imageURL || "");
    setDetails(buildDetails(record));
    setUploadError("");
  }, [open, record]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    try {
      const base64 = await toBase64(file);
      const result = await uploadBladeImage({ base64, bladeName: name.trim(), username });
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

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || uploading) return;
    const trimmed = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v.trim()]));
    onSubmit({ name: name.trim(), imageURL, ...trimmed });
  }

  const isEdit = Boolean(record);

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div>
        {isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={submitting}
            className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger)]/20 active:scale-[0.98] transition-all shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
          >
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
          onClick={onClose}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all shadow-2xs"
        >
          {isJa ? "キャンセル" : "Cancel"}
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={submitting || uploading || !name.trim()}
          className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (isJa ? "保存中…" : "Saving…") : (isJa ? "保存" : "Save")}
        </button>
      </div>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? (isJa ? "刃物を編集" : "Edit Blade") : (isJa ? "刃物を追加" : "Add Blade")}
      title={isEdit ? (isJa ? "刃物レコードの編集" : "Edit Blade Record") : (isJa ? "刃物レコードの追加" : "Add Blade Record")}
      subtitle={isEdit
        ? (isJa ? "選択した刃物の情報を更新します。" : "Update the selected blade's details.")
        : (isJa ? "bladeDBに新規刃物を登録します。" : "Create a new blade entry in bladeDB.")}
      maxWidth="max-w-xl"
      footer={footer}
      footerClassName="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4"
    >
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
        </FormField>

        <FormField label={isJa ? "画像" : "Image"} variant="form">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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
          {uploadError && <p className="mt-2 text-xs text-[var(--status-danger)]">{uploadError}</p>}
          {imageURL && (
            <div className="mt-3 group relative inline-block">
              <img src={imageURL} alt="blade" className="h-32 w-32 rounded-[8px] object-cover border border-[var(--border)]" />
              <button
                type="button"
                onClick={() => setImageURL("")}
                className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--status-danger)] text-white group-hover:flex"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
              </button>
            </div>
          )}
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

        <FormField label={isJa ? "コメント" : "Comment"} variant="form">
          <textarea
            value={details.comment}
            onChange={(e) => setDetails((d) => ({ ...d, comment: e.target.value }))}
            rows={3}
            placeholder={isJa ? "メモ・備考" : "Notes"}
            className={`${inputCls} resize-y`}
          />
        </FormField>
        </div>
      </form>
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
          tabKey: "bladeDB",
        }).catch((err) => {
          // 304 = nothing changed; treat as success
          if (!String(err?.message || "").includes("304")) throw err;
        });
      } else {
        await createMasterRecord({
          data: { name, imageURL: imageURL || "", ...details, createdAt: new Date().toISOString(), createdBy: username },
          username,
          role: authUser?.role,
          tabKey: "bladeDB",
        });
      }
      onFlash?.({ type: "success", message: editing ? (isJa ? "刃物を更新しました。" : "Blade updated.") : (isJa ? "刃物を追加しました。" : "Blade added.") });
      closeModal();
      setLocalRefresh((n) => n + 1);
    } catch (err) {
      onFlash?.({ type: "error", message: err?.message || (isJa ? "刃物の保存に失敗しました。" : "Failed to save blade.") });
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
      await deleteMasterRecord({ recordId: recordIdOf(editing), username, role: authUser?.role, tabKey: "bladeDB" });
      if (editing.imageURL) deleteEquipmentEventImage(editing.imageURL).catch(() => {});
      onFlash?.({ type: "success", message: isJa ? "刃物を削除しました。" : "Blade deleted." });
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
        <div className="rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-5 py-4 text-xs font-medium text-[var(--status-danger)]">{error}</div>
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
              onClick={canEdit ? () => openEdit(blade) : undefined}
              className={`overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-left shadow-2xs transition ${
                canEdit ? "hover:border-[var(--freya-blue)]/50 hover:bg-[var(--surface-hover)]/50" : "cursor-default"
              }`}
            >
              <div className="flex aspect-square items-center justify-center bg-[var(--surface-subtle)]">
                {blade.imageURL ? (
                  <img src={blade.imageURL} alt={blade.name || "blade"} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 32 }}>image</span>
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
        submitting={submitting}
        username={username}
        onClose={closeModal}
        onSubmit={handleSave}
        onDelete={canEdit ? handleDelete : undefined}
      />
    </div>
  );
}
