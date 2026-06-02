export function normalizePlaylistAssetType(type, mimeType = "") {
  if (["image", "video", "audio"].includes(type)) return type;
  if (typeof mimeType === "string" && mimeType.startsWith("image/")) return "image";
  if (typeof mimeType === "string" && mimeType.startsWith("audio/")) return "audio";
  return "video";
}

export function getAssetLibraryTypeLabel(type) {
  const labels = {
    image: "Photos",
    video: "Videos",
    audio: "Audio",
  };

  return labels[normalizePlaylistAssetType(type)] || "Media";
}

export function getAssetLibraryItemLabel(type) {
  switch (normalizePlaylistAssetType(type)) {
    case "image":
      return "Photo";
    case "audio":
      return "Audio";
    default:
      return "Video";
  }
}

export function getAssetLibraryAccept(type) {
  const normalizedType = normalizePlaylistAssetType(type);
  if (normalizedType === "image") return "image/*";
  if (normalizedType === "audio") return "audio/*";
  return "video/*";
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function getAssetUsageLabel(asset) {
  const usageCount = Math.max(0, Number(asset?.usageCount) || 0);
  if (!usageCount) return "Playlist library";
  return usageCount === 1 ? "Used by 1 project" : `Used by ${usageCount} projects`;
}

export const DEFAULT_VIDEO_MANUAL_TEMPLATE = {
  timeline: {
    background: "#ffffff",
    tracks: [],
  },
  output: {
    format: "mp4",
    fps: 30,
    size: { width: 1920, height: 1080 },
  },
};

export const SHAPE_DIMENSIONS = {
  rect: { width: 220, height: 120 },
  circle: { width: 180, height: 180 },
  arrow: { width: 240, height: 140 },
  line: { width: 240, height: 120 },
};

export const KEYFRAME_SAME_TIME_TOLERANCE = 0.05;
export const KEYFRAME_MIN_SPACING = 0.25;
export const ACTIVE_KEYFRAME_THRESHOLD = 0.1;

export function cloneJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function getStaticNumericValue(value, fallback = 0) {
  if (Array.isArray(value)) return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function roundNumericValue(value, decimals = 4, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Number(numericValue.toFixed(decimals));
}

export function getClipRelativePlaybackTime(clip, playbackTime = 0) {
  const clipStart = getStaticNumericValue(clip?.start, 0);
  const clipLength = getStaticNumericValue(clip?.length, 5);
  const resolvedTime = Number(playbackTime);
  return Number(Math.max(0, Math.min(clipLength, (Number.isFinite(resolvedTime) ? resolvedTime : 0) - clipStart)).toFixed(3));
}

export function normalizeKeyframeFieldValue(field, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  if (field === "offsetX" || field === "offsetY") return Number(numericValue.toFixed(4));
  if (field === "scale") return Math.max(0.05, Number(numericValue.toFixed(3)));
  if (field === "opacity") return Math.max(0, Math.min(1, Number(numericValue.toFixed(2))));
  if (field === "rotate") return Number(numericValue.toFixed(2));
  return null;
}

export function segmentsToKeyframePoints(segments) {
  if (!Array.isArray(segments) || !segments.length) return [];

  const sorted = [...segments].sort((left, right) => (Number(left?.start) || 0) - (Number(right?.start) || 0));
  const points = [];

  sorted.forEach((segment, index) => {
    const start = Number(segment?.start) || 0;
    const length = Number(segment?.length) || 0;
    const from = Number(segment?.from);
    const to = Number(segment?.to);

    if (index === 0 && Number.isFinite(from)) {
      points.push({ time: Number(start.toFixed(3)), value: from });
    }
    if (Number.isFinite(to)) {
      points.push({ time: Number((start + length).toFixed(3)), value: to });
    }
  });

  return points;
}

export function normalizeKeyframePoints(points, clipLength) {
  if (!Array.isArray(points) || !points.length) return [];

  const normalizedClipLength = Number(Math.max(0.001, Number(clipLength) || 0.001).toFixed(3));
  const sorted = points
    .map((point) => {
      const time = Number(point?.time);
      const value = Number(point?.value);
      return {
        time: Number(Math.max(0, Math.min(normalizedClipLength, Number.isFinite(time) ? time : 0)).toFixed(3)),
        value: Number((Number.isFinite(value) ? value : 0).toFixed(4)),
      };
    })
    .sort((left, right) => left.time - right.time);

  const deduped = [];
  sorted.forEach((point) => {
    const previous = deduped[deduped.length - 1] || null;
    if (previous && Math.abs(previous.time - point.time) <= KEYFRAME_SAME_TIME_TOLERANCE) {
      deduped[deduped.length - 1] = point;
      return;
    }
    deduped.push(point);
  });

  return deduped;
}

export function segmentsToExplicitKeyframePoints(segments, clipLength) {
  const anchorPoints = Array.isArray(segments)
    ? segments
      .filter((segment) => Math.abs(Number(segment?.length) || 0) <= 0.001)
      .map((segment) => ({
        time: Number((Number(segment?.start) || 0).toFixed(3)),
        value: Number((Number(segment?.to ?? segment?.from) || 0).toFixed(4)),
      }))
    : [];

  if (anchorPoints.length) return normalizeKeyframePoints(anchorPoints, clipLength);

  const points = segmentsToKeyframePoints(segments);
  if (!points.length) return points;

  const tailIndex = points.length - 1;
  const tailPoint = points[tailIndex];
  const previousPoint = points[tailIndex - 1] || null;
  const roundedClipLength = Number((Number(clipLength) || 0).toFixed(3));

  if (
    tailPoint
    && previousPoint
    && Math.abs(tailPoint.time - roundedClipLength) <= 0.001
    && Math.abs(tailPoint.value - previousPoint.value) <= 0.0001
  ) {
    points.pop();
  }

  return normalizeKeyframePoints(points, clipLength);
}

export function sanitizeGeneratedKeyframes(segments, clipLength) {
  if (!Array.isArray(segments) || !segments.length) return null;

  const normalizedClipLength = Number(Math.max(0.001, Number(clipLength) || 0.001).toFixed(3));
  const sorted = segments
    .map((segment) => {
      const start = Number(Math.max(0, Math.min(normalizedClipLength, Number(segment?.start) || 0)).toFixed(3));
      const maxLength = Math.max(0, normalizedClipLength - start);
      const length = Number(Math.min(Math.max(0, Number(segment?.length) || 0), maxLength).toFixed(3));
      return {
        start,
        length,
        from: Number((Number(segment?.from) || 0).toFixed(4)),
        to: Number((Number(segment?.to) || 0).toFixed(4)),
        interpolation: segment?.interpolation || "linear",
        ...(segment?.easing ? { easing: segment.easing } : {}),
      };
    })
    .sort((left, right) => left.start - right.start || left.length - right.length);

  const sanitized = [];
  sorted.forEach((segment) => {
    const previous = sanitized[sanitized.length - 1] || null;
    if (previous) {
      const previousEnd = Number((previous.start + previous.length).toFixed(3));
      if (previousEnd > segment.start) {
        previous.length = Number(Math.max(0, segment.start - previous.start).toFixed(3));
      }
    }

    const last = sanitized[sanitized.length - 1] || null;
    if (
      last
      && Math.abs(last.start - segment.start) <= 0.001
      && Math.abs(last.length - segment.length) <= 0.001
      && Math.abs(last.from - segment.from) <= 0.0001
      && Math.abs(last.to - segment.to) <= 0.0001
    ) {
      return;
    }

    sanitized.push(segment);
  });

  return sanitized.length ? sanitized : null;
}

export function keyframePointsToSegments(points, clipLength) {
  const sorted = normalizeKeyframePoints(points, clipLength);
  if (!sorted.length) return null;

  const normalizedClipLength = Number(Math.max(0.001, Number(clipLength) || 0.001).toFixed(3));
  const segments = [];
  const firstPoint = sorted[0];

  if (firstPoint.time > 0) {
    segments.push({
      start: 0,
      length: Number(firstPoint.time.toFixed(3)),
      from: Number(firstPoint.value.toFixed(4)),
      to: Number(firstPoint.value.toFixed(4)),
      interpolation: "linear",
    });
  }

  sorted.forEach((point) => {
    segments.push({
      start: Number(point.time.toFixed(3)),
      length: 0,
      from: Number(point.value.toFixed(4)),
      to: Number(point.value.toFixed(4)),
      interpolation: "linear",
    });
  });

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const currentPoint = sorted[index];
    const nextPoint = sorted[index + 1];
    const duration = Number((nextPoint.time - currentPoint.time).toFixed(3));
    if (duration <= 0.001) continue;

    segments.push({
      start: Number(currentPoint.time.toFixed(3)),
      length: duration,
      from: Number(currentPoint.value.toFixed(4)),
      to: Number(nextPoint.value.toFixed(4)),
      interpolation: "linear",
    });
  }

  const lastPoint = sorted[sorted.length - 1];
  if (lastPoint.time < normalizedClipLength) {
    segments.push({
      start: Number(lastPoint.time.toFixed(3)),
      length: Number((normalizedClipLength - lastPoint.time).toFixed(3)),
      from: Number(lastPoint.value.toFixed(4)),
      to: Number(lastPoint.value.toFixed(4)),
      interpolation: "linear",
    });
  }

  return sanitizeGeneratedKeyframes(segments, clipLength);
}

export function interpolateKeyframeAtTime(segments, time, fallback = 0) {
  if (!Array.isArray(segments) || !segments.length) return fallback;

  const sorted = [...segments].sort((left, right) => (Number(left?.start) || 0) - (Number(right?.start) || 0));
  const targetTime = Number(time) || 0;

  for (const segment of sorted) {
    const start = Number(segment?.start) || 0;
    const length = Number(segment?.length) || 0;
    const end = start + length;

    if (targetTime >= start && targetTime <= end) {
      if (!length) return Number(segment?.from) || fallback;
      const progress = (targetTime - start) / length;
      const from = Number(segment?.from) || 0;
      const to = Number(segment?.to) || 0;
      return from + (to - from) * progress;
    }
  }

  if (targetTime < (Number(sorted[0]?.start) || 0)) return Number(sorted[0]?.from) || fallback;
  return Number(sorted[sorted.length - 1]?.to) || fallback;
}

export function getKeyframedScalarValueAtTime(propertyValue, time, fallback = 0, decimals = 4) {
  if (Array.isArray(propertyValue)) {
    return roundNumericValue(interpolateKeyframeAtTime(propertyValue, time, fallback), decimals, fallback);
  }

  return roundNumericValue(getStaticNumericValue(propertyValue, fallback), decimals, fallback);
}

export function getAllKeyframeTimesForClip(clip) {
  const times = new Set();
  const clipLength = getStaticNumericValue(clip?.length, 5);
  const addTimes = (segments) => {
    if (!Array.isArray(segments)) return;
    segmentsToExplicitKeyframePoints(segments, clipLength).forEach((point) => times.add(Number(point.time.toFixed(2))));
  };

  addTimes(clip?.scale);
  addTimes(clip?.opacity);
  addTimes(clip?.offset?.x);
  addTimes(clip?.offset?.y);
  addTimes(clip?.transform?.rotate?.angle);

  return Array.from(times).sort((left, right) => left - right);
}

export function getNearestKeyframe(times, targetTime, threshold = ACTIVE_KEYFRAME_THRESHOLD) {
  if (!Array.isArray(times) || !times.length) return null;

  let nearest = null;
  times.forEach((time) => {
    const delta = Math.abs(time - targetTime);
    if (!nearest || delta < nearest.delta) nearest = { time, delta };
  });

  if (!nearest || nearest.delta > threshold) return null;
  return nearest;
}

export function getKeyframeValuesForClip(clip, time) {
  return {
    offsetX: getKeyframedScalarValueAtTime(clip?.offset?.x, time, 0, 4),
    offsetY: getKeyframedScalarValueAtTime(clip?.offset?.y, time, 0, 4),
    scale: getKeyframedScalarValueAtTime(clip?.scale, time, 1, 3),
    opacity: getKeyframedScalarValueAtTime(clip?.opacity, time, 1, 3),
    rotate: getKeyframedScalarValueAtTime(clip?.transform?.rotate?.angle, time, 0, 2),
  };
}

export function getActiveKeyframeForClip(clip, playbackTime, threshold = ACTIVE_KEYFRAME_THRESHOLD) {
  if (!clip) return null;
  const relativeTime = getClipRelativePlaybackTime(clip, playbackTime);
  const nearest = getNearestKeyframe(getAllKeyframeTimesForClip(clip), relativeTime, threshold);
  if (!nearest) return null;

  return {
    time: nearest.time,
    delta: nearest.delta,
    values: getKeyframeValuesForClip(clip, nearest.time),
  };
}

export function hasAnyAnimatedProperties(clip) {
  return Boolean(
    Array.isArray(clip?.scale)
    || Array.isArray(clip?.opacity)
    || Array.isArray(clip?.offset?.x)
    || Array.isArray(clip?.offset?.y)
    || Array.isArray(clip?.transform?.rotate?.angle)
  );
}

export function buildKeyframedPropertyValue(existingValue, nextValue, clipLength, time) {
  const numericValue = Number(nextValue);
  if (!Number.isFinite(numericValue)) return null;

  const currentPoints = Array.isArray(existingValue)
    ? segmentsToExplicitKeyframePoints(existingValue, clipLength)
    : [];
  const nextPoints = [...currentPoints];
  const normalizedTime = Number((Number(time) || 0).toFixed(3));
  const normalizedValue = Number(numericValue.toFixed(4));
  const pointIndex = nextPoints.findIndex((point) => Math.abs(point.time - normalizedTime) <= KEYFRAME_SAME_TIME_TOLERANCE);

  if (pointIndex >= 0) {
    nextPoints[pointIndex] = { time: nextPoints[pointIndex].time, value: normalizedValue };
  } else {
    nextPoints.push({ time: normalizedTime, value: normalizedValue });
  }

  return keyframePointsToSegments(nextPoints, clipLength);
}

export function shiftAnimatedSegments(previousSegments, nextValue, relativeTime, fallback = 0, clipLength = null) {
  if (!Array.isArray(previousSegments) || !Number.isFinite(Number(nextValue))) return null;

  const oldValue = interpolateKeyframeAtTime(previousSegments, relativeTime, fallback);
  const delta = Number(nextValue) - oldValue;
  const shifted = previousSegments.map((segment) => ({
    ...segment,
    from: Number((Number(segment.from) + delta).toFixed(4)),
    to: Number((Number(segment.to) + delta).toFixed(4)),
  }));

  const resolvedClipLength = Number.isFinite(Number(clipLength))
    ? Number(clipLength)
    : Math.max(...shifted.map((segment) => (Number(segment.start) || 0) + (Number(segment.length) || 0)), 0.001);
  return sanitizeGeneratedKeyframes(shifted, resolvedClipLength);
}

export function createAnimatedClipStateSnapshot(clip) {
  if (!clip) return null;

  const snapshot = {
    scale: Array.isArray(clip.scale) ? cloneJson(clip.scale, null) : null,
    opacity: Array.isArray(clip.opacity) ? cloneJson(clip.opacity, null) : null,
    offsetX: Array.isArray(clip.offset?.x) ? cloneJson(clip.offset.x, null) : null,
    offsetY: Array.isArray(clip.offset?.y) ? cloneJson(clip.offset.y, null) : null,
    rotate: Array.isArray(clip.transform?.rotate?.angle) ? cloneJson(clip.transform.rotate.angle, null) : null,
  };

  if (!Object.values(snapshot).some(Boolean)) return null;

  const width = Number(clip.width);
  const height = Number(clip.height);
  if (Number.isFinite(width) && width > 0) snapshot.width = width;
  if (Number.isFinite(height) && height > 0) snapshot.height = height;

  return snapshot;
}

export function buildKeyframeUpdatePayload(clip, targetTime, values, sourceClip = null) {
  if (!clip || !values) return null;

  const clipLength = getStaticNumericValue(clip.length, 5);
  const source = sourceClip || clip;
  const scaleValue = normalizeKeyframeFieldValue("scale", values.scale);
  const opacityValue = normalizeKeyframeFieldValue("opacity", values.opacity);
  const offsetXValue = normalizeKeyframeFieldValue("offsetX", values.offsetX);
  const offsetYValue = normalizeKeyframeFieldValue("offsetY", values.offsetY);
  const rotateValue = normalizeKeyframeFieldValue("rotate", values.rotate);

  const scaleSegments = buildKeyframedPropertyValue(source.scale, scaleValue, clipLength, targetTime);
  const opacitySegments = buildKeyframedPropertyValue(source.opacity, opacityValue, clipLength, targetTime);
  const offsetXSegments = buildKeyframedPropertyValue(source.offset?.x, offsetXValue, clipLength, targetTime);
  const offsetYSegments = buildKeyframedPropertyValue(source.offset?.y, offsetYValue, clipLength, targetTime);
  const rotateSegments = buildKeyframedPropertyValue(source.transform?.rotate?.angle, rotateValue, clipLength, targetTime);

  const update = {};
  if (scaleSegments) update.scale = scaleSegments;
  if (opacitySegments) update.opacity = opacitySegments;
  if (offsetXSegments || offsetYSegments) {
    update.offset = {
      ...(clip.offset || {}),
      ...(offsetXSegments ? { x: offsetXSegments } : {}),
      ...(offsetYSegments ? { y: offsetYSegments } : {}),
    };
  }
  if (rotateSegments) {
    update.transform = {
      ...(clip.transform || {}),
      rotate: {
        ...((clip.transform || {}).rotate || {}),
        angle: rotateSegments,
      },
    };
  }

  return Object.keys(update).length ? update : null;
}

export function removeKeyframeAtTime(clip, targetTime) {
  if (!clip) return null;

  const clipLength = getStaticNumericValue(clip.length, 5);
  const removeAtTime = (segments, fallback) => {
    if (!Array.isArray(segments)) return segments;
    const nextPoints = segmentsToExplicitKeyframePoints(segments, clipLength)
      .filter((point) => Math.abs(point.time - targetTime) > KEYFRAME_SAME_TIME_TOLERANCE);
    if (!nextPoints.length) return fallback;
    return keyframePointsToSegments(nextPoints, clipLength) || fallback;
  };

  const update = {};
  if (Array.isArray(clip.scale)) update.scale = removeAtTime(clip.scale, getStaticNumericValue(clip.scale, 1));
  if (Array.isArray(clip.opacity)) update.opacity = removeAtTime(clip.opacity, getStaticNumericValue(clip.opacity, 1));
  if (Array.isArray(clip.offset?.x) || Array.isArray(clip.offset?.y)) {
    update.offset = {
      ...(clip.offset || {}),
      ...(Array.isArray(clip.offset?.x) ? { x: removeAtTime(clip.offset.x, getStaticNumericValue(clip.offset.x, 0)) } : {}),
      ...(Array.isArray(clip.offset?.y) ? { y: removeAtTime(clip.offset.y, getStaticNumericValue(clip.offset.y, 0)) } : {}),
    };
  }
  if (Array.isArray(clip.transform?.rotate?.angle)) {
    update.transform = {
      ...(clip.transform || {}),
      rotate: {
        ...((clip.transform || {}).rotate || {}),
        angle: removeAtTime(clip.transform.rotate.angle, getStaticNumericValue(clip.transform.rotate.angle, 0)),
      },
    };
  }

  return Object.keys(update).length ? update : null;
}

export function buildAnimatedScalarUpdateForClip(clip, updates, playbackTime) {
  if (!clip || !updates || !hasAnyAnimatedProperties(clip)) {
    return { blocked: false, updates };
  }

  const activeKeyframe = getActiveKeyframeForClip(clip, playbackTime);
  const nextUpdates = cloneJson(updates, updates);
  const clipLength = getStaticNumericValue(clip.length, 5);
  let touchedAnimatedScalar = false;
  let blocked = false;

  const applyField = (field, sourceValue, nextValue, assignValue) => {
    if (Array.isArray(nextValue)) return;
    const normalizedValue = normalizeKeyframeFieldValue(field, nextValue);
    if (normalizedValue == null) return;

    touchedAnimatedScalar = true;
    if (!activeKeyframe) {
      blocked = true;
      return;
    }

    const segments = buildKeyframedPropertyValue(sourceValue, normalizedValue, clipLength, activeKeyframe.time);
    if (segments) assignValue(segments);
  };

  if (Object.prototype.hasOwnProperty.call(updates, "scale")) {
    applyField("scale", clip.scale, updates.scale, (segments) => { nextUpdates.scale = segments; });
  }
  if (Object.prototype.hasOwnProperty.call(updates, "opacity")) {
    applyField("opacity", clip.opacity, updates.opacity, (segments) => { nextUpdates.opacity = segments; });
  }
  if (updates.offset && Object.prototype.hasOwnProperty.call(updates.offset, "x")) {
    nextUpdates.offset = { ...(nextUpdates.offset || {}) };
    applyField("offsetX", clip.offset?.x, updates.offset.x, (segments) => { nextUpdates.offset.x = segments; });
  }
  if (updates.offset && Object.prototype.hasOwnProperty.call(updates.offset, "y")) {
    nextUpdates.offset = { ...(nextUpdates.offset || {}) };
    applyField("offsetY", clip.offset?.y, updates.offset.y, (segments) => { nextUpdates.offset.y = segments; });
  }
  if (updates.transform?.rotate && Object.prototype.hasOwnProperty.call(updates.transform.rotate, "angle")) {
    nextUpdates.transform = { ...(nextUpdates.transform || {}), rotate: { ...(nextUpdates.transform?.rotate || {}) } };
    applyField("rotate", clip.transform?.rotate?.angle, updates.transform.rotate.angle, (segments) => { nextUpdates.transform.rotate.angle = segments; });
  }

  return {
    blocked: touchedAnimatedScalar && blocked,
    updates: nextUpdates,
  };
}

export function getOutputSize(editData) {
  return editData?.output?.size || DEFAULT_VIDEO_MANUAL_TEMPLATE.output.size;
}

export function getOutputFps(editData) {
  return editData?.output?.fps || DEFAULT_VIDEO_MANUAL_TEMPLATE.output.fps;
}

export function getClipCategory(clip) {
  const assetType = clip?.asset?.type;
  if (["rich-text", "text", "title", "caption", "rich-caption"].includes(assetType)) return "text";
  if (["svg", "shape"].includes(assetType)) return "shapes";
  if (["video", "image", "audio"].includes(assetType)) return "media";
  return null;
}

export function normalizeHexColor(color) {
  if (typeof color !== "string") return "";
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((part) => part + part).join("")}`;
  }
  return "";
}

export function extractShapeStyle(svgSource) {
  if (typeof svgSource !== "string") return {};

  const readAttr = (name) => {
    const match = svgSource.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
    return match?.[1] || "";
  };

  const strokeWidth = Number(readAttr("stroke-width"));
  return {
    shapeType: readAttr("data-vmfa-shape") || readAttr("data-vmss-shape") || "rect",
    fill: normalizeHexColor(readAttr("fill")) || "#fecaca",
    stroke: normalizeHexColor(readAttr("stroke")) || "#ef4444",
    strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 3,
  };
}

export function createShapeSvg(shapeType, width, height, options = {}) {
  const fill = options.fill || "#fecaca";
  const stroke = options.stroke || "#ef4444";
  const safeStrokeWidth = Math.max(2, Number(options.strokeWidth) || 3);
  const strokePadding = safeStrokeWidth + 14;

  if (shapeType === "rect") {
    const inset = strokePadding;
    return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="rect" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="${inset}" y="${inset}" width="${Math.max(1, width - inset * 2)}" height="${Math.max(1, height - inset * 2)}" rx="12" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${safeStrokeWidth}"/></svg>`;
  }

  if (shapeType === "circle") {
    const radiusX = Math.max(8, width / 2 - strokePadding);
    const radiusY = Math.max(8, height / 2 - strokePadding);
    const centerX = width / 2;
    const centerY = height / 2;
    const ovalPath = [
      `M ${centerX - radiusX} ${centerY}`,
      `A ${radiusX} ${radiusY} 0 1 0 ${centerX + radiusX} ${centerY}`,
      `A ${radiusX} ${radiusY} 0 1 0 ${centerX - radiusX} ${centerY}`,
    ].join(" ");
    return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="circle" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${ovalPath}" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${safeStrokeWidth}"/></svg>`;
  }

  if (shapeType === "arrow") {
    const margin = strokePadding + 6;
    const leftX = margin;
    const rightX = width - margin;
    const centerY = height / 2;
    const usableHeight = Math.max(18, height - margin * 2);
    const headLength = Math.max(18, Math.min(width * 0.28, usableHeight * 1.1));
    const shaftHalf = Math.max(4, usableHeight * 0.16);
    const bodyRight = Math.max(leftX + 12, rightX - headLength);
    const topY = centerY - usableHeight / 2;
    const bottomY = centerY + usableHeight / 2;
    const arrowPath = [
      `M ${leftX} ${centerY - shaftHalf}`,
      `L ${bodyRight} ${centerY - shaftHalf}`,
      `L ${bodyRight} ${topY}`,
      `L ${rightX} ${centerY}`,
      `L ${bodyRight} ${bottomY}`,
      `L ${bodyRight} ${centerY + shaftHalf}`,
      `L ${leftX} ${centerY + shaftHalf}`,
      "Z",
    ].join(" ");
    return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="arrow" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${arrowPath}" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${safeStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  const margin = strokePadding + 8;
  const centerY = height / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="line" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="${margin}" y1="${centerY}" x2="${width - margin}" y2="${centerY}" stroke="${stroke}" stroke-width="${safeStrokeWidth}" stroke-linecap="butt"/></svg>`;
}

