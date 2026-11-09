// Converts a Xiao .pce file into the same point format parsePlt() returns, so a PCE can be
// uploaded without exporting a PLT from Xiao (which needs the PC connected to the machine).
//
// Two layouts exist, told apart by the first int32 (all little-endian; reverse engineered):
//
//   version 4 (e.g. 1GD_1h_12, SP4, SP6 samples)
//     int32 x3          preamble: 4, 0, <polyline count>
//     per polyline:
//       int32 x6        header: 1, 0, 1, 3, <pen>, 0
//       int32           point count
//       count x         float64 x, y, z  (mm; z is always 0)
//     8 bytes           trailer: int32 1, int32 0
//
//   version 1 (e.g. VKY01) - older Xiao, no z and no trailer
//     int32 x2          preamble: 1, <polyline count>
//     per polyline:
//       int32 x6        header: 1, 0, 1, 1, <pen>, <point count>
//       count x         float64 x, y  (mm)
//
// In both, the pen is the 5th header int (4 -> SP4, 6 -> SP6). Polylines and points are already
// in cut order / start-point order, so they map straight to one PU (first point) followed by PD
// (the rest), exactly like the PLT Xiao exports. Version 4 was checked point-for-point against
// exported PLTs; version 1 was only checked for structure (it consumes the file exactly).
//
// Not verified: the meaning of the other header ints (constant in every sample so far).

const LAYOUTS = {
  4: { preambleBytes: 12, countOffset: 8, headerInts: 6, countInHeader: false, pointBytes: 24, trailerBytes: 8 },
  1: { preambleBytes: 8, countOffset: 4, headerInts: 6, countInHeader: true, pointBytes: 16, trailerBytes: 0 },
};
const PEN_INDEX = 4;

function describeHeader(view) {
  const ints = [];
  for (let i = 0; i < Math.min(12, Math.floor(view.byteLength / 4)); i += 1) {
    ints.push(view.getInt32(i * 4, true));
  }
  return ints;
}

function fail(view, message, extra = {}) {
  // Shown in the browser console so an unrecognised file can be inspected without guessing.
  console.error(`[parsePce] ${message}`, {
    fileSize: view.byteLength,
    firstInts: describeHeader(view),
    ...extra,
  });
  throw new Error(message);
}

export function parsePce(buffer) {
  const view = new DataView(buffer);
  const size = view.byteLength;
  if (size < 12) fail(view, "File is too small to be a PCE.");

  const version = view.getInt32(0, true);
  const layout = LAYOUTS[version];
  if (!layout) {
    fail(view, `Not a recognised PCE file (unexpected header: first value ${version}, expected 1 or 4).`);
  }
  const polylineCount = view.getInt32(layout.countOffset, true);
  if (polylineCount < 1) fail(view, "Not a recognised PCE file (no polylines).", { version, polylineCount });

  const headerBytes = layout.headerInts * 4;
  const raw = [];
  let pos = layout.preambleBytes;
  for (let n = 0; n < polylineCount; n += 1) {
    if (pos + headerBytes + (layout.countInHeader ? 0 : 4) > size) {
      fail(view, `PCE ends early at polyline ${n + 1}.`, { version, polylineCount, pos });
    }
    const pen = view.getInt32(pos + PEN_INDEX * 4, true);
    let pointCount;
    if (layout.countInHeader) {
      pointCount = view.getInt32(pos + headerBytes - 4, true);
      pos += headerBytes;
    } else {
      pointCount = view.getInt32(pos + headerBytes, true);
      pos += headerBytes + 4;
    }
    if (pointCount < 1 || pos + pointCount * layout.pointBytes > size) {
      fail(view, `Invalid point count ${pointCount} in polyline ${n + 1}.`, { version, polylineCount, pos, pen });
    }
    for (let i = 0; i < pointCount; i += 1) {
      const x = view.getFloat64(pos, true);
      const y = view.getFloat64(pos + 8, true);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(view, `Invalid coordinates in polyline ${n + 1}.`, { version, pos });
      }
      raw.push({ flag: i === 0 ? 0 : 1, layer: pen, x, y });
      pos += layout.pointBytes;
    }
  }
  if (size - pos !== layout.trailerBytes) {
    fail(view, "PCE has unexpected data after the last polyline.", {
      version,
      polylineCount,
      pos,
      leftoverBytes: size - pos,
      expectedLeftover: layout.trailerBytes,
    });
  }

  // same rule as parsePlt: drop a PU that lands exactly where the previous point already is
  const filtered = raw.filter((p, i) => {
    if (i === 0 || p.flag !== 0) return true;
    const prev = raw[i - 1];
    return !(Math.abs(p.x - prev.x) < 0.001 && Math.abs(p.y - prev.y) < 0.001);
  });

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
    pceVersion: version,
  };
}
