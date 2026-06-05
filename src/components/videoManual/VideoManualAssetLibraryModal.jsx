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
  recycleItems,
  loading,
  recycleLoading,
  error,
  recycleError,
  uploading,
  uploadProgress,
  canPermanentlyDelete,
  onClose,
  onRefresh,
  onSilentRefresh,
  onLoadRecycleBin,
  onUpload,
  onUseAsset,
  onPreviewDelete,
  onSoftDelete,
  onRestoreAssets,
  onPermanentDelete,
}) {
  const fileInputRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);

  const normalizedType = normalizePlaylistAssetType(type);
  const libraryItems = (Array.isArray(items) ? items : []).filter((asset) => normalizePlaylistAssetType(asset?.type, asset?.mimeType) === normalizedType);
  const recycleBinItems = (Array.isArray(recycleItems) ? recycleItems : []).filter((asset) => normalizePlaylistAssetType(asset?.type, asset?.mimeType) === normalizedType);
  const displayedItems = showRecycleBin ? recycleBinItems : libraryItems;

  useEffect(() => {
    if (!open) return;
    setEditMode(false);
    setShowRecycleBin(false);
    setSelectedAssetIds([]);
    setActionBusy(false);
  }, [open, type]);

  useEffect(() => {
    if (!editMode) setSelectedAssetIds([]);
  }, [editMode, showRecycleBin]);

  // Set up polling if any filtered items are still processing.
  useEffect(() => {
    if (!open || showRecycleBin) return;
    const hasProcessing = (Array.isArray(items) ? items : []).some(
      (asset) => getPreviewStatus(asset) === "processing"
    );
    if (!hasProcessing) return;

    const intervalId = setInterval(() => {
      onSilentRefresh?.();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [open, items, onSilentRefresh, showRecycleBin]);

  useEffect(() => {
    if (!open || !showRecycleBin) return;
    onLoadRecycleBin?.();
  }, [onLoadRecycleBin, open, showRecycleBin]);

  if (!open) return null;

  const title = getAssetLibraryTypeLabel(normalizedType);

  const listLoading = showRecycleBin ? recycleLoading : loading;
  const listError = showRecycleBin ? recycleError : error;

  const selectedSet = new Set(selectedAssetIds);
  const selectedAssets = displayedItems.filter((asset) => selectedSet.has(getAssetId(asset)));

  const toggleAssetSelection = (asset) => {
    const assetId = getAssetId(asset);
    if (!assetId) return;
    setSelectedAssetIds((current) => (
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    ));
  };

  const toggleSelectAll = () => {
    if (selectedAssets.length === displayedItems.length) {
      setSelectedAssetIds([]);
      return;
    }
    setSelectedAssetIds(displayedItems.map((asset) => getAssetId(asset)).filter(Boolean));
  };

  const handleDeleteSelected = async () => {
    if (!selectedAssets.length || !onPreviewDelete || !onSoftDelete) return;

    setActionBusy(true);
    try {
      const preview = await onPreviewDelete(selectedAssets.map((asset) => getAssetId(asset)));
      const previewAssets = Array.isArray(preview?.assets) ? preview.assets : [];
      const usedAssets = previewAssets.filter((asset) => Number(asset?.usageCount || 0) > 0);
      const warningLines = usedAssets.map((asset) => {
        const projectNames = Array.isArray(asset?.usageProjects)
          ? asset.usageProjects.map((project) => project?.title).filter(Boolean)
          : [];
        const usageLabel = projectNames.length ? projectNames.join(", ") : `${asset?.usageCount || 0} project(s)`;
        return `- ${asset?.name || asset?.fileName || "Untitled Asset"}: ${usageLabel}`;
      });

      const confirmMessage = [
        `Move ${selectedAssets.length} selected ${title.toLowerCase()} to recycle bin?`,
        "",
        "Assets in recycle bin are auto-purged after 60 days.",
        warningLines.length ? "" : null,
        warningLines.length ? "Warning: these assets are currently used:" : null,
        ...(warningLines.length ? warningLines : []),
      ].filter(Boolean).join("\n");

      if (!window.confirm(confirmMessage)) return;
      await onSoftDelete(selectedAssets.map((asset) => getAssetId(asset)));
      setSelectedAssetIds([]);
    } catch {
      // Parent callbacks surface notices.
    } finally {
      setActionBusy(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (!selectedAssets.length || !onRestoreAssets) return;

    if (!window.confirm(`Restore ${selectedAssets.length} selected ${title.toLowerCase()} from recycle bin?`)) return;
    setActionBusy(true);
    try {
      await onRestoreAssets(selectedAssets.map((asset) => getAssetId(asset)));
      setSelectedAssetIds([]);
    } catch {
      // Parent callbacks surface notices.
    } finally {
      setActionBusy(false);
    }
  };

  const handlePermanentDeleteSelected = async () => {
    if (!selectedAssets.length || !onPermanentDelete || !canPermanentlyDelete) return;

    const confirmed = window.confirm(
      `Permanently delete ${selectedAssets.length} selected ${title.toLowerCase()} from recycle bin? This also deletes files from Firebase Storage and cannot be undone.`
    );
    if (!confirmed) return;

    setActionBusy(true);
    try {
      await onPermanentDelete(selectedAssets.map((asset) => getAssetId(asset)));
      setSelectedAssetIds([]);
    } catch {
      // Parent callbacks surface notices.
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[340] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_120px_-40px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Playlist Media Library</p>
            <h3 className="mt-1 truncate text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{uploading ? `Uploading ${uploadProgress ?? 0}%` : (showRecycleBin ? "Recycle bin keeps deleted assets for 60 days." : "Browse uploaded files for this playlist.")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRecycleBin((current) => !current)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${showRecycleBin ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
              title="Recycle Bin"
            >
              <Icon className="text-[18px]">delete</Icon>
              {showRecycleBin ? "Library" : "Recycle Bin"}
            </button>
            <button
              type="button"
              onClick={() => setEditMode((current) => !current)}
              disabled={listLoading || actionBusy}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${editMode ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"} disabled:cursor-not-allowed disabled:opacity-50`}
              title="Edit"
            >
              <Icon className="text-[18px]">edit</Icon>
              {editMode ? "Done" : "Edit"}
            </button>
            <button
              type="button"
              onClick={showRecycleBin ? onLoadRecycleBin : onRefresh}
              disabled={listLoading || uploading || actionBusy}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Refresh"
            >
              <Icon className={listLoading ? "animate-spin text-[20px]" : "text-[20px]"}>refresh</Icon>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || showRecycleBin}
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

        {editMode ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={!displayedItems.length || listLoading || actionBusy}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {selectedAssets.length === displayedItems.length && displayedItems.length ? "Unselect All" : "Select All"}
            </button>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{selectedAssets.length} selected</span>

            {!showRecycleBin ? (
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={!selectedAssets.length || actionBusy || listLoading}
                className="ml-auto rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Move To Recycle Bin
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleRestoreSelected}
                  disabled={!selectedAssets.length || actionBusy || listLoading}
                  className="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={handlePermanentDeleteSelected}
                  disabled={!selectedAssets.length || actionBusy || listLoading || !canPermanentlyDelete}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Permanently Delete
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto bg-slate-50 px-6 py-6 md:grid-cols-2 xl:grid-cols-3 dark:bg-slate-900/40">
          {listLoading ? (
            <p className="col-span-full py-12 text-center text-sm font-bold text-slate-400">Loading playlist library...</p>
          ) : null}

          {!listLoading && listError ? (
            <p className="col-span-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{listError}</p>
          ) : null}

          {!listLoading && !listError && displayedItems.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-base font-black text-slate-700 dark:text-slate-200">{showRecycleBin ? `No ${title.toLowerCase()} in recycle bin.` : `No ${title.toLowerCase()} in this playlist yet.`}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{showRecycleBin ? "Deleted assets appear here for up to 60 days." : "Upload a file to add it to this project."}</p>
            </div>
          ) : null}

          {!listLoading && !listError ? displayedItems.map((asset) => {
            const assetType = normalizePlaylistAssetType(asset?.type, asset?.mimeType);
            const assetId = getAssetId(asset);
            const name = asset?.name || asset?.fileName || "Untitled Asset";
            const previewStatus = getPreviewStatus(asset);
            const uploadedAt = asset?.uploadedAt ? new Date(asset.uploadedAt).toLocaleDateString() : "";
            const sizeLabel = formatFileSize(asset?.size);
            const metaLabel = [uploadedAt, sizeLabel].filter(Boolean).join(" | ");
            const usageProjects = Array.isArray(asset?.usageProjects) ? asset.usageProjects.map((project) => project?.title).filter(Boolean) : [];
            const recycleDaysRemaining = Number.isFinite(Number(asset?.daysRemaining)) ? Number(asset.daysRemaining) : null;
            const previewLabel = assetType === "video"
              ? previewStatus === "processing"
                ? "Preview processing"
                : previewStatus === "failed"
                  ? "Preview failed"
                  : asset?.previewUrl
                    ? "Hover preview ready"
                    : "Preview unavailable"
              : getAssetUsageLabel(asset);

            const isSelected = selectedSet.has(assetId);

            return (
              <article key={assetId || name} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-slate-950 ${isSelected ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-slate-200 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:hover:border-cyan-500"}`}>
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-900">
                  {editMode ? (
                    <button
                      type="button"
                      onClick={() => toggleAssetSelection(asset)}
                      className={`absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border text-white ${isSelected ? "border-cyan-500 bg-cyan-500" : "border-white/70 bg-black/35"}`}
                    >
                      {isSelected ? <Icon className="text-[15px]">check</Icon> : null}
                    </button>
                  ) : null}
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
                    {usageProjects.length ? (
                      <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">Used in: {usageProjects.join(", ")}</p>
                    ) : null}
                    {showRecycleBin && recycleDaysRemaining != null ? (
                      <p className="mt-1 text-[11px] font-semibold text-red-500 dark:text-red-300">Auto-delete in {recycleDaysRemaining} day{recycleDaysRemaining === 1 ? "" : "s"}</p>
                    ) : null}
                    {assetType === "video" && previewStatus === "failed" && asset?.processingError ? (
                      <p className="mt-2 text-[11px] font-semibold text-red-500 dark:text-red-300">{asset.processingError}</p>
                    ) : null}
                  </div>
                  {!editMode && !showRecycleBin ? (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => onUseAsset(asset)} className="rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-white transition hover:bg-cyan-600">
                        Use {getAssetLibraryItemLabel(assetType)}
                      </button>
                    </div>
                  ) : null}
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