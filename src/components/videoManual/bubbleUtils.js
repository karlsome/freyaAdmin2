// Speech-bubble shape: an SVG clip (rounded body + pointer) paired with a rich-text clip that sits on the body.
// The two clips are linked by matching aliases: bubble-<id>-shape / bubble-<id>-text.
// All geometry below is in edit pixels (top-left origin, y down) unless noted.

export const BUBBLE_PAD = 6;
export const BUBBLE_DEFAULT_FILL = "#ef4444";
export const BUBBLE_ALIAS_PATTERN = /^bubble-(.+)-(shape|text)$/;

const round = (value) => Math.round(value * 1000) / 1000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createBubbleId() {
  return Math.random().toString(36).slice(2, 8);
}

export function getBubbleAliasInfo(clip) {
  const match = typeof clip?.alias === "string" ? clip.alias.match(BUBBLE_ALIAS_PATTERN) : null;
  return match ? { groupId: match[1], role: match[2] } : null;
}

/** Geometry stored on the svg as fractions of its box: body rect + pointer tip. */
export function parseBubbleGeometry(svgSource) {
  const match = typeof svgSource === "string" ? svgSource.match(/data-vmfa-bubble=["']([^"']+)["']/i) : null;
  if (!match) return null;
  const [bx, by, bw, bh, tx, ty] = match[1].split(",").map(Number);
  return [bx, by, bw, bh, tx, ty].every(Number.isFinite) ? { bx, by, bw, bh, tx, ty } : null;
}

/** Body rect and tip (absolute) -> svg box (inflated by the stroke padding) + fractional geometry. */
export function bubbleBoxFromAbs(body, tip, pad = BUBBLE_PAD) {
  const left = Math.min(body.left, tip.x) - pad;
  const top = Math.min(body.top, tip.y) - pad;
  const right = Math.max(body.left + body.width, tip.x) + pad;
  const bottom = Math.max(body.top + body.height, tip.y) + pad;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  return {
    box: { left, top, width, height },
    geometry: {
      bx: (body.left - left) / width,
      by: (body.top - top) / height,
      bw: body.width / width,
      bh: body.height / height,
      tx: (tip.x - left) / width,
      ty: (tip.y - top) / height,
    },
  };
}

export function bubbleAbsFromBox(box, geometry) {
  return {
    body: {
      left: box.left + geometry.bx * box.width,
      top: box.top + geometry.by * box.height,
      width: geometry.bw * box.width,
      height: geometry.bh * box.height,
    },
    tip: { x: box.left + geometry.tx * box.width, y: box.top + geometry.ty * box.height },
  };
}

