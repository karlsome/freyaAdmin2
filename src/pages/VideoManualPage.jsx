import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import VideoManualCopyProjectModal from "../components/videoManual/VideoManualCopyProjectModal";
import VideoManualProjectTrashModal from "../components/videoManual/VideoManualProjectTrashModal";
import { useLanguage } from "../contexts/LanguageContext";
import { readStoredAuthUser } from "../utils/auth";
import {
  canEditVideoManualProjects,
  createVideoManualProject,
  deleteVideoManualPlaylist,
  deleteVideoManualProject,
  duplicateVideoManualProject,
  fetchVideoManualPlaylistProjects,
  fetchVideoManualPlaylists,
  patchVideoManualPlaylist,
  patchVideoManualProject,
} from "../services/videoManualApi";

const PROJECT_PREVIEW_POLL_INTERVAL_MS = 4000;
const SELECTED_PLAYLIST_STORAGE_KEY = "videoManual.selectedPlaylistId";

function readRememberedPlaylistId() {
  try {
    return window.sessionStorage.getItem(SELECTED_PLAYLIST_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberPlaylistId(playlistId) {
  try {
    if (playlistId) window.sessionStorage.setItem(SELECTED_PLAYLIST_STORAGE_KEY, playlistId);
  } catch {
    // Storage can be unavailable (private mode); the selection just won't persist.
  }
}

function formatDateTime(value, fallback = "") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

function formatProjectCount(count, t) {
  const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${safeCount} ${safeCount === 1 ? t("vmProject") : t("vmProjects")}`;
}

function filterItemsByQuery(items, query, resolver) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) => resolver(item).includes(normalizedQuery));
}

function buildProjectSearchText(project) {
  return [
    project?.title,
    project?.description,
    project?.lastEditedBy,
    project?.createdBy,
    project?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function buildPlaylistSearchText(playlist) {
  return [
    playlist?.name,
    playlist?.description,
    playlist?.model,
    playlist?.privacy,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function getProjectPreviewMedia(project) {
  return {
    previewUrl: String(project?.previewUrl || project?.deployedVideoUrl || "").trim(),
    thumbnailUrl: String(project?.previewThumbnailUrl || "").trim(),
  };
}

function InfoPopover({ anchorRef, onClose, children }) {
  const [position, setPosition] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return undefined;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = 260;
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 190 ? Math.max(8, rect.top - 190) : rect.bottom + 6;
      setPosition({ top, left, width });
    };
    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target) || anchor.contains(event.target)) return;
      onClose();
    };
    const handleKey = (event) => { if (event.key === "Escape") onClose(); };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onClose, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onClose, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose]);

  if (!position) return null;
  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
      className="z-[400] rounded-xl border border-separator/40 bg-surface px-3 py-3 shadow-xl"
    >
      {children}
    </div>,
    document.body,
  );
}

function ProjectCard({ project, onOpen, canEdit, canDelete, onEdit, onDelete, onDuplicate, onCopyTo }) {
  const { t } = useLanguage();
  const [showInfo, setShowInfo] = useState(false);
  const [isHoveringPreview, setIsHoveringPreview] = useState(false);
  const videoRef = useRef(null);
  const infoButtonRef = useRef(null);
  const closeInfo = useCallback(() => setShowInfo(false), []);
  const { previewUrl, thumbnailUrl } = getProjectPreviewMedia(project);
  const latestRevision = Number(project?.currentRevisionNumber || 0) > 0 ? `${t("vmRevision")} ${project.currentRevisionNumber}` : t("vmNone");
  const deployedRevision = project?.deployedRevisionName || (project?.deployedRevisionNumber ? `${t("vmRevision")} ${project.deployedRevisionNumber}` : t("vmNotDeployed"));
  const previewStatus = String(project?.previewStatus || "").trim().toLowerCase();

  useEffect(() => {
    if (!videoRef.current || !previewUrl) return;

    if (isHoveringPreview) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      return;
    }

    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  }, [isHoveringPreview, previewUrl]);

  const badge = previewStatus === "processing"
    ? t("vmPreviewProcessing")
    : previewStatus === "failed"
      ? t("vmPreviewFailed")
      : !previewUrl && !thumbnailUrl
        ? t("vmNoPreview")
        : "";

  return (
    <article className="glass-card rounded-xl card-hover-lift group flex h-full flex-col overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(project)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(project);
          }
        }}
        onMouseEnter={() => setIsHoveringPreview(true)}
        onMouseLeave={() => { setIsHoveringPreview(false); setShowInfo(false); }}
        className="relative block aspect-video w-full cursor-pointer overflow-hidden bg-surface-container-low outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${project?.title || "Project"} thumbnail`}
            className={`h-full w-full object-cover transition-opacity duration-150 ${isHoveringPreview && previewUrl ? "opacity-0" : "opacity-100"}`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>movie</span>
          </div>
        )}

        {previewUrl ? (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${isHoveringPreview ? "opacity-100" : "opacity-0"}`}
          />
        ) : null}

        {badge ? (
          <div className="absolute left-2 top-2 inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white">
            {badge}
          </div>
        ) : null}

        {project?.deployedRevisionId ? (
          <div
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm"
            title={`${t("vmDeployedLabel")} ${deployedRevision}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
            {t("Deployed")}
          </div>
        ) : null}

        <div className="absolute right-2 top-2 flex items-center gap-1">
          {canEdit ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onEdit(project); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={t("Edit project")}
              title={t("Edit project")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onDuplicate(project); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={t("Duplicate")}
              title={t("Duplicate")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onCopyTo(project); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={t("Copy to playlist")}
              title={t("Copy to playlist")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>drive_file_move</span>
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onDelete(project); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={t("Delete project")}
              title={t("Delete project")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            </button>
          ) : null}
          <button
            ref={infoButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowInfo((value) => !value);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-opacity duration-150 hover:bg-black/70 focus-visible:opacity-100 ${showInfo ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            aria-label={t("vmProjectInfo")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
          </button>

          {showInfo ? (
            <InfoPopover anchorRef={infoButtonRef} onClose={closeInfo}>
              <div className="space-y-2 text-xs text-on-surface-variant">
                <p><span className="font-bold text-on-surface">{t("vmCreatedBy")}</span> {project?.createdBy || t("vmUnknown")}</p>
                <p><span className="font-bold text-on-surface">{t("vmLastEdited")}</span> {formatDateTime(project?.lastEditedAt || project?.updatedAt, t("vmNotUpdated"))}</p>
                <p><span className="font-bold text-on-surface">{t("vmDeployedLabel")}</span> {deployedRevision}</p>
                <p><span className="font-bold text-on-surface">{t("vmLatestLabel")}</span> {latestRevision}</p>
              </div>
            </InfoPopover>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 px-3 py-2">
        <h3 className="truncate text-[13px] font-bold text-on-surface">{project?.title || t("vmUntitledProject")}</h3>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
          {project?.description || t("vmNoDescription")}
        </p>
      </div>
    </article>
  );
}

function EditProjectModal({ project, playlistId, onClose, onSaved }) {
  const { t } = useLanguage();
  const isCreate = !project;
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) { setError(t("Title is required.")); return; }
    setSaving(true);
    setError("");
    try {
      if (isCreate) {
        const created = await createVideoManualProject(playlistId, { title: nextTitle, description: description.trim() });
        onSaved({ ...created, _id: created?._id || created?.insertedId });
      } else {
        await patchVideoManualProject(project._id, { title: nextTitle, description: description.trim() });
        onSaved({ ...project, title: nextTitle, description: description.trim() });
      }
    } catch (saveError) {
      setError(saveError.message || t("Failed to save project."));
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]";

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => { if (!saving) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="freya-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t("vmTitle")}</p>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">{isCreate ? t("New project") : t("Edit project")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-6 py-5">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>title</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">{t("Title")}</span>
            </div>
            <input autoFocus type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isCreate ? t("Project title") : undefined} className={inputClass} />
          </div>

          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>notes</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em]">{t("Description")}</span>
            </div>
            <textarea
              rows={9}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputClass} resize-y font-normal leading-relaxed`}
            />
          </div>

          {error ? (
            <div className="flex gap-2.5 rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3">
              <span className="material-symbols-outlined flex-shrink-0 text-[var(--status-danger)]" style={{ fontSize: 18 }}>report</span>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{error}</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] bg-[var(--surface-raised)] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-2xs transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--freya-blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("Saving...") : isCreate ? t("Create") : t("Save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function EditPlaylistModal({ playlist, onClose, onSaved }) {
  const { t } = useLanguage();
  const [name, setName] = useState(playlist?.name || "");
  const [description, setDescription] = useState(playlist?.description || "");
  const [model, setModel] = useState(playlist?.model || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) { setError(t("Name is required.")); return; }
    setSaving(true);
    setError("");
    try {
      const updates = { name: nextName, description: description.trim(), model: model.trim() };
      await patchVideoManualPlaylist(playlist._id, updates);
      onSaved({ ...playlist, ...updates, model: updates.model || null });
    } catch (saveError) {
      setError(saveError.message || t("Failed to save playlist."));
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]";
  const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";

  return createPortal(
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="freya-card flex w-full max-w-lg flex-col overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl"
      >
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("Edit playlist")}</h2>
        </div>
        <div className="space-y-3.5 px-6 py-5">
          <label className="block">
            <span className={labelClass}>{t("Name")}</span>
            <input autoFocus type="text" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>{t("Model")}</span>
            <input type="text" value={model} onChange={(event) => setModel(event.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>{t("Description")}</span>
            <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-y font-normal`} />
          </label>
          {error ? <p className="text-xs font-semibold text-[var(--status-danger)]">{error}</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] px-6 py-3.5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50">
            {t("Cancel")}
          </button>
          <button type="submit" disabled={saving} className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {saving ? t("Saving...") : t("Save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="glass-card rounded-2xl px-4 py-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <p className="mt-4 text-sm font-bold text-on-surface">{title}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

export default function VideoManualPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(readRememberedPlaylistId);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState("");
  const [projectsError, setProjectsError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [editingProject, setEditingProject] = useState(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copyingProject, setCopyingProject] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [notice, setNotice] = useState("");
  const authRole = String(readStoredAuthUser()?.role || "");
  const canEditProjects = canEditVideoManualProjects(authRole);
  const canDeleteProjects = authRole === "admin"; // backend: only admin may delete projects

  async function handleDeletePlaylist() {
    if (!selectedPlaylist) return;
    const count = Number(selectedPlaylist.projectCount || projects.length || 0);
    if (!window.confirm(t("Permanently delete playlist \"{name}\" and its {count} project(s)? This cannot be undone.", { name: selectedPlaylist.name || "", count }))) return;
    setActionError("");
    try {
      await deleteVideoManualPlaylist(selectedPlaylist._id);
      const remaining = playlists.filter((item) => String(item._id) !== String(selectedPlaylist._id));
      setPlaylists(remaining);
      setSelectedPlaylistId(String(remaining[0]?._id || ""));
      setNotice(t("Deleted playlist \"{name}\".", { name: selectedPlaylist.name || "" }));
    } catch (error) {
      setActionError(error.message || t("Failed to delete playlist."));
    }
  }

  async function handleDeleteProject(project) {
    if (!window.confirm(t("Move project \"{title}\" to the recycle bin? You can restore it from there.", { title: project?.title || "" }))) return;
    setActionError("");
    try {
      await deleteVideoManualProject(project._id);
      setProjects((current) => current.filter((item) => String(item._id) !== String(project._id)));
    } catch (error) {
      setActionError(error.message || t("Failed to delete project."));
    }
  }

  async function handleDuplicateProject(project) {
    setActionError("");
    try {
      const copy = await duplicateVideoManualProject(project._id);
      setProjects((current) => [...current, { ...copy, _id: copy?._id || copy?.insertedId }]);
      setNotice(t("Duplicated as \"{title}\".", { title: copy?.title || "" }));
    } catch (error) {
      setActionError(error.message || t("Failed to duplicate project."));
    }
  }

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    rememberPlaylistId(selectedPlaylistId);
  }, [selectedPlaylistId]);

  const deferredPlaylistQuery = useDeferredValue(playlistQuery);
  const deferredProjectQuery = useDeferredValue(projectQuery);


  useEffect(() => {
    let cancelled = false;

    async function loadPlaylists() {
      setPlaylistsLoading(true);
      setPlaylistsError("");

      try {
        const nextPlaylists = await fetchVideoManualPlaylists();
        if (cancelled) return;

        setPlaylists(nextPlaylists);
        setSelectedPlaylistId((currentId) => {
          const hasCurrent = nextPlaylists.some((playlist) => String(playlist?._id) === String(currentId));
          if (hasCurrent) return currentId;
          return String(nextPlaylists[0]?._id || "");
        });
      } catch (error) {
        if (cancelled) return;
        setPlaylists([]);
        setSelectedPlaylistId("");
        setPlaylistsError(error.message || "Failed to load playlists.");
      } finally {
        if (!cancelled) setPlaylistsLoading(false);
      }
    }

    loadPlaylists();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  useEffect(() => {
    if (!selectedPlaylistId) {
      setProjects([]);
      setProjectsLoading(false);
      setProjectsError("");
      return undefined;
    }

    let cancelled = false;

    async function loadProjects() {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const nextProjects = await fetchVideoManualPlaylistProjects(selectedPlaylistId);
        if (cancelled) return;
        setProjects(nextProjects);
      } catch (error) {
        if (cancelled) return;
        setProjects([]);
        setProjectsError(error.message || "Failed to load projects.");
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylistId]);

  useEffect(() => {
    if (!selectedPlaylistId || projectsLoading || projectsError) return undefined;

    const hasProcessingPreviews = projects.some((project) => String(project?.previewStatus || "").trim().toLowerCase() === "processing");
    if (!hasProcessingPreviews) return undefined;

    let cancelled = false;
    const timerId = window.setInterval(async () => {
      try {
        const nextProjects = await fetchVideoManualPlaylistProjects(selectedPlaylistId);
        if (cancelled) return;
        setProjects(nextProjects);
      } catch {
        // Keep silent polling to avoid disruptive errors during background refresh.
      }
    }, PROJECT_PREVIEW_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [projects, projectsError, projectsLoading, selectedPlaylistId]);

  const filteredPlaylists = useMemo(() => (
    filterItemsByQuery(playlists, deferredPlaylistQuery, buildPlaylistSearchText)
  ), [deferredPlaylistQuery, playlists]);

  const filteredProjects = useMemo(() => (
    filterItemsByQuery(projects, deferredProjectQuery, buildProjectSearchText)
  ), [deferredProjectQuery, projects]);

  const selectedPlaylist = useMemo(() => (
    playlists.find((playlist) => String(playlist?._id) === String(selectedPlaylistId)) || null
  ), [playlists, selectedPlaylistId]);

  return (
    <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
      <PageHeader
        title={t("vmTitle")}
        subtitle={t("vmSubtitle")}
        actions={(
          <button
            type="button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-separator/50 px-4 py-2 text-xs font-bold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            {t("vmRefresh")}
          </button>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="dashboard-section rounded-2xl p-4 lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-bold text-on-surface">{t("vmPlaylists")}</h2>
            <span className="ml-auto text-[10px] text-outline">{filteredPlaylists.length}</span>
          </div>

          <label className="mb-3 flex items-center gap-2 rounded-xl border border-separator/40 bg-surface-container-low px-3 py-2.5 text-on-surface transition-all duration-150 focus-within:border-primary/30 focus-within:bg-surface">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
            <input
              value={playlistQuery}
              onChange={(event) => setPlaylistQuery(event.target.value)}
              className="w-full bg-transparent text-sm font-medium text-on-surface outline-none placeholder:text-outline"
              placeholder={t("vmSearchPlaylists")}
              type="search"
            />
          </label>

          {playlistsError ? (
            <div className="mb-3 flex gap-3 rounded-xl border border-error/20 bg-error/10 px-3 py-3">
              <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{t("vmPlaylistLoadFailed")}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{playlistsError}</p>
              </div>
            </div>
          ) : null}

          <div className="max-h-[calc(100vh-18rem)] space-y-1.5 overflow-y-auto scrollbar-hide">
            {playlistsLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 rounded-xl bg-surface-container/70 animate-pulse" />
              ))
            ) : filteredPlaylists.length ? (
              filteredPlaylists.map((playlist) => {
                const isActive = String(playlist?._id) === String(selectedPlaylistId);

                return (
                  <button
                    key={playlist?._id}
                    type="button"
                    onClick={() => setSelectedPlaylistId(String(playlist?._id || ""))}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${isActive
                      ? "border-primary/25 bg-primary/10 shadow-[inset_3px_0_0_rgb(var(--c-primary))]"
                      : "border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-on-surface">{playlist?.name || t("vmUntitledPlaylist")}</span>
                      <span className="block truncate text-[11px] text-outline">
                        {formatProjectCount(playlist?.projectCount || 0, t)}{playlist?.model ? ` · ${playlist.model}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon="folder"
                title={playlistQuery ? t("vmNoMatchingPlaylists") : t("vmNoPlaylists")}
                description={playlistQuery ? t("vmTryDifferentSearch") : t("vmNoPlaylistsDesc")}
              />
            )}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-on-surface">
                {selectedPlaylist?.name || t("vmProjectsHeading")}
              </h2>
              <p className="text-xs text-outline">
                {selectedPlaylist ? formatProjectCount(filteredProjects.length, t) : t("vmNoPlaylistSelected")}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {canEditProjects ? (
              <button
                type="button"
                onClick={() => setEditingPlaylist(selectedPlaylist)}
                disabled={!selectedPlaylist}
                className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-separator/40 bg-surface-container-low px-3.5 py-2.5 text-xs font-bold text-on-surface transition-all duration-150 hover:bg-surface-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                {t("Edit playlist")}
              </button>
            ) : null}
            {canDeleteProjects ? (
              <button
                type="button"
                onClick={handleDeletePlaylist}
                disabled={!selectedPlaylist}
                className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-xs font-bold text-error transition-all duration-150 hover:bg-error/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_delete</span>
                {t("Delete playlist")}
              </button>
            ) : null}
            {canEditProjects ? (
              <button
                type="button"
                onClick={() => setTrashOpen(true)}
                disabled={!selectedPlaylist}
                className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl border border-separator/40 bg-surface-container-low px-3.5 py-2.5 text-xs font-bold text-on-surface transition-all duration-150 hover:bg-surface-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                {t("Recycle bin")}
              </button>
            ) : null}
            {canEditProjects ? (
              <button
                type="button"
                onClick={() => setCreatingProject(true)}
                disabled={!selectedPlaylist}
                className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-all duration-150 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                {t("New project")}
              </button>
            ) : null}
            <label className="flex w-full items-center gap-2 rounded-xl border border-separator/40 bg-surface-container-low px-3 py-2.5 text-on-surface transition-all duration-150 focus-within:border-primary/30 focus-within:bg-surface sm:w-72">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
              <input
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                className="w-full bg-transparent text-sm font-medium text-on-surface outline-none placeholder:text-outline"
                placeholder={t("vmSearchProjects")}
                type="search"
              />
            </label>
            </div>
          </div>

          {projectsError ? (
            <div className="mb-5 flex gap-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-4">
              <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
              <div>
                <p className="text-sm font-bold text-on-surface">{t("vmProjectLoadFailed")}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{projectsError}</p>
              </div>
            </div>
          ) : null}

          {!selectedPlaylist && !playlistsLoading ? (
            <EmptyState
              icon="video_library"
              title={t("vmChoosePlaylist")}
              description={t("vmChoosePlaylistDesc")}
            />
          ) : projectsLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-[150px] rounded-xl bg-surface-container/70 animate-pulse" />
              ))}
            </div>
          ) : filteredProjects.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project?._id}
                  project={project}
                  onOpen={(nextProject) => navigate(`/videoManual/project/${nextProject._id}`)}
                  canEdit={canEditProjects}
                  canDelete={canDeleteProjects}
                  onEdit={setEditingProject}
                  onDelete={handleDeleteProject}
                  onDuplicate={handleDuplicateProject}
                  onCopyTo={setCopyingProject}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="movie_edit"
              title={projectQuery ? t("vmNoMatchingProjects") : t("vmNoProjects")}
              description={projectQuery ? t("vmTryDifferentSearch") : t("vmNoProjectsDesc")}
            />
          )}
        </section>
      </div>

      {actionError ? (
        <div className="fixed bottom-6 left-1/2 z-[360] -translate-x-1/2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg" onClick={() => setActionError("")}>
          {actionError}
        </div>
      ) : null}

      {notice ? (
        <div className="fixed bottom-6 left-1/2 z-[360] -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg" onClick={() => setNotice("")}>
          {notice}
        </div>
      ) : null}

      {trashOpen && selectedPlaylistId ? (
        <VideoManualProjectTrashModal
          playlistId={selectedPlaylistId}
          canRestore={canEditProjects}
          canPurge={canDeleteProjects}
          onClose={() => setTrashOpen(false)}
          onRestored={(restored) => {
            setNotice(t("Restored \"{title}\".", { title: restored?.title || "" }));
            fetchVideoManualPlaylistProjects(selectedPlaylistId).then(setProjects).catch(() => {});
          }}
        />
      ) : null}

      {editingPlaylist ? (
        <EditPlaylistModal
          playlist={editingPlaylist}
          onClose={() => setEditingPlaylist(null)}
          onSaved={(updated) => {
            setEditingPlaylist(null);
            setPlaylists((current) => current.map((item) => (String(item._id) === String(updated._id) ? { ...item, ...updated } : item)));
            setNotice(t("Playlist updated."));
          }}
        />
      ) : null}

      {copyingProject ? (
        <VideoManualCopyProjectModal
          project={copyingProject}
          playlists={playlists}
          currentPlaylistId={selectedPlaylistId}
          onClose={() => setCopyingProject(null)}
          onCopied={(copy, targetPlaylist) => {
            setCopyingProject(null);
            setNotice(t("Copied \"{title}\" to {playlist}.", { title: copy?.title || "", playlist: targetPlaylist?.name || "" }));
            setRefreshNonce((value) => value + 1);
          }}
        />
      ) : null}

      {creatingProject && selectedPlaylistId ? (
        <EditProjectModal
          project={null}
          playlistId={selectedPlaylistId}
          onClose={() => setCreatingProject(false)}
          onSaved={(created) => {
            setCreatingProject(false);
            navigate(`/videoManual/project/${created._id}`);
          }}
        />
      ) : null}

      {editingProject ? (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={(updated) => {
            setProjects((current) => current.map((item) => (String(item._id) === String(updated._id) ? { ...item, title: updated.title, description: updated.description } : item)));
            setEditingProject(null);
          }}
        />
      ) : null}
    </section>
  );
}
