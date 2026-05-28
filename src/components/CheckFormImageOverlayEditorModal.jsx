import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Arrow, Circle, Image as KonvaImage, Layer, Rect, Stage, Transformer } from "react-konva";
import IconButton from "./IconButton";

const TOOL_OPTIONS = [
  { value: "select", label: "Select", icon: "arrow_selector_tool" },
  { value: "rect", label: "Box", icon: "crop_square" },
  { value: "circle", label: "Circle", icon: "circle" },
  { value: "arrow", label: "Arrow", icon: "arrow_right_alt" },
];

const DEFAULT_COLOR = "#ef4444";
const DEFAULT_STROKE_WIDTH = 5;
const MIN_DRAW_SIZE = 8;
const REFERENCE_IMAGE_EXPORT_MAX_DIMENSION = 2200;
const REFERENCE_IMAGE_EXPORT_MIN_DIMENSION = 1200;
const REFERENCE_IMAGE_EXPORT_MAX_BYTES = 4.5 * 1024 * 1024;
const REFERENCE_IMAGE_EXPORT_QUALITY_STEPS = [0.9, 0.84, 0.78, 0.72, 0.66, 0.6];
const REFERENCE_IMAGE_EXPORT_DOWNSCALE_RATIO = 0.82;

function getViewportSize() {
  if (typeof window === "undefined") {
    return { width: 1280, height: 900 };
  }

  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
}

function fitImageSize(width, height, maxWidth, maxHeight) {
  const safeWidth = Math.max(width || 1, 1);
  const safeHeight = Math.max(height || 1, 1);
  const scale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight, 1);

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    scale,
  };
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error("Image source is required."));
      return;
    }

    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = source;
  });
}

function estimateDataURLBytes(dataURL) {
  const base64Payload = String(dataURL || "").split(",")[1] || "";
  return Math.ceil((base64Payload.length * 3) / 4);
}

async function exportOptimizedReferenceImage({
  stage,
  sourceWidth,
  sourceHeight,
}) {
  const exportSize = fitImageSize(
    sourceWidth,
    sourceHeight,
    REFERENCE_IMAGE_EXPORT_MAX_DIMENSION,
    REFERENCE_IMAGE_EXPORT_MAX_DIMENSION
  );
  const stageWidth = Math.max(stage.width() || 0, 1);
  const stageHeight = Math.max(stage.height() || 0, 1);
  const exportPixelRatio = Math.max(
    exportSize.width / stageWidth,
    exportSize.height / stageHeight,
    1
  );
  const stageDataURL = stage.toDataURL({
    pixelRatio: exportPixelRatio,
    mimeType: "image/png",
  });
  const flattenedImage = await loadImageElement(stageDataURL);

  let targetWidth = exportSize.width;
  let targetHeight = exportSize.height;

  while (true) {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(flattenedImage, 0, 0, targetWidth, targetHeight);

    let smallestCandidate = "";
    let smallestBytes = Number.POSITIVE_INFINITY;

    for (const quality of REFERENCE_IMAGE_EXPORT_QUALITY_STEPS) {
      const candidate = canvas.toDataURL("image/jpeg", quality);
      const candidateBytes = estimateDataURLBytes(candidate);

      if (candidateBytes < smallestBytes) {
        smallestBytes = candidateBytes;
        smallestCandidate = candidate;
      }

      if (candidateBytes <= REFERENCE_IMAGE_EXPORT_MAX_BYTES) {
        return candidate;
      }
    }

    if (Math.max(targetWidth, targetHeight) <= REFERENCE_IMAGE_EXPORT_MIN_DIMENSION) {
      return smallestCandidate;
    }

    const currentLargestDimension = Math.max(targetWidth, targetHeight);
    const nextLargestDimension = Math.max(
      Math.round(currentLargestDimension * REFERENCE_IMAGE_EXPORT_DOWNSCALE_RATIO),
      REFERENCE_IMAGE_EXPORT_MIN_DIMENSION
    );
    const resizeRatio = nextLargestDimension / currentLargestDimension;

    if (resizeRatio >= 1) {
      return smallestCandidate;
    }

    targetWidth = Math.max(1, Math.round(targetWidth * resizeRatio));
    targetHeight = Math.max(1, Math.round(targetHeight * resizeRatio));
  }
}

