import { useMemo } from "react";
import { STATUS_THEME, statusLabel } from "../twin/twinTheme";

/** First visible character of a name (skips brackets like "(Naomi)"). */
const initialOf = (name) => (name || "?").trim().charAt(0);
const mainName = (name) => (name || "").replace(/\s*\(.*\)\s*$/, "");

/**
 * Who is on which machine right now.
 */
export default function WorkersPanel({ units, onSelect, isJa, hasData }) {
  const workers = useMemo(
    () => units.filter((u) => u.worker && u.status !== "off"),
    [units]
  );

  if (hasData && workers.length === 0) {
    return (
      <div className="dash-empty" style={{ "--status": "#64748b" }}>
        <span className="material-symbols-outlined">person_off</span>
        <strong>{isJa ? "作業者なし" : "Nobody on the floor"}</strong>
      </div>
    );
  }

  return (
    <div className="dash-workers">
      <div className="dash-workers__count">
        <span className="material-symbols-outlined">groups</span>
        <strong>{workers.length}</strong>
        <span>{isJa ? "人が稼働中" : "people working"}</span>
      </div>
      <div className="dash-workers__grid">
        {workers.map((u) => {
          const theme = STATUS_THEME[u.status] || STATUS_THEME.off;
          return (
            <button
              key={u.id}
              type="button"
              className="dash-workers__card"
              style={{ "--status": theme.color }}
              onClick={() => onSelect(u.id)}
            >
              <span className="dash-workers__avatar">{initialOf(u.worker)}</span>
              <span className="min-w-0">
                <span className="dash-workers__name">{mainName(u.worker)}</span>
                <span className="dash-workers__machine">
                  {u.label} · {statusLabel(u.status, isJa)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
