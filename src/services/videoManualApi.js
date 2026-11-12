import { readStoredAuthUser } from "../utils/auth";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

const PLAYLIST_MANAGE_ROLES = ["admin", "課長", "部長", "係長"];
const PROJECT_EDIT_ROLES = ["admin", "課長", "部長", "係長", "班長"];
const PROJECT_DEPLOY_ROLES = ["admin", "課長", "部長", "係長", "班長"];
const PROJECT_PERMANENT_DELETE_ROLES = ["admin", "課長", "部長", "係長"];
const ASSET_PERMANENT_DELETE_ROLES = ["admin"];

function encodeBase64Unicode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function buildAuthHeaders(extraHeaders = {}) {
  const authUser = readStoredAuthUser();
  const hasIdentity = Boolean(authUser?.username || authUser?.role);

  return {
    ...(hasIdentity ? {
      Authorization: `Bearer ${encodeBase64Unicode(JSON.stringify({
        username: authUser?.username || "unknown",
        role: authUser?.role || "viewer",
      }))}`,
    } : {}),
    ...extraHeaders,
  };
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(endpoint, { method = "GET", headers, body } = {}) {
  const res = await fetch(BASE_URL + endpoint, {
    method,
    headers: buildAuthHeaders(headers),
    body,
  });

  const data = await readJson(res);
  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    if (typeof data === "object" && data?.code) error.code = data.code;
    throw error;
  }

  return data;
}

export function canManageVideoManualPlaylists(role = "") {
  return PLAYLIST_MANAGE_ROLES.includes(String(role || ""));
}

export function canEditVideoManualProjects(role = "") {
  return PROJECT_EDIT_ROLES.includes(String(role || ""));
}

export function canDeployVideoManualProjects(role = "") {
  return PROJECT_DEPLOY_ROLES.includes(String(role || ""));
}

export function canPermanentlyDeleteVideoManualProjects(role = "") {
  return PROJECT_PERMANENT_DELETE_ROLES.includes(String(role || ""));
}

export function canPermanentlyDeleteVideoManualAssets(role = "") {
  return ASSET_PERMANENT_DELETE_ROLES.includes(String(role || ""));
}

export async function fetchVideoManualPlaylists() {
  const data = await request("api/video-manuals-studio/playlists");
  return Array.isArray(data) ? data : [];
}

export async function patchVideoManualPlaylist(playlistId, updates) {
  if (!playlistId) throw new Error("playlistId is required");
  return request(`api/video-manuals-studio/playlists/${playlistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function previewVideoManualPlaylistDelete(playlistId) {
  if (!playlistId) throw new Error("playlistId is required");
  return request(`api/video-manuals-studio/playlists/${playlistId}/delete-preview`);
}

export async function deleteVideoManualPlaylist(playlistId) {
  if (!playlistId) throw new Error("playlistId is required");
  return request(`api/video-manuals-studio/playlists/${playlistId}`, { method: "DELETE" });
}

export async function fetchVideoManualPlaylistProjects(playlistId) {
  if (!playlistId) return [];

  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/projects`);
  return Array.isArray(data) ? data : [];
}

/** One page of a playlist's projects (server-side pagination / sort / search, cached 1 min on the server). */
export async function fetchVideoManualPlaylistProjectsPage(playlistId, { page = 1, limit = 15, sort = "newest", q = "", nocache = false } = {}) {
  if (!playlistId) return { projects: [], total: 0, page: 1, pageSize: limit, totalPages: 1 };

  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (q) params.set("q", q);
  if (nocache) params.set("nocache", "1");
  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/projects?${params.toString()}`);
  return {
    projects: Array.isArray(data?.projects) ? data.projects : [],
    total: Number(data?.total) || 0,
    page: Number(data?.page) || page,
    pageSize: Number(data?.pageSize) || limit,
    totalPages: Math.max(1, Number(data?.totalPages) || 1),
  };
}

/** Ids of every project matching the search (all pages) - for "select all matching". */
export async function fetchVideoManualPlaylistProjectIds(playlistId, { q = "", sort = "newest" } = {}) {
  if (!playlistId) return [];

  const params = new URLSearchParams({ idsOnly: "1", sort });
  if (q) params.set("q", q);
  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/projects?${params.toString()}`);
  return Array.isArray(data?.ids) ? data.ids : [];
}

export async function moveVideoManualProject(projectId, targetPlaylistId) {
  if (!projectId) throw new Error("projectId is required");
  if (!targetPlaylistId) throw new Error("targetPlaylistId is required");

  return request(`api/video-manuals-studio/projects/${projectId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetPlaylistId }),
  });
}

/** Bulk action on many projects: action = "delete" | "move" | "copy" (move / copy need targetPlaylistId). */
export async function bulkVideoManualProjects(action, ids, targetPlaylistId = "") {
  return request("api/video-manuals-studio/projects/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ids, targetPlaylistId: targetPlaylistId || undefined }),
  });
}

export async function fetchVideoManualProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}`);
}

