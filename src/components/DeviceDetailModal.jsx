import { useMemo, useState } from "react";
import ModalShell from "./ModalShell";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";
import { useLanguage } from "../contexts/LanguageContext";

function formatDateTime(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatRegisteredBy(device) {
  const first = String(device?.registeredBy?.firstName || "").trim();
  const last = String(device?.registeredBy?.lastName || "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || String(device?.username || "").trim() || "—";
}

export default function DeviceDetailModal({ device, open, onClose }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [previewIndex, setPreviewIndex] = useState(null);

  const images = useMemo(() => (
    Array.isArray(device?.imageURLs) ? device.imageURLs.filter(Boolean) : []
  ), [device]);

  const registeredByName = device ? formatRegisteredBy(device) : "—";
  const usernameLabel = device?.username ? `@${device.username}` : "";
  const factoryName = String(device?.factoryName || "—").trim() || "—";
  const deviceName = String(device?.name || "").trim() || String(device?.deviceId || "Unknown device");
  const deviceId = String(device?.deviceId || "—").trim() || "—";

  function handleClose() {
    setPreviewIndex(null);
    onClose?.();
  }

  function handleNavigatePreview(delta) {
    setPreviewIndex((current) => {
      if (current == null) return current;
      const next = current + delta;
      if (next < 0 || next >= images.length) return current;
      return next;
    });
  }

  const preview = previewIndex != null && images[previewIndex] ? {
    eyebrow: isJa ? "デバイス写真" : "Device Photos",
    images: images.map((url) => ({ url })),
    activeIndex: previewIndex,
    displayName: deviceName,
    deviceId,
    factoryName,
  } : null;

  return (
    <>
      <ModalShell
        open={open && Boolean(device)}
        onClose={handleClose}
        eyebrow={isJa ? "デバイス情報" : "Device"}
        title={deviceName}
        subtitle={`${factoryName} • ${deviceId}`}
        maxWidth="max-w-3xl"
        cardClassName="max-h-[92vh]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-3.5">
          {/* Identity */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-2.5">
              {isJa ? "基本情報" : "Identity"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>badge</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "名称" : "Name"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{deviceName}</p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>tag</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "デバイスID" : "Device ID"}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-[var(--text-secondary)] break-all">{deviceId}</p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>factory</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "工場" : "Factory"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{factoryName}</p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>image</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "写真" : "Photos"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)] font-mono">
                  {images.length} {isJa ? "枚" : (images.length === 1 ? "photo" : "photos")}
                </p>
              </div>
            </div>
          </div>

          {/* Registration */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-2.5">
              {isJa ? "登録情報" : "Registration"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>person</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "登録者" : "Registered By"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{registeredByName}</p>
                {usernameLabel ? (
                  <p className="text-[10px] text-[var(--text-muted)]">{usernameLabel}</p>
                ) : null}
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>schedule</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "登録日時" : "Created"}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-[var(--text-secondary)]">{formatDateTime(device?.createdAt)}</p>
              </div>
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>update</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    {isJa ? "更新日時" : "Updated"}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-[var(--text-secondary)]">{formatDateTime(device?.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                {isJa ? "写真" : "Photos"}
              </p>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {images.length} {isJa ? "枚" : (images.length === 1 ? "image" : "images")}
              </span>
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                    className="aspect-square rounded-[6px] overflow-hidden border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 hover:border-[var(--freya-blue)]/50 shadow-2xs"
                    title={isJa ? `写真 ${index + 1} を開く` : `Open photo ${index + 1}`}
                  >
                    <img
                      src={url}
                      alt={`${deviceName} ${isJa ? `写真 ${index + 1}` : `photo ${index + 1}`}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                {isJa ? "このデバイスの写真はありません。" : "No photos uploaded for this device."}
              </p>
            )}
          </div>
        </div>
      </ModalShell>

      <SensorDevicePhotoPreviewModal
        preview={preview}
        onClose={() => setPreviewIndex(null)}
        onNavigate={handleNavigatePreview}
      />
    </>
  );
}
