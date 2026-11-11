import { cloneJson } from "./videoManualEditorUtils";

// Shared by the single-timeline editor and the step list page (deploy / export).
export function getRevisionId(revision) {
  return String(revision?._id?.$oid || revision?._id || revision?.revisionId || "");
}

export function getRevisionDisplayName(revision, t = (key) => key) {
  return revision?.revisionName || (revision?.revisionNumber ? t("Revision {n}", { n: revision.revisionNumber }) : t("revision"));
}

function getPublicRenderSource(sourceUrl, assetSourceMap = {}) {
  const mappedSrc = assetSourceMap[sourceUrl];
  if (mappedSrc && mappedSrc !== sourceUrl) return mappedSrc;

  try {
    const parsed = new URL(sourceUrl, window.location.href);
    if (parsed.pathname.includes("/api/video-manual-media/")) {
      const upstreamUrl = parsed.searchParams.get("url");
      if (upstreamUrl) return upstreamUrl;
    }
  } catch {
    return mappedSrc || sourceUrl;
  }

  return mappedSrc || sourceUrl;
}

export function prepareVideoManualEditForRender(editJson, assetSourceMap = {}) {
  const preparedEdit = cloneJson(editJson, null);
  if (!preparedEdit) throw new Error("Revision snapshot is missing edit data.");

  const unresolvedSources = [];
  (preparedEdit.timeline?.tracks || []).forEach((track) => {
    (track.clips || []).forEach((clip) => {
      if (!clip?.asset?.src || typeof clip.asset.src !== "string") return;

      const currentSrc = clip.asset.src;
      const mappedSrc = getPublicRenderSource(currentSrc, assetSourceMap);
      if (mappedSrc) {
        clip.asset.src = mappedSrc;
      }

      if (clip.asset.src.startsWith("blob:")
        || clip.asset.src.includes("/api/video-manuals/stream/")
        || clip.asset.src.includes("/api/video-manual-media/")) {
        unresolvedSources.push(clip.asset.src);
      }
    });
  });

  if (unresolvedSources.length) {
    throw new Error("Some uploaded assets are still using preview URLs. Wait for upload to finish, then try deploy again.");
  }

  return preparedEdit;
}

export function buildVideoManualDeploymentFileName(title, revisionNumber) {
  return `${String(title || "video-manual").trim() || "video-manual"}-rev-${revisionNumber || "deploy"}.mp4`;
}

export function triggerVideoManualUrlDownload(downloadUrl, fileName = "video-manual.mp4", { openInNewTab = false } = {}) {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  if (openInNewTab) {
    anchor.target = "_blank";
    anchor.rel = "noopener";
  }
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function openVideoManualUrl(downloadUrl) {
  if (!downloadUrl) return;
  window.open(downloadUrl, "_blank", "noopener,noreferrer");
}

export function buildVideoManualDownloadActionUrl(apiBaseUrl, downloadUrl, fileName = "video-manual.mp4") {
  if (!downloadUrl || !apiBaseUrl) return "";

  const proxyUrl = new URL(`${String(apiBaseUrl).replace(/\/$/, "")}/api/video-manual-media`);
  proxyUrl.searchParams.set("url", downloadUrl);
  proxyUrl.searchParams.set("download", "1");
  if (fileName) proxyUrl.searchParams.set("fileName", fileName);
  return proxyUrl.toString();
}
