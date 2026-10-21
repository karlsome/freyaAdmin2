import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

// Colours follow Xiao: SP4 cyan, SP6 purple. Any other pen is neutral grey until chosen.
const PEN_COLORS = { 4: "#22d3ee", 6: "#a855f7" };
const OTHER_PEN_COLOR = "#9ca3af";
const PEN_UP_COLOR = "#6b7280";
const LABEL_COLOR = "#f0a868";
const PADDING_PX = 16;
const HEIGHT_PX = 380;

const penColor = (pen) => PEN_COLORS[pen] || OTHER_PEN_COLOR;

// A stroke is one pen-up move followed by its pen-down points (same grouping the machine sees).
function buildStrokes(points) {
  const strokes = [];
  for (const p of points) {
    if (p.flag === 0 || strokes.length === 0) {
      strokes.push({ pen: p.layer, pts: [p] });
    } else {
      strokes[strokes.length - 1].pts.push(p);
    }
  }
  return strokes;
}

function boundsOf(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

const num = (v) => Math.round(v * 100) / 100;

export default function ScnaNcProgramPreview({ points }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: HEIGHT_PX });
  const [view, setView] = useState(null); // { cx, cy, scale } scale = mm per pixel; null = fit
  const [showNumbers, setShowNumbers] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [showPenUp, setShowPenUp] = useState(true);

  const strokes = useMemo(() => buildStrokes(points || []), [points]);
  const bounds = useMemo(() => boundsOf(points || []), [points]);

  // The Y axis points up in Xiao, SVG's points down, so every Y is mirrored once here.
  const flipY = bounds.minY + bounds.maxY;
  const toY = (y) => flipY - y;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      if (width > 0) setSize({ w: width, h: HEIGHT_PX });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useMemo(() => {
    const bw = Math.max(bounds.maxX - bounds.minX, 1);
    const bh = Math.max(bounds.maxY - bounds.minY, 1);
    return {
      cx: (bounds.minX + bounds.maxX) / 2,
      cy: toY((bounds.minY + bounds.maxY) / 2),
      scale: Math.max(bw / (size.w - PADDING_PX * 2), bh / (size.h - PADDING_PX * 2)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, size]);

  const current = view || fit;
  const vbW = size.w * current.scale;
  const vbH = size.h * current.scale;
  const viewBox = `${num(current.cx - vbW / 2)} ${num(current.cy - vbH / 2)} ${num(vbW)} ${num(vbH)}`;

  // Wheel needs a non-passive listener to stop the page scrolling while zooming.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((prev) => {
        const base = prev || fit;
        const factor = e.deltaY < 0 ? 0.8 : 1.25;
        const scale = Math.min(Math.max(base.scale * factor, fit.scale / 200), fit.scale * 4);
        // keep the point under the cursor fixed
        const mmX = base.cx + (px - size.w / 2) * base.scale;
        const mmY = base.cy + (py - size.h / 2) * base.scale;
        return { scale, cx: mmX - (px - size.w / 2) * scale, cy: mmY - (py - size.h / 2) * scale };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [fit, size]);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, view: view || fit };
  }
  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    setView({
      scale: drag.view.scale,
      cx: drag.view.cx - (e.clientX - drag.x) * drag.view.scale,
      cy: drag.view.cy - (e.clientY - drag.y) * drag.view.scale,
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const penPaths = useMemo(() => {
    const byPen = new Map();
    for (const s of strokes) {
      const d = s.pts.map((p, i) => `${i === 0 ? "M" : "L"}${num(p.x)} ${num(toY(p.y))}`).join("");
      byPen.set(s.pen, (byPen.get(s.pen) || "") + d);
    }
    return [...byPen.entries()].sort((a, b) => a[0] - b[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, flipY]);

  const penUpPath = useMemo(() => {
    let d = "";
    for (let i = 1; i < strokes.length; i += 1) {
      const from = strokes[i - 1].pts[strokes[i - 1].pts.length - 1];
      const to = strokes[i].pts[0];
      d += `M${num(from.x)} ${num(toY(from.y))}L${num(to.x)} ${num(toY(to.y))}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, flipY]);

  const penStats = useMemo(() => {
    const stats = new Map();
    for (const s of strokes) stats.set(s.pen, (stats.get(s.pen) || 0) + 1);
    return [...stats.entries()].sort((a, b) => a[0] - b[0]);
  }, [strokes]);

  if (!points?.length) return null;

  const px = current.scale; // mm per screen pixel
  const arrowSize = px * 9;
  const fontSize = px * 11;
  const lineWidth = px * 1.4;

  const arrows = showArrows
    ? strokes.map((s, i) => {
        const a = s.pts[0];
        const b = s.pts[1] || s.pts[0];
        const ax = a.x;
        const ay = toY(a.y);
        const angle = Math.atan2(toY(b.y) - ay, b.x - ax);
        const tip = [ax + Math.cos(angle) * arrowSize, ay + Math.sin(angle) * arrowSize];
        const l = [ax + Math.cos(angle + 2.5) * arrowSize * 0.6, ay + Math.sin(angle + 2.5) * arrowSize * 0.6];
        const r = [ax + Math.cos(angle - 2.5) * arrowSize * 0.6, ay + Math.sin(angle - 2.5) * arrowSize * 0.6];
        return (
          <polygon
            key={i}
            points={`${tip[0]},${tip[1]} ${l[0]},${l[1]} ${r[0]},${r[1]}`}
            fill="#facc15"
          />
        );
      })
    : null;

  const numbers = showNumbers
    ? strokes.map((s, i) => {
        const mid = s.pts[Math.floor(s.pts.length / 2)];
        return (
          <text key={i} x={mid.x} y={toY(mid.y)} fontSize={fontSize} fill={LABEL_COLOR} style={{ userSelect: "none" }}>
            {i + 1}
          </text>
        );
      })
    : null;

  const toggle = (checked, onChange, label) => (
    <label className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {toggle(showNumbers, setShowNumbers, isJa ? "カット順の番号" : "Cut order numbers")}
        {toggle(showArrows, setShowArrows, isJa ? "開始位置の矢印" : "Start arrows")}
        {toggle(showPenUp, setShowPenUp, isJa ? "移動線" : "Pen-up moves")}
        <button type="button" onClick={() => setView(null)} className="text-[11px] font-semibold text-[var(--freya-blue)]">
          {isJa ? "全体表示" : "Reset view"}
        </button>
      </div>

      <div ref={wrapRef} className="overflow-hidden rounded-[8px] border border-[var(--border)]" style={{ background: "#0b0f14" }}>
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          viewBox={viewBox}
          style={{ display: "block", touchAction: "none", cursor: dragRef.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {showPenUp && (
            <path d={penUpPath} fill="none" stroke={PEN_UP_COLOR} strokeWidth={lineWidth * 0.7} strokeDasharray={`${px * 4} ${px * 4}`} />
          )}
          {penPaths.map(([pen, d]) => (
            <path key={pen} d={d} fill="none" stroke={penColor(pen)} strokeWidth={lineWidth} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {arrows}
          {numbers}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        {penStats.map(([pen, count]) => (
          <span key={pen} className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: penColor(pen) }} />
            SP{pen} · {count} {isJa ? "本" : count === 1 ? "stroke" : "strokes"}
          </span>
        ))}
        <span>
          {num(bounds.maxX - bounds.minX)} × {num(bounds.maxY - bounds.minY)} mm
        </span>
        <span className="text-[var(--text-muted)]">
          {isJa ? "ホイールで拡大縮小・ドラッグで移動" : "Scroll to zoom, drag to pan"}
        </span>
      </div>
    </div>
  );
}
