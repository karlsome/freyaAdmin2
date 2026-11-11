import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { readStoredAuthUser } from "../utils/auth";
import {
  canEditVideoManualProjects,
  createVideoManualStep,
  deleteVideoManualStep,
  fetchVideoManualProject,
  patchVideoManualStep,
  reorderVideoManualSteps,
} from "../services/videoManualApi";

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

function StepThumbnail({ step }) {
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
    <video
      src={`${src}#t=0.1`}
      preload="metadata"
      muted
      playsInline
      className="h-[72px] w-[128px] flex-shrink-0 rounded-[6px] bg-black object-cover"
    />
  );
}

export default function VideoManualStepListPage() {
  const { t } = useLanguage();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const authUser = useMemo(() => readStoredAuthUser(), []);
  const canEdit = canEditVideoManualProjects(authUser?.role);

  const [project, setProject] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const [focusStepId, setFocusStepId] = useState("");
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
          navigate(`/videoManual/project/${projectId}`, { replace: true });
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
  }, [navigate, projectId]);

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

  const buttonClass = "inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-2xs transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";
  const iconButtonClass = "flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <section className="h-screen overflow-y-auto px-4 pb-24 pt-20 scrollbar-hide sm:px-6 sm:pb-16 sm:pt-24 md:px-8">
      <div className="mx-auto max-w-4xl">
        <button type="button" onClick={() => navigate("/videoManual")} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Icon>arrow_back</Icon>{t("Back to manuals")}
        </button>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-[var(--text-primary)]">{project?.title || ""}</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t("Steps")}: {steps.length} · {t("Total length")}: {formatDuration(totalSeconds)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("Steps are combined in this order into one continuous video when exported.")}</p>
          </div>
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
                  <StepThumbnail step={step} />
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
                  <button type="button" disabled title={t("Video editing for steps is coming in the next update.")} className={buttonClass}>
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
    </section>
  );
}
