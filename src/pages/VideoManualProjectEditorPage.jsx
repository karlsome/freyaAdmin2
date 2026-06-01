import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Canvas, Controls, Edit, Timeline, UIController } from "@shotstack/shotstack-studio";
import VideoManualAddElementsSidebar from "../components/videoManual/VideoManualAddElementsSidebar";
import VideoManualAssetLibraryModal from "../components/videoManual/VideoManualAssetLibraryModal";
import VideoManualClipActionBar from "../components/videoManual/VideoManualClipActionBar";
import VideoManualEditorToolbar from "../components/videoManual/VideoManualEditorToolbar";
import VideoManualStepsPanel from "../components/videoManual/VideoManualStepsPanel";
import {
  buildRevisionSnapshot,
  buildAnimatedScalarUpdateForClip,
  buildKeyframeUpdatePayload,
  buildUploadedAsset,
  cloneJson,
  createAnimatedClipStateSnapshot,
  createShapeSvg,
  decorateAssetForPreview,
  DEFAULT_VIDEO_MANUAL_TEMPLATE,
  getActiveKeyframeForClip,
  getAssetLibraryTypeLabel,
  getAllKeyframeTimesForClip,
  getClipCategory,
  getClipRelativePlaybackTime,
  getKeyframedScalarValueAtTime,
  getKeyframeValuesForClip,
  getOutputFps,
  getOutputSize,
  getStaticNumericValue,
  getTrackCount,
  hasAnyAnimatedProperties,
  KEYFRAME_MIN_SPACING,
  KEYFRAME_SAME_TIME_TOLERANCE,
  measureImageClipSize,
  normalizeKeyframeFieldValue,
  normalizePlayableMediaSource,
  normalizePlaylistAssetType,
  removeKeyframeAtTime,
  roundNumericValue,
  SHAPE_DIMENSIONS,
  shiftAnimatedSegments,
} from "../components/videoManual/videoManualEditorUtils";
import {
  createVideoManualRevision,
  fetchVideoManualPlaylistAssets,
  fetchVideoManualProject,
  getVideoManualApiBaseUrl,
  patchVideoManualProject,
  uploadVideoManualPlaylistAsset,
} from "../services/videoManualApi";

