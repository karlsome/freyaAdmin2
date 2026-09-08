import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export default function DeviceNamingModal({
  open,
  deviceId,
  factoryName,
  initialName = "",
  initialImageURLs = [],
  initialOffset = 0,
  saving,
  onClose,
  onSave,
  onUploadImage,
  onDeleteImage,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const fileInputRef = useRef(null);
  const [name, setName] = useState(initialName);
  const [offset, setOffset] = useState(initialOffset);
  const [imageURLs, setImageURLs] = useState(initialImageURLs);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setOffset(initialOffset);
      setImageURLs(initialImageURLs);
      setUploadError("");
      setUploadingCount(0);
    }
  }, [open, initialName, initialOffset, initialImageURLs]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isUploading = uploadingCount > 0;

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";

    setUploadError("");
    setUploadingCount((c) => c + files.length);

    const results = await Promise.allSettled(
      files.map(async (file) => {
        const base64 = await toBase64(file);
        return onUploadImage({ base64, deviceId, factoryName });
      })
    );

    setUploadingCount((c) => c - files.length);

    const newURLs = [];
    const errors = [];
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value?.imageURL) {
        newURLs.push(r.value.imageURL);
      } else if (r.status === "rejected") {
        errors.push(r.reason?.message || (isJa ? "アップロードに失敗しました" : "Upload failed"));
      }
    });

    if (newURLs.length) setImageURLs((prev) => [...prev, ...newURLs]);
    if (errors.length) setUploadError(errors[0]);
  }

  async function handleDeleteImage(url) {
    setImageURLs((prev) => prev.filter((u) => u !== url));
    try {
      await onDeleteImage({ deviceId, factoryName, imageUrl: url });
    } catch {
      // silently ignore — URL is already removed from local state
    }
  }

  function handleSave() {
    onSave({ name: name.trim(), imageURLs, offset: Number(offset) });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="freya-card rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {isJa ? "IoTデバイス" : "IoT Device"}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">
              {isJa ? "デバイス設定の変更" : "Rename Device"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-3.5">

          {/* Device ID (read-only) */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>sensors</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                {isJa ? "デバイスID" : "Device ID"}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-xs text-[var(--text-secondary)]">{deviceId}</p>
          </div>

          {/* Factory (read-only) */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>factory</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                {isJa ? "工場" : "Factory"}
              </span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{factoryName}</p>
          </div>

          {/* Friendly name input */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] mb-2">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>edit</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                {isJa ? "表示名" : "Display Name"}
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isJa ? "例: 倉庫センサーA" : "e.g. Warehouse Sensor A"}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              {isJa
                ? "この工場内のすべてのセンサー画面で、デバイスIDの代わりにこの表示名が使用されます。"
                : "This name will replace the device ID in all sensor views for this factory."}
            </p>
          </div>

          {/* Temperature Offset input */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)] mb-2">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>thermostat</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                {isJa ? "温度補正値 (°C)" : "Temperature Offset (°C)"}
              </span>
            </div>
            <input
              type="number"
              step="0.1"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              placeholder={isJa ? "例: 5 または -2" : "e.g. 5 or -2"}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              {isJa
                ? "画面上で元の温度計測値にこの補正値が加算されます。"
                : "This value will be added to the raw temperature reading in the frontend."}
            </p>
          </div>

          {/* Device photos */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>photo_library</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">
                  {isJa ? "デバイス写真" : "Device Photos"}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {imageURLs.length} {isJa ? "枚" : `photo${imageURLs.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {uploadError && (
              <div className="rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 flex gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[var(--status-danger)] flex-shrink-0" style={{ fontSize: 18 }}>report</span>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">
                    {isJa ? "アップロード失敗" : "Upload failed"}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{uploadError}</p>
                </div>
              </div>
            )}

            {imageURLs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
                {imageURLs.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative rounded-[6px] overflow-hidden border border-[var(--border)] aspect-square bg-[var(--surface-subtle)] group"
                  >
                    <img
                      src={url}
                      alt={isJa ? `デバイス写真 ${idx + 1}` : `Device photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(url)}
                      className="absolute top-1 right-1 p-1 rounded-[4px] bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-[var(--status-danger)]"
                      title={isJa ? "写真を削除" : "Remove photo"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-0.5">
                      <p className="text-[10px] text-white/90">
                        {isJa ? `写真 ${idx + 1}` : `Photo ${idx + 1}`}
                      </p>
                    </div>
                  </div>
                ))}

                {isUploading && Array.from({ length: uploadingCount }).map((_, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="rounded-[6px] border border-[var(--border)] aspect-square bg-[var(--surface-subtle)] flex items-center justify-center animate-pulse"
                  >
                    <span className="material-symbols-outlined text-[var(--text-muted)] animate-spin" style={{ fontSize: 22 }}>progress_activity</span>
                  </div>
                ))}
              </div>
            )}

            {imageURLs.length === 0 && !isUploading && (
              <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] flex flex-col items-center justify-center gap-1.5 py-6 mb-3">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 28 }}>add_photo_alternate</span>
                <p className="text-xs text-[var(--text-muted)]">
                  {isJa ? "写真がまだありません。設置場所の写真を追加してください。" : "No photos yet. Add photos of the device location."}
                </p>
              </div>
            )}

            {isUploading && imageURLs.length === 0 && (
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] flex flex-col items-center justify-center gap-2 py-6 mb-3">
                <span className="material-symbols-outlined text-[var(--freya-blue)] animate-spin" style={{ fontSize: 28 }}>progress_activity</span>
                <p className="text-xs text-[var(--text-muted)]">
                  {isJa ? `${uploadingCount}枚の写真をアップロード中…` : `Uploading ${uploadingCount} photo${uploadingCount !== 1 ? "s" : ""}…`}
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_photo_alternate</span>
              {isUploading
                ? (isJa ? `${uploadingCount}枚の写真をアップロード中…` : `Uploading ${uploadingCount} photo${uploadingCount !== 1 ? "s" : ""}…`)
                : (isJa ? "写真を追加" : "Add Photos")}
            </button>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="border-t border-[var(--border)] px-6 py-3.5 bg-[var(--surface-raised)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isUploading}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (isJa ? "保存中…" : "Saving…") : (isJa ? "変更を保存" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
