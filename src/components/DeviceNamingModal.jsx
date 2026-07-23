import { useEffect, useRef, useState } from "react";

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
        errors.push(r.reason?.message || "Upload failed");
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 rounded-t-2xl px-6 py-5 flex items-center justify-between border-b border-separator/40 bg-surface/90 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">IoT Device</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">Rename Device</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Device ID (read-only) */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>sensors</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Device ID</span>
            </div>
            <p className="mt-2 font-mono text-xs text-on-surface-variant">{deviceId}</p>
          </div>

          {/* Factory (read-only) */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>factory</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Factory</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-on-surface">{factoryName}</p>
          </div>

          {/* Friendly name input */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
            <div className="flex items-center gap-2 text-outline mb-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>edit</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Display Name</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse Sensor A"
              className="w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm font-semibold text-on-surface placeholder:text-outline/50 outline-none transition-all duration-150 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
            <p className="text-[11px] text-outline mt-2">
              This name will replace the device ID in all sensor views for this factory.
            </p>
          </div>

          {/* Temperature Offset input */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
            <div className="flex items-center gap-2 text-outline mb-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>thermostat</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Temperature Offset (°C)</span>
            </div>
            <input
              type="number"
              step="0.1"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              placeholder="e.g. 5 or -2"
              className="w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm font-semibold text-on-surface placeholder:text-outline/50 outline-none transition-all duration-150 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
            <p className="text-[11px] text-outline mt-2">
              This value will be added to the raw temperature reading in the frontend.
            </p>
          </div>

          {/* Device photos */}
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-outline">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>photo_library</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Device Photos</span>
              </div>
              <span className="text-[10px] text-outline">{imageURLs.length} photo{imageURLs.length !== 1 ? "s" : ""}</span>
            </div>

            {uploadError && (
              <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3 mb-3">
                <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Upload failed</p>
                  <p className="text-xs text-on-surface-variant mt-1">{uploadError}</p>
                </div>
              </div>
            )}

            {imageURLs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {imageURLs.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative rounded-xl overflow-hidden border border-separator/40 aspect-square bg-surface-container group"
                  >
                    <img
                      src={url}
                      alt={`Device photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(url)}
                      className="absolute top-1 right-1 p-1 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-error/80"
                      title="Remove photo"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <p className="text-[10px] text-white/80">Photo {idx + 1}</p>
                    </div>
                  </div>
                ))}

                {isUploading && Array.from({ length: uploadingCount }).map((_, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="rounded-xl border border-separator/40 aspect-square bg-surface-container flex items-center justify-center animate-pulse"
                  >
                    <span className="material-symbols-outlined text-outline animate-spin" style={{ fontSize: 24 }}>progress_activity</span>
                  </div>
                ))}
              </div>
            )}

            {imageURLs.length === 0 && !isUploading && (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container/50 flex flex-col items-center justify-center gap-2 py-6 mb-3">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: 32 }}>add_photo_alternate</span>
                <p className="text-xs text-outline">No photos yet. Add photos of the device location.</p>
              </div>
            )}

            {isUploading && imageURLs.length === 0 && (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container/50 flex flex-col items-center justify-center gap-2 py-6 mb-3">
                <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
                <p className="text-xs text-outline">Uploading {uploadingCount} photo{uploadingCount !== 1 ? "s" : ""}…</p>
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
              className="inline-flex items-center gap-2 rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/30 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_photo_alternate</span>
              {isUploading ? `Uploading ${uploadingCount} photo${uploadingCount !== 1 ? "s" : ""}…` : "Add Photos"}
            </button>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="border-t border-outline-variant/20 px-6 py-4 bg-surface-container-low/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/30 active:scale-95 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isUploading}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
