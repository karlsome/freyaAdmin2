// ─── Multi-device line chart for sensor trends ──────────────────────────────
// Props:
//   readings  — raw array from fetchHistoricalSensorData
//   type      — "temp" | "humid"
//   height    — SVG height in px (default 180)

function parseTemp(v)  { return parseFloat(String(v ?? "").replace("°C", "").trim()); }
function parseHumid(v) { return parseFloat(String(v ?? "").replace("%",  "").trim()); }

const LINE_COLORS = ["#6366f1","#22d3ee","#f59e0b","#34d399","#f87171","#a78bfa","#fb923c","#4ade80"];

const THRESHOLDS = {
  temp:  { warning: 26, danger: 30, unit: "°C" },
  humid: { warning: 60, danger: 70, unit: "%"  },
};

export default function SensorTrendChart({ readings = [], type = "temp", height = 180 }) {
  const { warning, danger, unit } = THRESHOLDS[type];
  const getVal = (r) => type === "temp" ? parseTemp(r.Temperature) : parseHumid(r.Humidity);

  // Group by device → by Date → daily average
  const deviceMap = new Map();
  readings.forEach((r) => {
    const id = r.device ?? "unknown";
    const v  = getVal(r);
    if (isNaN(v)) return;
    if (!deviceMap.has(id)) deviceMap.set(id, new Map());
    const dm = deviceMap.get(id);
    if (!dm.has(r.Date)) dm.set(r.Date, []);
    dm.get(r.Date).push(v);
  });

  const allDates = [...new Set(readings.map((r) => r.Date).filter(Boolean))].sort();
  if (!allDates.length || !deviceMap.size) {
    return (
      <div className="flex items-center justify-center h-24 text-outline text-xs">
        No data for this range
      </div>
    );
  }

  const series = Array.from(deviceMap.entries()).map(([id, dm]) => ({
    id,
    values: allDates.map((d) => {
      const vals = dm.get(d);
      return vals?.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }),
  }));

  // Chart geometry
  const W = 800;
  const H = height;
  const P = { top: 12, right: 16, bottom: 28, left: 36 };
  const cW = W - P.left - P.right;
  const cH = H - P.top  - P.bottom;

  const allVals = series.flatMap((s) => s.values.filter((v) => v !== null));
  const minV = Math.floor(Math.min(...allVals) - 1);
  const maxV = Math.ceil( Math.max(...allVals) + 1);
  const rangeV = maxV - minV || 1;

  const xPos = (i) => P.left + (i / Math.max(allDates.length - 1, 1)) * cW;
  const yPos = (v) => P.top  + cH - ((v - minV) / rangeV) * cH;

  // Y axis tick count
  const yTicks = 4;

  // X axis: show at most 8 labels
  const xStep = Math.ceil(allDates.length / 8);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {/* Grid + Y labels */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = minV + (rangeV / yTicks) * i;
          const y = yPos(v);
          return (
            <g key={i}>
              <line x1={P.left} y1={y} x2={W - P.right} y2={y}
                stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
              <text x={P.left - 4} y={y + 3.5} textAnchor="end" fontSize={9}
                fill="currentColor" fillOpacity={0.4}>
                {Math.round(v)}{unit}
              </text>
            </g>
          );
        })}

        {/* Threshold lines */}
        {[{ val: warning, color: "#f59e0b" }, { val: danger, color: "#f87171" }].map(({ val, color }) =>
          val >= minV && val <= maxV ? (
            <g key={val}>
              <line x1={P.left} y1={yPos(val)} x2={W - P.right} y2={yPos(val)}
                stroke={color} strokeWidth={1} strokeDasharray="5 3" strokeOpacity={0.55} />
              <text x={W - P.right + 3} y={yPos(val) + 3.5} fontSize={8} fill={color} fillOpacity={0.7}>
                {val}
              </text>
            </g>
          ) : null
        )}

        {/* X labels */}
        {allDates.map((d, i) => {
          if (i % xStep !== 0 && i !== allDates.length - 1) return null;
          return (
            <text key={d} x={xPos(i)} y={H - 4} textAnchor="middle" fontSize={8}
              fill="currentColor" fillOpacity={0.4}>
              {d.slice(5)}
            </text>
          );
        })}

        {/* Series lines */}
        {series.map(({ id, values }, si) => {
          const color = LINE_COLORS[si % LINE_COLORS.length];
          let path = "";
          values.forEach((v, i) => {
            if (v === null) return;
            const x = xPos(i);
            const y = yPos(v);
            path += (i === 0 || values[i - 1] === null) ? `M ${x} ${y}` : ` L ${x} ${y}`;
          });
          // Dots at each data point
          return (
            <g key={id}>
              <path d={path} fill="none" stroke={color} strokeWidth={1.8}
                strokeLinecap="round" strokeLinejoin="round" />
              {values.map((v, i) =>
                v !== null ? (
                  <circle key={i} cx={xPos(i)} cy={yPos(v)} r={2.5}
                    fill={color} fillOpacity={0.8} />
                ) : null
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-1 pl-9">
          {series.map(({ id }, si) => (
            <div key={id} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: LINE_COLORS[si % LINE_COLORS.length] }} />
              <span className="text-[10px] text-outline font-mono">{id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