// Translated subtitles / step titles / step descriptions of a project. The server stores every translation in
// MongoDB, so MyMemory is only called for text that has never been translated before.
export async function fetchVideoManualProjectTranslation(projectId, lang) {
  if (!projectId) throw new Error("projectId is required");
  return request(`api/video-manuals-studio/projects/${projectId}/translations?lang=${encodeURIComponent(lang)}`);
}

export async function patchVideoManualProject(projectId, updates) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export async function createVideoManualProject(playlistId, { title, description = "" } = {}) {
  if (!playlistId) {
    throw new Error("playlistId is required");
  }

  return request(`api/video-manuals-studio/playlists/${playlistId}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
}

// ---- Step-based projects (project.structure === "steps") ----
const jsonRequest = (endpoint, method, payload) => request(endpoint, {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload ?? {}),
});

export function createVideoManualStep(projectId, { title, afterStepId } = {}) {
  return jsonRequest(`api/video-manuals-studio/projects/${projectId}/steps`, "POST", { title, afterStepId });
}

export function patchVideoManualStep(projectId, stepId, updates) {
  return jsonRequest(`api/video-manuals-studio/projects/${projectId}/steps/${stepId}`, "PATCH", updates);
}

export function deleteVideoManualStep(projectId, stepId) {
  return request(`api/video-manuals-studio/projects/${projectId}/steps/${stepId}`, { method: "DELETE" });
}

export function reorderVideoManualSteps(projectId, order) {
  return jsonRequest(`api/video-manuals-studio/projects/${projectId}/steps/order`, "PUT", { order });
}

export function convertVideoManualProjectToSteps(projectId, { title } = {}) {
  return jsonRequest(`api/video-manuals-studio/projects/${projectId}/convert-to-steps`, "POST", { title });
}

export async function deleteVideoManualProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}`, { method: "DELETE" });
}

export async function createVideoManualRevision(projectId, snapshot, revisionName) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const body = { snapshot };
  if (revisionName) body.revisionName = revisionName;

  return request(`api/video-manuals-studio/projects/${projectId}/revisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchVideoManualRevisions(projectId) {
  if (!projectId) return [];

  const data = await request(`api/video-manuals-studio/projects/${projectId}/revisions`);
  return Array.isArray(data) ? data : [];
}

export async function fetchVideoManualRevision(revisionId) {
  if (!revisionId) {
    throw new Error("revisionId is required");
  }

  return request(`api/video-manuals-studio/revisions/${revisionId}`);
}

export async function deployVideoManualRevision(projectId, revisionId, options = {}) {
  if (!projectId) {
    throw new Error("projectId is required");
  }
  if (!revisionId) {
    throw new Error("revisionId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revisionId, ...options }),
  });
}

export async function undeployVideoManualProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}/undeploy`, {
    method: "POST",
  });
}

export async function renderVideoManualEdit(editJson, projectTitle = "Video Manual") {
  if (!editJson || typeof editJson !== "object") {
    throw new Error("editJson is required");
  }

  return request("api/video-manuals/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ editJson, projectTitle }),
  });
}

export async function fetchVideoManualRenderStatus(renderId) {
  if (!renderId) {
    throw new Error("renderId is required");
  }

  return request(`api/video-manuals/render-status/${renderId}`);
}

export async function deployVideoManualRenderedRevision(projectId, revisionId, { renderId, downloadUrl = null } = {}) {
  if (!projectId) {
    throw new Error("projectId is required");
  }
  if (!revisionId) {
    throw new Error("revisionId is required");
  }
  if (!renderId) {
    throw new Error("renderId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}/deploy-render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revisionId, renderId, downloadUrl }),
  });
}

export async function deployVideoManualUploadedRevision(projectId, revisionId, file, { fileName = "video-manual.mp4", mimeType = "video/mp4" } = {}) {
  if (!projectId) {
    throw new Error("projectId is required");
  }
  if (!revisionId) {
    throw new Error("revisionId is required");
  }
  if (!file) {
    throw new Error("file is required");
  }

  const res = await fetch(`${BASE_URL}api/video-manuals-studio/projects/${projectId}/deploy-upload`, {
    method: "POST",
    headers: buildAuthHeaders({
      "Content-Type": mimeType,
      "X-Revision-Id": revisionId,
      "X-File-Name": fileName,
    }),
    body: file,
  });

  const data = await readJson(res);
  if (!res.ok) {
    const message = typeof data === "string"
      ? data
      : data?.error || data?.message || `API ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    if (typeof data === "object" && data?.code) error.code = data.code;
    throw error;
  }

  return data;
}

export function getVideoManualApiBaseUrl() {
  return BASE_URL.replace(/\/$/, "");
}

export async function fetchVideoManualPlaylistAssets(playlistId) {
  if (!playlistId) return [];

  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/assets`);
  return Array.isArray(data) ? data : [];
}

