import { memo } from "react";
import { Html } from "@react-three/drei";
import { STATUS_THEME } from "./twinTheme";
import { kensaStatus } from "./kensaLive";

/**
 * Floating badge above an inspection table. Shows what the operator is doing right now on the Kensa interactive
 * tablet (品番 scanned, OK / NG counts, boxes scanned, labels printed) or today's submitted total when idle.
 */
const KensaBadge = memo(function KensaBadge({ machineId, position, height = 2.1, title, live, call, today, isJa, selected, onSelect }) {
  const status = kensaStatus(live, call);
  const theme = STATUS_THEME[status] || STATUS_THEME.off;
  const k = live?.kensa || null;
  const active = Boolean(k);
  const showTag = status === "break" || status === "maintenance" || status === "stopCall";

  return (
    <Html position={[position[0], height, position[1]]} center zIndexRange={[30, 10]}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect && onSelect(machineId); }}
        className={`twin-badge ${selected ? "twin-badge--selected" : ""} ${status === "off" && !call ? "twin-badge--dim" : ""} ${theme.pulse ? "twin-badge--alert" : ""}`}
        style={{ "--status": theme.color }}
      >
        <span className="twin-badge__title">
          <span className="twin-badge__dot" />
          <span>{title}</span>
          {active && k.sebango && <span className="twin-badge__sebanggo" title={k.hinban}>{k.sebango}</span>}
          {active && k.ngTotal > 0 && <span className="twin-badge__ng">NG {k.ngTotal}</span>}
        </span>
        <div className="twin-badge__bottom">
          {active ? (
            <span className="twin-badge__value">
              {isJa ? "良" : "OK"} {k.good}
              <small>{` / ${k.processQty}${k.labels?.some((l) => !l.voided) ? ` · 🏷${k.labels.filter((l) => !l.voided).length}` : ""}`}</small>
            </span>
          ) : (
            <span className="twin-badge__value">
              {today && today.records.length > 0 ? today.good : "—"}
              <small>{today && today.records.length > 0 ? (isJa ? " 本日" : " today") : ""}</small>
            </span>
          )}
          {showTag && <span className="twin-badge__status">{isJa ? theme.ja : theme.en}</span>}
        </div>
      </button>
    </Html>
  );
});

export default KensaBadge;
