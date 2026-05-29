import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Edit, Canvas, Controls, Timeline, UIController } from "@shotstack/shotstack-studio";
import PageHeader from "../components/PageHeader";
import {
  fetchVideoManualProject,
  patchVideoManualProject,
  createVideoManualRevision,
} from "../services/videoManualApi";

export default function VideoManualProjectPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Refs for the SDK instances and DOM mount points
  const editRef = useRef(null);
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const studioElRef = useRef(null);
  const timelineElRef = useRef(null);
  const sdkInitialized = useRef(false);

  // Load project metadata
  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoadingProject(true);
      setProjectError("");
      try {
        const nextProject = await fetchVideoManualProject(projectId);
        if (!cancelled) setProject(nextProject);
      } catch (err) {
        if (!cancelled) {
          setProject(null);
          setProjectError(err.message || "Failed to load project.");
        }
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    }

    loadProject();
    return () => { cancelled = true; };
  }, [projectId]);

  // Mount the Shotstack SDK once the project is loaded and the DOM elements are ready
  useEffect(() => {
    if (!project || sdkInitialized.current) return;
    if (!studioElRef.current || !timelineElRef.current) return;

    // Mark initialized immediately — blocks the StrictMode second invocation
    // from racing the first one on the same DOM element.
    sdkInitialized.current = true;

    const template = project.edit || { timeline: { tracks: [] } };

    let cancelled = false;
    let edit;
    let canvas;
    let timeline;
    let controls;

    function disposeSDK() {
      try { canvas?.dispose(); } catch (_) {}
      try { edit?.dispose(); } catch (_) {}
    }

    async function initSDK() {
      try {
        edit = new Edit(template);
        canvas = new Canvas(edit);
        const ui = UIController.create(edit, canvas);

        await canvas.load();
        if (cancelled) { disposeSDK(); return; }

        await edit.load();
        if (cancelled) { disposeSDK(); return; }

        timeline = new Timeline(edit, timelineElRef.current);
        await timeline.load();
        if (cancelled) { disposeSDK(); return; }

        controls = new Controls(edit);
        await controls.load();
        if (cancelled) { disposeSDK(); return; }

        edit.play();

        editRef.current = edit;
        canvasRef.current = canvas;
        timelineRef.current = timeline;
      } catch (err) {
        disposeSDK();
        if (!cancelled) {
          console.error("Shotstack SDK init failed:", err);
          setProjectError("Failed to initialize the editor: " + (err.message || "unknown error"));
        }
      }
    }

    initSDK();

    return () => {
      cancelled = true;
      sdkInitialized.current = false;
      // Only dispose via refs — if refs are null, initSDK is still in-flight
      // and will call disposeSDK() itself via the cancelled checks above.
      // Calling canvas.dispose() while canvas.load() is awaiting app.init()
      // would destroy a mid-initializing pixi app and cause the crash.
      if (editRef.current) {
        try { canvasRef.current?.dispose(); } catch (_) {}
        try { editRef.current?.dispose(); } catch (_) {}
        editRef.current = null;
        canvasRef.current = null;
        timelineRef.current = null;
      }
    };
  }, [project]);

  const handleSave = useCallback(async () => {
    if (!editRef.current || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const currentEdit = editRef.current.getEdit();
      await patchVideoManualProject(projectId, { edit: currentEdit });
      setSaveSuccess("Saved successfully.");
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch (err) {
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [projectId, saving]);

  const handleSaveRevision = useCallback(async () => {
    if (!editRef.current || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const currentEdit = editRef.current.getEdit();
      await patchVideoManualProject(projectId, { edit: currentEdit });
      const { revisionNumber } = await createVideoManualRevision(projectId, currentEdit);
      setSaveSuccess(`Revision ${revisionNumber} created.`);
      // Refresh project to update revision count
      const refreshed = await fetchVideoManualProject(projectId);
      setProject(refreshed);
      setTimeout(() => setSaveSuccess(""), 4000);
    } catch (err) {
      setSaveError(err.message || "Revision save failed.");
    } finally {
      setSaving(false);
    }
  }, [projectId, saving]);

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-16">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/videoManual")}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-separator/50 text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95"
            title="Back to browser"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-on-surface leading-tight">
              {loadingProject ? "Loading…" : (project?.title || "Untitled Project")}
            </p>
            <p className="text-[10px] text-outline leading-tight">
              {project ? `Rev. ${project.currentRevisionNumber ?? 0}` : "Shotstack Workspace"}
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {saveError ? (
            <span className="text-xs text-error font-medium">{saveError}</span>
          ) : saveSuccess ? (
            <span className="text-xs text-success font-medium">{saveSuccess}</span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loadingProject || !project}
            className="rounded-xl border border-separator/50 px-3 py-1.5 text-xs font-bold text-on-surface-variant transition-all duration-150 hover:border-primary/30 hover:bg-surface-container hover:text-primary active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleSaveRevision}
            disabled={saving || loadingProject || !project}
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Revision"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {projectError ? (
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-error/20 bg-error/10 px-4 py-3">
          <span className="material-symbols-outlined flex-shrink-0 text-error" style={{ fontSize: 18 }}>report</span>
          <p className="text-xs font-medium text-on-surface">{projectError}</p>
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loadingProject ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-outline">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
            <p className="text-sm font-medium">Loading project…</p>
          </div>
        </div>
      ) : null}

      {/* Shotstack editor — always rendered once project is available so refs attach */}
      {!loadingProject && project ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Canvas area */}
          <div
            ref={studioElRef}
            data-shotstack-studio
            className="min-h-0 flex-1 w-full"
          />
          {/* Timeline */}
          <div
            ref={timelineElRef}
            data-shotstack-timeline
            className="h-[260px] w-full flex-shrink-0"
          />
        </div>
      ) : null}
    </div>
  );
}