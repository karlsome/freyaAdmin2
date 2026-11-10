import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useLanguage } from "../contexts/LanguageContext";
import {
  fetchVideoManualPlaylistProjects,
  fetchVideoManualPlaylists,
} from "../services/videoManualApi";

const PROJECT_PREVIEW_POLL_INTERVAL_MS = 4000;

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

function ProjectCard({ project, onOpen }) {
  const { t } = useLanguage();
  const [showInfo, setShowInfo] = useState(false);
  const [isHoveringPreview, setIsHoveringPreview] = useState(false);
  const videoRef = useRef(null);
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

        <div className="absolute right-2 top-2">
          <button
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
            <div
              onClick={(event) => event.stopPropagation()}
              className="absolute right-0 top-9 z-10 w-56 cursor-default rounded-xl border border-separator/40 bg-surface px-3 py-3 shadow-lg"
            >
              <div className="space-y-2 text-xs text-on-surface-variant">
                <p><span className="font-bold text-on-surface">{t("vmCreatedBy")}</span> {project?.createdBy || t("vmUnknown")}</p>
                <p><span className="font-bold text-on-surface">{t("vmLastEdited")}</span> {formatDateTime(project?.lastEditedAt || project?.updatedAt, t("vmNotUpdated"))}</p>
                <p><span className="font-bold text-on-surface">{t("vmDeployedLabel")}</span> {deployedRevision}</p>
                <p><span className="font-bold text-on-surface">{t("vmLatestLabel")}</span> {latestRevision}</p>
              </div>
            </div>
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
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState("");
  const [projectsError, setProjectsError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

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
    </section>
  );
}
