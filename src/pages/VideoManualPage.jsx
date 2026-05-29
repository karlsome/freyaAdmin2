import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import {
  canDeployVideoManualProjects,
  canEditVideoManualProjects,
  canManageVideoManualPlaylists,
  fetchVideoManualPlaylistProjects,
  fetchVideoManualPlaylists,
} from "../services/videoManualApi";
import { readStoredAuthUser } from "../utils/auth";

function formatDateTime(value, fallback = "Not updated yet") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString();
}

function formatPlural(count, singular, plural = `${singular}s`) {
  const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
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

function getProjectBadge(project) {
  if (project?.deployedRevisionId) {
    return {
      label: "Live",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    };
  }

  if (Number(project?.currentRevisionNumber || 0) > 0) {
    return {
      label: `Rev ${project.currentRevisionNumber}`,
      className: "border-primary/20 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Draft",
    className: "border-separator/35 bg-surface-container text-on-surface-variant",
  };
}

function ProjectCard({ project, onOpen }) {
  const badge = getProjectBadge(project);
  const deployedLabel = project?.deployedRevisionName || (project?.deployedRevisionNumber ? `Revision ${project.deployedRevisionNumber}` : "Not deployed");

  return (
    <article className="glass-card rounded-2xl p-4 card-hover-lift flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>movie</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface">{project?.title || "Untitled Project"}</h3>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm font-medium text-on-surface-variant">
            {project?.description || "No project description yet."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Tracks</div>
          <div className="mt-1 text-sm font-semibold text-on-surface">{project?.tracksCount || 0}</div>
        </div>
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Revisions</div>
          <div className="mt-1 text-sm font-semibold text-on-surface">{project?.currentRevisionNumber || 0}</div>
        </div>
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Updated</div>
          <div className="mt-1 text-sm font-semibold text-on-surface">{formatDateTime(project?.lastEditedAt || project?.updatedAt)}</div>
        </div>
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Deployment</div>
          <div className="mt-1 text-sm font-semibold text-on-surface">{deployedLabel}</div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-separator/30 pt-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Last editor</div>
          <div className="mt-1 truncate text-sm font-semibold text-on-surface">{project?.lastEditedBy || project?.createdBy || "Unknown"}</div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(project)}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-all duration-150 hover:opacity-90 active:scale-95"
        >
          Open Project
        </button>
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
  const navigate = useNavigate();
  const [authUser] = useState(() => readStoredAuthUser());
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

  const canManagePlaylists = canManageVideoManualPlaylists(authUser?.role);
  const canEditProjects = canEditVideoManualProjects(authUser?.role);
  const canDeployProjects = canDeployVideoManualProjects(authUser?.role);

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
        eyebrow="Shotstack Workspace"
        title="Video Manual"
        subtitle="Phase 1 focuses on the React browser: playlists on the left, projects on the right, backed by the existing Shotstack API."
        titleMeta={(
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">
            Browser MVP
          </span>
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRefreshNonce((value) => value + 1)}
              className="rounded-xl border border-separator/50 px-4 py-2 text-xs font-bold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95"
            >
              Refresh Browser
            </button>
          </div>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="dashboard-section rounded-2xl p-5 xl:col-span-4 2xl:col-span-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
            </span>
            <h2 className="text-sm font-bold text-on-surface">Playlists</h2>
            <span className="ml-auto text-[10px] text-outline">{formatPlural(filteredPlaylists.length, "playlist")}</span>
          </div>
          <p className="mb-4 ml-10 text-[11px] text-outline">The browser keeps the legacy project hierarchy, rebuilt with Freya Admin 2 styling and spacing rules.</p>

          <label className="mb-4 flex items-center gap-2 rounded-xl border border-separator/40 bg-surface-container-low px-3 py-3 text-on-surface transition-all duration-150 focus-within:border-primary/30 focus-within:bg-surface">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
            <input
              value={playlistQuery}
              onChange={(event) => setPlaylistQuery(event.target.value)}
              className="w-full bg-transparent text-sm font-medium text-on-surface outline-none placeholder:text-outline"
              placeholder="Search playlists"
              type="search"
            />
          </label>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="glass-card rounded-2xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Role</div>
              <div className="mt-1 text-sm font-semibold text-on-surface">{authUser?.role || "Viewer"}</div>
            </div>
            <div className="glass-card rounded-2xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Access</div>
              <div className="mt-1 text-sm font-semibold text-on-surface">{canManagePlaylists ? "Manage" : "Browse"}</div>
            </div>
          </div>

          {playlistsError ? (
            <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3">
              <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
              <div>
                <p className="text-sm font-bold text-on-surface">Playlist load failed</p>
                <p className="mt-1 text-xs text-on-surface-variant">{playlistsError}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {playlistsLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[88px] rounded-xl bg-surface-container/70 animate-pulse" />
              ))
            ) : filteredPlaylists.length ? (
              filteredPlaylists.map((playlist) => {
                const isActive = String(playlist?._id) === String(selectedPlaylistId);

                return (
                  <button
                    key={playlist?._id}
                    type="button"
                    onClick={() => setSelectedPlaylistId(String(playlist?._id || ""))}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-150 ${isActive
                      ? "border-primary/25 bg-primary/10 shadow-[inset_3px_0_0_rgb(var(--c-primary))]"
                      : "border-separator/35 bg-surface-container/45 hover:border-primary/30 hover:bg-surface-container hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory_2</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface">{playlist?.name || "Untitled Playlist"}</div>
                          <span className="inline-flex items-center rounded-full border border-separator/35 bg-surface px-3 py-1 text-[10px] font-bold text-on-surface-variant">
                            {playlist?.privacy || "internal"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium text-on-surface-variant">
                          {playlist?.description || "No playlist description yet."}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-[10px] text-outline">
                          <span>{formatPlural(playlist?.projectCount || 0, "project")}</span>
                          {playlist?.model ? <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold text-on-surface-variant">{playlist.model}</span> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon="folder"
                title="No accessible playlists"
                description="The browser is wired to the real Shotstack API, but no playlists are currently visible for this account."
              />
            )}
          </div>
        </section>

        <section className="dashboard-section rounded-2xl p-5 xl:col-span-8 2xl:col-span-9">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>video_library</span>
            </span>
            <h2 className="text-sm font-bold text-on-surface">Projects</h2>
            <span className="ml-auto text-[10px] text-outline">{formatPlural(filteredProjects.length, "project")}</span>
          </div>
          <p className="mb-4 ml-10 text-[11px] text-outline">
            {selectedPlaylist
              ? `${selectedPlaylist.name || "Selected playlist"} projects are loaded from the existing Video Manual Shotstack collections.`
              : "Select a playlist to load its projects into the browser workspace."}
          </p>

          <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-separator/40 bg-surface-container-low px-3 py-3 text-on-surface transition-all duration-150 focus-within:border-primary/30 focus-within:bg-surface">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>search</span>
              <input
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
                className="w-full bg-transparent text-sm font-medium text-on-surface outline-none placeholder:text-outline"
                placeholder="Search projects"
                type="search"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-2xl px-4 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Role</div>
                <div className="mt-1 text-sm font-semibold text-on-surface">{authUser?.role || "Viewer"}</div>
              </div>
              <div className="glass-card rounded-2xl px-4 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Edit</div>
                <div className="mt-1 text-sm font-semibold text-on-surface">{canEditProjects ? "Yes" : "No"}</div>
              </div>
              <div className="glass-card rounded-2xl px-4 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Deploy</div>
                <div className="mt-1 text-sm font-semibold text-on-surface">{canDeployProjects ? "Yes" : "No"}</div>
              </div>
            </div>
          </div>

          {projectsError ? (
            <div className="mb-5 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3">
              <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
              <div>
                <p className="text-sm font-bold text-on-surface">Project load failed</p>
                <p className="mt-1 text-xs text-on-surface-variant">{projectsError}</p>
              </div>
            </div>
          ) : null}

          {!selectedPlaylist && !playlistsLoading ? (
            <EmptyState
              icon="video_library"
              title="Choose a playlist first"
              description="The browser information architecture is in place. Pick a playlist from the left rail to load its projects."
            />
          ) : projectsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[260px] rounded-2xl bg-surface-container/70 animate-pulse" />
              ))}
            </div>
          ) : filteredProjects.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
              title={selectedPlaylist ? "No projects matched this search" : "No projects yet"}
              description={selectedPlaylist
                ? "Try a different project search, or choose another playlist from the left rail."
                : "This playlist does not have any projects yet."}
            />
          )}
        </section>
      </div>
    </section>
  );
}