import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

// Colours follow Xiao: SP4 cyan, SP6 purple. Any other pen is neutral grey until chosen.
const PEN_COLORS = { 4: "#22d3ee", 6: "#a855f7" };
const OTHER_PEN_COLOR = "#9ca3af";
const PEN_NAMES = { 4: "cyan", 6: "purple" };
const PEN_UP_COLOR = "#6b7280";
const LABEL_COLOR = "#f0a868";
const PADDING_PX = 16;
const MEASURE_COLOR = "#facc15";
const SNAP_RADIUS_PX = 14;
const CLICK_SLOP_PX = 4;

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

export default function ScnaNcProgramPreview({ points, height = "380px" }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 380 });
  const [view, setView] = useState(null); // { cx, cy, scale } scale = mm per pixel; null = fit
  const [showNumbers, setShowNumbers] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [showPenUp, setShowPenUp] = useState(true);
  const [measuring, setMeasuring] = useState(false);
  const [measurements, setMeasurements] = useState([]); // [{ a, b }] in mm, real (un-flipped) Y
  const [pendingStart, setPendingStart] = useState(null);
  const [hover, setHover] = useState(null); // snapped or raw point under the cursor, in mm

  const strokes = useMemo(() => buildStrokes(points || []), [points]);
  const bounds = useMemo(() => boundsOf(points || []), [points]);

  // The Y axis points up in Xiao, SVG's points down, so every Y is mirrored once here.
  const flipY = bounds.minY + bounds.maxY;
  const toY = (y) => flipY - y;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect;
      if (width > 0 && h > 0) setSize({ w: width, h });
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

  // Stroke ends win over mid-line vertices, so "end to end" gaps are easy to pick.
  const snapTargets = useMemo(() => {
    const ends = [];
    const mids = [];
    for (const s of strokes) {
      s.pts.forEach((p, i) => (i === 0 || i === s.pts.length - 1 ? ends : mids).push(p));
    }
    return { ends, mids };
  }, [strokes]);

  // pointer position -> mm (real Y), snapped to the nearest vertex within a few pixels
  function pointerToMm(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const base = view || fit;
    const x = base.cx + (e.clientX - rect.left - size.w / 2) * base.scale;
    const y = flipY - (base.cy + (e.clientY - rect.top - size.h / 2) * base.scale);
    const radius = SNAP_RADIUS_PX * base.scale;
    let best = null;
    let bestD = radius;
    const consider = (list, bonus) => {
      for (const p of list) {
        const d = Math.hypot(p.x - x, p.y - y) * bonus;
        if (d < bestD) { bestD = d; best = p; }
      }
    };
    consider(snapTargets.ends, 0.6);
    consider(snapTargets.mids, 1);
    return best ? { x: best.x, y: best.y, snapped: true } : { x, y, snapped: false };
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, view: view || fit, moved: false };
  }
  function onPointerMove(e) {
    const drag = dragRef.current;
    if (measuring && !drag) setHover(pointerToMm(e));
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > CLICK_SLOP_PX) drag.moved = true;
    if (!drag.moved) return;
    setView({
      scale: drag.view.scale,
      cx: drag.view.cx - (e.clientX - drag.x) * drag.view.scale,
      cy: drag.view.cy - (e.clientY - drag.y) * drag.view.scale,
    });
  }
  function onPointerUp(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    // a press without movement is a click: in measure mode it picks a point instead of panning
    if (measuring && drag && !drag.moved && e.type === "pointerup") {
      const point = pointerToMm(e);
      if (!pendingStart) {
        setPendingStart(point);
      } else {
        setMeasurements((list) => [...list, { a: pendingStart, b: point }]);
        setPendingStart(null);
      }
    }
  }

  function toggleMeasure(on) {
    setMeasuring(on);
    setPendingStart(null);
    setHover(null);
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
  // Text is drawn in a separate layer in screen pixels: SVG text sized in mm becomes a tiny
  // font size when zoomed in, which browsers render with overlapping glyphs.
  const toScreen = (x, yFlipped) => [
    (x - (current.cx - vbW / 2)) / px,
    (yFlipped - (current.cy - vbH / 2)) / px,
  ];
  const textStyle = { userSelect: "none", paintOrder: "stroke", stroke: "#0b0f14", strokeWidth: 3, strokeLinejoin: "round" };
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

  const numberLabels = showNumbers
    ? strokes.map((st, i) => {
        const mid = st.pts[Math.floor(st.pts.length / 2)];
        const [sx, sy] = toScreen(mid.x, toY(mid.y));
        if (sx < 0 || sy < 0 || sx > size.w || sy > size.h) return null;
        return (
          <text key={i} x={sx + 3} y={sy - 3} fontSize={11} fill={LABEL_COLOR} style={textStyle}>
            {i + 1}
          </text>
        );
      })
    : null;

  function renderMeasurementShape({ a, b }, key, live = false) {
    return (
      <g key={key} opacity={live ? 0.8 : 1} style={{ pointerEvents: "none" }}>
        <line x1={a.x} y1={toY(a.y)} x2={b.x} y2={toY(b.y)} stroke={MEASURE_COLOR} strokeWidth={px * 1.5} strokeDasharray={live ? `${px * 5} ${px * 3}` : undefined} />
        <circle cx={a.x} cy={toY(a.y)} r={px * 3.5} fill={MEASURE_COLOR} />
        <circle cx={b.x} cy={toY(b.y)} r={px * 3.5} fill={MEASURE_COLOR} />
      </g>
    );
  }

  // Same precision as Xiao's status bar (3 decimals). Signs are B minus A.
  function renderMeasurementLabel({ a, b }, key) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const [sx, sy] = toScreen((a.x + b.x) / 2, (toY(a.y) + toY(b.y)) / 2);
    return (
      <g key={key}>
        <text x={sx + 12} y={sy - 8} fontSize={14} fontWeight="600" fill={MEASURE_COLOR} style={textStyle}>
          {Math.hypot(dx, dy).toFixed(3)} mm
        </text>
        <text x={sx + 12} y={sy + 8} fontSize={11} fill={MEASURE_COLOR} style={textStyle}>
          {`ΔX ${dx.toFixed(3)}   ΔY ${dy.toFixed(3)}`}
        </text>
      </g>
    );
  }

  const toggle = (checked, onChange, label) => (
    <label className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[6px] bg-[var(--surface-muted,transparent)] text-[11px] text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-primary)]">{isJa ? "線の色 = ペン（SP）" : "Line colour = pen (SP)"}</span>
        {penStats.map(([pen, count]) => (
          <span key={pen} className="flex items-center gap-1">
            <span className="inline-block h-2 w-5 rounded-sm" style={{ background: penColor(pen) }} />
            SP{pen} {PEN_COLORS[pen] ? `(${PEN_NAMES[pen]})` : ""} · {count} {isJa ? "本" : count === 1 ? "stroke" : "strokes"}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t border-dashed" style={{ borderColor: PEN_UP_COLOR }} />
          {isJa ? "移動（切らない）" : "pen-up move"}
        </span>
        <span>{num(bounds.maxX - bounds.minX)} × {num(bounds.maxY - bounds.minY)} mm</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {toggle(showNumbers, setShowNumbers, isJa ? "カット順の番号" : "Cut order numbers")}
        {toggle(showArrows, setShowArrows, isJa ? "開始位置の矢印" : "Start arrows")}
        {toggle(showPenUp, setShowPenUp, isJa ? "移動線" : "Pen-up moves")}
        <button type="button" onClick={() => setView(null)} className="text-[11px] font-semibold text-[var(--freya-blue)]">
          {isJa ? "全体表示" : "Reset view"}
        </button>
        <span className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => toggleMeasure(!measuring)}
          className={`rounded-[6px] border px-2 py-0.5 text-[11px] font-semibold ${
            measuring ? "border-[#facc15] bg-[#facc15] text-black" : "border-[var(--border)] text-[var(--text-primary)]"
          }`}
        >
          {isJa ? "📏 計測" : "📏 Measure"}
        </button>
        {measurements.length > 0 && (
          <button
            type="button"
            onClick={() => { setMeasurements([]); setPendingStart(null); }}
            className="text-[11px] font-semibold text-[var(--status-danger)]"
          >
            {isJa ? "計測を消去" : "Clear measurements"} ({measurements.length})
          </button>
        )}
        {measuring && (
          <span className="text-[11px] text-[var(--text-muted)]">
            {pendingStart
              ? (isJa ? "2点目をクリック" : "Click the second point")
              : (isJa ? "1点目をクリック（端点にスナップします）" : "Click the first point (snaps to line ends)")}
          </span>
        )}
      </div>

      <div ref={wrapRef} className="relative min-h-0 overflow-hidden rounded-[8px] border border-[var(--border)]" style={{ position: "relative", overflow: "hidden", background: "#0b0f14", height, flex: height === "100%" ? "1 1 0%" : "none" }}>
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          viewBox={viewBox}
          style={{ display: "block", touchAction: "none", cursor: measuring ? "crosshair" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          {showPenUp && (
            <path d={penUpPath} fill="none" stroke={PEN_UP_COLOR} strokeWidth={lineWidth * 0.7} strokeDasharray={`${px * 4} ${px * 4}`} />
          )}
          {penPaths.map(([pen, d]) => (
            <path key={pen} d={d} fill="none" stroke={penColor(pen)} strokeWidth={lineWidth} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {arrows}
          {measurements.map((m, i) => renderMeasurementShape(m, i))}
          {measuring && pendingStart && hover && renderMeasurementShape({ a: pendingStart, b: hover }, "live", true)}
          {measuring && hover && (
            <circle cx={hover.x} cy={toY(hover.y)} r={px * (hover.snapped ? 6 : 3)} fill="none" stroke={MEASURE_COLOR} strokeWidth={px * 1.5} />
          )}
        </svg>
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        >
          {numberLabels}
          {measurements.map((m, i) => renderMeasurementLabel(m, i))}
          {measuring && pendingStart && hover && renderMeasurementLabel({ a: pendingStart, b: hover }, "live")}
        </svg>
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">
        {isJa ? "ホイールで拡大縮小・ドラッグで移動" : "Scroll to zoom, drag to pan"}
      </p>
    </div>
  );
}
