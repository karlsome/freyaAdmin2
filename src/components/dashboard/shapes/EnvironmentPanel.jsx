import { useState } from "react";

export default function EnvironmentPanel({ data = {}, onAskAI }) {
  const [selectedFacility, setSelectedFacility] = useState(data.factory || "小瀬");

  const readings = data.readings || [
    { metric: "WBGT (Heat Stress)", value: 27.4, unit: "°C", status: "warn", statusLabel: "Caution (注意)", min: 20, max: 35 },
    { metric: "Ambient Temperature", value: 26.8, unit: "°C", status: "ok", statusLabel: "Normal", min: 15, max: 35 },
    { metric: "Relative Humidity", value: 58, unit: "%", status: "ok", statusLabel: "Normal", min: 20, max: 80 },
    { metric: "CO2 Concentration", value: 680, unit: "ppm", status: "ok", statusLabel: "Good Ventilation", min: 400, max: 1500 }
  ];

  const facilities = data.facilities || [
    { name: "小瀬", wbgt: 27.4, temp: 26.8, humidity: 58, status: "warn" },
    { name: "倉知", wbgt: 25.1, temp: 24.9, humidity: 52, status: "ok" },
    { name: "桜台", wbgt: 26.3, temp: 25.5, humidity: 55, status: "ok" },
    { name: "富田", wbgt: 28.2, temp: 27.9, humidity: 62, status: "critical" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Facility Selector ── */}
      {facilities.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">Facility:</span>
          {facilities.map((fac) => {
            const isWarn = fac.status === "warn";
            const isCritical = fac.status === "critical";

            return (
              <button
                key={fac.name}
                onClick={() => setSelectedFacility(fac.name)}
                className={`h-7 px-3 text-xs font-semibold rounded-[4px] border transition-all flex items-center gap-1.5 ${
                  selectedFacility === fac.name
                    ? "bg-[var(--freya-blue)] text-white border-[var(--freya-blue)] shadow-2xs"
                    : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{fac.name}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCritical ? "bg-rose-500" : isWarn ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                <span className="freya-tabular text-[11px] opacity-80">{fac.wbgt}°C</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Environment Sensor Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {readings.map((r, idx) => {
          const isCritical = r.status === "critical";
          const isWarn = r.status === "warn";
          const isOk = r.status === "ok";

          const badgeColor = isCritical
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
            : isWarn
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

          return (
            <div
              key={idx}
              className="p-3.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between shadow-2xs gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {r.metric}
                  </span>
                  {r.statusLabel && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] border ${badgeColor}`}>
                      {r.statusLabel}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] freya-tabular">
                    {r.value}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    {r.unit}
                  </span>
                </div>
              </div>

              {/* Threshold Gauge Indicator */}
              <div className="space-y-1">
                <div className="w-full h-1.5 rounded-full bg-[var(--surface-hover)] overflow-hidden flex">
                  <div className="w-1/3 bg-emerald-500 opacity-60" />
                  <div className="w-1/3 bg-amber-500 opacity-60" />
                  <div className="w-1/3 bg-rose-500 opacity-60" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-medium">
                  <span>Safe</span>
                  <span>Caution (25°C)</span>
                  <span>Danger (&gt;31°C)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Floor Health & Safety Note ── */}
      <div className="p-3 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] flex items-start gap-2.5 text-xs text-[var(--text-muted)]">
        <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 18 }}>
          heat
        </span>
        <div>
          <span className="font-semibold text-[var(--text-primary)]">Heat-Stress Protocol Advisory: </span>
          When WBGT exceeds 28°C, mandatory 10-minute rest breaks every hour and hydration monitoring are recommended for active operators on Press and Kensa inspection lines.
        </div>
      </div>

      {onAskAI && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">Query sensors:</span>
          <button
            onClick={() => onAskAI("Are any factories currently exceeding heat-stress safety thresholds?")}
            className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-hover)] hover:bg-[var(--surface)] text-[var(--freya-blue)] border border-[var(--border)] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>device_thermostat</span>
            <span>Check thermal risks</span>
          </button>
        </div>
      )}
    </div>
  );
}