export function measureImageClipSize(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 600;
      const scale = image.width > maxWidth ? maxWidth / image.width : 1;
      resolve({
        width: Math.round(image.width * scale),
        height: Math.round(image.height * scale),
      });
    };
    image.onerror = () => resolve({ width: 400, height: 300 });
    image.src = url;
  });
}

export function normalizePlayableMediaSource(sourceUrl, apiBaseUrl) {
  if (typeof sourceUrl !== "string" || !sourceUrl.trim()) return null;
  if (sourceUrl.startsWith("blob:") || sourceUrl.startsWith("data:")) {
    return { previewUrl: sourceUrl, publicUrl: sourceUrl };
  }

  try {
    const parsed = new URL(sourceUrl, window.location.href);
    if (parsed.pathname.includes("/api/video-manual-media/")) {
      const upstreamUrl = parsed.searchParams.get("url");
      return { previewUrl: parsed.toString(), publicUrl: upstreamUrl || parsed.toString() };
    }

    if (parsed.pathname.includes("/api/video-manuals/stream/")) {
      return { previewUrl: parsed.toString(), publicUrl: parsed.toString() };
    }

    if (parsed.pathname.endsWith("/api/video-manual-media")) {
      const upstreamUrl = parsed.searchParams.get("url");
      if (upstreamUrl) return normalizePlayableMediaSource(upstreamUrl, apiBaseUrl);
      return { previewUrl: parsed.toString(), publicUrl: parsed.toString() };
    }

    const needsProxy = parsed.hostname === "firebasestorage.googleapis.com"
      || parsed.hostname === "storage.googleapis.com"
      || parsed.hostname.endsWith(".amazonaws.com");
    if (!needsProxy) return { previewUrl: parsed.toString(), publicUrl: parsed.toString() };

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const rawFileName = pathSegments[pathSegments.length - 1] || "asset";
    const safeFileName = encodeURIComponent(rawFileName.includes(".") ? rawFileName : `${rawFileName}.bin`);
    return {
      previewUrl: `${apiBaseUrl}/api/video-manual-media/${safeFileName}?url=${encodeURIComponent(parsed.toString())}`,
      publicUrl: parsed.toString(),
    };
  } catch {
    return { previewUrl: sourceUrl, publicUrl: sourceUrl };
  }
}

