import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas, Controls, Edit, Timeline, UIController } from "@shotstack/shotstack-studio";
import VideoManualAddElementsSidebar from "../components/videoManual/VideoManualAddElementsSidebar";
import VideoManualAssetLibraryModal from "../components/videoManual/VideoManualAssetLibraryModal";
import VideoManualEditorToolbar from "../components/videoManual/VideoManualEditorToolbar";
import VideoManualStepsPanel from "../components/videoManual/VideoManualStepsPanel";
import {
  buildRevisionSnapshot,
  buildUploadedAsset,
  cloneJson,
  createShapeSvg,
  decorateAssetForPreview,
  DEFAULT_VIDEO_MANUAL_TEMPLATE,
  getAssetLibraryTypeLabel,
  getClipCategory,
  getOutputFps,
  getOutputSize,
  getTrackCount,
  measureImageClipSize,
  normalizePlayableMediaSource,
  normalizePlaylistAssetType,
  SHAPE_DIMENSIONS,
} from "../components/videoManual/videoManualEditorUtils";
import {
  createVideoManualRevision,
  fetchVideoManualPlaylistAssets,
  fetchVideoManualProject,
  getVideoManualApiBaseUrl,
  patchVideoManualProject,
  uploadVideoManualPlaylistAsset,
} from "../services/videoManualApi";