export function buildBubbleSvg(width, height, geometry, style = {}) {
  const fill = style.fill || BUBBLE_DEFAULT_FILL;
  const stroke = style.stroke || fill;
  const strokeWidth = Math.max(0, Number(style.strokeWidth) || 0);
  const g = geometry;
  const x = g.bx * width;
  const y = g.by * height;
  const w = Math.max(2, g.bw * width);
  const h = Math.max(2, g.bh * height);
  const tipX = g.tx * width;
  const tipY = g.ty * height;
  const r = Math.max(0, Math.min(18, w / 2, h / 2));
  const half = clamp(Math.min(w, h) * 0.24, 10, 30);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = (tipX - cx) / (w / 2);
  const dy = (tipY - cy) / (h / 2);
  let side;
  if (Math.abs(dx) > Math.abs(dy)) side = dx > 0 ? "right" : "left";
  else side = dy > 0 ? "bottom" : "top";

  const place = (value, start, end) => {
    const min = start + r + half;
    const max = end - r - half;
    return min > max ? (start + end) / 2 : clamp(value, min, max);
  };

  const parts = [`M ${round(x + r)} ${round(y)}`];
  if (side === "top") {
    const c = place(tipX, x, x + w);
    parts.push(`L ${round(c - half)} ${round(y)}`, `L ${round(tipX)} ${round(tipY)}`, `L ${round(c + half)} ${round(y)}`);
  }
  parts.push(`L ${round(x + w - r)} ${round(y)}`, `A ${round(r)} ${round(r)} 0 0 1 ${round(x + w)} ${round(y + r)}`);
  if (side === "right") {
    const c = place(tipY, y, y + h);
    parts.push(`L ${round(x + w)} ${round(c - half)}`, `L ${round(tipX)} ${round(tipY)}`, `L ${round(x + w)} ${round(c + half)}`);
  }
  parts.push(`L ${round(x + w)} ${round(y + h - r)}`, `A ${round(r)} ${round(r)} 0 0 1 ${round(x + w - r)} ${round(y + h)}`);
  if (side === "bottom") {
    const c = place(tipX, x, x + w);
    parts.push(`L ${round(c + half)} ${round(y + h)}`, `L ${round(tipX)} ${round(tipY)}`, `L ${round(c - half)} ${round(y + h)}`);
  }
  parts.push(`L ${round(x + r)} ${round(y + h)}`, `A ${round(r)} ${round(r)} 0 0 1 ${round(x)} ${round(y + h - r)}`);
  if (side === "left") {
    const c = place(tipY, y, y + h);
    parts.push(`L ${round(x)} ${round(c + half)}`, `L ${round(tipX)} ${round(tipY)}`, `L ${round(x)} ${round(c - half)}`);
  }
  parts.push(`L ${round(x)} ${round(y + r)}`, `A ${round(r)} ${round(r)} 0 0 1 ${round(x + r)} ${round(y)}`, "Z");

  const geometryAttr = [g.bx, g.by, g.bw, g.bh, g.tx, g.ty].map((v) => round(v)).join(",");
  const strokeAttrs = strokeWidth > 0 ? ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" data-vmfa-shape="bubble" data-vmfa-bubble="${geometryAttr}" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}"><path d="${parts.join(" ")}" fill="${fill}"${strokeAttrs}/></svg>`;
}

/** Clip box (document values: width/height + centre offset) -> absolute box. Returns null for keyframed values. */
export function clipBoxFromDocument(clip, editSize) {
  const width = Number(clip?.width);
  const height = Number(clip?.height);
  const offset = clip?.offset || { x: 0, y: 0 };
  const ox = typeof offset.x === "number" ? offset.x : 0;
  const oy = typeof offset.y === "number" ? offset.y : 0;
  if (!(width > 0) || !(height > 0) || (clip?.position && clip.position !== "center")) return null;
  return {
    left: (0.5 + ox) * editSize.width - width / 2,
    top: (0.5 - oy) * editSize.height - height / 2,
    width,
    height,
  };
}

/** Absolute box -> clip fields (width/height + centre offset). */
export function documentFieldsFromBox(box, editSize) {
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  return {
    width: round(box.width),
    height: round(box.height),
    position: "center",
    offset: { x: round(centerX / editSize.width - 0.5), y: round(-(centerY / editSize.height - 0.5)) },
  };
}

/** Finds the shape/text clips of the bubble that the clip at (trackIndex, clipIndex) belongs to. */
export function findBubblePair(editData, trackIndex, clipIndex) {
  const tracks = editData?.timeline?.tracks;
  const source = tracks?.[trackIndex]?.clips?.[clipIndex];
  const info = getBubbleAliasInfo(source);
  if (!info) return null;

  const pair = { groupId: info.groupId, shape: null, text: null };
  tracks.forEach((track, t) => {
    (track?.clips || []).forEach((clip, c) => {
      const other = getBubbleAliasInfo(clip);
      if (other?.groupId === info.groupId) pair[other.role] = { trackIndex: t, clipIndex: c, clip };
    });
  });
  return pair.shape && pair.text ? pair : null;
}

export function createBubbleClips({ editSize, start, centerX, centerY, text }) {
  const bodyWidth = 380;
  const bodyHeight = 130;
  const cx = typeof centerX === "number" ? centerX : editSize.width / 2;
  const cy = typeof centerY === "number" ? centerY : editSize.height / 2 - 40;
  const body = { left: cx - bodyWidth / 2, top: cy - bodyHeight / 2, width: bodyWidth, height: bodyHeight };
  const tip = { x: cx + 90, y: cy + bodyHeight / 2 + 80 };
  const { box, geometry } = bubbleBoxFromAbs(body, tip);
  const id = createBubbleId();

  const shapeClip = {
    alias: `bubble-${id}-shape`,
    asset: { type: "svg", src: buildBubbleSvg(box.width, box.height, geometry, { fill: BUBBLE_DEFAULT_FILL, strokeWidth: 0 }) },
    start,
    length: 5,
    ...documentFieldsFromBox(box, editSize),
  };
  const textClip = {
    alias: `bubble-${id}-text`,
    asset: {
      type: "rich-text",
      text,
      font: { family: "Work Sans", size: 56, weight: 600, color: "#ffffff", opacity: 1 },
      align: { horizontal: "center", vertical: "middle" },
    },
    start,
    length: 5,
    ...documentFieldsFromBox(body, editSize),
  };
  return { shapeClip, textClip };
}
