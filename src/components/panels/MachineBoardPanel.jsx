import { STATUS_THEME, formatNumber, statusLabel } from "../twin/twinTheme";

/**
 * Flat 2D board: one big colored tile per machine (pairs running together share a wide tile).
 */
export default function MachineBoardPanel({ units, selectedId, onSelect, isJa }) {
  return (
    <div className="dash-board">
      {units.map((u) => {
        const theme = STATUS_THEME[u.status] || STATUS_THEME.off;
        const selected = u.ids.includes(selectedId);
        return (
          <button
            key={u.id}
            type="button"
            className={`dash-board__tile ${u.together ? "dash-board__tile--pair" : ""} ${selected ? "is-selected" : ""} ${theme.pulse ? "is-alert" : ""}`}
            style={{ "--status": theme.color }}
            onClick={() => onSelect(u.id)}
            aria-label={`${u.fullLabel} ${statusLabel(u.status, isJa)}`}
          >
            <span className="dash-board__name">
              {u.together && <span className="material-symbols-outlined">link</span>}
              {u.label}
            </span>
            <span className="dash-board__value">
              {u.pieces !== null ? formatNumber(u.pieces) : "—"}
              <small>{isJa ? "個" : "pcs"}</small>
            </span>
            <span className="dash-board__status">
              <span className="material-symbols-outlined">{theme.icon}</span>
              {statusLabel(u.status, isJa)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
