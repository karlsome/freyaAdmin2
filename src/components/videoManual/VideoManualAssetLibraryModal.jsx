import { useEffect, useRef, useState } from "react";
import {
  formatFileSize,
  getAssetLibraryAccept,
  getAssetLibraryItemLabel,
  getAssetLibraryTypeLabel,
  getAssetUsageLabel,
  normalizePlaylistAssetType,
} from "./videoManualEditorUtils";

function Icon({ children, className = "text-[20px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function getAssetId(asset) {
  return String(asset?.assetId || asset?._id || "");
}

function getDisplayImageUrl(asset) {
  return asset?.thumbnailUrl || asset?.thumbnailPreviewUrl || "";
}

function getHoverPreviewUrl(asset) {
  return asset?.previewUrl || "";
}

function getPreviewStatus(asset) {
  return String(asset?.processingStatus || "").trim().toLowerCase();
}

function AssetPreview({ asset }) {
  const type = normalizePlaylistAssetType(asset?.type, asset?.mimeType);
  const imageUrl = getDisplayImageUrl(asset);
  const hoverPreviewUrl = getHoverPreviewUrl(asset);
  const previewStatus = getPreviewStatus(asset);
  const label = asset?.name || asset?.fileName || "Asset";
  const videoRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);

  if (type === "image") {
    return <img src={asset?.previewUrl || asset?.originalUrl || asset?.downloadUrl || asset?.url || ""} alt={label} className="h-full w-full object-cover" />;
  }

  if (type === "video") {
    const startPreviewPlayback = () => {
      if (!hoverPreviewUrl) return;
      setIsHovering(true);
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    const stopPreviewPlayback = () => {
      setIsHovering(false);
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = 0;
    };

    return (
      <div className="relative h-full w-full" onMouseEnter={startPreviewPlayback} onMouseLeave={stopPreviewPlayback}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className={`h-full w-full object-cover transition-opacity duration-150 ${isHovering && hoverPreviewUrl ? "opacity-0" : "opacity-100"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <Icon className="text-[44px]">video_library</Icon>
          </div>
        )}
        {hoverPreviewUrl ? (
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${isHovering ? "opacity-100" : "opacity-0"}`}
            muted
            playsInline
            preload="none"
            src={hoverPreviewUrl}
          />
        ) : null}
        {previewStatus === "processing" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/38 px-4 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white">
            Processing Preview
          </div>
        ) : null}
        {previewStatus === "failed" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/45 px-4 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white">
            Preview Failed
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
      <Icon className="text-[44px]">audio_file</Icon>
    </div>
  );
}

export default function VideoManualAssetLibraryModal({
  open,
  type,
  items,
  loading,
  error,
  uploading,
  uploadProgress,
  onClose,
  onRefresh,
  onSilentRefresh,
  onUpload,
  onUseAsset,
}) {
  const fileInputRef = useRef(null);
  
  // Set up polling if any filtered items are still processing
  useEffect(() => {
    if (!open) return;
    const hasProcessing = (Array.isArray(items) ? items : []).some(
      (asset) => getPreviewStatus(asset) === "processing"
    );
    if (!hasProcessing) return;

    const intervalId = setInterval(() => {
      onSilentRefresh?.();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [open, items, onSilentRefresh]);

  if (!open) return null;

  const normalizedType = normalizePlaylistAssetType(type);
  const filteredItems = (Array.isArray(items) ? items : []).filter((asset) => normalizePlaylistAssetType(asset?.type, asset?.mimeType) === normalizedType);
  const title = getAssetLibraryTypeLabel(normalizedType);

  return (
    <div className="fixed inset-0 z-[340] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_120px_-40px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Playlist Media Library</p>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{uploading ? `Uploading ${uploadProgress ?? 0}%` : "Browse uploaded files for this playlist."}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading || uploading}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Refresh"
            >
              <Icon className={loading ? "animate-spin text-[20px]" : "text-[20px]"}>refresh</Icon>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-black text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon className="text-[18px]">upload</Icon>
              Upload
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Close"
            >
              <Icon>close</Icon>
            </button>
          </div>
        </div>

        {uploading ? (
          <div className="h-1 bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-cyan-500 transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, uploadProgress ?? 0))}%` }} />
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto bg-slate-50 px-6 py-6 md:grid-cols-2 xl:grid-cols-3 dark:bg-slate-900/40">
          {loading ? (
            <p className="col-span-full py-12 text-center text-sm font-bold text-slate-400">Loading playlist library...</p>
          ) : null}

          {!loading && error ? (
            <p className="col-span-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>
          ) : null}

          {!loading && !error && filteredItems.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-base font-black text-slate-700 dark:text-slate-200">No {title.toLowerCase()} in this playlist yet.</p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Upload a file to add it to this project.</p>
            </div>
          ) : null}

          {!loading && !error ? filteredItems.map((asset) => {
            const assetType = normalizePlaylistAssetType(asset?.type, asset?.mimeType);
            const assetId = getAssetId(asset);
            const name = asset?.name || asset?.fileName || "Untitled Asset";
            const previewStatus = getPreviewStatus(asset);
            const uploadedAt = asset?.uploadedAt ? new Date(asset.uploadedAt).toLocaleDateString() : "";
            const sizeLabel = formatFileSize(asset?.size);
            const metaLabel = [uploadedAt, sizeLabel].filter(Boolean).join(" | ");
            const previewLabel = assetType === "video"
              ? previewStatus === "processing"
                ? "Preview processing"
                : previewStatus === "failed"
                  ? "Preview failed"
                  : asset?.previewUrl
                    ? "Hover preview ready"
                    : "Preview unavailable"
              : getAssetUsageLabel(asset);

            return (
              <article key={assetId || name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-500">
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900">
                  <AssetPreview asset={asset} />
                  {assetType === "video" ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                      <span className="truncate mr-2">{previewStatus === "processing" ? "Processing" : previewStatus === "failed" ? "Unavailable" : asset?.previewUrl ? name : "No Preview"}</span>
                      <Icon className="text-[16px] shrink-0">play_arrow</Icon>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-black text-slate-800 dark:text-white">{name}</p>
                      <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200">{getAssetLibraryTypeLabel(assetType)}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{metaLabel || "Shared playlist asset"}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{previewLabel}</p>
                    {assetType === "video" && previewStatus === "failed" && asset?.processingError ? (
                      <p className="mt-2 text-[11px] font-semibold text-red-500 dark:text-red-300">{asset.processingError}</p>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => onUseAsset(asset)} className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-white transition hover:bg-cyan-600">
                      Use {getAssetLibraryItemLabel(assetType)}
                    </button>
                  </div>
                </div>
              </article>
            );
          }) : null}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={getAssetLibraryAccept(normalizedType)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}