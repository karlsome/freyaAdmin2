import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { uploadEquipmentEventImage } from "../services/api";
import FormField from "./FormField";
import ModalShell from "./ModalShell";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function buildInitialDraft(record) {
  if (!record) {
    return {
      name: "", 工場: "", installationDate: "", imageURL: "",
      model: "", size: "", serialNo: "", manufactureDate: "",
      voltage: "", manufacturer: "", contactVia: "",
      noOfHead: "", tableLength: "",
    };
  }
  return {
    name: record.name || "",
    工場: record["工場"] || "",
    installationDate: record.installationDate || "",
    imageURL: record.imageURL || "",
    model: record.model || "",
    size: record.size || "",
    serialNo: record.serialNo || "",
    manufactureDate: record.manufactureDate || "",
    voltage: record.voltage || "",
    manufacturer: record.manufacturer || "",
    contactVia: record.contactVia || "",
    noOfHead: record.noOfHead != null ? String(record.noOfHead) : "",
    tableLength: record.tableLength != null ? String(record.tableLength) : "",
  };
}

const FORM_ID = "setsubi-record-form";

const inputCls =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]";

export default function SetsubiRecordModal({
  open,
  record,
  submitting,
  factories = [],
  defaultFactory = "",
  username = "unknown",
  onClose,
  onSubmit,
  onArchive,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [draft, setDraft] = useState(() => buildInitialDraft(record));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const base = buildInitialDraft(record);
    if (!record && defaultFactory) base["工場"] = defaultFactory;
    setDraft(base);
    setUploadError("");
  }, [open, record, defaultFactory]);

  const hasData = useMemo(() => draft.name.trim() !== "", [draft]);

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    try {
      const base64 = await toBase64(file);
      const result = await uploadEquipmentEventImage({
        base64,
        factoryName: draft["工場"] || "",
        equipmentName: draft.name || "",
        username,
      });
      set("imageURL", result.imageURL);
    } catch (err) {
      const raw = err?.message || "";
      setUploadError(
        raw.startsWith("<")
          ? (isJa ? "アップロード失敗 — サーバーエラーです。サーバー稼働状況を確認してください。" : "Upload failed — server error. Check that the server is running.")
          : raw || (isJa ? "アップロードに失敗しました。" : "Upload failed.")
      );
    } finally {
      setUploading(false);
    }
  }

  const isEdit = Boolean(record);

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <div>
        {isEdit && onArchive ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={submitting}
            className="rounded-[6px] border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--status-warning)] hover:bg-[var(--status-warning)]/20 active:scale-[0.98] transition-all shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isJa ? "アーカイブ" : "Archive"}
          </button>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            {isJa ? "保存する前に設備名の入力が必要です。" : "Equipment name is required before saving."}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
        >
          {isJa ? "キャンセル" : "Cancel"}
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={!hasData || submitting}
          className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] active:scale-[0.98] transition-all shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? (isJa ? "保存中…" : "Saving…")
            : isEdit
            ? (isJa ? "変更を保存" : "Save Changes")
            : (isJa ? "設備を追加" : "Add Equipment")}
        </button>
      </div>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? (isJa ? "設備を編集" : "Edit Equipment") : (isJa ? "設備を追加" : "Add Equipment")}
      title={isEdit ? (isJa ? "設備レコードの編集" : "Edit Equipment Record") : (isJa ? "設備レコードの追加" : "Add Equipment Record")}
      subtitle={isEdit
        ? (isJa ? "選択した設備の詳細情報を更新します。" : "Update the selected equipment details.")
        : (isJa ? "setsubiDBに新規設備を登録します。" : "Create a new equipment entry in setsubiDB.")}
      maxWidth="max-w-3xl"
      align="start"
      footer={footer}
      footerClassName="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-4"
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          if (!hasData) return;
          onSubmit(draft);
        }}
        className="overflow-y-auto px-6 py-5 scrollbar-hide"
        style={{ maxHeight: "calc(92vh - 180px)" }}
      >
        <div className="grid gap-3">

          <FormField label={isJa ? "設備名" : "Equipment Name"} variant="form" required>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={isJa ? "例: プレス機 #1" : "e.g. Press #1"}
              className={inputCls}
              required
            />
          </FormField>

          <FormField label={isJa ? "工場 (設置場所)" : "Factory (Location)"} variant="form">
            {factories.length > 0 ? (
              <select
                value={draft["工場"]}
                onChange={(e) => set("工場", e.target.value)}
                className={inputCls}
              >
                <option value="">{isJa ? "— 工場を選択 —" : "— Select factory —"}</option>
                {factories.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={draft["工場"]}
                onChange={(e) => set("工場", e.target.value)}
                placeholder={isJa ? "工場名" : "Factory name"}
                className={inputCls}
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={isJa ? "設置日" : "Installation Date"} variant="form">
              <input
                type="date"
                value={draft.installationDate}
                onChange={(e) => set("installationDate", e.target.value)}
                className={inputCls}
              />
            </FormField>

            <FormField label={isJa ? "製造日" : "Manufacture Date"} variant="form">
              <input
                type="date"
                value={draft.manufactureDate}
                onChange={(e) => set("manufactureDate", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>

          <FormField label={isJa ? "型式" : "Model"} variant="form">
            <input
              type="text"
              value={draft.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder={isJa ? "例: XR-500" : "e.g. XR-500"}
              className={inputCls}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={isJa ? "サイズ" : "Size"} variant="form">
              <input
                type="text"
                value={draft.size}
                onChange={(e) => set("size", e.target.value)}
                placeholder={isJa ? "例: 1200×800mm" : "e.g. 1200×800mm"}
                className={inputCls}
              />
            </FormField>

            <FormField label={isJa ? "電圧" : "Voltage"} variant="form">
              <input
                type="text"
                value={draft.voltage}
                onChange={(e) => set("voltage", e.target.value)}
                placeholder={isJa ? "例: 200V / 3φ" : "e.g. 200V / 3φ"}
                className={inputCls}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={isJa ? "ヘッド数" : "Number of Heads"} variant="form">
              <select
                value={draft.noOfHead}
                onChange={(e) => set("noOfHead", e.target.value)}
                className={inputCls}
              >
                <option value="">{isJa ? "— 選択 —" : "— Select —"}</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </FormField>

            <FormField label={isJa ? "長さ (mm)" : "Length (mm)"} variant="form">
              <input
                type="number"
                value={draft.tableLength}
                onChange={(e) => set("tableLength", e.target.value)}
                placeholder={isJa ? "例: 3500" : "e.g. 3500"}
                min="0"
                className={inputCls}
              />
            </FormField>
          </div>

          <FormField label={isJa ? "シリアル番号" : "Serial No."} variant="form">
            <input
              type="text"
              value={draft.serialNo}
              onChange={(e) => set("serialNo", e.target.value)}
              placeholder={isJa ? "例: SN-20240001" : "e.g. SN-20240001"}
              className={inputCls}
            />
          </FormField>

          <FormField label={isJa ? "メーカー" : "Manufacturer"} variant="form">
            <input
              type="text"
              value={draft.manufacturer}
              onChange={(e) => set("manufacturer", e.target.value)}
              placeholder={isJa ? "例: 山田機械株式会社" : "e.g. Yamada Machinery Co."}
              className={inputCls}
            />
          </FormField>

          <FormField label={isJa ? "連絡窓口" : "Contact Via"} variant="form">
            <input
              type="text"
              value={draft.contactVia}
              onChange={(e) => set("contactVia", e.target.value)}
              placeholder={isJa ? "例: sales@yamada.co.jp / 03-1234-5678" : "e.g. sales@yamada.co.jp / 03-1234-5678"}
              className={inputCls}
            />
          </FormField>

          <FormField label={isJa ? "画像" : "Image"} variant="form">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
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
                  {draft.imageURL ? (isJa ? "画像を変更" : "Change Image") : (isJa ? "画像を添付" : "Attach Image")}
                </>
              )}
            </button>

            {uploadError && (
              <p className="mt-2 text-xs text-[var(--status-danger)]">{uploadError}</p>
            )}

            {draft.imageURL && (
              <div className="mt-3 group relative inline-block">
                <img
                  src={draft.imageURL}
                  alt="equipment"
                  className="h-16 w-16 rounded-[8px] object-cover border border-[var(--border)]"
                />
                <button
                  type="button"
                  onClick={() => set("imageURL", "")}
                  className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--status-danger)] text-white group-hover:flex"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                </button>
              </div>
            )}
          </FormField>

        </div>
      </form>
    </ModalShell>
  );
}
