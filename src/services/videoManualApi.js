import { readStoredAuthUser } from "../utils/auth";

const LOCAL_URL = "http://localhost:3000/";
const ENV_URL = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = (ENV_URL || LOCAL_URL).replace(/\/?$/, "/");

const PLAYLIST_MANAGE_ROLES = ["admin", "課長", "部長", "係長"];
const PROJECT_EDIT_ROLES = ["admin", "課長", "部長", "係長", "班長"];
const PROJECT_DEPLOY_ROLES = ["admin", "課長", "部長", "係長", "班長"];
const PROJECT_PERMANENT_DELETE_ROLES = ["admin", "課長", "部長", "係長"];

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
    throw new Error(message);
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

export async function fetchVideoManualPlaylists() {
  const data = await request("api/video-manuals-studio/playlists");
  return Array.isArray(data) ? data : [];
}

export async function fetchVideoManualPlaylistProjects(playlistId) {
  if (!playlistId) return [];

  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/projects`);
  return Array.isArray(data) ? data : [];
}

export async function fetchVideoManualProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return request(`api/video-manuals-studio/projects/${projectId}`);
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

export function getVideoManualApiBaseUrl() {
  return BASE_URL.replace(/\/$/, "");
}

export async function fetchVideoManualPlaylistAssets(playlistId) {
  if (!playlistId) return [];

  const data = await request(`api/video-manuals-studio/playlists/${playlistId}/assets`);
  return Array.isArray(data) ? data : [];
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
      } catch (_) {}
      reject(new Error(errorMessage));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload canceled"));
    xhr.send(file);
  });
}