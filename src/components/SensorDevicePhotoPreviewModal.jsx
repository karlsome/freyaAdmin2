import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BASE_URL } from "../services/api";

function isVideoUrl(url) {
  return /\.(mp4|mov)$/i.test(url.split("?")[0]);
}

function isPdfUrl(url) {
  return /\.pdf$/i.test(url.split("?")[0]);
}

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
    if (fileName) {
      // Ensure file has extension
      if (fileName.includes(".")) return fileName;
      return `${fileName}.jpg`;
    }
  } catch {
    // Fall back to a generated file name when the URL cannot be parsed.
  }

  return `${safeLabel}.jpg`;
}

export default function SensorDevicePhotoPreviewModal({ preview, onClose, onNavigate }) {
  const [isDownloading, setIsDownloading] = useState(false);
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

  const handleDownload = async () => {
    if (!activeImage?.url || isDownloading) return;
    setIsDownloading(true);
    try {
      const filename = buildImageDownloadName(activeImage.url, activeImage.label || title);
      const proxyUrl = `${BASE_URL}api/download-proxy?url=${encodeURIComponent(activeImage.url)}&filename=${encodeURIComponent(filename)}`;

      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Proxy download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (error) {
      console.warn("Blob download failed, falling back to direct proxy anchor:", error);
      const filename = buildImageDownloadName(activeImage.url, activeImage.label || title);
      const proxyUrl = `${BASE_URL}api/download-proxy?url=${encodeURIComponent(activeImage.url)}&filename=${encodeURIComponent(filename)}`;
      const link = document.createElement("a");
      link.href = proxyUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Photos for ${title}`}
        onMouseDown={(event) => event.stopPropagation()}
        className="freya-card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-raised)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{eyebrow}</p>
            <h2 className="mt-0.5 truncate text-base font-semibold text-[var(--text-primary)]">{title}</h2>
            {subtitleParts.length > 0 ? (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitleParts.join(" • ")}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Close photo preview"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-3.5">
          <div className="relative overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)]">
            <div className="flex min-h-[52vh] items-center justify-center bg-[var(--surface-subtle)] px-4 py-4 w-full h-full overflow-hidden">
              {isVideoUrl(activeImage.url) ? (
                <video
                  src={activeImage.url}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full rounded-[8px] object-contain shadow-md"
                />
              ) : isPdfUrl(activeImage.url) ? (
                <iframe 
                  src={activeImage.url} 
                  className="w-full h-[70vh] rounded-[8px] shadow-md bg-white" 
                  title={activeImage.label || title || "PDF Preview"} 
                />
              ) : (
                <img
                  src={activeImage.url}
                  alt={activeImage.label || title}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              )}
            </div>

            {hasMultipleImages ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(-1)}
                  disabled={!canGoPrevious}
                  aria-label="Show previous image"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)]/90 p-1.5 text-[var(--text-primary)] shadow-xs transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate(1)}
                  disabled={!canGoNext}
                  aria-label="Show next image"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)]/90 p-1.5 text-[var(--text-primary)] shadow-xs transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
              </>
            ) : null}
          </div>

          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Current File</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{activeImage.label || `File ${activeIndex + 1}`}</p>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {hasMultipleImages
                  ? `Use the left and right arrow keys to browse all ${images.length} files.`
                  : "Press Escape to close this preview."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-raised)] px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-mono text-[var(--text-muted)]">
            {hasMultipleImages
              ? `File ${activeIndex + 1} of ${images.length}`
              : "Single file attached"}
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {hasMultipleImages ? (
              <button
                type="button"
                onClick={() => onNavigate(-1)}
                disabled={!canGoPrevious}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
            ) : null}

            {hasMultipleImages ? (
              <button
                type="button"
                onClick={() => onNavigate(1)}
                disabled={!canGoNext}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            ) : null}

            <a
              href={activeImage.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-2xs transition-colors"
            >
              Open File
            </a>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] shadow-xs transition-colors disabled:opacity-50"
            >
              {isDownloading && (
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>
                  progress_activity
                </span>
              )}
              <span>{isDownloading ? "Downloading…" : "Download File"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}