const CANVAS_ZOOM_STEP = 1.12;
const CANVAS_MIN_ZOOM = 0.1;
const CANVAS_MAX_ZOOM = 4;
const TIMELINE_DEFAULT_HEIGHT = 280;
const TIMELINE_MIN_HEIGHT = 180;
const TIMELINE_MAX_HEIGHT = 560;
const EDITOR_CANVAS_MIN_HEIGHT = 180;
const TIMELINE_RESIZE_KEYBOARD_STEP = 24;
const KEYFRAME_DIMENSION_CHANGE_EPSILON = 0.5;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPositiveDimension(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function getVisualScaleFromDimensions(currentClip, sourceClip, targetTime) {
  if (!currentClip || !sourceClip) return null;

  const baseWidth = getPositiveDimension(sourceClip.width);
  const baseHeight = getPositiveDimension(sourceClip.height);
  const currentWidth = getPositiveDimension(currentClip.width);
  const currentHeight = getPositiveDimension(currentClip.height);
  const scaleRatios = [];

  if (baseWidth && currentWidth && Math.abs(currentWidth - baseWidth) > KEYFRAME_DIMENSION_CHANGE_EPSILON) {
    scaleRatios.push(currentWidth / baseWidth);
  }
  if (baseHeight && currentHeight && Math.abs(currentHeight - baseHeight) > KEYFRAME_DIMENSION_CHANGE_EPSILON) {
    scaleRatios.push(currentHeight / baseHeight);
  }

  if (!scaleRatios.length) return null;

  const resizeRatio = scaleRatios.reduce((sum, ratio) => sum + ratio, 0) / scaleRatios.length;
  const sourceScale = getKeyframedScalarValueAtTime(sourceClip.scale, targetTime, 1, 3);
  return normalizeKeyframeFieldValue("scale", sourceScale * resizeRatio);
}

function buildDimensionRestoreUpdate(currentClip, sourceClip) {
  if (!currentClip || !sourceClip) return {};

  const update = {};
  const baseWidth = getPositiveDimension(sourceClip.width);
  const baseHeight = getPositiveDimension(sourceClip.height);
  const currentWidth = getPositiveDimension(currentClip.width);
  const currentHeight = getPositiveDimension(currentClip.height);

  if (baseWidth && currentWidth && Math.abs(currentWidth - baseWidth) > KEYFRAME_DIMENSION_CHANGE_EPSILON) {
    update.width = baseWidth;
  }
  if (baseHeight && currentHeight && Math.abs(currentHeight - baseHeight) > KEYFRAME_DIMENSION_CHANGE_EPSILON) {
    update.height = baseHeight;
  }

  return update;
}

function buildKeyframeSourceClipFromSnapshot(clip, snapshot) {
  if (!clip || !snapshot) return clip;

  const width = getPositiveDimension(snapshot.width);
  const height = getPositiveDimension(snapshot.height);

  const hasOffsetSource = snapshot.offsetX || snapshot.offsetY;
  const hasRotateSource = snapshot.rotate;

  return {
    ...clip,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(snapshot.scale ? { scale: snapshot.scale } : {}),
    ...(snapshot.opacity ? { opacity: snapshot.opacity } : {}),
    ...(hasOffsetSource ? {
      offset: {
        ...(clip.offset || {}),
        ...(snapshot.offsetX ? { x: snapshot.offsetX } : {}),
        ...(snapshot.offsetY ? { y: snapshot.offsetY } : {}),
      },
    } : {}),
    ...(hasRotateSource ? {
      transform: {
        ...(clip.transform || {}),
        rotate: {
          ...((clip.transform || {}).rotate || {}),
          angle: snapshot.rotate,
        },
      },
    } : {}),
  };
}

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
  const [playbackTime, setPlaybackTime] = useState(0);
  const [keyframeDraft, setKeyframeDraft] = useState(null);
  const [keyframeEditMode, setKeyframeEditMode] = useState(null);
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT_HEIGHT);
  const [timelineResizing, setTimelineResizing] = useState(false);
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
  const editorBodyRef = useRef(null);
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const controlsRef = useRef(null);
  const uiRef = useRef(null);
  const studioElRef = useRef(null);
  const timelineElRef = useRef(null);
  const sdkInitialized = useRef(false);
  const noticeTimerRef = useRef(null);
  const assetSourceMapRef = useRef({});
  const selectedClipRef = useRef(null);
  const playbackTimeRef = useRef(0);
  const keyframeEditModeRef = useRef(null);
  const syncingAnimatedClipUpdateRef = useRef(false);
  const animatedClipStateByIdRef = useRef({});
  const visualResizeSourceByIdRef = useRef({});
  const timelineResizeFrameRef = useRef(null);

  useEffect(() => {
    selectedClipRef.current = selectedClip;
  }, [selectedClip]);

  useEffect(() => {
    playbackTimeRef.current = playbackTime;
  }, [playbackTime]);

  useEffect(() => {
    keyframeEditModeRef.current = keyframeEditMode;
  }, [keyframeEditMode]);

  const activeKeyframe = useMemo(() => {
    if (!selectedClip?.clip) return null;
    return getActiveKeyframeForClip(selectedClip.clip, playbackTime);
  }, [playbackTime, selectedClip]);

  const activeKeyframeEditMode = useMemo(() => {
    if (!selectedClip || !activeKeyframe || !keyframeEditMode) return null;
    if (keyframeEditMode.trackIndex !== selectedClip.trackIndex || keyframeEditMode.clipIndex !== selectedClip.clipIndex) return null;
    if (Math.abs(keyframeEditMode.time - activeKeyframe.time) > KEYFRAME_SAME_TIME_TOLERANCE) return null;
    return keyframeEditMode;
  }, [activeKeyframe, keyframeEditMode, selectedClip]);

  useEffect(() => {
    if (!keyframeEditMode || activeKeyframeEditMode) return;
    setKeyframeDraft(null);
    setKeyframeEditMode(null);
  }, [activeKeyframeEditMode, keyframeEditMode]);

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
      setKeyframeDraft(null);
      setKeyframeEditMode(null);
      return;
    }

    const clip = selection.clip || readClipAt(selection.trackIndex, selection.clipIndex);
    setSelectedClip({ ...selection, clip });
    setKeyframeDraft(null);
    setKeyframeEditMode(null);

    const category = getClipCategory(clip);
    if (category) {
      setActiveAddCategory(category);
      setAddDrawerOpen(true);
    }
  }, [readClipAt]);

  const syncSelectedClipFromDocument = useCallback(() => {
    setSelectedClip((current) => {
      if (!current) return current;
      const clip = readClipAt(current.trackIndex, current.clipIndex);
      if (!clip || clip === current.clip) return current;
      return { ...current, clip };
    });
  }, [readClipAt]);

  const refreshTimelineKeyframeDiamonds = useCallback(() => {
    const timelineElement = timelineElRef.current;
    const edit = editRef.current;
    if (!timelineElement || !edit) return;

    timelineElement.querySelectorAll(".video-manual-kf-diamonds").forEach((element) => element.remove());

    const editData = edit.getEdit?.();
    if (!editData?.timeline?.tracks) return;

    const selection = selectedClipRef.current;
    const active = selection?.clip ? getActiveKeyframeForClip(selection.clip, playbackTimeRef.current) : null;

    editData.timeline.tracks.forEach((track, trackIndex) => {
      (track.clips || []).forEach((clip, clipIndex) => {
        const keyframeTimes = getAllKeyframeTimesForClip(clip);
        if (!keyframeTimes.length) return;

        const clipElement = timelineElement.querySelector(`.ss-clip[data-track-index="${trackIndex}"][data-clip-index="${clipIndex}"]`);
        if (!clipElement) return;

        const clipLength = getStaticNumericValue(clip.length, 5);
        if (clipLength <= 0) return;

        if (window.getComputedStyle(clipElement).position === "static") clipElement.style.position = "relative";

        const container = document.createElement("div");
        container.className = "video-manual-kf-diamonds pointer-events-none absolute inset-0 overflow-hidden";

        keyframeTimes.forEach((time) => {
          const percent = Math.max(0, Math.min(1, time / clipLength)) * 100;
          const isActive = selection
            && selection.trackIndex === trackIndex
            && selection.clipIndex === clipIndex
            && active
            && Math.abs(active.time - time) <= KEYFRAME_SAME_TIME_TOLERANCE;
          const marker = document.createElement("div");
          marker.className = "video-manual-kf-diamond absolute top-0 text-amber-500";
          marker.style.cssText = `left:${percent}%;transform:translateX(-50%) scale(${isActive ? 1.25 : 1});filter:${isActive ? "drop-shadow(0 0 4px rgba(14,165,233,0.45))" : "none"};color:${isActive ? "#0ea5e9" : "#f59e0b"};`;
          marker.innerHTML = `<svg width="${isActive ? "10" : "8"}" height="${isActive ? "10" : "8"}" viewBox="0 0 8 8" style="display:block"><rect x="1" y="1" width="6" height="6" fill="currentColor" transform="rotate(45 4 4)"/></svg>`;
          container.appendChild(marker);
        });

        clipElement.appendChild(container);
      });
    });
  }, []);

  const scheduleTimelineKeyframeRefresh = useCallback(() => {
    window.requestAnimationFrame(() => refreshTimelineKeyframeDiamonds());
  }, [refreshTimelineKeyframeDiamonds]);

  const getTimelineHeightBounds = useCallback(() => {
    const editorBodyHeight = editorBodyRef.current?.getBoundingClientRect().height || 0;
    const layoutMaxHeight = editorBodyHeight > 0 ? editorBodyHeight - EDITOR_CANVAS_MIN_HEIGHT : TIMELINE_MAX_HEIGHT;
    const max = Math.max(TIMELINE_MIN_HEIGHT, Math.min(TIMELINE_MAX_HEIGHT, layoutMaxHeight));
    return { min: TIMELINE_MIN_HEIGHT, max };
  }, []);

  const resizeEditorSurfaces = useCallback(() => {
    if (timelineResizeFrameRef.current) window.cancelAnimationFrame(timelineResizeFrameRef.current);
    timelineResizeFrameRef.current = window.requestAnimationFrame(() => {
      timelineResizeFrameRef.current = null;
      canvasRef.current?.resize?.();
      timelineRef.current?.resize?.();
      timelineRef.current?.refresh?.();
      scheduleTimelineKeyframeRefresh();
    });
  }, [scheduleTimelineKeyframeRefresh]);

  useEffect(() => () => {
    if (timelineResizeFrameRef.current) window.cancelAnimationFrame(timelineResizeFrameRef.current);
  }, []);

  useEffect(() => {
    resizeEditorSurfaces();
  }, [resizeEditorSurfaces, timelineHeight]);

  useEffect(() => {
    const editorBody = editorBodyRef.current;
    if (!project || !editorBody || typeof ResizeObserver === "undefined") return undefined;

    const resizeObserver = new ResizeObserver(() => {
      setTimelineHeight((currentHeight) => {
        const { min, max } = getTimelineHeightBounds();
        return Math.round(clampNumber(currentHeight, min, max));
      });
      resizeEditorSurfaces();
    });

    resizeObserver.observe(editorBody);
    return () => resizeObserver.disconnect();
  }, [getTimelineHeightBounds, project, resizeEditorSurfaces]);

  const handleTimelineResizePointerDown = useCallback((event) => {
    if (event.button != null && event.button !== 0) return;

    event.preventDefault();
    const startY = event.clientY;
    const startHeight = timelineHeight;
    const handleElement = event.currentTarget;
    handleElement.setPointerCapture?.(event.pointerId);
    setTimelineResizing(true);

    const handlePointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      const { min, max } = getTimelineHeightBounds();
      setTimelineHeight(Math.round(clampNumber(startHeight + startY - moveEvent.clientY, min, max)));
    };

    const stopResize = () => {
      handleElement.releasePointerCapture?.(event.pointerId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      setTimelineResizing(false);
      resizeEditorSurfaces();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }, [getTimelineHeightBounds, resizeEditorSurfaces, timelineHeight]);

  const handleTimelineResizeKeyDown = useCallback((event) => {
    let delta = 0;

    if (event.key === "ArrowUp") delta = TIMELINE_RESIZE_KEYBOARD_STEP;
    else if (event.key === "ArrowDown") delta = -TIMELINE_RESIZE_KEYBOARD_STEP;
    else if (event.key === "PageUp") delta = TIMELINE_RESIZE_KEYBOARD_STEP * 3;
    else if (event.key === "PageDown") delta = -TIMELINE_RESIZE_KEYBOARD_STEP * 3;
    else if (event.key !== "Home" && event.key !== "End") return;

    event.preventDefault();
    setTimelineHeight((currentHeight) => {
      const { min, max } = getTimelineHeightBounds();
      if (event.key === "Home") return min;
      if (event.key === "End") return max;
      return Math.round(clampNumber(currentHeight + delta, min, max));
    });
  }, [getTimelineHeightBounds]);

  const rememberAnimatedClipStateByLocation = useCallback((trackIndex, clipIndex) => {
    const edit = editRef.current;
    const clipId = edit?.getClipId?.(trackIndex, clipIndex);
    const clip = readClipAt(trackIndex, clipIndex);
    if (!clipId) return;

    const snapshot = createAnimatedClipStateSnapshot(clip);
    if (snapshot) {
      animatedClipStateByIdRef.current[clipId] = snapshot;
    } else {
      delete animatedClipStateByIdRef.current[clipId];
    }
  }, [readClipAt]);

  const syncAnimatedClipUpdateFromEvent = useCallback((change) => {
    if (syncingAnimatedClipUpdateRef.current || !change?.previous?.clip || !change?.current?.clip) return false;

    const edit = editRef.current;
    const previousClip = change.previous.clip;
    const currentClip = change.current.clip;
    const { trackIndex, clipIndex } = change.current;
    const clipId = edit?.getClipId?.(trackIndex, clipIndex);
    if (!edit || !clipId || !edit.updateClipInDocument || !edit.resolveClip) return false;

    const rememberedState = animatedClipStateByIdRef.current[clipId] || null;
    const clipLength = getStaticNumericValue(currentClip.length ?? previousClip.length, 5);
    const clipStart = getStaticNumericValue(currentClip.start ?? previousClip.start, 0);
    const relativeTime = Number(Math.max(0, Math.min(clipLength, (Number(edit.playbackTime) || 0) - clipStart)).toFixed(3));
    const editModeContext = keyframeEditModeRef.current
      && keyframeEditModeRef.current.trackIndex === trackIndex
      && keyframeEditModeRef.current.clipIndex === clipIndex
      ? keyframeEditModeRef.current
      : null;

    let update = {};

    if (editModeContext) {
      const targetTime = Number(editModeContext.time.toFixed(3));
      const sourceClip = editModeContext.sourceClip || previousClip;
      const resizeScale = getVisualScaleFromDimensions(currentClip, sourceClip, targetTime);
      const liveValues = {
        offsetX: getStaticNumericValue(currentClip.offset?.x, getKeyframedScalarValueAtTime(sourceClip.offset?.x, targetTime, 0, 4)),
        offsetY: getStaticNumericValue(currentClip.offset?.y, getKeyframedScalarValueAtTime(sourceClip.offset?.y, targetTime, 0, 4)),
        scale: resizeScale ?? getStaticNumericValue(currentClip.scale, getKeyframedScalarValueAtTime(sourceClip.scale, targetTime, 1, 3)),
        opacity: getStaticNumericValue(currentClip.opacity, getKeyframedScalarValueAtTime(sourceClip.opacity, targetTime, 1, 3)),
        rotate: getStaticNumericValue(currentClip.transform?.rotate?.angle, getKeyframedScalarValueAtTime(sourceClip.transform?.rotate?.angle, targetTime, 0, 2)),
      };
      update = buildKeyframeUpdatePayload(previousClip, targetTime, liveValues, sourceClip) || {};
      update = { ...buildDimensionRestoreUpdate(currentClip, sourceClip), ...update };
    } else {
      const scaleSegments = shiftAnimatedSegments(previousClip.scale || rememberedState?.scale, currentClip.scale, relativeTime, 1, clipLength);
      if (scaleSegments) update.scale = scaleSegments;

      const opacitySegments = shiftAnimatedSegments(previousClip.opacity || rememberedState?.opacity, currentClip.opacity, relativeTime, 1, clipLength);
      if (opacitySegments) update.opacity = opacitySegments;

      const offsetXSegments = shiftAnimatedSegments(previousClip.offset?.x || rememberedState?.offsetX, currentClip.offset?.x, relativeTime, 0, clipLength);
      const offsetYSegments = shiftAnimatedSegments(previousClip.offset?.y || rememberedState?.offsetY, currentClip.offset?.y, relativeTime, 0, clipLength);
      if (offsetXSegments || offsetYSegments) {
        update.offset = {
          ...(currentClip.offset || {}),
          ...(offsetXSegments ? { x: offsetXSegments } : {}),
          ...(offsetYSegments ? { y: offsetYSegments } : {}),
        };
      }

      const rotateSegments = shiftAnimatedSegments(previousClip.transform?.rotate?.angle || rememberedState?.rotate, currentClip.transform?.rotate?.angle, relativeTime, 0, clipLength);
      if (rotateSegments) {
        update.transform = {
          ...(currentClip.transform || {}),
          rotate: {
            ...((currentClip.transform || {}).rotate || {}),
            angle: rotateSegments,
          },
        };
      }
    }

    if (!Object.keys(update).length) return false;

    syncingAnimatedClipUpdateRef.current = true;
    try {
      edit.updateClipInDocument(clipId, update);
      edit.resolveClip(clipId);
      canvasRef.current?.refresh?.();
      timelineRef.current?.refresh?.();
      rememberAnimatedClipStateByLocation(trackIndex, clipIndex);
      scheduleTimelineKeyframeRefresh();
    } finally {
      syncingAnimatedClipUpdateRef.current = false;
    }

    return true;
  }, [rememberAnimatedClipStateByLocation, scheduleTimelineKeyframeRefresh]);

  const installAnimatedLiveUpdateInterceptor = useCallback((edit) => {
    if (!edit || edit.__vmfaAnimatedLiveUpdateInterceptor || typeof edit.updateClipInDocument !== "function") return;

    const originalUpdateClipInDocument = edit.updateClipInDocument.bind(edit);
    const originalCommitClipUpdate = typeof edit.commitClipUpdate === "function" ? edit.commitClipUpdate.bind(edit) : null;

    edit.updateClipInDocument = (clipId, updates = {}) => {
      if (syncingAnimatedClipUpdateRef.current) {
        return originalUpdateClipInDocument(clipId, updates);
      }

      const location = edit.getDocument?.()?.getClipById?.(clipId) || null;
      const previousClip = location?.clip ? cloneJson(location.clip, null) : null;
      let nextUpdates = updates;
      let convertedAnimatedUpdate = false;

      if (previousClip && hasAnyAnimatedProperties(previousClip)) {
        const playbackTime = Number(edit.playbackTime) || 0;
        const relativeTime = getClipRelativePlaybackTime(previousClip, playbackTime);
        const editModeContext = keyframeEditModeRef.current
          && keyframeEditModeRef.current.trackIndex === location.trackIndex
          && keyframeEditModeRef.current.clipIndex === location.clipIndex
          ? keyframeEditModeRef.current
          : null;
        const activeKeyframe = getActiveKeyframeForClip(previousClip, playbackTime);
        const targetTime = editModeContext?.time ?? activeKeyframe?.time ?? relativeTime;
        const rememberedState = animatedClipStateByIdRef.current[clipId] || null;
        const sourceClip = editModeContext?.sourceClip
          || visualResizeSourceByIdRef.current[clipId]
          || buildKeyframeSourceClipFromSnapshot(previousClip, rememberedState);
        const values = getKeyframeValuesForClip(sourceClip, targetTime);
        const candidateClip = {
          ...previousClip,
          ...updates,
          ...(updates.offset ? { offset: { ...(previousClip.offset || {}), ...updates.offset } } : {}),
          ...(updates.transform ? { transform: { ...(previousClip.transform || {}), ...updates.transform } } : {}),
        };
        const resizeScale = getVisualScaleFromDimensions(candidateClip, sourceClip, targetTime);
        const dimensionRestore = buildDimensionRestoreUpdate(candidateClip, sourceClip);
        if (resizeScale != null && !visualResizeSourceByIdRef.current[clipId]) {
          visualResizeSourceByIdRef.current[clipId] = cloneJson(sourceClip, sourceClip);
        }
        let touchedAnimatedProperty = false;

        const applyField = (field, value, assignValue) => {
          const normalizedValue = normalizeKeyframeFieldValue(field, value);
          if (normalizedValue == null) return;
          touchedAnimatedProperty = true;
          assignValue(normalizedValue);
        };

        if (updates.offset && Object.prototype.hasOwnProperty.call(updates.offset, "x")) {
          applyField("offsetX", updates.offset.x, (value) => { values.offsetX = value; });
        }
        if (updates.offset && Object.prototype.hasOwnProperty.call(updates.offset, "y")) {
          applyField("offsetY", updates.offset.y, (value) => { values.offsetY = value; });
        }
        if (Object.prototype.hasOwnProperty.call(updates, "scale")) {
          applyField("scale", updates.scale, (value) => { values.scale = value; });
        }
        if (Object.prototype.hasOwnProperty.call(updates, "opacity")) {
          applyField("opacity", updates.opacity, (value) => { values.opacity = value; });
        }
        if (updates.transform?.rotate && Object.prototype.hasOwnProperty.call(updates.transform.rotate, "angle")) {
          applyField("rotate", updates.transform.rotate.angle, (value) => { values.rotate = value; });
        }
        if (resizeScale != null) {
          applyField("scale", resizeScale, (value) => { values.scale = value; });
        }

        if (touchedAnimatedProperty) {
          const keyframeUpdate = buildKeyframeUpdatePayload(previousClip, targetTime, values, sourceClip);
          if (keyframeUpdate) {
            nextUpdates = {
              ...updates,
              ...dimensionRestore,
              ...keyframeUpdate,
              ...(updates.offset || keyframeUpdate.offset ? { offset: { ...(updates.offset || {}), ...(keyframeUpdate.offset || {}) } } : {}),
              ...(updates.transform || keyframeUpdate.transform ? { transform: { ...(updates.transform || {}), ...(keyframeUpdate.transform || {}) } } : {}),
            };
            convertedAnimatedUpdate = true;
          }
        }
      }

      const result = originalUpdateClipInDocument(clipId, nextUpdates);

      if (convertedAnimatedUpdate && location) {
        window.requestAnimationFrame(() => {
          const updatedClip = readClipAt(location.trackIndex, location.clipIndex);
          if (updatedClip) {
            setSelectedClip((current) => {
              if (!current) return current;
              if (current.trackIndex !== location.trackIndex || current.clipIndex !== location.clipIndex) return current;
              return { ...current, clip: updatedClip };
            });
            rememberAnimatedClipStateByLocation(location.trackIndex, location.clipIndex);
          }
          scheduleTimelineKeyframeRefresh();
        });
      }

      return result;
    };

    if (originalCommitClipUpdate) {
      edit.commitClipUpdate = (clipId, initialConfig, finalConfig) => {
        const location = edit.getDocument?.()?.getClipById?.(clipId) || null;
        const documentClip = location?.clip || null;
        const resolvedFinalConfig = documentClip && hasAnyAnimatedProperties(documentClip)
          ? cloneJson(documentClip, finalConfig)
          : finalConfig;
        delete visualResizeSourceByIdRef.current[clipId];
        return originalCommitClipUpdate(clipId, initialConfig, resolvedFinalConfig);
      };
    }

    edit.__vmfaAnimatedLiveUpdateInterceptor = true;
  }, [readClipAt, rememberAnimatedClipStateByLocation, scheduleTimelineKeyframeRefresh]);

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
        installAnimatedLiveUpdateInterceptor(edit);
        canvas = new Canvas(edit);
        ui = UIController.create(edit, canvas);

        await canvas.load();
        if (cancelled) { disposeSDK(); return; }
        await edit.load();
        if (cancelled) { disposeSDK(); return; }
        timeline = new Timeline(edit, timelineElRef.current, { resizable: false });
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
          syncSelectedClipFromDocument();
          scheduleTimelineKeyframeRefresh();
        };

        ["track:added", "track:removed", "clip:added", "clip:deleted", "edit:changed", "timeline:backgroundChanged", "output:resized", "output:fpsChanged"].forEach((eventName) => {
          unsubs.push(edit.events.on(eventName, syncAll));
        });

        unsubs.push(edit.events.on("clip:selected", syncSelectedClip));
        unsubs.push(edit.events.on("selection:cleared", () => syncSelectedClip(null)));
        unsubs.push(edit.events.on("clip:updated", (change) => {
          syncAnimatedClipUpdateFromEvent(change);
          const { current } = change || {};
          syncAll();
          if (current) rememberAnimatedClipStateByLocation(current.trackIndex, current.clipIndex);
          setSelectedClip((previous) => {
            if (!previous) return previous;
            if (!current) return previous;
            if (previous.trackIndex !== current.trackIndex || previous.clipIndex !== current.clipIndex) return previous;
            return { ...previous, clip: readClipAt(current.trackIndex, current.clipIndex) || current.clip };
          });
        }));

        edit.play();
        syncAll();
        scheduleTimelineKeyframeRefresh();
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
  }, [installAnimatedLiveUpdateInterceptor, project, readClipAt, rememberAnimatedClipStateByLocation, scheduleTimelineKeyframeRefresh, syncAnimatedClipUpdateFromEvent, syncEditorSettings, syncSelectedClip, syncSelectedClipFromDocument, syncSteps]);

  const getPlaybackTime = useCallback(() => {
    const playbackTime = Number(editRef.current?.playbackTime || 0);
    return Number.isFinite(playbackTime) ? Math.max(0, playbackTime) : 0;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextPlaybackTime = Number(getPlaybackTime().toFixed(3));
      setPlaybackTime((current) => (Math.abs(current - nextPlaybackTime) > 0.01 ? nextPlaybackTime : current));
      syncSelectedClipFromDocument();
      refreshTimelineKeyframeDiamonds();
    }, 150);

    return () => window.clearInterval(timer);
  }, [getPlaybackTime, refreshTimelineKeyframeDiamonds, syncSelectedClipFromDocument]);

  const readLiveClipValues = useCallback((selection, clip, relativeTime, sourceClip = null) => {
    const edit = editRef.current;
    const clipId = edit?.getClipId?.(selection.trackIndex, selection.clipIndex);
    const player = clipId ? edit?.getPlayerByClipId?.(clipId) : null;
    const liveOffset = player?.calculateMoveOffset?.(0, 0);
    const resizeScale = getVisualScaleFromDimensions(clip, sourceClip, relativeTime);

    return {
      offsetX: roundNumericValue(liveOffset?.x ?? getKeyframedScalarValueAtTime(clip.offset?.x, relativeTime, 0, 4), 4, 0),
      offsetY: roundNumericValue(liveOffset?.y ?? getKeyframedScalarValueAtTime(clip.offset?.y, relativeTime, 0, 4), 4, 0),
      scale: resizeScale ?? getKeyframedScalarValueAtTime(clip.scale, relativeTime, 1, 3),
      opacity: roundNumericValue(player?.getOpacity?.() ?? getKeyframedScalarValueAtTime(clip.opacity, relativeTime, 1, 3), 3, 1),
      rotate: roundNumericValue(player?.getRotation?.() ?? getKeyframedScalarValueAtTime(clip.transform?.rotate?.angle, relativeTime, 0, 2), 2, 0),
    };
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

  const handleZoom = useCallback((direction) => {
    const canvas = canvasRef.current;
    if (canvas?.setZoom) {
      const currentZoom = canvas.getZoom ? canvas.getZoom() : 1;
      const zoomDirection = Math.sign(direction);
      if (!zoomDirection) return;
      const nextZoom = zoomDirection > 0 ? currentZoom * CANVAS_ZOOM_STEP : currentZoom / CANVAS_ZOOM_STEP;
      const targetZoom = Math.max(CANVAS_MIN_ZOOM, Math.min(CANVAS_MAX_ZOOM, nextZoom));
      let viewport = null;
      try {
        viewport = canvas.getViewportContainer?.() || null;
      } catch {
        viewport = null;
      }
      const canvasElement = canvas.application?.canvas;

      if (!viewport || !canvasElement || currentZoom <= 0) {
        canvas.setZoom(targetZoom);
        return;
      }

      const viewportCenter = {
        x: canvasElement.width / 2,
        y: canvasElement.height / 2,
      };
      const contentCenter = {
        x: (viewportCenter.x - viewport.position.x) / currentZoom,
        y: (viewportCenter.y - viewport.position.y) / currentZoom,
      };

      canvas.setZoom(targetZoom);
      const appliedZoom = canvas.getZoom ? canvas.getZoom() : targetZoom;
      viewport.position.x = viewportCenter.x - contentCenter.x * appliedZoom;
      viewport.position.y = viewportCenter.y - contentCenter.y * appliedZoom;

      if (typeof canvas.syncContentTransforms === "function") {
        canvas.syncContentTransforms();
      } else if (canvas.overlayContainer) {
        canvas.overlayContainer.scale.x = appliedZoom;
        canvas.overlayContainer.scale.y = appliedZoom;
        canvas.overlayContainer.position.x = viewport.position.x;
        canvas.overlayContainer.position.y = viewport.position.y;
      }
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
    scheduleTimelineKeyframeRefresh();
    showNotice("Animation applied.");
  }, [readClipAt, scheduleTimelineKeyframeRefresh, selectedClip, showNotice]);

  const handleAddKeyframeAtCurrentTime = useCallback(async () => {
    const edit = editRef.current;
    const selection = selectedClipRef.current || edit?.getSelectedClipInfo?.();
    if (!edit || !selection) {
      showNotice("Select a clip first.", "error");
      return;
    }

    const clip = readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip;
    if (!clip) return;

    const relativeTime = getClipRelativePlaybackTime(clip, getPlaybackTime());
    const keyframeTimes = getAllKeyframeTimesForClip(clip);
    const sameTimeKeyframe = keyframeTimes.find((time) => Math.abs(time - relativeTime) <= KEYFRAME_SAME_TIME_TOLERANCE);
    const blockingKeyframe = keyframeTimes.find((time) => {
      const delta = Math.abs(time - relativeTime);
      return delta > KEYFRAME_SAME_TIME_TOLERANCE && delta < KEYFRAME_MIN_SPACING;
    });

    if (blockingKeyframe != null) {
      showNotice(`Keyframes must be at least ${KEYFRAME_MIN_SPACING.toFixed(2)}s apart.`, "error");
      return;
    }

    const targetTime = sameTimeKeyframe ?? relativeTime;
    const clipId = edit.getClipId?.(selection.trackIndex, selection.clipIndex);
    const rememberedState = clipId ? animatedClipStateByIdRef.current[clipId] || null : null;
    const sourceClip = buildKeyframeSourceClipFromSnapshot(clip, rememberedState);
    const liveValues = readLiveClipValues(selection, clip, targetTime, sourceClip);
    const dimensionRestore = buildDimensionRestoreUpdate(clip, sourceClip);
    const updates = {
      ...dimensionRestore,
      ...(buildKeyframeUpdatePayload(clip, targetTime, liveValues, sourceClip) || {}),
    };
    if (!Object.keys(updates).length) {
      showNotice("Unable to record keyframe.", "error");
      return;
    }

    try {
      await edit.updateClip(selection.trackIndex, selection.clipIndex, updates);
      const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
      const clipStart = getStaticNumericValue(clip.start, 0);
      const clipLength = getStaticNumericValue(clip.length, 5);
      const seekTime = Number((clipStart + Math.max(0, Math.min(targetTime, Math.max(0, clipLength - 0.001)))).toFixed(3));
      edit.seek?.(seekTime);
      setPlaybackTime(seekTime);
      setSelectedClip({ trackIndex: selection.trackIndex, clipIndex: selection.clipIndex, clip: updatedClip || { ...clip, ...updates } });
      setKeyframeDraft(null);
      setKeyframeEditMode(null);
      setActiveAddCategory("animation");
      setAddDrawerOpen(true);
      scheduleTimelineKeyframeRefresh();
      showNotice(`${sameTimeKeyframe != null ? "Keyframe updated" : "Keyframe recorded"} at T=${targetTime.toFixed(2)}s.`);
    } catch (error) {
      console.error("Failed to add keyframe", error);
      showNotice(error.message || "Keyframe update failed.", "error");
    }
  }, [getPlaybackTime, readClipAt, readLiveClipValues, scheduleTimelineKeyframeRefresh, showNotice]);

  const handleEnterKeyframeEditMode = useCallback(() => {
    const selection = selectedClipRef.current;
    const clip = selection ? readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip : null;
    const currentActiveKeyframe = clip ? getActiveKeyframeForClip(clip, getPlaybackTime()) : null;
    if (!selection || !clip || !currentActiveKeyframe) {
      showNotice("Move the playhead onto a keyframe first.", "error");
      return;
    }

    setKeyframeDraft(null);
    setKeyframeEditMode({
      trackIndex: selection.trackIndex,
      clipIndex: selection.clipIndex,
      time: currentActiveKeyframe.time,
      baseline: { ...currentActiveKeyframe.values },
      sourceClip: cloneJson(clip, {}),
    });
    showNotice("Keyframe edit mode enabled.");
  }, [getPlaybackTime, readClipAt, showNotice]);

  const handleChangeKeyframeDraftValue = useCallback((field, value) => {
    const selection = selectedClipRef.current;
    const normalizedValue = normalizeKeyframeFieldValue(field, value);
    if (!selection || normalizedValue == null) return;

    setKeyframeDraft((current) => ({
      trackIndex: selection.trackIndex,
      clipIndex: selection.clipIndex,
      time: activeKeyframe?.time ?? keyframeEditMode?.time ?? 0,
      values: {
        ...(current?.values || {}),
        [field]: normalizedValue,
      },
    }));
  }, [activeKeyframe?.time, keyframeEditMode?.time]);

  const handleRecordKeyframeEditMode = useCallback(async () => {
    const edit = editRef.current;
    const selection = selectedClipRef.current;
    if (!edit || !selection || !activeKeyframeEditMode) {
      showNotice("Move the playhead onto the same keyframe before recording.", "error");
      return;
    }

    const currentClip = readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip;
    const sourceClip = activeKeyframeEditMode.sourceClip || currentClip;
    const sourceActiveKeyframe = getActiveKeyframeForClip(sourceClip, getPlaybackTime());
    if (!sourceActiveKeyframe || Math.abs(sourceActiveKeyframe.time - activeKeyframeEditMode.time) > KEYFRAME_SAME_TIME_TOLERANCE) {
      showNotice("Move the playhead onto the same keyframe before recording.", "error");
      return;
    }

    const liveValues = readLiveClipValues(selection, currentClip, activeKeyframeEditMode.time, sourceClip);
    const values = {
      ...getKeyframeValuesForClip(sourceClip, activeKeyframeEditMode.time),
      ...liveValues,
      ...(keyframeDraft?.values || {}),
    };
    const updates = {
      ...buildDimensionRestoreUpdate(currentClip, sourceClip),
      ...(buildKeyframeUpdatePayload(currentClip, activeKeyframeEditMode.time, values, sourceClip) || {}),
    };

    if (!Object.keys(updates).length) {
      showNotice("Unable to record keyframe.", "error");
      return;
    }

    try {
      await edit.updateClip(selection.trackIndex, selection.clipIndex, updates);
      const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
      setSelectedClip({ trackIndex: selection.trackIndex, clipIndex: selection.clipIndex, clip: updatedClip || { ...currentClip, ...updates } });
      setKeyframeDraft(null);
      setKeyframeEditMode(null);
      scheduleTimelineKeyframeRefresh();
      showNotice(`Keyframe recorded at T=${activeKeyframeEditMode.time.toFixed(2)}s.`);
    } catch (error) {
      console.error("Failed to record keyframe", error);
      showNotice(error.message || "Keyframe record failed.", "error");
    }
  }, [activeKeyframeEditMode, getPlaybackTime, keyframeDraft?.values, readClipAt, readLiveClipValues, scheduleTimelineKeyframeRefresh, showNotice]);

  const handleCancelKeyframeEditMode = useCallback(async () => {
    const edit = editRef.current;
    const selection = selectedClipRef.current;
    const sourceClip = keyframeEditMode?.sourceClip;

    if (edit && selection && sourceClip) {
      const updates = {};
      if (Object.prototype.hasOwnProperty.call(sourceClip, "scale")) updates.scale = cloneJson(sourceClip.scale, sourceClip.scale);
      if (Object.prototype.hasOwnProperty.call(sourceClip, "opacity")) updates.opacity = cloneJson(sourceClip.opacity, sourceClip.opacity);
      if (sourceClip.offset || selection.clip?.offset) updates.offset = cloneJson(sourceClip.offset || {}, {});
      if (sourceClip.transform || selection.clip?.transform) updates.transform = cloneJson(sourceClip.transform || {}, {});

      if (Object.keys(updates).length) {
        try {
          await edit.updateClip(selection.trackIndex, selection.clipIndex, updates);
          const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
          setSelectedClip({ trackIndex: selection.trackIndex, clipIndex: selection.clipIndex, clip: updatedClip || { ...selection.clip, ...updates } });
        } catch (error) {
          console.error("Failed to restore keyframe edit source", error);
        }
      }
    }

    setKeyframeDraft(null);
    setKeyframeEditMode(null);
    scheduleTimelineKeyframeRefresh();
    showNotice("Keyframe edit cancelled.");
  }, [keyframeEditMode?.sourceClip, readClipAt, scheduleTimelineKeyframeRefresh, showNotice]);

  const handleDeleteKeyframe = useCallback(async () => {
    const edit = editRef.current;
    const selection = selectedClipRef.current || edit?.getSelectedClipInfo?.();
    if (!edit || !selection) return;

    const clip = readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip;
    const currentActiveKeyframe = clip ? getActiveKeyframeForClip(clip, getPlaybackTime()) : null;
    if (!clip || !currentActiveKeyframe) {
      showNotice("Move the playhead onto a keyframe first.", "error");
      return;
    }

    const updates = removeKeyframeAtTime(clip, currentActiveKeyframe.time);
    if (!updates) {
      showNotice("No keyframe to remove at the current playhead.", "error");
      return;
    }

    try {
      await edit.updateClip(selection.trackIndex, selection.clipIndex, updates);
      const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
      setSelectedClip({ trackIndex: selection.trackIndex, clipIndex: selection.clipIndex, clip: updatedClip || { ...clip, ...updates } });
      setKeyframeDraft(null);
      setKeyframeEditMode(null);
      scheduleTimelineKeyframeRefresh();
      showNotice(`Keyframe removed at T=${currentActiveKeyframe.time.toFixed(2)}s.`);
    } catch (error) {
      console.error("Failed to delete keyframe", error);
      showNotice(error.message || "Keyframe delete failed.", "error");
    }
  }, [getPlaybackTime, readClipAt, scheduleTimelineKeyframeRefresh, showNotice]);

  const handleUpdateSelectedClip = useCallback(async (updates, statusMessage = "Clip updated.") => {
    const edit = editRef.current;
    const selection = selectedClip || edit?.getSelectedClipInfo?.();
    if (!edit || !selection) return;

    const clip = readClipAt(selection.trackIndex, selection.clipIndex) || selection.clip;
    const animatedUpdate = buildAnimatedScalarUpdateForClip(clip, updates, getPlaybackTime());
    if (animatedUpdate.blocked) {
      showNotice("Move the playhead onto a keyframe, or add a new one first.", "error");
      return;
    }

    try {
      await edit.updateClip(selection.trackIndex, selection.clipIndex, animatedUpdate.updates);
      const updatedClip = readClipAt(selection.trackIndex, selection.clipIndex);
      setSelectedClip((current) => ({
        ...(current || selection),
        trackIndex: selection.trackIndex,
        clipIndex: selection.clipIndex,
        clip: updatedClip || { ...(selection.clip || {}), ...animatedUpdate.updates },
      }));
      syncSteps();
      syncEditorSettings();
      scheduleTimelineKeyframeRefresh();
      showNotice(statusMessage);
    } catch (error) {
      console.error("Failed to update selected clip", error);
      showNotice(error.message || "Clip update failed.", "error");
    }
  }, [getPlaybackTime, readClipAt, scheduleTimelineKeyframeRefresh, selectedClip, showNotice, syncEditorSettings, syncSteps]);

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
      scheduleTimelineKeyframeRefresh();
      showNotice("Clip deleted.");
    } catch (error) {
      console.error("Failed to delete selected clip", error);
      showNotice(error.message || "Delete failed.", "error");
    }
  }, [scheduleTimelineKeyframeRefresh, selectedClip, showNotice, syncSteps]);

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
      scheduleTimelineKeyframeRefresh();
      showNotice(`Clip split at ${playhead.toFixed(2)}s.`);
    } catch (error) {
      console.error("Failed to trim selected clip", error);
      showNotice(error.message || "Trim failed.", "error");
    }
  }, [getPlaybackTime, readClipAt, scheduleTimelineKeyframeRefresh, selectedClip, showNotice, syncSteps]);

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
        onZoomOut={() => handleZoom(-1)}
        onAutoFit={handleAutoFit}
        onZoomIn={() => handleZoom(1)}
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
        <div ref={editorBodyRef} className={`relative flex min-h-0 flex-1 flex-col ${timelineResizing ? "select-none" : ""}`}>
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
              playbackTime={playbackTime}
              activeKeyframe={activeKeyframe}
              keyframeDraft={keyframeDraft}
              isKeyframeEditMode={!!activeKeyframeEditMode}
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
              onAddKeyframe={handleAddKeyframeAtCurrentTime}
              onEnterKeyframeEditMode={handleEnterKeyframeEditMode}
              onRecordKeyframeEditMode={handleRecordKeyframeEditMode}
              onCancelKeyframeEditMode={handleCancelKeyframeEditMode}
              onDeleteKeyframe={handleDeleteKeyframe}
              onChangeKeyframeDraftValue={handleChangeKeyframeDraftValue}
              onApplyAnimationPreset={handleApplyAnimationPreset}
              onComingSoon={handleComingSoon}
            />
          </div>

          <div
            className="relative z-20 flex flex-shrink-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
            style={{ height: timelineHeight }}
          >
            <div
              role="separator"
              aria-label="Resize timeline"
              aria-orientation="horizontal"
              aria-valuemin={TIMELINE_MIN_HEIGHT}
              aria-valuemax={TIMELINE_MAX_HEIGHT}
              aria-valuenow={timelineHeight}
              aria-valuetext={`${timelineHeight}px`}
              tabIndex={0}
              title="Drag to resize timeline"
              onPointerDown={handleTimelineResizePointerDown}
              onKeyDown={handleTimelineResizeKeyDown}
              onDoubleClick={() => setTimelineHeight(TIMELINE_DEFAULT_HEIGHT)}
              className={`group absolute -top-4 left-0 right-0 z-30 flex h-8 cursor-row-resize touch-none items-center justify-center outline-none ${timelineResizing ? "bg-blue-500/10" : ""}`}
            >
              <span className={`flex h-5 w-20 items-center justify-center gap-1 rounded-full border shadow-sm ring-1 ring-black/5 transition-all duration-200 ease-out group-hover:w-28 group-hover:gap-1.5 group-focus-visible:w-28 group-focus-visible:gap-1.5 ${timelineResizing ? "w-28 gap-1.5 border-blue-400 bg-blue-50 ring-blue-400/30" : "border-slate-200 bg-white group-hover:border-blue-300 group-hover:bg-blue-50 group-hover:ring-blue-300/30 group-focus-visible:border-blue-400 group-focus-visible:bg-blue-50 group-focus-visible:ring-2 group-focus-visible:ring-blue-400/40 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10 dark:group-hover:border-blue-500 dark:group-hover:bg-slate-800"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${timelineResizing ? "bg-blue-500" : "bg-slate-400 group-hover:bg-blue-500 dark:bg-slate-500"}`} />
                <span className={`h-1.5 w-1.5 rounded-full ${timelineResizing ? "bg-blue-500" : "bg-slate-400 group-hover:bg-blue-500 dark:bg-slate-500"}`} />
                <span className={`h-1.5 w-1.5 rounded-full ${timelineResizing ? "bg-blue-500" : "bg-slate-400 group-hover:bg-blue-500 dark:bg-slate-500"}`} />
              </span>
            </div>
            <VideoManualClipActionBar selectedClip={selectedClip} onTrimClip={handleTrimSelectedClip} onDeleteClip={handleDeleteSelectedClip} />
            <div ref={timelineElRef} data-shotstack-timeline className="video-manual-timeline-host min-h-0 flex-1 w-full" />
            <style dangerouslySetInnerHTML={{ __html: `
              .video-manual-timeline-host .ss-ruler-marker:first-child {
                align-items: flex-start;
                transform: translateX(0);
              }

              .video-manual-timeline-host .ss-ruler-marker:first-child .ss-ruler-marker-label {
                padding-left: 4px;
              }

              .video-manual-timeline-host .ss-timeline-divider {
                display: none !important;
                pointer-events: none !important;
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