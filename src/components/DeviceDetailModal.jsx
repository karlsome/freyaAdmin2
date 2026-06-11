import { useMemo, useState } from "react";
import ModalShell from "./ModalShell";
import SensorDevicePhotoPreviewModal from "./SensorDevicePhotoPreviewModal";

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
    eyebrow: "Device Photos",
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
        eyebrow="Device"
        title={deviceName}
        subtitle={`${factoryName} • ${deviceId}`}
        maxWidth="max-w-3xl"
        cardClassName="max-h-[92vh]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Identity */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-3">Identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>badge</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Name</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{deviceName}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>tag</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Device ID</span>
                </div>
                <p className="mt-2 font-mono text-xs text-on-surface-variant break-all">{deviceId}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>factory</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Factory</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{factoryName}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>image</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Photos</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {images.length} {images.length === 1 ? "photo" : "photos"}
                </p>
              </div>
            </div>
          </div>

          {/* Registration */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-3">Registration</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Registered By</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{registeredByName}</p>
                {usernameLabel ? (
                  <p className="text-[11px] text-outline">{usernameLabel}</p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>schedule</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Created</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{formatDateTime(device?.createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>update</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Updated</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{formatDateTime(device?.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Photos</p>
              <span className="text-[10px] text-outline">
                {images.length} {images.length === 1 ? "image" : "images"}
              </span>
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPreviewIndex(index)}
                    className="aspect-square rounded-xl overflow-hidden border border-separator/40 bg-surface-container transition-all duration-150 hover:border-primary/30 active:scale-95"
                    title={`Open photo ${index + 1}`}
                  >
                    <img
                      src={url}
                      alt={`${deviceName} photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-outline">No photos uploaded for this device.</p>
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
