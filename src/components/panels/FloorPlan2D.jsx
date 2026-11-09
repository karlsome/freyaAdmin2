import { STATUS_THEME, formatNumber, statusLabel } from "../twin/twinTheme";

function sinceLabel(iso, isJa) {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const hhmm = t.toLocaleTimeString(isJa ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" });
  return isJa ? `${hhmm}〜` : `since ${hhmm}`;
}

/**
 * Automatic 2D floor for factories without a 3D map: one "station" per machine used recently.
 * Status comes from tablet sessions (start → end → submit) until cycle sensors are installed.
 */
export default function FloorPlan2D({ units, machinesById, selectedId, onSelect, isJa, hasSensors }) {
  if (!units.length) {
    return (
      <div className="floor2d floor2d--empty">
        <span className="material-symbols-outlined">factory</span>
        <p>{isJa ? "最近30日間の稼働記録がありません" : "No machine activity in the last 30 days"}</p>
      </div>
    );
  }

  return (
    <div className="floor2d">
      {!hasSensors && (
        <div className="floor2d__note">
          <span className="material-symbols-outlined">tablet_mac</span>
          {isJa
            ? "タブレット記録による状態表示（サイクルセンサー未設置）"
            : "Status from tablet sessions — no cycle sensors yet"}
        </div>
      )}
      <div className="floor2d__grid">
        {units.map((u) => {
          const theme = STATUS_THEME[u.status] || STATUS_THEME.off;
          const m = machinesById[u.id];
          const selected = u.ids.includes(selectedId);
          const since = u.status === "running"
            ? sinceLabel(m?.sessionStartedAt, isJa)
            : sinceLabel(u.alertSince, isJa);
          const runs = m?.completedRuns?.length || 0;
          return (
            <button
              key={u.id}
              type="button"
              className={`floor2d__station ${selected ? "is-selected" : ""} ${theme.pulse ? "is-alert" : ""} is-${u.status}`}
              style={{ "--status": theme.color }}
              onClick={() => onSelect(u.id)}
              aria-label={`${u.fullLabel} ${statusLabel(u.status, isJa)}`}
            >
              <span className="floor2d__machine" aria-hidden="true">
                <span className="floor2d__bed" />
                <span className="floor2d__light" />
              </span>
              <span className="floor2d__body">
                <span className="floor2d__name">
                  {u.together && <span className="material-symbols-outlined">link</span>}
                  {u.fullLabel}
                </span>
                <span className="floor2d__status">
                  <span className="material-symbols-outlined">{theme.icon}</span>
                  {statusLabel(u.status, isJa)}
                  {since && <small>{since}</small>}
                </span>
                <span className="floor2d__meta">
                  <b>{u.pieces !== null && u.pieces !== undefined ? formatNumber(u.pieces) : "—"}</b>
                  <small>{isJa ? "個" : "pcs"}</small>
                  {runs > 0 && <em>· {runs}{isJa ? "ロット" : runs === 1 ? " run" : " runs"}</em>}
                </span>
                {(u.worker || u.sebanggo) && (
                  <span className="floor2d__who">
                    {u.sebanggo && <span className="floor2d__seb">{u.sebanggo}</span>}
                    {u.worker && <span className="floor2d__worker">{u.worker}</span>}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
