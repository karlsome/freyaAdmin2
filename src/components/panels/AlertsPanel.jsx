import { STATUS_THEME, statusLabel } from "../twin/twinTheme";
import { formatMinutes, minutesInState } from "./twinUnits";

/**
 * Big, tappable list of machines that need someone right now.
 */
export default function AlertsPanel({ attention, onSelect, isJa, hasData }) {
  if (hasData && attention.length === 0) {
    return (
      <div className="dash-empty" style={{ "--status": STATUS_THEME.running.color }}>
        <span className="material-symbols-outlined">check_circle</span>
        <strong>{isJa ? "異常なし" : "All clear"}</strong>
        <span>{isJa ? "対応が必要な設備はありません" : "No machine needs attention"}</span>
      </div>
    );
  }

  return (
    <ul className="dash-alerts">
      {attention.map((u) => {
        const theme = STATUS_THEME[u.status];
        const minutes = minutesInState(u);
        return (
          <li key={u.id}>
            <button
              type="button"
              className={`dash-alerts__row ${theme.pulse ? "is-alert" : ""}`}
              style={{ "--status": theme.color }}
              onClick={() => onSelect(u.id)}
            >
              <span className="dash-alerts__icon material-symbols-outlined">{theme.icon}</span>
              <span className="dash-alerts__main">
                <span className="dash-alerts__name">{u.label}</span>
                <span className="dash-alerts__status">{statusLabel(u.status, isJa)}</span>
              </span>
              {minutes !== null && <span className="dash-alerts__time">{formatMinutes(minutes, isJa)}</span>}
              <span className="material-symbols-outlined dash-alerts__chevron">chevron_right</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