export default function VideoManualProjectEditorPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [activeAddCategory, setActiveAddCategory] = useState("text");
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [steps, setSteps] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [timelineBackground, setTimelineBackground] = useState(DEFAULT_VIDEO_MANUAL_TEMPLATE.timeline.background);
  const [outputSize, setOutputSize] = useState(DEFAULT_VIDEO_MANUAL_TEMPLATE.output.size);
  const [outputFps, setOutputFps] = useState(DEFAULT_VIDEO_MANUAL_TEMPLATE.output.fps);
  const [assetLibrary, setAssetLibrary] = useState({
    open: false,
    type: "video",
    items: [],
    loading: false,
    error: "",
    uploading: false,
    uploadProgress: null,
  });

  const editRef = useRef(null);
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const controlsRef = useRef(null);
  const uiRef = useRef(null);
  const studioElRef = useRef(null);
  const timelineElRef = useRef(null);
  const sdkInitialized = useRef(false);
  const noticeTimerRef = useRef(null);
  const assetSourceMapRef = useRef({});

  const apiBaseUrl = useMemo(() => getVideoManualApiBaseUrl(), []);
  const playlistId = useMemo(() => (project?.playlistId ? String(project.playlistId) : ""), [project?.playlistId]);

  const showNotice = useCallback((message, type = "success") => {
    window.clearTimeout(noticeTimerRef.current);
    setNotice({ type, message });
    noticeTimerRef.current = window.setTimeout(() => setNotice({ type: "", message: "" }), type === "error" ? 6000 : 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      setLoadingProject(true);
      setProjectError("");
      setNotice({ type: "", message: "" });

      try {
        const nextProject = await fetchVideoManualProject(projectId);
        if (!cancelled) setProject(nextProject);
      } catch (error) {
        if (!cancelled) {
          setProject(null);
          setProjectError(error.message || "Failed to load project.");
        }
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    }

    loadProject();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const editData = project.edit || DEFAULT_VIDEO_MANUAL_TEMPLATE;
    assetSourceMapRef.current = { ...(project.assetSourceMap || {}) };
    setTimelineBackground(editData?.timeline?.background || DEFAULT_VIDEO_MANUAL_TEMPLATE.timeline.background);
    setOutputSize(getOutputSize(editData));
    setOutputFps(getOutputFps(editData));
  }, [project]);

  const readClipAt = useCallback((trackIndex, clipIndex) => {
    try {
      const editData = editRef.current?.getEdit();
      return editData?.timeline?.tracks?.[trackIndex]?.clips?.[clipIndex] || null;
    } catch {
      return null;
    }
  }, []);

  const syncSteps = useCallback(() => {
    const edit = editRef.current;
    if (!edit) return;

    try {
      const tracks = edit.getEdit()?.timeline?.tracks || [];
      const videoClips = [];

      tracks.forEach((track, trackIndex) => {
        (track.clips || []).forEach((clip, clipIndex) => {
          if (clip?.asset?.type === "video") videoClips.push({ trackIndex, clipIndex, clip });
        });
      });

      videoClips.sort((a, b) => (a.clip.start ?? 0) - (b.clip.start ?? 0));
      setSteps(videoClips.map(({ trackIndex, clipIndex, clip }, index) => {
        const startTime = Number(clip.start ?? 0);
        const length = Number(clip.length ?? 0);
        return {
          id: `${trackIndex}:${clipIndex}`,
          trackIndex,
          clipIndex,
          label: `Step ${index + 1}`,
          startTime,
          endTime: startTime + (Number.isFinite(length) ? length : 0),
        };
      }));
    } catch (error) {
      console.warn("Failed to sync steps", error);
    }
  }, []);

  const syncEditorSettings = useCallback(() => {
    const edit = editRef.current;
    if (!edit) return;

    try {
      const editData = edit.getEdit();
      setTimelineBackground(editData?.timeline?.background || DEFAULT_VIDEO_MANUAL_TEMPLATE.timeline.background);
      setOutputSize(getOutputSize(editData));
      setOutputFps(getOutputFps(editData));
    } catch (error) {
      console.warn("Failed to sync editor settings", error);
    }
  }, []);

  const syncSelectedClip = useCallback((selection) => {
    if (!selection) {
      setSelectedClip(null);
      return;
    }

    const clip = selection.clip || readClipAt(selection.trackIndex, selection.clipIndex);
    setSelectedClip({ ...selection, clip });

    const category = getClipCategory(clip);
    if (category) {
      setActiveAddCategory(category);
      setAddDrawerOpen(true);
    }
  }, [readClipAt]);

  useEffect(() => {
    if (!project || sdkInitialized.current) return undefined;
    if (!studioElRef.current || !timelineElRef.current) return undefined;

    sdkInitialized.current = true;
    const template = cloneJson(project.edit, cloneJson(DEFAULT_VIDEO_MANUAL_TEMPLATE, DEFAULT_VIDEO_MANUAL_TEMPLATE));
    let cancelled = false;
    let edit;
    let canvas;
    let timeline;
    let controls;
    let ui;
    const unsubs = [];

    function disposeSDK() {
      unsubs.splice(0).forEach((unsubscribe) => {
        try { unsubscribe?.(); } catch { /* Ignore SDK listener cleanup errors. */ }
      });
      try { controls?.dispose?.(); } catch { /* Ignore SDK disposal errors. */ }
      try { ui?.dispose?.(); } catch { /* Ignore SDK disposal errors. */ }
      try { canvas?.dispose?.(); } catch { /* Ignore SDK disposal errors. */ }
      try { edit?.dispose?.(); } catch { /* Ignore SDK disposal errors. */ }
    }

    async function initSDK() {
      try {
        edit = new Edit(template);
        canvas = new Canvas(edit);
        ui = UIController.create(edit, canvas);

        await canvas.load();
        if (cancelled) { disposeSDK(); return; }
        await edit.load();
        if (cancelled) { disposeSDK(); return; }
        timeline = new Timeline(edit, timelineElRef.current);
        await timeline.load();
        if (cancelled) { disposeSDK(); return; }
        timeline.setZoom?.(90);
        controls = new Controls(edit);
        await controls.load();
        if (cancelled) { disposeSDK(); return; }

        editRef.current = edit;
        canvasRef.current = canvas;
        timelineRef.current = timeline;
        controlsRef.current = controls;
        uiRef.current = ui;

        const syncAll = () => {
          syncSteps();
          syncEditorSettings();
        };

        ["track:added", "track:removed", "clip:added", "clip:deleted", "edit:changed", "timeline:backgroundChanged", "output:resized", "output:fpsChanged"].forEach((eventName) => {
          unsubs.push(edit.events.on(eventName, syncAll));
        });

        unsubs.push(edit.events.on("clip:selected", syncSelectedClip));
        unsubs.push(edit.events.on("selection:cleared", () => syncSelectedClip(null)));
        unsubs.push(edit.events.on("clip:updated", ({ current }) => {
          syncAll();
          setSelectedClip((previous) => {
            if (!previous) return previous;
            if (previous.trackIndex !== current.trackIndex || previous.clipIndex !== current.clipIndex) return previous;
            return { ...previous, clip: current.clip };
          });
        }));

        edit.play();
        syncAll();
      } catch (error) {
        disposeSDK();
        if (!cancelled) {
          console.error("Shotstack SDK init failed:", error);
          setProjectError(`Failed to initialize the editor: ${error.message || "unknown error"}`);
        }
      }
    }

    initSDK();
    return () => {
      cancelled = true;
      sdkInitialized.current = false;
      disposeSDK();
      editRef.current = null;
      canvasRef.current = null;
      timelineRef.current = null;
      controlsRef.current = null;
      uiRef.current = null;
      setSelectedClip(null);
    };
  }, [project, syncEditorSettings, syncSelectedClip, syncSteps]);

  const getPlaybackTime = useCallback(() => {
    const playbackTime = Number(editRef.current?.playbackTime || 0);
    return Number.isFinite(playbackTime) ? Math.max(0, playbackTime) : 0;
  }, []);

  const rememberAssetSource = useCallback((previewUrl, publicUrl) => {
    if (!previewUrl || !publicUrl || previewUrl === publicUrl) return;
    assetSourceMapRef.current = { ...assetSourceMapRef.current, [previewUrl]: publicUrl };
  }, []);

  const handleSave = useCallback(async () => {
    if (!editRef.current || saving) return;
    setSaving(true);
    try {
      const currentEdit = editRef.current.getEdit();
      await patchVideoManualProject(projectId, { edit: currentEdit, assetSourceMap: assetSourceMapRef.current });
      showNotice("Project saved.");
    } catch (error) {
      showNotice(error.message || "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  }, [projectId, saving, showNotice]);

  const handleSaveRevision = useCallback(async () => {
    if (!editRef.current || saving) return;
    setSaving(true);
    try {
      const currentEdit = editRef.current.getEdit();
      const assetSourceMap = assetSourceMapRef.current;
      await patchVideoManualProject(projectId, { edit: currentEdit, assetSourceMap });
      const snapshot = buildRevisionSnapshot(project, currentEdit, assetSourceMap);
      const { revisionNumber } = await createVideoManualRevision(projectId, snapshot);
      setProject(await fetchVideoManualProject(projectId));
      showNotice(`Revision ${revisionNumber} created.`);
    } catch (error) {
      showNotice(error.message || "Revision save failed.", "error");
    } finally {
      setSaving(false);
    }
  }, [project, projectId, saving, showNotice]);

  const handleUndo = useCallback(() => {
    editRef.current?.undo?.().then(() => {
      syncSteps();
      syncEditorSettings();
    });
  }, [syncEditorSettings, syncSteps]);

  const handleRedo = useCallback(() => {
    editRef.current?.redo?.().then(() => {
      syncSteps();
      syncEditorSettings();
    });
  }, [syncEditorSettings, syncSteps]);

  const handleZoom = useCallback((amount) => {
    const canvas = canvasRef.current;
    if (canvas?.setZoom) {
      const currentZoom = canvas.getZoom ? canvas.getZoom() : 1;
      canvas.setZoom(Math.max(0.1, currentZoom + amount));
      return;
    }
    window.dispatchEvent(new Event("resize"));
  }, []);

  const handleAutoFit = useCallback(() => {
    canvasRef.current?.resize?.();
    window.dispatchEvent(new Event("resize"));
  }, []);

  const handleAddStep = useCallback(async () => {
    const edit = editRef.current;
    if (!edit) return;
    await edit.addTrack(getTrackCount(edit), { clips: [] });
    syncSteps();
    showNotice("Step track added.");
  }, [showNotice, syncSteps]);

  const handleAddText = useCallback(async (options = {}) => {
    const edit = editRef.current;
    if (!edit) return;

    const { text = "Change Text", fontSize = 48, fontWeight = 600, fontFamily = "Work Sans", color = "#111111", align = "center" } = options;
    await edit.addTrack(0, {
      clips: [{
        asset: {
          type: "rich-text",
          text,
          font: { family: fontFamily, size: fontSize, weight: fontWeight, color, opacity: 1 },
          align: { horizontal: align, vertical: "middle" },
        },
        start: getPlaybackTime(),
        length: 5,
        width: 600,
        height: 150,
      }],
    });
    syncSteps();
    showNotice("Text added.");
  }, [getPlaybackTime, showNotice, syncSteps]);

  const handleAddShape = useCallback(async (shapeType) => {
    const edit = editRef.current;
    if (!edit) return;

    const dimensions = SHAPE_DIMENSIONS[shapeType] || SHAPE_DIMENSIONS.rect;
    await edit.addTrack(0, {
      clips: [{
        asset: { type: "svg", src: createShapeSvg(shapeType, dimensions.width, dimensions.height), opacity: 1 },
        start: getPlaybackTime(),
        length: 5,
        width: dimensions.width,
        height: dimensions.height,
      }],
    });
    syncSteps();
    showNotice(`${shapeType === "rect" ? "Rectangle" : shapeType[0].toUpperCase() + shapeType.slice(1)} added.`);
  }, [getPlaybackTime, showNotice, syncSteps]);

  const loadAssetLibrary = useCallback(async (libraryType = assetLibrary.type) => {
    if (!playlistId) {
      setAssetLibrary((current) => ({ ...current, open: true, type: libraryType, loading: false, error: "Open a project from a playlist first." }));
      return;
    }

    setAssetLibrary((current) => ({ ...current, open: true, type: libraryType, loading: true, error: "" }));
    try {
      const assets = await fetchVideoManualPlaylistAssets(playlistId);
      setAssetLibrary((current) => ({ ...current, items: assets.map((asset) => decorateAssetForPreview(asset, apiBaseUrl)), loading: false, error: "" }));
    } catch (error) {
      setAssetLibrary((current) => ({ ...current, loading: false, error: error.message || "Failed to load playlist library." }));
    }
  }, [apiBaseUrl, assetLibrary.type, playlistId]);

  const insertPlaylistAsset = useCallback(async (asset) => {
    const edit = editRef.current;
    if (!edit || !asset) return;

    const assetType = normalizePlaylistAssetType(asset.type, asset.mimeType);
    const downloadUrl = asset.downloadUrl || asset.url;
    const normalized = normalizePlayableMediaSource(downloadUrl, apiBaseUrl);
    const sourceUrl = normalized?.previewUrl || downloadUrl;
    if (!sourceUrl) {
      showNotice("Asset has no media URL.", "error");
      return;
    }

    rememberAssetSource(sourceUrl, normalized?.publicUrl || downloadUrl);

    if (assetType === "image") {
      const size = await measureImageClipSize(sourceUrl);
      await edit.addTrack(0, {
        clips: [{ asset: { type: "image", src: sourceUrl }, start: getPlaybackTime(), length: 5, width: size.width, height: size.height, position: "center" }],
      });
    } else if (assetType === "audio") {
      await edit.addTrack(getTrackCount(edit), {
        clips: [{ asset: { type: "audio", src: sourceUrl, trim: 0, volume: 1 }, start: getPlaybackTime(), length: 10 }],
      });
    } else {
      await edit.addTrack(getTrackCount(edit), {
        clips: [{ asset: { type: "video", src: sourceUrl, trim: 0, volume: 1 }, start: getPlaybackTime(), length: 10 }],
      });
    }

    setAssetLibrary((current) => ({ ...current, open: false }));
    syncSteps();
    showNotice(`${getAssetLibraryTypeLabel(assetType)} item added.`);
  }, [apiBaseUrl, getPlaybackTime, rememberAssetSource, showNotice, syncSteps]);

  const handleUploadAsset = useCallback(async (file) => {
    if (!playlistId) {
      showNotice("Open a project from a playlist first.", "error");
      return;
    }

    const assetType = normalizePlaylistAssetType(assetLibrary.type, file.type);
    setAssetLibrary((current) => ({ ...current, uploading: true, uploadProgress: 0, error: "" }));
    try {
      const result = await uploadVideoManualPlaylistAsset(playlistId, file, {
        onProgress: (loaded, total) => {
          const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setAssetLibrary((current) => ({ ...current, uploadProgress: progress }));
        },
      });
      const uploadedAsset = decorateAssetForPreview(buildUploadedAsset(file, result, assetType), apiBaseUrl);
      setAssetLibrary((current) => ({
        ...current,
        uploading: false,
        uploadProgress: null,
        items: [uploadedAsset, ...current.items.filter((item) => String(item.assetId || item._id || "") !== String(uploadedAsset.assetId))],
      }));
      await insertPlaylistAsset(uploadedAsset);
      loadAssetLibrary(assetType);
    } catch (error) {
      setAssetLibrary((current) => ({ ...current, uploading: false, uploadProgress: null, error: error.message || "Upload failed." }));
      showNotice(error.message || "Upload failed.", "error");
    }
  }, [apiBaseUrl, assetLibrary.type, insertPlaylistAsset, loadAssetLibrary, playlistId, showNotice]);

  const handleSetBackgroundColor = useCallback(async (color) => {
    const edit = editRef.current;
    if (!edit) return;
    setTimelineBackground(color);
    await edit.setTimelineBackground(color);
    showNotice("Background updated.");
  }, [showNotice]);

  const handleSetOutputPreset = useCallback(async ({ width, height }) => {
    const edit = editRef.current;
    if (!edit) return;
    setOutputSize({ width, height });
    await edit.setOutputSize(width, height);
    showNotice("Resolution updated.");
  }, [showNotice]);

  const handleSetOutputFps = useCallback(async (fps) => {
    const edit = editRef.current;
    if (!edit) return;
    setOutputFps(fps);
    await edit.setOutputFps(fps);
    showNotice("Frame rate updated.");
  }, [showNotice]);

  const handleApplyAnimationPreset = useCallback(async (preset) => {
    const edit = editRef.current;
    if (!edit) return;

    const selection = selectedClip || edit.getSelectedClipInfo?.();
    if (!selection) {
      showNotice("Select a clip first.", "error");
      return;
    }

    const clip = readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip;
    const length = Math.max(0.5, Number(clip?.length) || 5);
    const currentScale = typeof clip?.scale === "number" ? clip.scale : 1;
    let updates = {};

    if (preset === "fadeIn") updates = { transition: { ...(clip?.transition || {}), in: "fade" } };
    if (preset === "fadeOut") updates = { transition: { ...(clip?.transition || {}), out: "fade" } };
    if (preset === "zoomIn") updates = { effect: "zoomIn" };
    if (preset === "slideLeft") updates = { effect: "slideLeft" };
    if (preset === "pulse") {
      updates = {
        scale: [
          { from: currentScale * 0.94, to: currentScale * 1.06, start: 0, length: length / 2, interpolation: "bezier", easing: "easeInOut" },
          { from: currentScale * 1.06, to: currentScale, start: length / 2, length: length / 2, interpolation: "bezier", easing: "easeInOut" },
        ],
      };
    }

    await edit.updateClip(selection.trackIndex, selection.clipIndex, updates);
    setSelectedClip({ trackIndex: selection.trackIndex, clipIndex: selection.clipIndex, clip: readClipAt(selection.trackIndex, selection.clipIndex) });
    showNotice("Animation applied.");
  }, [readClipAt, selectedClip, showNotice]);

  const handleUpdateSelectedClip = useCallback(async (updates, statusMessage = "Clip updated.") => {
    const edit = editRef.current;
    const selection = selectedClip || edit?.getSelectedClipInfo?.();
    if (!edit || !selection) return;

    try {
      await edit.updateClip(selection.trackIndex, selection.clipIndex, updates);
      const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
      setSelectedClip((current) => ({
        ...(current || selection),
        trackIndex: selection.trackIndex,
        clipIndex: selection.clipIndex,
        clip: updatedClip || { ...(selection.clip || {}), ...updates },
      }));
      syncSteps();
      syncEditorSettings();
      showNotice(statusMessage);
    } catch (error) {
      console.error("Failed to update selected clip", error);
      showNotice(error.message || "Clip update failed.", "error");
    }
  }, [readClipAt, selectedClip, showNotice, syncEditorSettings, syncSteps]);

  const handleDeleteSelectedClip = useCallback(async () => {
    const edit = editRef.current;
    const selection = selectedClip || edit?.getSelectedClipInfo?.();
    if (!edit || !selection) return;

    try {
      const clipCount = (edit.getEdit()?.timeline?.tracks || []).reduce((total, track) => total + (track.clips?.length || 0), 0);
      if (clipCount <= 1) {
        showNotice("The last clip cannot be deleted.", "error");
        return;
      }

      await edit.deleteClip(selection.trackIndex, selection.clipIndex);
      setSelectedClip(null);
      setAddDrawerOpen(false);
      syncSteps();
      showNotice("Clip deleted.");
    } catch (error) {
      console.error("Failed to delete selected clip", error);
      showNotice(error.message || "Delete failed.", "error");
    }
  }, [selectedClip, showNotice, syncSteps]);

  const handleTrimSelectedClip = useCallback(async () => {
    const edit = editRef.current;
    const selection = selectedClip || edit?.getSelectedClipInfo?.();
    if (!edit || !selection) return;

    const clip = readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip;
    if (clip?.asset?.type !== "video") {
      showNotice("Trim is available for video clips only.", "error");
      return;
    }

    const clipStart = Number(clip.start);
    const clipLength = Number(clip.length);
    const playhead = getPlaybackTime();
    if (!Number.isFinite(clipStart) || !Number.isFinite(clipLength) || clipLength <= 0) {
      showNotice("This clip cannot be trimmed because its timing is invalid.", "error");
      return;
    }

    const splitOffset = playhead - clipStart;
    if (splitOffset <= 0.05 || splitOffset >= clipLength - 0.05) {
      showNotice("Move the playhead inside the selected video to trim it.", "error");
      return;
    }

    try {
      const sourceTrim = Number(clip.asset?.trim) || 0;
      const firstLength = Number(splitOffset.toFixed(3));
      const secondClip = cloneJson(clip, {});
      delete secondClip.id;
      delete secondClip.alias;
      secondClip.start = Number(playhead.toFixed(3));
      secondClip.length = Number((clipLength - splitOffset).toFixed(3));
      secondClip.asset = {
        ...(secondClip.asset || {}),
        trim: Number((sourceTrim + splitOffset).toFixed(3)),
      };

      await edit.updateClip(selection.trackIndex, selection.clipIndex, { length: firstLength });
      await Promise.resolve(edit.addClip(selection.trackIndex, secondClip));
      edit.seek?.(playhead + 0.001);

      const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
      setSelectedClip({ ...selection, clip: updatedClip || { ...clip, length: firstLength } });
      syncSteps();
      showNotice(`Clip split at ${playhead.toFixed(2)}s.`);
    } catch (error) {
      console.error("Failed to trim selected clip", error);
      showNotice(error.message || "Trim failed.", "error");
    }
  }, [getPlaybackTime, readClipAt, selectedClip, showNotice, syncSteps]);

  const handleComingSoon = useCallback((label) => {
    showNotice(`${label} is coming soon.`);
  }, [showNotice]);

  return (
    <div className="mt-16 flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-100 font-sans dark:bg-slate-950">
      <VideoManualEditorToolbar
        projectTitle={project?.title || "Video Manual"}
        saving={saving}
        onBack={() => navigate("/videoManual")}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSaveRevision={handleSaveRevision}
        onShowHistory={() => handleComingSoon("History")}
        onZoomOut={() => handleZoom(-0.25)}
        onAutoFit={handleAutoFit}
        onZoomIn={() => handleZoom(0.25)}
        onExport={handleSave}
      />

      {(projectError || notice.message) ? (
        <div className={`relative z-20 flex justify-center px-4 py-1.5 text-xs font-black text-white ${projectError || notice.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
          {projectError || notice.message}
        </div>
      ) : null}

      {loadingProject ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-[32px] text-slate-400">progress_activity</span>
        </div>
      ) : !project ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm font-bold text-slate-500">
          {projectError || "Project not found."}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <VideoManualStepsPanel steps={steps} onSelectStep={(step) => editRef.current?.seek?.(step.startTime)} onAddStep={handleAddStep} />

            <main className="relative flex min-w-0 flex-1 flex-col bg-slate-200 dark:bg-slate-950">
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-200 p-4 dark:bg-slate-950">
                <div ref={studioElRef} data-shotstack-studio className="h-full w-full max-w-[980px] overflow-hidden rounded-lg border border-black/5 bg-black shadow-xl" />
                <style dangerouslySetInnerHTML={{ __html: `
                  [data-shotstack-studio] > div:not(canvas) { opacity: 0 !important; pointer-events: none !important; position: absolute !important; width: 0 !important; height: 0 !important; overflow: hidden !important; }
                ` }} />
              </div>
            </main>

            <VideoManualAddElementsSidebar
              isOpen={addDrawerOpen}
              activeCategory={activeAddCategory}
              selectedClip={selectedClip}
              outputSize={outputSize}
              outputFps={outputFps}
              backgroundColor={timelineBackground}
              onClose={() => setAddDrawerOpen(false)}
              onSelectCategory={(category) => {
                setActiveAddCategory(category);
                setAddDrawerOpen((currentOpen) => !(currentOpen && activeAddCategory === category));
              }}
              onAddText={handleAddText}
              onAddShape={handleAddShape}
              onOpenAssetLibrary={(libraryType) => loadAssetLibrary(libraryType)}
              onSetBackgroundColor={handleSetBackgroundColor}
              onSetOutputPreset={handleSetOutputPreset}
              onSetOutputFps={handleSetOutputFps}
              onUpdateSelectedClip={handleUpdateSelectedClip}
              onTrimSelectedClip={handleTrimSelectedClip}
              onDeleteSelectedClip={handleDeleteSelectedClip}
              onApplyAnimationPreset={handleApplyAnimationPreset}
              onComingSoon={handleComingSoon}
            />
          </div>

          <div className="relative z-20 h-[280px] flex-shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div ref={timelineElRef} data-shotstack-timeline className="video-manual-timeline-host h-full w-full" />
            <style dangerouslySetInnerHTML={{ __html: `
              .video-manual-timeline-host .ss-ruler-marker:first-child {
                align-items: flex-start;
                transform: translateX(0);
              }

              .video-manual-timeline-host .ss-ruler-marker:first-child .ss-ruler-marker-label {
                padding-left: 4px;
              }
            ` }} />
          </div>
        </div>
      )}

      <VideoManualAssetLibraryModal
        open={assetLibrary.open}
        type={assetLibrary.type}
        items={assetLibrary.items}
        loading={assetLibrary.loading}
        error={assetLibrary.error}
        uploading={assetLibrary.uploading}
        uploadProgress={assetLibrary.uploadProgress}
        onClose={() => setAssetLibrary((current) => ({ ...current, open: false }))}
        onRefresh={() => loadAssetLibrary(assetLibrary.type)}
        onUpload={handleUploadAsset}
        onUseAsset={insertPlaylistAsset}
      />
    </div>
  );
}