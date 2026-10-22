import { useState } from "react";

const PT_TO_MM = 25.4 / 72;

// Deterministic pseudo pattern so barcode / QR placeholders look stable between renders.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };
}

function Barcode({ el }) {
  const rnd = seeded(String(el.bind || el.id || "bc"));
  const bars = [];
  let x = 0;
  while (x < el.w) {
    const bw = Math.max(el.w / 90, 0.2) * (1 + Math.floor(rnd() * 3));
    if (rnd() > 0.45) bars.push(<rect key={x} x={x} y={0} width={Math.min(bw, el.w - x)} height={el.h} fill="#000" />);
    x += bw;
  }
  return <g transform={`translate(${el.x} ${el.y})`}>{bars}</g>;
}

function Qr({ el }) {
  const side = Math.min(el.w, el.h);
  const n = 11;
  const cell = side / n;
  const rnd = seeded(String(el.bind || el.id || "qr"));
  const cells = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const finder = (r < 3 && c < 3) || (r < 3 && c >= n - 3) || (r >= n - 3 && c < 3);
      if (finder || rnd() > 0.5) cells.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#000" />);
    }
  }
  return <g transform={`translate(${el.x} ${el.y})`}>{cells}</g>;
}

function TextEl({ el }) {
  const size = (Number(el.size) || 10) * PT_TO_MM;
  const bold = String(el.font || "").includes("Bold");
  const anchor = el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
  const tx = el.align === "center" ? el.w / 2 : el.align === "right" ? el.w : 0;
  const lines = String(el.text || "").split("\n");
  return (
    <svg x={el.x} y={el.y} width={el.w} height={Math.max(el.h, size * 1.2)} overflow="hidden">
      {lines.map((line, i) => (
        <text
          key={i}
          x={tx}
          y={size * 0.95 + i * size * 1.2}
          fontSize={size}
          fontWeight={bold ? 700 : 400}
          fontFamily="Helvetica, Arial, sans-serif"
          textAnchor={anchor}
          fill="#000"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}

// Static, non-interactive preview of a saved layout (mm viewBox). Barcode / QR are placeholders.
export default function ScnaLabelThumb({ layout, className = "" }) {
  const w = Number(layout?.widthMm) || 100;
  const h = Number(layout?.heightMm) || 60;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} style={{ background: "#fff" }} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={w} height={h} fill="#fff" stroke="#94a3b8" strokeWidth={Math.max(w, h) / 150} />
      {(layout?.elements || []).map((el, i) => {
        const key = el.id || i;
        if (el.type === "text") return <TextEl key={key} el={el} />;
        if (el.type === "barcode128") return <Barcode key={key} el={el} />;
        if (el.type === "qr") return <Qr key={key} el={el} />;
        const sw = Math.max((el.strokeWidth || 1) * PT_TO_MM, 0.2);
        if (el.type === "line") return <line key={key} x1={el.x} y1={el.y} x2={el.x + el.w} y2={el.y + el.h} stroke="#000" strokeWidth={sw} />;
        return <rect key={key} x={el.x} y={el.y} width={el.w} height={el.h} fill="none" stroke="#000" strokeWidth={sw} />;
      })}
    </svg>
  );
}

// Saved layout preview: the Firebase thumbnail rendered at save time while it still matches the layout,
// otherwise (no thumbnail yet, layout changed since, or the image fails to load) a quick SVG drawn on the spot.
export function LayoutPreview({ doc, className = "" }) {
  const [failedUrl, setFailedUrl] = useState("");
  const url = doc?.thumbnailUrl;
  const fresh = url && doc.thumbnailHash && doc.thumbnailHash === doc.layoutHash && failedUrl !== url;
  if (fresh) {
    return <img src={url} alt={doc.name || ""} loading="lazy" className={`${className} object-contain`} style={{ background: "#fff" }} onError={() => setFailedUrl(url)} />;
  }
  return <ScnaLabelThumb layout={doc?.layout} className={className} />;
}
