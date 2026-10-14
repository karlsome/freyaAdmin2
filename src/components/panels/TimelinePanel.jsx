import { useMemo, useState } from "react";
import { TIMELINE_THEME, effectiveStatus, formatNumber, timelineLabel } from "../twin/twinTheme";

const SHIFT_START_MIN = 480;  // 08:00
const SHIFT_END_MIN = 1140;   // 19:00
const TOTAL_SHIFT_MIN = SHIFT_END_MIN - SHIFT_START_MIN; // 660 min

const TIME_MARKS = [
  { min: 480,  label: "08:00" },
  { min: 600,  label: "10:00" },
  { min: 720,  label: "12:00" },
  { min: 840,  label: "14:00" },
  { min: 960,  label: "16:00" },
  { min: 1080, label: "18:00" },
  { min: 1140, label: "19:00" },
];

/**
 * Multi-machine timeline Gantt widget for dashboard slots.
 * Displays all machines horizontally across the shift with color-coded operational segments.
 */
export default function TimelinePanel({ machines = [], selectedMachineId, onSelectMachine, isJa }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'running' | 'attention'
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Group or deduplicate pairs if desired, but showing all 19 gives complete overview
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const st = effectiveStatus(m);
      if (filter === "running") return st === "running";
      if (filter === "attention") return ["stopCall", "cncCancel", "maintenance", "idle"].includes(st);
      return true;
    });
  }, [machines, filter]);

  const counts = useMemo(() => {
    let running = 0;
    let attention = 0;
    machines.forEach((m) => {
      const st = effectiveStatus(m);
      if (st === "running") running += 1;
      else if (["stopCall", "cncCancel", "maintenance", "idle"].includes(st)) attention += 1;
    });
    return { all: machines.length, running, attention };
  }, [machines]);

  return (
    <div className="dash-timeline">
      {/* Controls & Filter Tabs */}
      <div className="dash-timeline__toolbar">
        <div className="dash-timeline__filters" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`dash-timeline__tab ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {isJa ? "全設備" : "All"} <span className="dash-timeline__count">{counts.all}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "running"}
            className={`dash-timeline__tab ${filter === "running" ? "is-active" : ""}`}
            onClick={() => setFilter("running")}
          >
            <span className="dash-timeline__dot dash-timeline__dot--running" />
            {isJa ? "稼働中" : "Running"} <span className="dash-timeline__count">{counts.running}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "attention"}
            className={`dash-timeline__tab ${filter === "attention" ? "is-active" : ""}`}
            onClick={() => setFilter("attention")}
          >
            <span className="dash-timeline__dot dash-timeline__dot--alert" />
            {isJa ? "待機・停止" : "Attention"} <span className="dash-timeline__count">{counts.attention}</span>
          </button>
        </div>

        {/* Legend */}
        <div className="dash-timeline__legend">
          {Object.entries(TIMELINE_THEME).map(([type, meta]) => (
            <span key={type} className="dash-timeline__legend-item">
              <span className="dash-timeline__legend-swatch" style={{ background: meta.color }} />
              {isJa ? meta.ja : meta.en}
            </span>
          ))}
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="dash-timeline__chart">
        {/* Time ruler */}
        <div className="dash-timeline__ruler">
          <div className="dash-timeline__row-label-col">
            <span className="dash-timeline__col-title">{isJa ? "設備名" : "Machine"}</span>
          </div>
          <div className="dash-timeline__track-col dash-timeline__track-ruler">
            {TIME_MARKS.map((mark) => {
              const leftPercent = ((mark.min - SHIFT_START_MIN) / TOTAL_SHIFT_MIN) * 100;
              return (
                <div
                  key={mark.min}
                  className="dash-timeline__mark"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span className="dash-timeline__mark-line" />
                  <span className="dash-timeline__mark-label">{mark.label}</span>
                </div>
              );
            })}
          </div>
          <div className="dash-timeline__stats-col">
            <span className="dash-timeline__col-title">{isJa ? "稼働率 / 実績" : "Uptime / Output"}</span>
          </div>
        </div>

        {/* Machine rows */}
        <div className="dash-timeline__rows">
          {filteredMachines.map((m) => {
            const st = effectiveStatus(m);
            const isSelected = selectedMachineId === m.id;
            const segments = m.timeline && m.timeline.length > 0
              ? m.timeline
              : [{ type: st === "running" ? "running" : st === "off" ? "off" : "idle", durationMin: TOTAL_SHIFT_MIN, label: st }];
            const summary = m.timelineSummary;
            const pieces = m.pieces;
            const showPieces = pieces !== null && pieces !== undefined;

            return (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                className={`dash-timeline__row ${isSelected ? "is-selected" : ""}`}
                onClick={() => onSelectMachine?.(m.id)}
                onKeyDown={(e) => e.key === "Enter" && onSelectMachine?.(m.id)}
              >
                {/* Machine Label Column */}
                <div className="dash-timeline__row-label-col">
                  <span
                    className="dash-timeline__status-dot"
                    style={{ background: (TIMELINE_THEME[st] || TIMELINE_THEME.off).color }}
                  />
                  <div className="min-w-0">
                    <div className="dash-timeline__machine-id">
                      {m.id}
                      {m.pair?.partner && (
                        <span
                          className={`material-symbols-outlined dash-timeline__pair-icon ${m.pair.together ? "is-together" : ""}`}
                          title={m.pair.together ? (isJa ? `ペア運転中 (${m.pair.partner})` : `Paired with ${m.pair.partner}`) : (isJa ? `ペア (${m.pair.partner})` : `Partner ${m.pair.partner}`)}
                        >
                          {m.pair.together ? "link" : "link_off"}
                        </span>
                      )}
                    </div>
                    {m.worker && <div className="dash-timeline__machine-worker">{m.worker}</div>}
                  </div>
                </div>

                {/* Horizontal Gantt Track */}
                <div className="dash-timeline__track-col">
                  <div className="dash-timeline__bar">
                    {segments.map((seg, idx) => {
                      const dur = seg.durationMin || 0;
                      if (dur <= 0) return null;
                      const widthPct = (dur / TOTAL_SHIFT_MIN) * 100;
                      const theme = TIMELINE_THEME[seg.type] || TIMELINE_THEME.off;
                      const label = seg.sebanggo || seg.label || timelineLabel(seg.type, isJa);
                      const tooltipText = `${timelineLabel(seg.type, isJa)}: ${seg.start}〜${seg.end} (${dur}${isJa ? "分" : "m"})${seg.sebanggo ? ` · 背番号: ${seg.sebanggo}` : ""}${seg.pieces ? ` · ${formatNumber(seg.pieces)}${isJa ? "個" : "pcs"}` : ""}${seg.worker ? ` · ${seg.worker}` : ""}`;

                      return (
                        <div
                          key={`${seg.type}-${idx}`}
                          className={`dash-timeline__seg dash-timeline__seg--${seg.type}`}
                          style={{
                            width: `${widthPct}%`,
                            background: theme.color,
                          }}
                          title={tooltipText}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveTooltip({
                              text: tooltipText,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                            });
                          }}
                          onMouseLeave={() => setActiveTooltip(null)}
                        >
                          {widthPct > 5 && (
                            <span className="dash-timeline__seg-label">{label}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats Column */}
                <div className="dash-timeline__stats-col">
                  {summary?.uptimePercent !== undefined ? (
                    <span className="dash-timeline__uptime">
                      {summary.uptimePercent}%
                    </span>
                  ) : (
                    <span className="dash-timeline__uptime">—</span>
                  )}
                  <span className="dash-timeline__pieces">
                    {showPieces ? `${formatNumber(pieces)}${isJa ? "個" : "pcs"}` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating tooltip */}
      {activeTooltip && (
        <div
          className="dash-timeline__floating-tooltip"
          style={{ left: activeTooltip.x, top: activeTooltip.y }}
        >
          {activeTooltip.text}
        </div>
      )}
    </div>
  );
}
