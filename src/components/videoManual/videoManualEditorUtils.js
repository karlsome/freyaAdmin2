export function normalizePlaylistAssetType(type, mimeType = "") {
  if (["image", "video", "audio"].includes(type)) return type;
  if (typeof mimeType === "string" && mimeType.startsWith("image/")) return "image";
  if (typeof mimeType === "string" && mimeType.startsWith("audio/")) return "audio";
  return "video";
}

export function getAssetLibraryTypeLabel(type) {
  const labels = {
    image: "Photos",
    video: "Videos",
    audio: "Audio",
  };

  return labels[normalizePlaylistAssetType(type)] || "Media";
}

export function getAssetLibraryItemLabel(type) {
  switch (normalizePlaylistAssetType(type)) {
    case "image":
      return "Photo";
    case "audio":
      return "Audio";
    default:
      return "Video";
  }
}

export function getAssetLibraryAccept(type) {
  const normalizedType = normalizePlaylistAssetType(type);
  if (normalizedType === "image") return "image/*";
  if (normalizedType === "audio") return "audio/*";
  return "video/*";
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function getAssetUsageLabel(asset) {
  const usageCount = Math.max(0, Number(asset?.usageCount) || 0);
  if (!usageCount) return "Playlist library";
  return usageCount === 1 ? "Used by 1 project" : `Used by ${usageCount} projects`;
}

export const DEFAULT_VIDEO_MANUAL_TEMPLATE = {
  timeline: {
    background: "#ffffff",
    tracks: [],
  },
  output: {
    format: "mp4",
    fps: 30,
    size: { width: 1920, height: 1080 },
  },
};

export const SHAPE_DIMENSIONS = {
  rect: { width: 220, height: 120 },
  circle: { width: 180, height: 180 },
  arrow: { width: 240, height: 140 },
  line: { width: 240, height: 120 },
};

export function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function getOutputSize(editData) {
  return editData?.output?.size || DEFAULT_VIDEO_MANUAL_TEMPLATE.output.size;
}

export function getOutputFps(editData) {
  return editData?.output?.fps || DEFAULT_VIDEO_MANUAL_TEMPLATE.output.fps;
}

export function getClipCategory(clip) {
  const assetType = clip?.asset?.type;
  if (["rich-text", "text", "title", "caption", "rich-caption"].includes(assetType)) return "text";
  if (["svg", "shape"].includes(assetType)) return "shapes";
  if (["video", "image", "audio"].includes(assetType)) return "media";
  return null;
}

export function normalizeHexColor(color) {
  if (typeof color !== "string") return "";
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((part) => part + part).join("")}`;
  }
  return "";
}

export function extractShapeStyle(svgSource) {
  if (typeof svgSource !== "string") return {};

  const readAttr = (name) => {
    const match = svgSource.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
    return match?.[1] || "";
  };

  const strokeWidth = Number(readAttr("stroke-width"));
  return {
    shapeType: readAttr("data-vmfa-shape") || readAttr("data-vmss-shape") || "rect",
    fill: normalizeHexColor(readAttr("fill")) || "#fecaca",
    stroke: normalizeHexColor(readAttr("stroke")) || "#ef4444",
    strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 3,
  };
}

export function createShapeSvg(shapeType, width, height, options = {}) {
  const fill = options.fill || "#fecaca";
  const stroke = options.stroke || "#ef4444";
  const safeStrokeWidth = Math.max(2, Number(options.strokeWidth) || 3);
  const strokePadding = safeStrokeWidth + 14;

  if (shapeType === "rect") {
    const inset = strokePadding;
    return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="rect" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${inset}" y="${inset}" width="${Math.max(1, width - inset * 2)}" height="${Math.max(1, height - inset * 2)}" rx="12" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${safeStrokeWidth}"/></svg>`;
  }

  if (shapeType === "circle") {
    const radiusX = Math.max(8, width / 2 - strokePadding);
    const radiusY = Math.max(8, height / 2 - strokePadding);
    const centerX = width / 2;
    const centerY = height / 2;
    const ovalPath = [
      `M ${centerX - radiusX} ${centerY}`,
      `A ${radiusX} ${radiusY} 0 1 0 ${centerX + radiusX} ${centerY}`,
      `A ${radiusX} ${radiusY} 0 1 0 ${centerX - radiusX} ${centerY}`,
    ].join(" ");
    return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="circle" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${ovalPath}" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${safeStrokeWidth}"/></svg>`;
  }

  if (shapeType === "arrow") {
    const margin = strokePadding + 6;
    const leftX = margin;
    const rightX = width - margin;
    const centerY = height / 2;
    const usableHeight = Math.max(18, height - margin * 2);
    const headLength = Math.max(18, Math.min(width * 0.28, usableHeight * 1.1));
    const shaftHalf = Math.max(4, usableHeight * 0.16);
    const bodyRight = Math.max(leftX + 12, rightX - headLength);
    const topY = centerY - usableHeight / 2;
    const bottomY = centerY + usableHeight / 2;
    const arrowPath = [
      `M ${leftX} ${centerY - shaftHalf}`,
      `L ${bodyRight} ${centerY - shaftHalf}`,
      `L ${bodyRight} ${topY}`,
      `L ${rightX} ${centerY}`,
      `L ${bodyRight} ${bottomY}`,
      `L ${bodyRight} ${centerY + shaftHalf}`,
      `L ${leftX} ${centerY + shaftHalf}`,
      "Z",
    ].join(" ");
    return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="arrow" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${arrowPath}" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${safeStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  const margin = strokePadding + 8;
  const centerY = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="line" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="${margin}" y1="${centerY}" x2="${width - margin}" y2="${centerY}" stroke="${stroke}" stroke-width="${safeStrokeWidth}" stroke-linecap="butt"/></svg>`;
}

