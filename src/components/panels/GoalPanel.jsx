import { useMemo } from "react";
import { STATUS_THEME, formatNumber } from "../twin/twinTheme";

const RING = 2 * Math.PI * 52;

/**
 * Goal ring (today's pieces vs goal) + who is producing the most.
 */
export default function GoalPanel({ summary, units, onSelect, isJa }) {
  const pct = summary.goalPct;
  const ranked = useMemo(
    () => units.filter((u) => (u.pieces || 0) > 0).sort((a, b) => b.pieces - a.pieces),
    [units]
  );
  const max = ranked[0]?.pieces || 1;
  const ringColor = pct === null ? "#94a3b8" : pct >= 100 ? STATUS_THEME.running.color : "#a855f7";

  return (
    <div className="dash-goal">
      <div className="dash-goal__ring">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${pct ?? 0}%`}>
          <circle cx="60" cy="60" r="52" className="dash-goal__track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className="dash-goal__arc"
            style={{
              stroke: ringColor,
              strokeDasharray: RING,
              strokeDashoffset: RING * (1 - Math.min(100, pct ?? 0) / 100),
            }}
          />
        </svg>
        <div className="dash-goal__center">
          <strong>{pct === null ? "—" : `${pct}%`}</strong>
          <span>{formatNumber(summary.pieces)} / {summary.goal ? formatNumber(summary.goal) : "—"}</span>
        </div>
      </div>

      <div className="dash-goal__bars">
        <div className="dash-goal__bars-title">{isJa ? "設備別の生産数" : "Pieces by machine"}</div>
        {ranked.length === 0 && <div className="dash-goal__none">{isJa ? "まだ生産なし" : "No output yet"}</div>}
        {ranked.map((u) => (
          <button
            key={u.id}
            type="button"
            className="dash-goal__bar"
            style={{ "--status": (STATUS_THEME[u.status] || STATUS_THEME.off).color }}
            onClick={() => onSelect(u.id)}
          >
            <span className="dash-goal__bar-name">{u.label}</span>
            <span className="dash-goal__bar-track">
              <span style={{ width: `${(u.pieces / max) * 100}%` }} />
            </span>
            <span className="dash-goal__bar-value">{formatNumber(u.pieces)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
