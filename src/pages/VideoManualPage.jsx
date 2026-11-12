import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import VideoManualCopyProjectModal from "../components/videoManual/VideoManualCopyProjectModal";
import VideoManualProjectTrashModal from "../components/videoManual/VideoManualProjectTrashModal";
import {
  ProjectBulkBar,
  ProjectListToolbar,
  ProjectPagerBar,
  ProjectZoomSlider,
} from "../components/videoManual/VideoManualProjectListControls";
import {
  PROJECT_PAGE_SIZE_OPTIONS,
  PROJECT_SORT_OPTIONS,
  PROJECT_ZOOM_DEFAULT,
  PROJECT_ZOOM_MAX,
  PROJECT_ZOOM_MIN,
} from "../components/videoManual/videoManualListConfig";
import { useLanguage } from "../contexts/LanguageContext";
import VideoManualStepPlayerModal from "../components/videoManual/VideoManualStepPlayerModal";
import { getPlayableSteps } from "../components/videoManual/videoManualPlaybackUtils";
import { readStoredAuthUser } from "../utils/auth";
import {
  bulkVideoManualProjects,
  canEditVideoManualProjects,
  createVideoManualProject,
  deleteVideoManualPlaylist,
  deleteVideoManualProject,
  duplicateVideoManualProject,
  fetchVideoManualPlaylistProjectIds,
  fetchVideoManualPlaylistProjectsPage,
  fetchVideoManualProject,
  fetchVideoManualPlaylists,
  patchVideoManualPlaylist,
  previewVideoManualPlaylistDelete,
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

const VIEW_MODE_STORAGE_KEY = "videoManual.viewMode";
const PAGE_SIZE_STORAGE_KEY = "videoManual.pageSize";
const SORT_STORAGE_KEY = "videoManual.sort";
const ZOOM_STORAGE_KEY = "videoManual.zoom";
const SEARCH_DEBOUNCE_MS = 400;

function readStoredValue(key, fallback, isValid) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = typeof fallback === "number" ? Number(raw) : raw;
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function storeValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Preference just won't persist.
  }
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
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

function InfoPopover({ anchorRef, onClose, children, width = 260, height = 190 }) {
  const [position, setPosition] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return undefined;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < height ? Math.max(8, rect.top - height) : rect.bottom + 6;
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
  }, [anchorRef, height, onClose, width]);

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

function StepsLabel({ count, t }) {
  const safe = Number(count) || 0;
  return safe === 1 ? t("1 step") : t("{count} steps", { count: safe });
}

function SelectCheckbox({ selected, onToggle, variant = "overlay", className = "" }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={t("Select project")}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 shadow-sm transition-colors ${selected ? "border-[var(--freya-blue)] bg-[var(--freya-blue)] text-white" : variant === "overlay" ? "border-white/90 bg-black/40 text-transparent hover:bg-black/60" : "border-[var(--border-strong)] bg-[var(--surface)] text-transparent hover:border-[var(--freya-blue)]"} ${className}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
    </button>
  );
}

// "More" menu with the per-project actions that don't fit on a small card: duplicate, copy, move, delete.
function ProjectMenuButton({ project, canEdit, canDelete, onDuplicate, onCopyTo, onMoveTo, onDelete, className }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  if (!canEdit && !canDelete) return null;

  const items = [
    canEdit ? { key: "duplicate", icon: "content_copy", label: t("Duplicate"), run: onDuplicate } : null,
    canEdit ? { key: "copy", icon: "playlist_add", label: t("Copy to playlist"), run: onCopyTo } : null,
    canEdit ? { key: "move", icon: "drive_file_move", label: t("Move to playlist"), run: onMoveTo } : null,
    canDelete ? { key: "delete", icon: "delete", label: t("Delete project"), run: onDelete, danger: true } : null,
  ].filter(Boolean);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
        className={className}
        aria-label={t("More actions")}
        title={t("More actions")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_vert</span>
      </button>
      {open ? (
        <InfoPopover anchorRef={buttonRef} onClose={close} width={200} height={items.length * 38 + 20}>
          <div role="menu" className="-my-1 flex flex-col">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={(event) => { event.stopPropagation(); setOpen(false); item.run(project); }}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold transition-colors hover:bg-surface-container ${item.danger ? "text-error" : "text-on-surface"}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </InfoPopover>
      ) : null}
    </>
  );
}