function createRectFromDraft(draft) {
  const width = Math.abs((draft.endX ?? draft.startX) - draft.startX);
  const height = Math.abs((draft.endY ?? draft.startY) - draft.startY);
  if (width < MIN_DRAW_SIZE && height < MIN_DRAW_SIZE) return null;

  return {
    id: draft.id,
    kind: "rect",
    x: Math.min(draft.startX, draft.endX ?? draft.startX),
    y: Math.min(draft.startY, draft.endY ?? draft.startY),
    width: Math.max(width, MIN_DRAW_SIZE),
    height: Math.max(height, MIN_DRAW_SIZE),
    stroke: draft.stroke,
    strokeWidth: draft.strokeWidth,
  };
}

function createCircleFromDraft(draft) {
  const deltaX = (draft.endX ?? draft.startX) - draft.startX;
  const deltaY = (draft.endY ?? draft.startY) - draft.startY;
  const radius = Math.max(Math.abs(deltaX), Math.abs(deltaY)) / 2;
  if (radius < MIN_DRAW_SIZE / 2) return null;

  return {
    id: draft.id,
    kind: "circle",
    x: draft.startX + deltaX / 2,
    y: draft.startY + deltaY / 2,
    radius,
    stroke: draft.stroke,
    strokeWidth: draft.strokeWidth,
  };
}

function createArrowFromDraft(draft) {
  const startX = draft.startX;
  const startY = draft.startY;
  const endX = draft.endX ?? draft.startX;
  const endY = draft.endY ?? draft.startY;
  const length = Math.hypot(endX - startX, endY - startY);
  if (length < MIN_DRAW_SIZE) return null;

  return {
    id: draft.id,
    kind: "arrow",
    points: [startX, startY, endX, endY],
    stroke: draft.stroke,
    strokeWidth: draft.strokeWidth,
  };
}

function buildShapeFromDraft(draft) {
  if (!draft) return null;
  if (draft.kind === "rect") return createRectFromDraft(draft);
  if (draft.kind === "circle") return createCircleFromDraft(draft);
  if (draft.kind === "arrow") return createArrowFromDraft(draft);
  return null;
}

function renderAnnotation(annotation, options) {
  const commonProps = {
    key: annotation.id,
    ref: options.registerNode(annotation.id),
    stroke: annotation.stroke,
    strokeWidth: annotation.strokeWidth,
    onClick: (event) => {
      event.cancelBubble = true;
      options.onSelect(annotation.id);
    },
    onTap: (event) => {
      event.cancelBubble = true;
      options.onSelect(annotation.id);
    },
  };

  if (annotation.kind === "rect") {
    return (
      <Rect
        {...commonProps}
        x={annotation.x}
        y={annotation.y}
        width={annotation.width}
        height={annotation.height}
        draggable
        onDragEnd={(event) => {
          options.onRectChange(annotation.id, {
            x: event.target.x(),
            y: event.target.y(),
          });
        }}
        onTransformEnd={(event) => {
          const node = event.target;
          const nextWidth = Math.max(MIN_DRAW_SIZE, node.width() * node.scaleX());
          const nextHeight = Math.max(MIN_DRAW_SIZE, node.height() * node.scaleY());
          node.scaleX(1);
          node.scaleY(1);
          options.onRectChange(annotation.id, {
            x: node.x(),
            y: node.y(),
            width: nextWidth,
            height: nextHeight,
          });
        }}
      />
    );
  }

  if (annotation.kind === "circle") {
    return (
      <Circle
        {...commonProps}
        x={annotation.x}
        y={annotation.y}
        radius={annotation.radius}
        draggable
        onDragEnd={(event) => {
          options.onCircleChange(annotation.id, {
            x: event.target.x(),
            y: event.target.y(),
          });
        }}
        onTransformEnd={(event) => {
          const node = event.target;
          const nextRadius = Math.max(MIN_DRAW_SIZE / 2, annotation.radius * Math.max(node.scaleX(), node.scaleY()));
          node.scaleX(1);
          node.scaleY(1);
          options.onCircleChange(annotation.id, {
            x: node.x(),
            y: node.y(),
            radius: nextRadius,
          });
        }}
      />
    );
  }

  return (
    <Arrow
      {...commonProps}
      points={annotation.points}
      pointerLength={12 + annotation.strokeWidth}
      pointerWidth={10 + annotation.strokeWidth}
      lineCap="round"
      lineJoin="round"
      draggable
      onDragEnd={(event) => {
        const node = event.target;
        const [startX, startY, endX, endY] = annotation.points;
        const offsetX = node.x();
        const offsetY = node.y();
        node.x(0);
        node.y(0);
        options.onArrowChange(annotation.id, {
          points: [startX + offsetX, startY + offsetY, endX + offsetX, endY + offsetY],
        });
      }}
    />
  );
}

function EditorToolButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-outline-variant/20 bg-surface text-on-surface hover:bg-surface-container"
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

export default function CheckFormImageOverlayEditorModal({
  open,
  sourceImage,
  mode = "new",
  onClose,
  onSave,
}) {
  const [viewportSize, setViewportSize] = useState(() => getViewportSize());
  const [imageElement, setImageElement] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tool, setTool] = useState("select");
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [historyState, setHistoryState] = useState({ entries: [[]], index: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [draftShape, setDraftShape] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const nodeMapRef = useRef(new Map());
  const annotations = useMemo(
    () => historyState.entries[historyState.index] ?? [],
    [historyState.entries, historyState.index]
  );
  const draftPreview = buildShapeFromDraft(draftShape);

  useEffect(() => {
    if (!open) return undefined;

    const syncViewportSize = () => setViewportSize(getViewportSize());
    syncViewportSize();
    window.addEventListener("resize", syncViewportSize);
    window.visualViewport?.addEventListener("resize", syncViewportSize);

    return () => {
      window.removeEventListener("resize", syncViewportSize);
      window.visualViewport?.removeEventListener("resize", syncViewportSize);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !sourceImage?.dataURL) return undefined;

    let cancelled = false;
    setLoadingImage(true);
    setLoadError("");
    setTool("select");
    setStrokeColor(DEFAULT_COLOR);
    setStrokeWidth(DEFAULT_STROKE_WIDTH);
    setHistoryState({ entries: [[]], index: 0 });
    setSelectedId("");
    setDraftShape(null);
    setSaveError("");

    loadImageElement(sourceImage.dataURL)
      .then((nextImage) => {
        if (cancelled) return;
        setImageElement(nextImage);
      })
      .catch((error) => {
        if (cancelled) return;
        setImageElement(null);
        setLoadError(error.message || "Unable to load image.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingImage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, sourceImage]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        setHistoryState((current) => {
          const activeAnnotations = current.entries[current.index] ?? [];
          const nextAnnotations = activeAnnotations.filter((annotation) => annotation.id !== selectedId);
          const nextEntries = current.entries.slice(0, current.index + 1);
          nextEntries.push(nextAnnotations);
          return { entries: nextEntries, index: nextEntries.length - 1 };
        });
        setSelectedId("");
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, selectedId]);

  useEffect(() => {
    const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId);
    if (!selectedAnnotation) {
      transformerRef.current?.nodes([]);
      transformerRef.current?.getLayer()?.batchDraw();
      return;
    }

    const selectedNode = nodeMapRef.current.get(selectedId);
    if (!selectedNode || selectedAnnotation.kind === "arrow") {
      transformerRef.current?.nodes([]);
      transformerRef.current?.getLayer()?.batchDraw();
      return;
    }

    transformerRef.current?.nodes([selectedNode]);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [annotations, selectedId]);

  useEffect(() => {
    if (selectedId && !annotations.some((annotation) => annotation.id === selectedId)) {
      setSelectedId("");
    }
  }, [annotations, selectedId]);

  const stageSize = useMemo(() => {
    if (!imageElement) {
      return { width: 640, height: 400, pixelRatio: 1 };
    }

    const maxWidth = Math.max(320, Math.min(980, viewportSize.width - 160));
    const maxHeight = Math.max(220, Math.min(640, viewportSize.height - 320));
    const fitted = fitImageSize(imageElement.width, imageElement.height, maxWidth, maxHeight);

    return {
      width: fitted.width,
      height: fitted.height,
      pixelRatio: Math.max(imageElement.width / Math.max(fitted.width, 1), 1),
    };
  }, [imageElement, viewportSize]);

  function pushHistory(nextAnnotations) {
    setHistoryState((current) => {
      const nextEntries = current.entries.slice(0, current.index + 1);
      nextEntries.push(nextAnnotations);
      return { entries: nextEntries, index: nextEntries.length - 1 };
    });
  }

  function replaceAnnotation(annotationId, updater) {
    pushHistory(
      annotations.map((annotation) => (
        annotation.id === annotationId ? { ...annotation, ...updater(annotation) } : annotation
      ))
    );
  }

  function registerNode(annotationId) {
    return (node) => {
      if (node) {
        nodeMapRef.current.set(annotationId, node);
      } else {
        nodeMapRef.current.delete(annotationId);
      }
    };
  }

  function getPointerPosition() {
    const stage = stageRef.current;
    if (!stage) return null;
    const position = stage.getPointerPosition();
    if (!position) return null;
    return { x: position.x, y: position.y };
  }

  function handleStagePointerDown(event) {
    if (!imageElement) return;

    if (tool === "select") {
      if (event.target === event.target.getStage() || event.target.name() === "editor-background") {
        setSelectedId("");
      }
      return;
    }

    const point = getPointerPosition();
    if (!point) return;

    setSelectedId("");
    setDraftShape({
      id: crypto.randomUUID(),
      kind: tool,
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
      stroke: strokeColor,
      strokeWidth: Number(strokeWidth),
    });
  }

  function handleStagePointerMove() {
    if (!draftShape) return;

    const point = getPointerPosition();
    if (!point) return;

    setDraftShape((current) => (
      current
        ? { ...current, endX: point.x, endY: point.y }
        : current
    ));
  }

  function handleStagePointerUp() {
    if (!draftShape) return;

    const nextShape = buildShapeFromDraft(draftShape);
    setDraftShape(null);
    setTool("select");
    if (!nextShape) return;

    pushHistory([...annotations, nextShape]);
    setSelectedId(nextShape.id);
  }

  async function handleSave() {
    if (!stageRef.current || !imageElement) return;

    setSaving(true);
    setSaveError("");

    try {
      const dataURL = await exportOptimizedReferenceImage({
        stage: stageRef.current,
        sourceWidth: imageElement.width,
        sourceHeight: imageElement.height,
      });

      await onSave(dataURL);
    } catch (error) {
      setSaveError(error?.message || "Unable to save the annotated image.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => event.stopPropagation()}
          className="flex w-full max-w-7xl max-h-[92vh] flex-col overflow-hidden rounded-[32px] border border-separator/40 bg-surface shadow-[0_32px_120px_rgba(15,23,42,0.28)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-separator/35 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Overlay Editor</p>
              <h3 className="mt-1 text-lg font-black text-on-surface">{mode === "edit" ? "Edit reference image" : "Prepare new reference image"}</h3>
              <p className="mt-1 text-sm leading-6 text-outline">
                Add simple callouts only if you need them. When you save, the image is flattened and uploaded as a new file.
              </p>
            </div>

            <IconButton icon="close" onClick={onClose} size="xl" ariaLabel="Close dialog" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-separator/40 bg-surface-container/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Tools</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {TOOL_OPTIONS.map((option) => (
                      <EditorToolButton
                        key={option.value}
                        active={tool === option.value}
                        icon={option.icon}
                        label={option.label}
                        onClick={() => setTool(option.value)}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-outline">
                    Pick one shape, draw it once, then the editor returns to select mode automatically.
                  </p>
                </div>

                <div className="rounded-3xl border border-separator/40 bg-surface-container/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Style</p>
                  <div className="mt-3 space-y-4">
                    <label className="block text-xs font-semibold text-on-surface">
                      Color
                      <input
                        type="color"
                        value={strokeColor}
                        onChange={(event) => setStrokeColor(event.target.value)}
                        className="mt-2 h-11 w-full rounded-2xl border border-separator/40 bg-transparent p-1"
                      />
                    </label>

                    <label className="block text-xs font-semibold text-on-surface">
                      Stroke size
                      <input
                        type="range"
                        min="2"
                        max="14"
                        step="1"
                        value={strokeWidth}
                        onChange={(event) => setStrokeWidth(Number(event.target.value))}
                        className="mt-3 w-full accent-primary"
                      />
                      <span className="mt-1 block text-[11px] text-outline">{strokeWidth}px</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-3xl border border-separator/40 bg-surface-container/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Actions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryState((current) => (
                          current.index === 0 ? current : { ...current, index: current.index - 1 }
                        ));
                        setSelectedId("");
                      }}
                      disabled={historyState.index === 0}
                      className="inline-flex items-center gap-2 rounded-2xl border border-separator/40 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>undo</span>
                      Undo
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHistoryState((current) => (
                          current.index >= current.entries.length - 1 ? current : { ...current, index: current.index + 1 }
                        ));
                        setSelectedId("");
                      }}
                      disabled={historyState.index >= historyState.entries.length - 1}
                      className="inline-flex items-center gap-2 rounded-2xl border border-separator/40 px-3 py-2 text-xs font-bold text-on-surface transition hover:bg-surface disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>redo</span>
                      Redo
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedId) return;
                        pushHistory(annotations.filter((annotation) => annotation.id !== selectedId));
                        setSelectedId("");
                      }}
                      disabled={!selectedId}
                      className="inline-flex items-center gap-2 rounded-2xl border border-error/20 px-3 py-2 text-xs font-bold text-error transition hover:bg-error/5 disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      Delete selected
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-outline">
                    Drag shapes to reposition them. Boxes and circles can also be resized after selection.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-3xl border border-separator/40 bg-surface-container/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-on-surface">{sourceImage?.name || "Reference image"}</p>
                      <p className="mt-1 text-xs leading-5 text-outline">Draw only what needs emphasis. The saved image becomes the new flat reference image.</p>
                    </div>
                    <div className="rounded-full bg-surface px-3 py-1 text-[11px] font-bold text-outline">
                      {annotations.length} overlay{annotations.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="overflow-auto rounded-[28px] border border-separator/40 bg-slate-900/95 p-3">
                  {loadingImage ? (
                    <div className="flex min-h-[320px] items-center justify-center text-sm text-white/70">Loading image...</div>
                  ) : null}

                  {loadError ? (
                    <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-separator/35 bg-white/5 px-6 text-center text-sm text-white/70">
                      {loadError}
                    </div>
                  ) : null}

                  {!loadingImage && !loadError && imageElement ? (
                    <Stage
                      ref={stageRef}
                      width={stageSize.width}
                      height={stageSize.height}
                      className="mx-auto rounded-[24px] bg-white"
                      onMouseDown={handleStagePointerDown}
                      onMouseMove={handleStagePointerMove}
                      onMouseUp={handleStagePointerUp}
                      onTouchStart={handleStagePointerDown}
                      onTouchMove={handleStagePointerMove}
                      onTouchEnd={handleStagePointerUp}
                    >
                      <Layer>
                        <KonvaImage image={imageElement} width={stageSize.width} height={stageSize.height} name="editor-background" />

                        {annotations.map((annotation) => renderAnnotation(annotation, {
                          registerNode,
                          onSelect: setSelectedId,
                          onRectChange: (annotationId, nextValues) => replaceAnnotation(annotationId, () => nextValues),
                          onCircleChange: (annotationId, nextValues) => replaceAnnotation(annotationId, () => nextValues),
                          onArrowChange: (annotationId, nextValues) => replaceAnnotation(annotationId, () => nextValues),
                        }))}

                        {draftPreview ? renderAnnotation(draftPreview, {
                          registerNode: () => () => {},
                          onSelect: () => {},
                          onRectChange: () => {},
                          onCircleChange: () => {},
                          onArrowChange: () => {},
                        }) : null}

                        <Transformer
                          ref={transformerRef}
                          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                          rotateEnabled={false}
                          borderStroke="#4361ee"
                          anchorStroke="#4361ee"
                          anchorFill="#ffffff"
                        />
                      </Layer>
                    </Stage>
                  ) : null}
                </div>

                {saveError ? <p className="text-sm text-error">{saveError}</p> : null}
              </div>
            </div>
          </div>

          <div className="border-t border-separator/30 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5 text-outline">
                {mode === "edit"
                  ? "Saving creates a new flattened image file and keeps the original image untouched."
                  : "If you do not add any overlays, the image is still uploaded exactly as shown."}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-separator/40 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loadingImage || !imageElement}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 active:scale-95 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : mode === "edit" ? "Save as new image" : "Upload image"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}