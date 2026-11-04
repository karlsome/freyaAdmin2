// Converts an HPGL .plt file into the point format the SCNA listener sends to the CNC.
// Mirrors ioT/plt_to_json.py (validated against a real network capture):
//   - coordinates are in 1/40 mm
//   - redundant zero-distance PU points are dropped
//   - .plt has no 'value', so every point gets value 1.0 (validated assumption)

export function parsePlt(text) {
  const tokens = String(text || "")
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);

  const raw = [];
  let currentPen = null;
  for (const tok of tokens) {
    if (tok.startsWith("SP")) {
      const pen = tok.slice(2).trim();
      currentPen = /^\d+$/.test(pen) ? Number(pen) : null;
    } else if (tok.startsWith("PU") || tok.startsWith("PD")) {
      const coords = tok.slice(2).trim();
      if (!coords) continue;
      const [xr, yr] = coords.split(",").map((v) => Number(v));
      if (!Number.isFinite(xr) || !Number.isFinite(yr)) {
        throw new Error(`Invalid coordinates in "${tok}"`);
      }
      raw.push({ flag: tok.startsWith("PD") ? 1 : 0, layer: currentPen, x: xr / 40, y: yr / 40 });
    }
  }

  const filtered = raw.filter((p, i) => {
    if (i === 0 || p.flag !== 0) return true;
    const prev = raw[i - 1];
    return !(Math.abs(p.x - prev.x) < 0.001 && Math.abs(p.y - prev.y) < 0.001);
  });

  if (!filtered.length) throw new Error("No PU/PD points found in this file.");
  if (filtered.some((p) => p.layer == null)) {
    throw new Error("Found points before any pen selection (SP) — layer is undefined.");
  }

  const points = filtered.map((p, i) => ({
    index: i,
    flag: p.flag,
    layer: p.layer,
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
    value: 1.0,
  }));

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    points,
    pointCount: points.length,
    layers: [...new Set(points.map((p) => p.layer))].sort((a, b) => a - b),
    bounds: {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    },
  };
}
