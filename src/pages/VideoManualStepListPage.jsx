import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { readStoredAuthUser } from "../utils/auth";
import VideoManualStepPlayerModal from "../components/videoManual/VideoManualStepPlayerModal";
import VideoManualExportStatusModal from "../components/videoManual/VideoManualExportStatusModal";
import { buildRevisionSnapshot } from "../components/videoManual/videoManualEditorUtils";
import {
  buildVideoManualDeploymentFileName,
  buildVideoManualDownloadActionUrl,
  openVideoManualUrl,
  prepareVideoManualEditForRender,
  triggerVideoManualUrlDownload,
} from "../components/videoManual/videoManualDeployUtils";
import {
  canDeployVideoManualProjects,
  canEditVideoManualProjects,
  convertVideoManualProjectToSteps,
  createVideoManualRevision,
  createVideoManualStep,
  deleteVideoManualStep,
  deployVideoManualRenderedRevision,
  deployVideoManualRevision,
  fetchVideoManualProject,
  fetchVideoManualRenderStatus,
  fetchVideoManualRevision,
  getVideoManualApiBaseUrl,
  patchVideoManualStep,
  renderVideoManualEdit,
  reorderVideoManualSteps,
  undeployVideoManualProject,
} from "../services/videoManualApi";

const RENDER_POLL_INTERVAL_MS = 5000;
const RENDER_MAX_POLLS = 120;
const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: 18 }}>{children}</span>;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stepVideoClips(step) {
  return (step?.edit?.timeline?.tracks || [])
    .flatMap((track) => track?.clips || [])
    .filter((clip) => clip?.asset?.type === "video");
}

function stepDuration(step) {
  let end = 0;
  for (const track of step?.edit?.timeline?.tracks || []) {
    for (const clip of track?.clips || []) {
      const start = Number(clip?.start);
      const length = Number(clip?.length);
      if (Number.isFinite(start) && Number.isFinite(length)) end = Math.max(end, start + length);
    }
  }
  return end || Number(step?.durationSeconds) || 0;
}

function StepThumbnail({ step, onPlay }) {
  const first = stepVideoClips(step)[0];
  const src = first ? (step.assetSourceMap?.[first.asset.src] || first.asset.src) : "";
  if (!src) {
    return (
      <div className="flex h-[72px] w-[128px] flex-shrink-0 items-center justify-center rounded-[6px] border border-dashed border-[var(--border)] text-[var(--text-muted)]">
        <Icon>movie</Icon>
      </div>
    );
  }
  return (
    <button type="button" onClick={onPlay} title="Play" className="group relative h-[72px] w-[128px] flex-shrink-0 overflow-hidden rounded-[6px] bg-black">
      <video src={`${src}#t=0.1`} preload="metadata" muted playsInline className="pointer-events-none h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/35">
        <span className="material-symbols-outlined flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-[22px] text-white">play_arrow</span>
      </span>
    </button>
  );
}