function ProjectInfoPopoverContent({ project }) {
  const { t } = useLanguage();
  const latestRevision = Number(project?.currentRevisionNumber || 0) > 0 ? `${t("vmRevision")} ${project.currentRevisionNumber}` : t("vmNone");
  const deployedRevision = project?.deployedRevisionName || (project?.deployedRevisionNumber ? `${t("vmRevision")} ${project.deployedRevisionNumber}` : t("vmNotDeployed"));

  return (
    <div className="space-y-2 text-xs text-on-surface-variant">
      <p><span className="font-bold text-on-surface">{t("vmCreatedBy")}</span> {project?.createdBy || t("vmUnknown")}</p>
      <p><span className="font-bold text-on-surface">{t("vmLastEdited")}</span> {formatDateTime(project?.lastEditedAt || project?.updatedAt, t("vmNotUpdated"))}</p>
      <p><span className="font-bold text-on-surface">{t("vmDeployedLabel")}</span> {deployedRevision}</p>
      <p><span className="font-bold text-on-surface">{t("vmLatestLabel")}</span> {latestRevision}</p>
    </div>
  );
}

const overlayButtonClassName = "flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100";

function ProjectCard({
  project, onOpen, onPlay, canEdit, canDelete, onEdit, onDelete, onDuplicate, onCopyTo, onMoveTo,
  selectMode, selected, onToggleSelect,
}) {
  const { t } = useLanguage();
  const [showInfo, setShowInfo] = useState(false);
  const [isHoveringPreview, setIsHoveringPreview] = useState(false);
  const videoRef = useRef(null);
  const infoButtonRef = useRef(null);
  const closeInfo = useCallback(() => setShowInfo(false), []);
  const { previewUrl, thumbnailUrl } = getProjectPreviewMedia(project);
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

  function activate() {
    if (selectMode) onToggleSelect(project);
    else onOpen(project);
  }

  return (
    <article className={`glass-card rounded-xl card-hover-lift group flex h-full flex-col overflow-hidden ${selected ? "ring-2 ring-[var(--freya-blue)]" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
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
            preload="none"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${isHoveringPreview ? "opacity-100" : "opacity-0"}`}
          />
        ) : null}

        {selectMode ? <SelectCheckbox selected={selected} onToggle={() => onToggleSelect(project)} className="absolute left-2 top-2" /> : null}

        {badge ? (
          <div className={`absolute top-2 inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white ${selectMode ? "left-10" : "left-2"}`}>
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

        {!selectMode ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onPlay(project); }}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-md transition-opacity duration-150 hover:bg-[var(--freya-blue)] focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={t("Play whole manual")}
            title={t("Play whole manual")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>play_arrow</span>
          </button>
        ) : null}

        {!selectMode ? (
          <div className="absolute right-2 top-2 flex items-center gap-1">
            {canEdit ? (
              <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(project); }} className={overlayButtonClassName} aria-label={t("Edit project")} title={t("Edit project")}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
              </button>
            ) : null}
            <button
              ref={infoButtonRef}
              type="button"
              onClick={(event) => { event.stopPropagation(); setShowInfo((value) => !value); }}
              className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-opacity duration-150 hover:bg-black/70 focus-visible:opacity-100 ${showInfo ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              aria-label={t("vmProjectInfo")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
            </button>
            <ProjectMenuButton
              project={project}
              canEdit={canEdit}
              canDelete={canDelete}
              onDuplicate={onDuplicate}
              onCopyTo={onCopyTo}
              onMoveTo={onMoveTo}
              onDelete={onDelete}
              className={overlayButtonClassName}
            />

            {showInfo ? (
              <InfoPopover anchorRef={infoButtonRef} onClose={closeInfo}>
                <ProjectInfoPopoverContent project={project} />
              </InfoPopover>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 px-3 py-2">
        <h3 className="truncate text-[13px] font-bold text-on-surface" title={project?.title || ""}>{project?.title || t("vmUntitledProject")}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>format_list_numbered</span>
          <StepsLabel count={project?.stepCount} t={t} />
          {Number(project?.durationSeconds) > 0 ? <span className="text-outline">· {formatDuration(project.durationSeconds)}</span> : null}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
          {project?.description || t("vmNoDescription")}
        </p>
      </div>
    </article>
  );
}

function ProjectRow({
  project, thumbWidth, onOpen, onPlay, canEdit, canDelete, onEdit, onDelete, onDuplicate, onCopyTo, onMoveTo,
  selectMode, selected, onToggleSelect,
}) {
  const { t } = useLanguage();
  const { thumbnailUrl } = getProjectPreviewMedia(project);
  const deployedRevision = project?.deployedRevisionName || (project?.deployedRevisionNumber ? `${t("vmRevision")} ${project.deployedRevisionNumber}` : t("vmNotDeployed"));
  const rowButtonClassName = "flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container hover:text-primary";

  function activate() {
    if (selectMode) onToggleSelect(project);
    else onOpen(project);
  }

  return (
    <article className={`glass-card group flex items-center gap-3 rounded-xl px-3 py-2 ${selected ? "ring-2 ring-[var(--freya-blue)]" : ""}`}>
      {selectMode ? <SelectCheckbox selected={selected} onToggle={() => onToggleSelect(project)} variant="plain" /> : null}

      <div
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }}
        className="relative aspect-video flex-shrink-0 cursor-pointer overflow-hidden rounded-lg bg-surface-container-low outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ width: thumbWidth }}
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-outline">
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>movie</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 cursor-pointer" onClick={activate}>
        <h3 className="truncate text-sm font-bold text-on-surface" title={project?.title || ""}>{project?.title || t("vmUntitledProject")}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">{project?.description || t("vmNoDescription")}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-on-surface-variant md:hidden">
          <StepsLabel count={project?.stepCount} t={t} />
          {Number(project?.durationSeconds) > 0 ? ` · ${formatDuration(project.durationSeconds)}` : ""}
        </p>
      </div>

      <div className="hidden w-24 flex-shrink-0 items-center gap-1 text-xs font-semibold text-on-surface-variant md:flex">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>format_list_numbered</span>
        <StepsLabel count={project?.stepCount} t={t} />
      </div>
      <div className="hidden w-16 flex-shrink-0 text-xs font-semibold text-on-surface-variant md:block">
        {Number(project?.durationSeconds) > 0 ? formatDuration(project.durationSeconds) : "—"}
      </div>
      <div className="hidden w-44 flex-shrink-0 text-[11px] text-on-surface-variant lg:block">
        <p className="truncate">{formatDateTime(project?.lastEditedAt || project?.updatedAt, t("vmNotUpdated"))}</p>
        <p className="truncate text-outline">{project?.lastEditedBy || project?.createdBy || ""}</p>
      </div>
      <div className="hidden w-24 flex-shrink-0 xl:block">
        {project?.deployedRevisionId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white" title={`${t("vmDeployedLabel")} ${deployedRevision}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
            {t("Deployed")}
          </span>
        ) : null}
      </div>

      {!selectMode ? (
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button type="button" onClick={() => onPlay(project)} className={rowButtonClassName} aria-label={t("Play whole manual")} title={t("Play whole manual")}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
          </button>
          {canEdit ? (
            <button type="button" onClick={() => onEdit(project)} className={rowButtonClassName} aria-label={t("Edit project")} title={t("Edit project")}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            </button>
          ) : null}
          <ProjectMenuButton
            project={project}
            canEdit={canEdit}
            canDelete={canDelete}
            onDuplicate={onDuplicate}
            onCopyTo={onCopyTo}
            onMoveTo={onMoveTo}
            onDelete={onDelete}
            className={rowButtonClassName}
          />
        </div>
      ) : null}
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
  // Routing: /videoManual/playlist/:playlistId?page=&size=&sort=&q= — the URL is the source of truth so refresh, back/forward and shared links work.
  const location = useLocation();
  const { playlistId: routePlaylistId } = useParams();
  const [searchParams] = useSearchParams();
  const isValidSize = (value) => PROJECT_PAGE_SIZE_OPTIONS.includes(value);
  const isValidSort = (value) => PROJECT_SORT_OPTIONS.some((option) => option.value === value);
  const urlPage = Number.parseInt(searchParams.get("page") || "", 10);
  const urlSize = Number.parseInt(searchParams.get("size") || "", 10);
  const page = Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1;
  const pageSize = isValidSize(urlSize) ? urlSize : readStoredValue(PAGE_SIZE_STORAGE_KEY, PROJECT_PAGE_SIZE_OPTIONS[0], isValidSize);
  const sort = isValidSort(searchParams.get("sort")) ? searchParams.get("sort") : readStoredValue(SORT_STORAGE_KEY, "newest", isValidSort);
  const searchQuery = searchParams.get("q") || "";
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState(() => readStoredValue(VIEW_MODE_STORAGE_KEY, "thumbnail", (value) => value === "thumbnail" || value === "list"));
  const [zoom, setZoom] = useState(() => readStoredValue(ZOOM_STORAGE_KEY, PROJECT_ZOOM_DEFAULT, (value) => Number.isFinite(value) && value >= PROJECT_ZOOM_MIN && value <= PROJECT_ZOOM_MAX));
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const freshRef = useRef(false);
  const selectedPlaylistId = routePlaylistId || readRememberedPlaylistId();
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState(searchQuery);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState("");
  const [projectsError, setProjectsError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [editingProject, setEditingProject] = useState(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [actionError, setActionError] = useState("");
  const [transfer, setTransfer] = useState(null); // { mode: "copy" | "move", ids: [...], label }
  const [trashOpen, setTrashOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [notice, setNotice] = useState("");
  const [playback, setPlayback] = useState(null);
  const authRole = String(readStoredAuthUser()?.role || "");
  const canEditProjects = canEditVideoManualProjects(authRole);
  const canDeleteProjects = authRole === "admin"; // backend: only admin may delete projects

  // Write playlist/page/sort/size/search into the URL (the explorer state lives there).
  function updateRoute(changes, { replace = false } = {}) {
    const next = { playlistId: selectedPlaylistId, page, sort, size: pageSize, q: searchQuery, ...changes };
    const params = new URLSearchParams();
    if (next.page > 1) params.set("page", String(next.page));
    if (next.q) params.set("q", next.q);
    params.set("sort", next.sort);
    params.set("size", String(next.size));
    if (changes.sort) storeValue(SORT_STORAGE_KEY, changes.sort);
    if (changes.size) storeValue(PAGE_SIZE_STORAGE_KEY, changes.size);
    navigate({
      pathname: next.playlistId ? `/videoManual/playlist/${next.playlistId}` : "/videoManual",
      search: `?${params.toString()}`,
    }, { replace });
  }
  const routeRef = useRef(updateRoute);
  routeRef.current = updateRoute;

  // Re-fetch the current page from the server (skipping the 1-minute server cache) and refresh the playlist counts.
  function reloadProjects() {
    freshRef.current = true;
    setRefreshNonce((value) => value + 1);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleSelectPlaylist(playlistId) {
    updateRoute({ playlistId, page: 1 });
    setSelectMode(false);
    clearSelection();
  }

  function handleToggleSelect(project) {
    const id = String(project?._id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleToggleSelectMode() {
    setSelectMode((value) => !value);
    clearSelection();
  }

  const pageIds = projects.map((project) => String(project._id));
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  function handleSelectPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleSelectAllMatching() {
    setBulkBusy(true);
    setActionError("");
    try {
      const ids = await fetchVideoManualPlaylistProjectIds(selectedPlaylistId, { q: searchQuery, sort });
      setSelectedIds(new Set(ids.map(String)));
    } catch (error) {
      setActionError(error.message || t("Failed to load projects."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!window.confirm(t("Move {count} project(s) to the recycle bin? You can restore them from there.", { count: ids.length }))) return;
    setBulkBusy(true);
    setActionError("");
    try {
      const result = await bulkVideoManualProjects("delete", ids);
      setNotice(t("Moved {count} project(s) to the recycle bin.", { count: result?.ok ?? 0 }));
      if (result?.failed?.length) setActionError(t("{count} project(s) could not be deleted: {reason}", { count: result.failed.length, reason: result.failed[0]?.error || "" }));
      clearSelection();
      reloadProjects();
    } catch (error) {
      setActionError(error.message || t("Failed to delete project."));
    } finally {
      setBulkBusy(false);
    }
  }

  function openTransfer(mode, projectsToTransfer) {
    const list = Array.isArray(projectsToTransfer) ? projectsToTransfer : [projectsToTransfer];
    if (!list.length) return;
    const single = list.length === 1 ? (list[0]?.title || projects.find((item) => String(item._id) === String(list[0]._id))?.title || "") : "";
    setTransfer({ mode, ids: list.map((item) => String(item._id)), label: single });
  }

  function handleTransferDone(result, targetPlaylist) {
    const mode = transfer?.mode;
    setTransfer(null);
    const failedCount = result?.failed?.length || 0;
    const okCount = result?.ok ?? 0;
    if (okCount === 1 && !failedCount) {
      setNotice(mode === "move"
        ? t("Moved \"{title}\" to {playlist}.", { title: result?.title || "", playlist: targetPlaylist?.name || "" })
        : t("Copied \"{title}\" to {playlist}.", { title: result?.title || "", playlist: targetPlaylist?.name || "" }));
    } else {
      setNotice(mode === "move"
        ? t("Moved {count} project(s) to {playlist}.", { count: okCount, playlist: targetPlaylist?.name || "" })
        : t("Copied {count} project(s) to {playlist}.", { count: okCount, playlist: targetPlaylist?.name || "" }));
    }
    if (failedCount) setActionError(t("{count} project(s) failed: {reason}", { count: failedCount, reason: result.failed[0]?.error || "" }));
    if (mode === "move") clearSelection();
    reloadProjects();
  }

  async function handleDeletePlaylist(target) {
    const selectedPlaylist = target;
    if (!selectedPlaylist) return;
    setActionError("");
    let preview = null;
    try {
      preview = await previewVideoManualPlaylistDelete(selectedPlaylist._id);
    } catch (error) {
      setActionError(error.message || t("Failed to delete playlist."));
      return;
    }
    const message = t("Permanently delete playlist \"{name}\"?\n\n- {projects} project(s) and their revisions will be deleted.\n- {files} uploaded/deployed file(s) used only by this playlist will be deleted from storage.\n- {kept} file(s) are also used elsewhere and will be kept.\n\nThis cannot be undone.", {
      name: selectedPlaylist.name || "",
      projects: preview?.projectCount ?? 0,
      files: preview?.filesToDelete ?? 0,
      kept: preview?.filesKept ?? 0,
    });
    if (!window.confirm(message)) return;
    try {
      const result = await deleteVideoManualPlaylist(selectedPlaylist._id);
      const remaining = playlists.filter((item) => String(item._id) !== String(selectedPlaylist._id));
      setPlaylists(remaining);
      if (String(selectedPlaylistId) === String(selectedPlaylist._id)) updateRoute({ playlistId: String(remaining[0]?._id || ""), page: 1 }, { replace: true });
      setNotice(t("Deleted playlist \"{name}\" ({files} file(s) removed, {kept} kept).", {
        name: selectedPlaylist.name || "",
        files: result?.filesDeleted ?? 0,
        kept: result?.filesKept ?? 0,
      }));
    } catch (error) {
      setActionError(error.message || t("Failed to delete playlist."));
    }
  }

  async function handleDeleteProject(project) {
    if (!window.confirm(t("Move project \"{title}\" to the recycle bin? You can restore it from there.", { title: project?.title || "" }))) return;
    setActionError("");
    try {
      await deleteVideoManualProject(project._id);
      setSelectedIds((current) => { const next = new Set(current); next.delete(String(project._id)); return next; });
      reloadProjects();
    } catch (error) {
      setActionError(error.message || t("Failed to delete project."));
    }
  }

  // Play the whole manual (all steps back to back) right from the explorer.
  async function handlePlayProject(project) {
    setActionError("");
    try {
      const full = await fetchVideoManualProject(project._id);
      const steps = getPlayableSteps(full);
      if (!steps.length) { setActionError(t("Nothing to play yet.")); return; }
      setPlayback({ steps, projectId: String(project._id) });
    } catch (error) {
      setActionError(error.message || t("Failed to load project."));
    }
  }

  async function handleDuplicateProject(project) {
    setActionError("");
    try {
      const copy = await duplicateVideoManualProject(project._id);
      setNotice(t("Duplicated as \"{title}\".", { title: copy?.title || "" }));
      reloadProjects();
    } catch (error) {
      setActionError(error.message || t("Failed to duplicate project."));
    }
  }

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const currentPlaylistRef = useRef(selectedPlaylistId);
  currentPlaylistRef.current = selectedPlaylistId;
  useEffect(() => {
    rememberPlaylistId(selectedPlaylistId);
  }, [selectedPlaylistId]);

  const deferredPlaylistQuery = useDeferredValue(playlistQuery);


  useEffect(() => {
    let cancelled = false;

    async function loadPlaylists() {
      setPlaylistsLoading(true);
      setPlaylistsError("");

      try {
        const nextPlaylists = await fetchVideoManualPlaylists();
        if (cancelled) return;

        setPlaylists(nextPlaylists);
        // Bare /videoManual or an unknown/deleted playlist id -> go to the remembered (or first) playlist.
        const currentId = currentPlaylistRef.current;
        if (!nextPlaylists.some((playlist) => String(playlist?._id) === String(currentId))) {
          routeRef.current({ playlistId: String(nextPlaylists[0]?._id || ""), page: 1 }, { replace: true });
        }
      } catch (error) {
        if (cancelled) return;
        setPlaylists([]);
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

  // Debounce the search box; the server does the searching, so a new query goes back to page 1.
  const lastSearchRef = useRef(searchQuery);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = projectQuery.trim();
      if (next === lastSearchRef.current) return;
      lastSearchRef.current = next;
      routeRef.current({ q: next, page: 1 }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [projectQuery]);

  useEffect(() => { storeValue(VIEW_MODE_STORAGE_KEY, viewMode); }, [viewMode]);
  useEffect(() => { storeValue(ZOOM_STORAGE_KEY, zoom); }, [zoom]);

  useEffect(() => {
    if (!selectedPlaylistId) {
      setProjects([]);
      setTotal(0);
      setTotalPages(1);
      setProjectsLoading(false);
      setProjectsError("");
      return undefined;
    }

    let cancelled = false;
    const nocache = freshRef.current;
    freshRef.current = false;

    async function loadProjects() {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const result = await fetchVideoManualPlaylistProjectsPage(selectedPlaylistId, { page, limit: pageSize, sort, q: searchQuery, nocache });
        if (cancelled) return;
        setProjects(result.projects);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        if (result.page !== page) routeRef.current({ page: result.page }, { replace: true }); // the server clamps pages past the end (e.g. after deleting the last page)
      } catch (error) {
        if (cancelled) return;
        setProjects([]);
        setTotal(0);
        setTotalPages(1);
        setProjectsError(error.message || "Failed to load projects.");
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylistId, page, pageSize, sort, searchQuery, refreshNonce]);

  useEffect(() => {
    if (!selectedPlaylistId || projectsLoading || projectsError) return undefined;

    const hasProcessingPreviews = projects.some((project) => String(project?.previewStatus || "").trim().toLowerCase() === "processing");
    if (!hasProcessingPreviews) return undefined;

    let cancelled = false;
    const timerId = window.setInterval(async () => {
      try {
        const result = await fetchVideoManualPlaylistProjectsPage(selectedPlaylistId, { page, limit: pageSize, sort, q: searchQuery, nocache: true });
        if (cancelled) return;
        setProjects(result.projects);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch {
        // Keep silent polling to avoid disruptive errors during background refresh.
      }
    }, PROJECT_PREVIEW_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [page, pageSize, projects, projectsError, projectsLoading, searchQuery, selectedPlaylistId, sort]);

  const filteredPlaylists = useMemo(() => (
    filterItemsByQuery(playlists, deferredPlaylistQuery, buildPlaylistSearchText)
  ), [deferredPlaylistQuery, playlists]);

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
            onClick={reloadProjects}
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
                  <div key={playlist?._id} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleSelectPlaylist(String(playlist?._id || ""))}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${isActive
                        ? "border-primary/25 bg-primary/10 shadow-[inset_3px_0_0_rgb(var(--c-primary))]"
                        : "border-transparent hover:bg-surface-container"
                      } ${canEditProjects ? "pr-[4.5rem]" : ""}`}
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
                    {canEditProjects ? (
                      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setEditingPlaylist(playlist)}
                          aria-label={t("Edit playlist")}
                          title={t("Edit playlist")}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface hover:text-primary"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                        {canDeleteProjects ? (
                          <button
                            type="button"
                            onClick={() => handleDeletePlaylist(playlist)}
                            aria-label={t("Delete playlist")}
                            title={t("Delete playlist")}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error/10 hover:text-error"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
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
                {selectedPlaylist ? formatProjectCount(total, t) : t("vmNoPlaylistSelected")}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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

          {selectedPlaylist ? (
            <ProjectListToolbar
              sort={sort}
              onSortChange={(value) => updateRoute({ sort: value, page: 1 })}
              pageSize={pageSize}
              onPageSizeChange={(value) => updateRoute({ size: value, page: 1 })}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectMode={selectMode}
              onToggleSelectMode={handleToggleSelectMode}
              canSelect={canEditProjects}
            />
          ) : null}

          {selectMode && selectedPlaylist ? (
            <ProjectBulkBar
              selectedCount={selectedIds.size}
              pageCount={projects.length}
              allOnPageSelected={allOnPageSelected}
              total={total}
              allMatchingSelected={selectedIds.size >= total && total > 0}
              busy={bulkBusy}
              canEdit={canEditProjects}
              canDelete={canDeleteProjects}
              onSelectPage={handleSelectPage}
              onSelectAllMatching={handleSelectAllMatching}
              onClear={clearSelection}
              onMove={() => openTransfer("move", [...selectedIds].map((id) => ({ _id: id })))}
              onCopy={() => openTransfer("copy", [...selectedIds].map((id) => ({ _id: id })))}
              onDelete={handleBulkDelete}
            />
          ) : null}

          {!selectedPlaylist && !playlistsLoading ? (
            <EmptyState
              icon="video_library"
              title={t("vmChoosePlaylist")}
              description={t("vmChoosePlaylistDesc")}
            />
          ) : projectsLoading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${zoom}px, 1fr))` }}>
              {Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
                <div key={index} className="rounded-xl bg-surface-container/70 animate-pulse" style={{ height: zoom * 0.5625 + 64 }} />
              ))}
            </div>
          ) : projects.length ? (
            <>
              {viewMode === "list" ? (
                <div className="flex flex-col gap-2">
                  {projects.map((project) => (
                    <ProjectRow
                      key={project?._id}
                      project={project}
                      thumbWidth={Math.round(zoom * 0.55)}
                      onPlay={handlePlayProject}
                      onOpen={(nextProject) => navigate(`/videoManual/project/${nextProject._id}/steps`, { state: { from: `${location.pathname}${location.search}` } })}
                      canEdit={canEditProjects}
                      canDelete={canDeleteProjects}
                      onEdit={setEditingProject}
                      onDelete={handleDeleteProject}
                      onDuplicate={handleDuplicateProject}
                      onCopyTo={(item) => openTransfer("copy", item)}
                      onMoveTo={(item) => openTransfer("move", item)}
                      selectMode={selectMode}
                      selected={selectedIds.has(String(project?._id))}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${zoom}px, 1fr))` }}>
                  {projects.map((project) => (
                    <ProjectCard
                      key={project?._id}
                      project={project}
                      onPlay={handlePlayProject}
                      onOpen={(nextProject) => navigate(`/videoManual/project/${nextProject._id}/steps`, { state: { from: `${location.pathname}${location.search}` } })}
                      canEdit={canEditProjects}
                      canDelete={canDeleteProjects}
                      onEdit={setEditingProject}
                      onDelete={handleDeleteProject}
                      onDuplicate={handleDuplicateProject}
                      onCopyTo={(item) => openTransfer("copy", item)}
                      onMoveTo={(item) => openTransfer("move", item)}
                      selectMode={selectMode}
                      selected={selectedIds.has(String(project?._id))}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              )}

              <ProjectPagerBar
                total={total}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={(nextPage) => {
                  if (nextPage < 1 || nextPage > totalPages) return;
                  updateRoute({ page: nextPage });
                }}
                disabled={projectsLoading}
              />
            </>
          ) : (
            <EmptyState
              icon="movie_edit"
              title={searchQuery ? t("vmNoMatchingProjects") : t("vmNoProjects")}
              description={searchQuery ? t("vmTryDifferentSearch") : t("vmNoProjectsDesc")}
            />
          )}

          {selectedPlaylist && (projects.length > 0 || projectsLoading) ? (
            <ProjectZoomSlider value={zoom} onChange={setZoom} />
          ) : null}
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
            reloadProjects();
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

      {transfer ? (
        <VideoManualCopyProjectModal
          mode={transfer.mode}
          ids={transfer.ids}
          label={transfer.label}
          playlists={playlists}
          currentPlaylistId={selectedPlaylistId}
          onClose={() => setTransfer(null)}
          onDone={handleTransferDone}
        />
      ) : null}

      {playback ? <VideoManualStepPlayerModal steps={playback.steps} projectId={playback.projectId} onClose={() => setPlayback(null)} /> : null}

      {creatingProject && selectedPlaylistId ? (
        <EditProjectModal
          project={null}
          playlistId={selectedPlaylistId}
          onClose={() => setCreatingProject(false)}
          onSaved={(created) => {
            setCreatingProject(false);
            navigate(`/videoManual/project/${created._id}/steps`);
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