export function decorateAssetForPreview(asset, apiBaseUrl) {
  const downloadUrl = asset?.downloadUrl || asset?.url || "";
  const normalized = normalizePlayableMediaSource(downloadUrl, apiBaseUrl);
  return {
    ...asset,
    previewUrl: normalized?.previewUrl || downloadUrl,
  };
}

export function buildUploadedAsset(file, result, forcedType) {
  return {
    assetId: result.assetId,
    name: file.name,
    fileName: result.fileName || file.name,
    mimeType: result.mimeType || file.type || "application/octet-stream",
    type: normalizePlaylistAssetType(forcedType || result.type, result.mimeType || file.type),
    storagePath: result.storagePath,
    downloadUrl: result.url,
    uploadedAt: result.uploadedAt || new Date().toISOString(),
    size: file.size,
  };
}

export function getTrackCount(edit) {
  try {
    return edit?.getEdit()?.timeline?.tracks?.length || 0;
  } catch {
    return 0;
  }
}

export function buildRevisionSnapshot(project, edit, assetSourceMap) {
  return {
    title: project?.title || "Untitled Project",
    description: project?.description || "",
    status: project?.status || "draft",
    edit,
    settings: project?.settings || {},
    schemaVersion: project?.schemaVersion || 2,
    assetSourceMap,
    savedAt: new Date().toISOString(),
  };
}