export async function previewVideoManualPlaylistAssetDelete(playlistId, assetIds) {
  if (!playlistId) {
    throw new Error("playlistId is required");
  }

  const normalizedAssetIds = Array.isArray(assetIds)
    ? Array.from(new Set(assetIds.map((assetId) => String(assetId || "").trim()).filter(Boolean)))
    : [];
  if (!normalizedAssetIds.length) {
    throw new Error("assetIds is required");
  }

  return request(`api/video-manuals-studio/playlists/${playlistId}/assets/delete-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: normalizedAssetIds }),
  });
}

export async function softDeleteVideoManualPlaylistAssets(playlistId, assetIds) {
  if (!playlistId) {
    throw new Error("playlistId is required");
  }

  const normalizedAssetIds = Array.isArray(assetIds)
    ? Array.from(new Set(assetIds.map((assetId) => String(assetId || "").trim()).filter(Boolean)))
    : [];
  if (!normalizedAssetIds.length) {
    throw new Error("assetIds is required");
  }

  return request(`api/video-manuals-studio/playlists/${playlistId}/assets/soft-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: normalizedAssetIds }),
  });
}

export async function fetchVideoManualPlaylistAssetRecycleBin(playlistId) {
  if (!playlistId) return [];

  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/assets/recycle-bin`);
  return Array.isArray(data) ? data : [];
}

export async function restoreVideoManualPlaylistAssets(playlistId, assetIds) {
  if (!playlistId) {
    throw new Error("playlistId is required");
  }

  const normalizedAssetIds = Array.isArray(assetIds)
    ? Array.from(new Set(assetIds.map((assetId) => String(assetId || "").trim()).filter(Boolean)))
    : [];
  if (!normalizedAssetIds.length) {
    throw new Error("assetIds is required");
  }

  return request(`api/video-manuals-studio/playlists/${playlistId}/assets/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: normalizedAssetIds }),
  });
}

export async function permanentlyDeleteVideoManualPlaylistAssets(playlistId, assetIds) {
  if (!playlistId) {
    throw new Error("playlistId is required");
  }

  const normalizedAssetIds = Array.isArray(assetIds)
    ? Array.from(new Set(assetIds.map((assetId) => String(assetId || "").trim()).filter(Boolean)))
    : [];
  if (!normalizedAssetIds.length) {
    throw new Error("assetIds is required");
  }

  return request(`api/video-manuals-studio/playlists/${playlistId}/assets/permanent`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: normalizedAssetIds }),
  });
}

export function uploadVideoManualPlaylistAsset(playlistId, file, { onProgress = null } = {}) {
  if (!playlistId) {
    return Promise.reject(new Error("playlistId is required"));
  }
  if (!file) {
    return Promise.reject(new Error("file is required"));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getVideoManualApiBaseUrl()}/api/video-manuals-studio/upload-asset`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", file.name);
    xhr.setRequestHeader("X-Upload-Folder", "videoManuals/shotstackAssets");
    xhr.setRequestHeader("X-Playlist-Id", playlistId);

    Object.entries(buildAuthHeaders()).forEach(([header, value]) => {
      xhr.setRequestHeader(header, value);
    });

    xhr.upload.addEventListener("progress", (progressEvent) => {
      if (!progressEvent.lengthComputable) return;
      onProgress?.(progressEvent.loaded, progressEvent.total, progressEvent);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (error) {
          reject(error);
        }
        return;
      }

      let errorMessage = `${xhr.status} ${xhr.statusText}`;
      try {
        errorMessage = JSON.parse(xhr.responseText).error || errorMessage;
      } catch {
        // Keep the HTTP status text for non-JSON upload errors.
      }
      reject(new Error(errorMessage));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload canceled"));
    xhr.send(file);
  });
}
export async function duplicateVideoManualProject(projectId, { targetPlaylistId = null, title = "" } = {}) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetPlaylistId: targetPlaylistId || undefined, title: title || undefined }),
  });
}

export async function fetchVideoManualProjectTrash(playlistId) {
  if (!playlistId) return [];

  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/trash`);
  return Array.isArray(data) ? data : [];
}

export async function restoreVideoManualProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}/restore`, { method: "POST" });
}

export async function permanentlyDeleteVideoManualProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}/permanent`, { method: "DELETE" });
}