export default function VideoManualStepListPage() {
  const { t } = useLanguage();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useMemo(() => readStoredAuthUser(), []);
  const canEdit = canEditVideoManualProjects(authUser?.role);
  const canDeploy = canDeployVideoManualProjects(authUser?.role);

  const [project, setProject] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const [focusStepId, setFocusStepId] = useState("");
  const [playStepId, setPlayStepId] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const titleRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchVideoManualProject(projectId);
        if (cancelled) return;
        if (data?.structure !== "steps") {
          // Old single-timeline project: every video clip becomes a step (done once, on the server).
          if (!canEdit) throw new Error(t("This manual still uses the old format. Ask an editor to open it once to convert it."));
          await convertVideoManualProjectToSteps(projectId);
          const converted = await fetchVideoManualProject(projectId);
          if (cancelled) return;
          setProject(converted);
          setSteps(Array.isArray(converted.steps) ? converted.steps : []);
          return;
        }
        setProject(data);
        setSteps(Array.isArray(data.steps) ? data.steps : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Failed to load project.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, projectId]);

  useEffect(() => {
    if (!focusStepId) return;
    const el = titleRefs.current[focusStepId];
    if (el) { el.focus(); el.select(); el.scrollIntoView({ block: "center", behavior: "smooth" }); setFocusStepId(""); }
  }, [focusStepId, steps]);

  const totalSeconds = useMemo(() => steps.reduce((sum, step) => sum + stepDuration(step), 0), [steps]);

  const run = useCallback(async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAddStep = useCallback((afterStepId) => run(async () => {
    const result = await createVideoManualStep(projectId, { title: `${t("Step")} ${steps.length + 1}`, afterStepId });
    const created = {
      id: result.step.id,
      title: result.step.title,
      edit: null,
      assetSourceMap: {},
      subtitles: [],
      durationSeconds: 0,
    };
    setSteps((current) => {
      const index = afterStepId ? current.findIndex((s) => s.id === afterStepId) : -1;
      const next = [...current];
      next.splice(index >= 0 ? index + 1 : next.length, 0, created);
      return next;
    });
    setFocusStepId(created.id);
  }), [projectId, run, steps.length, t]);

  const handleRename = useCallback((step, value) => {
    const title = value.trim();
    if (!title || title === step.title) {
      setSteps((current) => current.map((s) => (s.id === step.id ? { ...s, title: step.title } : s)));
      return;
    }
    run(async () => {
      await patchVideoManualStep(projectId, step.id, { title });
      setSteps((current) => current.map((s) => (s.id === step.id ? { ...s, title } : s)));
    });
  }, [projectId, run]);

  const handleDelete = useCallback((step) => {
    if (!window.confirm(t("Delete step \"{title}\"? Its video edit and subtitles will be lost.", { title: step.title }))) return;
    run(async () => {
      await deleteVideoManualStep(projectId, step.id);
      setSteps((current) => current.filter((s) => s.id !== step.id));
    });
  }, [projectId, run, t]);

  const applyOrder = useCallback((nextSteps) => {
    const previous = steps;
    setSteps(nextSteps);
    run(async () => {
      try {
        await reorderVideoManualSteps(projectId, nextSteps.map((s) => s.id));
      } catch (orderError) {
        setSteps(previous);
        throw orderError;
      }
    });
  }, [projectId, run, steps]);

  const moveStep = useCallback((index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    applyOrder(next);
  }, [applyOrder, steps]);

  const handleDrop = useCallback((targetId) => {
    const fromIndex = steps.findIndex((s) => s.id === dragId);
    const toIndex = steps.findIndex((s) => s.id === targetId);
    setDragId("");
    setOverId("");
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    applyOrder(next);
  }, [applyOrder, dragId, steps]);

  // ---- Export / deploy: the server keeps project.edit = all steps joined in order, so this is one render. ----
  const waitForRender = useCallback(async (renderId) => {
    for (let attempt = 0; attempt < RENDER_MAX_POLLS; attempt += 1) {
      const result = await fetchVideoManualRenderStatus(renderId);
      const status = String(result?.status || "").toLowerCase();
      if (status === "done") return result;
      if (status === "failed") throw new Error(result?.message || "Render failed on Shotstack.");
      setExportStatus({
        type: "info",
        status: status ? status.toUpperCase() : "RENDERING",
        title: "Rendering video",
        message: t("Shotstack is rendering all steps into one video."),
        progress: { queued: 10, fetching: 30, rendering: 60, saving: 90 }[status] ?? null,
      });
      await sleep(RENDER_POLL_INTERVAL_MS);
    }
    throw new Error("Render timeout after 10 minutes.");
  }, [t]);

  const handleExport = useCallback(async () => {
    if (exportBusy) return;
    setExportBusy(true);
    let modalOpened = false;
    const openModal = (status) => { modalOpened = true; setExportStatus(status); setExportOpen(true); };
    try {
      const fresh = await fetchVideoManualProject(projectId); // always export what the server has saved
      const hasVideo = (fresh.edit?.timeline?.tracks || []).some((track) => (track?.clips || []).some((clip) => clip?.asset?.type === "video"));
      if (!hasVideo) throw new Error(t("Nothing to export yet. Add a video to at least one step first."));

      // Reuse the last revision when nothing changed since; otherwise save a new one.
      const sameAsLast = async () => {
        if (!fresh.lastRevisionId) return null;
        const last = await fetchVideoManualRevision(String(fresh.lastRevisionId));
        const key = (v) => JSON.stringify([v?.edit, v?.assetSourceMap, v?.settings?.steps, v?.settings?.subtitles]);
        return key(last?.snapshot) === key(fresh) ? last : null;
      };
      let revision = await sameAsLast();
      let revisionId = revision ? String(revision._id?.$oid || revision._id || revision.revisionId) : "";
      let revisionNumber = revision?.revisionNumber;
      if (!revision) {
        const nextNumber = (Number(fresh.currentRevisionNumber) || 0) + 1;
        const name = window.prompt(t("Export requires a saved revision. Revision name:"), `${fresh.title} Rev ${String(nextNumber).padStart(2, "0")}`);
        if (!name || !name.trim()) return;
        const created = await createVideoManualRevision(projectId, buildRevisionSnapshot(fresh, fresh.edit, fresh.assetSourceMap || {}), name.trim());
        revisionId = String(created.revisionId);
        revisionNumber = created.revisionNumber;
        revision = await fetchVideoManualRevision(revisionId);
      }

      openModal({ type: "info", status: "PREPARING", title: "Preparing export", message: "Checking whether this revision already has a flattened video ready to download.", progress: null });
      let deployData = await deployVideoManualRevision(projectId, revisionId, { reuseExistingDeployment: true, allowMissingReusableDeployment: true });
      if (deployData?.needsRender) deployData = null;

      if (!deployData) {
        const snapshot = revision.snapshot || {};
        const editJson = prepareVideoManualEditForRender(snapshot.edit, snapshot.assetSourceMap || {});
        setExportStatus({ type: "info", status: "SUBMITTING", title: "Sending to Shotstack", message: "Submitting the revision to Shotstack for online rendering.", progress: null });
        const renderStart = await renderVideoManualEdit(editJson, fresh.title || "Video Manual");
        if (!renderStart?.renderId) throw new Error("Render request did not return a render id.");
        const renderResult = await waitForRender(renderStart.renderId);
        setExportStatus({ type: "info", status: "UPLOADING", title: "Uploading render", message: "Shotstack finished rendering. Saving the final MP4 to Firebase Storage.", progress: null });
        deployData = await deployVideoManualRenderedRevision(projectId, revisionId, { renderId: renderStart.renderId, downloadUrl: renderResult?.downloadUrl || null });
      }

      const next = await fetchVideoManualProject(projectId);
      setProject(next);
      const url = deployData?.deployedVideoUrl || next?.deployedVideoUrl || "";
      const fileName = deployData?.deployedVideoFileName || next?.deployedVideoFileName || buildVideoManualDeploymentFileName(next?.title, deployData?.revisionNumber || revisionNumber);
      setExportStatus({
        type: "success",
        status: "COMPLETE",
        title: "Export Complete!",
        message: t("All steps were joined in order into one video and deployed."),
        progress: 100,
        downloadUrl: url,
        openUrl: url,
        copyUrl: url,
        downloadActionUrl: buildVideoManualDownloadActionUrl(getVideoManualApiBaseUrl(), url, fileName),
        fileName,
      });
      setExportOpen(true);
    } catch (exportError) {
      if (modalOpened) {
        setExportStatus({ type: "error", status: "FAILED", title: "Export Failed", message: exportError.message || "The video could not be exported.", progress: null });
      } else {
        setError(exportError.message || "Export failed.");
      }
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, projectId, t, waitForRender]);

  const handleUndeploy = useCallback(() => run(async () => {
    if (!window.confirm(t("Hide \"{name}\" from the factory side?", { name: project?.title || "" }))) return;
    await undeployVideoManualProject(projectId);
    setProject(await fetchVideoManualProject(projectId));
  }), [project?.title, projectId, run, t]);

  const buttonClass = "inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-2xs transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass = "flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate(location.state?.from || (project?.playlistId ? `/videoManual/playlist/${project.playlistId}` : "/videoManual"))} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Icon>arrow_back</Icon>{t("Back to manuals")}
        </button>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--text-primary)]">{project?.title || ""}</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t("Steps")}: {steps.length} · {t("Total length")}: {formatDuration(totalSeconds)}
            </p>
            {project?.deployedRevisionId ? (
              <p className="mt-0.5 text-xs font-semibold text-emerald-600">{t("Deployed")}: {project.deployedRevisionName || `Rev ${project.deployedRevisionNumber}`}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("Steps are combined in this order into one continuous video when exported.")}</p>
          </div>
          <button type="button" disabled={loading || !steps.some((step) => stepVideoClips(step).length > 0)} onClick={() => setPlayStepId("__all__")} className={buttonClass}>
            <Icon>play_circle</Icon>{t("Play all steps")}
          </button>
          {canDeploy ? (
            <div className="flex items-center gap-2">
              {project?.deployedRevisionId ? (
                <button type="button" disabled={busy || exportBusy} onClick={handleUndeploy} className={buttonClass}>
                  <Icon>visibility_off</Icon>{t("Undeploy")}
                </button>
              ) : null}
              <button type="button" disabled={busy || exportBusy || loading || steps.length === 0} onClick={handleExport} className={buttonClass}>
                <Icon className={exportBusy ? "animate-spin" : ""}>{exportBusy ? "progress_activity" : "download"}</Icon>{exportBusy ? t("Exporting...") : t("Export video")}
              </button>
            </div>
          ) : null}
          {canEdit ? (
            <button type="button" disabled={busy || loading} onClick={() => handleAddStep()} className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[var(--freya-blue-hover)] disabled:opacity-50">
              <Icon>add</Icon>{t("Add step")}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-[6px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 px-3.5 py-3 text-xs font-semibold text-[var(--text-primary)]">{error}</div>
        ) : null}

        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[108px] animate-pulse rounded-[10px] bg-[var(--surface-subtle)]" />)}</div>
        ) : steps.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[var(--border)] px-6 py-12 text-center">
            <Icon className="text-[var(--text-muted)]">account_tree</Icon>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{t("No steps yet")}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t("Create step 1, then edit its video, then add the next step.")}</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, index) => {
              const cuts = stepVideoClips(step).length;
              const empty = !step.edit;
              return (
                <li
                  key={step.id}
                  onDragOver={(event) => { if (dragId) { event.preventDefault(); setOverId(step.id); } }}
                  onDrop={(event) => { event.preventDefault(); handleDrop(step.id); }}
                  className={`flex items-center gap-3 rounded-[10px] border bg-[var(--surface-raised)] p-3 transition-colors ${overId === step.id && dragId !== step.id ? "border-[var(--freya-blue)]" : "border-[var(--border)]"} ${dragId === step.id ? "opacity-50" : ""}`}
                >
                  {canEdit ? (
                    <span
                      draggable
                      onDragStart={() => setDragId(step.id)}
                      onDragEnd={() => { setDragId(""); setOverId(""); }}
                      title={t("Drag to reorder")}
                      className="flex cursor-grab items-center text-[var(--text-muted)] active:cursor-grabbing"
                    >
                      <Icon>drag_indicator</Icon>
                    </span>
                  ) : null}
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--freya-blue)]/15 text-xs font-bold text-[var(--freya-blue)]">{index + 1}</span>
                  <StepThumbnail step={step} onPlay={() => setPlayStepId(step.id)} />
                  <div className="min-w-0 flex-1">
                    <input
                      ref={(el) => { titleRefs.current[step.id] = el; }}
                      defaultValue={step.title}
                      key={`${step.id}:${step.title}`}
                      disabled={!canEdit}
                      aria-label={t("Step title")}
                      onBlur={(event) => handleRename(step, event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                      className="w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-[var(--text-primary)] outline-none hover:border-[var(--border)] focus:border-[var(--freya-blue)] focus:bg-[var(--surface)]"
                    />
                    <p className="mt-0.5 px-1.5 text-xs text-[var(--text-muted)]">
                      {empty ? t("Empty - no video yet") : `${formatDuration(stepDuration(step))} · ${t("{n} cuts", { n: cuts })} · ${t("{n} subtitles", { n: (step.subtitles || []).length })}`}
                    </p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => navigate(`/videoManual/project/${projectId}/step/${step.id}`)} className={buttonClass}>
                    <Icon>edit</Icon>{t("Edit video")}
                  </button>
                  {canEdit ? (
                    <div className="flex flex-shrink-0 items-center">
                      <button type="button" disabled={busy || index === 0} onClick={() => moveStep(index, -1)} title={t("Move up")} className={iconButtonClass}><Icon>arrow_upward</Icon></button>
                      <button type="button" disabled={busy || index === steps.length - 1} onClick={() => moveStep(index, 1)} title={t("Move down")} className={iconButtonClass}><Icon>arrow_downward</Icon></button>
                      <button type="button" disabled={busy} onClick={() => handleDelete(step)} title={t("Delete")} className={iconButtonClass}><Icon>delete</Icon></button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        {canEdit && steps.length > 0 ? (
          <button type="button" disabled={busy} onClick={() => handleAddStep()} className={`${buttonClass} mt-3 w-full justify-center border-dashed py-2.5`}>
            <Icon>add</Icon>{t("Add step")}
          </button>
        ) : null}
      </div>

      {playStepId ? (
        <VideoManualStepPlayerModal steps={steps} startStepId={playStepId === "__all__" ? "" : playStepId} onClose={() => setPlayStepId("")} />
      ) : null}

      <VideoManualExportStatusModal
        open={exportOpen}
        status={exportStatus}
        busy={exportBusy}
        onClose={() => { if (!exportBusy) setExportOpen(false); }}
        onDownload={exportStatus?.downloadActionUrl ? () => triggerVideoManualUrlDownload(exportStatus.downloadActionUrl, exportStatus.fileName || "video-manual.mp4") : null}
        onOpenUrl={exportStatus?.openUrl ? () => openVideoManualUrl(exportStatus.openUrl) : null}
        onCopyUrl={exportStatus?.copyUrl ? () => navigator.clipboard?.writeText(exportStatus.copyUrl).catch(() => {}) : null}
      />
    </section>
  );
}
