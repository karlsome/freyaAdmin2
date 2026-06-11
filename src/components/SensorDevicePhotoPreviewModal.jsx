import { useEffect } from "react";
import { createPortal } from "react-dom";

function clampPreviewIndex(index, total) {
  if (!total) return 0;
  const numericIndex = Number.isInteger(index) ? index : 0;
  return Math.min(Math.max(numericIndex, 0), total - 1);
}

function buildImageDownloadName(url, label) {
  const safeLabel = String(label ?? "device-photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "device-photo";

  try {
    const pathname = new URL(url).pathname;
    const fileName = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
    if (fileName) return fileName;
  } catch {
    // Fall back to a generated file name when the URL cannot be parsed.
  }

  return `${safeLabel}.jpg`;
}

export default function SensorDevicePhotoPreviewModal({ preview, onClose, onNavigate }) {
  const images = Array.isArray(preview?.images) ? preview.images.filter((image) => image?.url) : [];
  const activeIndex = clampPreviewIndex(preview?.activeIndex, images.length);
  const activeImage = images[activeIndex] || null;
  const hasMultipleImages = images.length > 1;
  const canGoPrevious = activeIndex > 0;
  const canGoNext = activeIndex < images.length - 1;
  const title = String(preview?.displayName ?? "").trim() || String(preview?.deviceId ?? "").trim() || "Photos";
  const eyebrow = String(preview?.eyebrow ?? "").trim() || "Photos";
  const customSubtitle = String(preview?.subtitle ?? "").trim();
  const subtitleParts = customSubtitle
    ? [customSubtitle, hasMultipleImages ? `Photo ${activeIndex + 1} of ${images.length}` : ""].filter(Boolean)
    : [
        preview?.displayName ? String(preview?.deviceId ?? "").trim() : "",
        String(preview?.factoryName ?? "").trim(),
        hasMultipleImages ? `Photo ${activeIndex + 1} of ${images.length}` : "",
      ].filter(Boolean);

  useEffect(() => {
    if (!activeImage?.url) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (!hasMultipleImages) return;

      if (event.key === "ArrowLeft" && canGoPrevious) {
        event.preventDefault();
        onNavigate(-1);
      } else if (event.key === "ArrowRight" && canGoNext) {
        event.preventDefault();
        onNavigate(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage?.url, canGoNext, canGoPrevious, hasMultipleImages, onClose, onNavigate]);

  if (!activeImage?.url) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photos for ${title}`}
        onMouseDown={(event) => event.stopPropagation()}
        className="dashboard-section flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-separator/40 bg-surface/90 px-6 py-5 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{eyebrow}</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-on-surface">{title}</h2>
            {subtitleParts.length > 0 ? (
              <p className="mt-1 text-sm text-on-surface-variant">{subtitleParts.join(" • ")}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-outline transition-all duration-150 hover:bg-surface-container hover:text-on-surface"
            aria-label="Close photo preview"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-separator/40 bg-surface-container">
            <div className="flex min-h-[52vh] items-center justify-center bg-surface-container px-4 py-4">
              <img
                src={activeImage.url}
                alt={activeImage.label || title}
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>

            {hasMultipleImages ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(-1)}
                  disabled={!canGoPrevious}
                  aria-label="Show previous image"
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-separator/40 bg-surface/90 p-2 text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate(1)}
                  disabled={!canGoNext}
                  aria-label="Show next image"
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-separator/40 bg-surface/90 p-2 text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
              </>
            ) : null}
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Current Photo</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{activeImage.label || `Photo ${activeIndex + 1}`}</p>
              </div>
              <p className="text-[11px] text-outline">
                {hasMultipleImages
                  ? `Use the left and right arrow keys to browse all ${images.length} photos.`
                  : "Press Escape to close this preview."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-low/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-outline">
            {hasMultipleImages
              ? `Photo ${activeIndex + 1} of ${images.length}`
              : "Single photo attached"}
          </p>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {hasMultipleImages ? (
              <button
                type="button"
                onClick={() => onNavigate(-1)}
                disabled={!canGoPrevious}
                className="rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
            ) : null}

            {hasMultipleImages ? (
              <button
                type="button"
                onClick={() => onNavigate(1)}
                disabled={!canGoNext}
                className="rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            ) : null}

            <a
              href={activeImage.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-separator/40 px-4 py-2 text-xs font-semibold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95"
            >
              Open Photo
            </a>

            <a
              href={activeImage.url}
              download={buildImageDownloadName(activeImage.url, activeImage.label)}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-all duration-150 hover:opacity-90 active:scale-95"
            >
              Download Photo
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}