export function measureImageClipSize(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 600;
      const scale = image.width > maxWidth ? maxWidth / image.width : 1;
      resolve({
        width: Math.round(image.width * scale),
        height: Math.round(image.height * scale),
      });
    };
    image.onerror = () => resolve({ width: 400, height: 300 });
    image.src = url;
  });
}

export function normalizePlayableMediaSource(sourceUrl, apiBaseUrl) {
  if (typeof sourceUrl !== "string" || !sourceUrl.trim()) return null;
  if (sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:")) {
    return { previewUrl: sourceUrl, publicUrl: sourceUrl };
  }

  try {
    const parsed = new URL(sourceUrl, window.location.href);
    if (parsed.pathname.includes("/api/video-manuals/stream/") || parsed.pathname.includes("/api/video-manual-media/")) {
      return { previewUrl: parsed.toString(), publicUrl: parsed.toString() };
    }

    if (parsed.pathname.endsWith("/api/video-manual-media")) {
      const upstreamUrl = parsed.searchParams.get("url");
      if (upstreamUrl) return normalizePlayableMediaSource(upstreamUrl, apiBaseUrl);
      return { previewUrl: parsed.toString(), publicUrl: parsed.toString() };
    }

    const needsProxy = parsed.hostname === "firebasestorage.googleapis.com"
      || parsed.hostname === "storage.googleapis.com"
      || parsed.hostname.endsWith(".amazonaws.com");
    if (!needsProxy) return { previewUrl: parsed.toString(), publicUrl: parsed.toString() };

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const rawFileName = pathSegments[pathSegments.length - 1] || "asset";
    const safeFileName = encodeURIComponent(rawFileName.includes(".") ? rawFileName : `${rawFileName}.bin`);
    return {
      previewUrl: `${apiBaseUrl}/api/video-manual-media/${safeFileName}?url=${encodeURIComponent(parsed.toString())}`,
      publicUrl: parsed.toString(),
    };
  } catch {
    return { previewUrl: sourceUrl, publicUrl: sourceUrl };
  }
}

export function decorateAssetForPreview(asset, apiBaseUrl) {
  const downloadUrl = asset?.downloadUrl || asset?.url || "";
  const normalized = normalizePlayableMediaSource(downloadUrl, apiBaseUrl);
  return {
    ...asset,
    previewUrl: normalized?.previewUrl || downloadUrl,
  };
}

export function buildUploadedAsset(file, result, forcedType) {
  return {
    assetId: result.assetId,
    name: file.name,
    fileName: result.fileName || file.name,
    mimeType: result.mimeType || file.type || "application/octet-stream",
    type: normalizePlaylistAssetType(forcedType || result.type, result.mimeType || file.type),
    storagePath: result.storagePath,
    downloadUrl: result.url,
    uploadedAt: result.uploadedAt || new Date().toISOString(),
    size: file.size,
  };
}

export function getTrackCount(edit) {
  try {
    return edit?.getEdit()?.timeline?.tracks?.length || 0;
  } catch {
    return 0;
  }
}

export function buildRevisionSnapshot(project, edit, assetSourceMap) {
  return {
    title: project?.title || "Untitled Project",
    description: project?.description || "",
    status: project?.status || "draft",
    edit,
    settings: project?.settings || {},
    schemaVersion: project?.schemaVersion || 2,
    assetSourceMap,
    savedAt: new Date().toISOString(),
  };
}