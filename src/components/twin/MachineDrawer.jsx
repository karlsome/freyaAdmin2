import { STATUS_THEME, effectiveStatus, formatAgo, formatNumber, statusLabel } from "./twinTheme";

function InfoRow({ icon, label, value }) {
  return (
    <div className="twin-drawer__row">
      <span className="material-symbols-outlined twin-drawer__row-icon">{icon}</span>
      <div className="min-w-0">
        <div className="twin-drawer__row-label">{label}</div>
        <div className="twin-drawer__row-value">{value || "—"}</div>
      </div>
    </div>
  );
}

/**
 * Side drawer shown after tapping a machine: big status, one big number, a few facts.
 */
export default function MachineDrawer({ machine, partner, isJa, onClose, onCamera, onDetails }) {
  if (!machine) return null;
  const together = Boolean(machine.pair?.together && partner);
  const status = effectiveStatus(machine);
  const theme = STATUS_THEME[status] || STATUS_THEME.off;

  const pieces = together ? machine.pair.sharedPieces : machine.pieces;
  const cycles = together ? machine.pair.sharedCycles : machine.todayCycles;
  const worker = (together ? machine.pair.worker : machine.worker) || partner?.worker;
  const sebanggo = (together ? machine.pair.sebanggo : machine.sebanggo) || partner?.sebanggo;
  const hinban = machine.hinban || partner?.hinban;
  const counting = together
    ? [machine, partner].filter(Boolean).sort((a, b) => (b.todayCycles || 0) - (a.todayCycles || 0))[0]
    : machine;
  const secondsSince = counting?.secondsSinceCycle ?? null;
  const title = together ? `${machine.id} ⇄ ${partner.id}` : machine.id;
  const showPieces = pieces !== null && pieces !== undefined;

  return (
    <aside className="twin-drawer" style={{ "--status": theme.color }} aria-label={title}>
      <div className="twin-drawer__header">
        <div className="min-w-0">
          <h2 className="twin-drawer__title">{title}</h2>
          {together && (
            <div className="twin-drawer__pair">
              <span className="material-symbols-outlined">link</span>
              {isJa ? "ペア運転中" : "Running as a pair"}
            </div>
          )}
          {!together && machine.pair?.partner && (
            <div className="twin-drawer__pair twin-drawer__pair--solo">
              <span className="material-symbols-outlined">link_off</span>
              {isJa ? `単独運転（ペア: ${machine.pair.partner}）` : `Solo (pair: ${machine.pair.partner})`}
            </div>
          )}
        </div>
        <button type="button" className="twin-icon-btn" onClick={onClose} aria-label={isJa ? "閉じる" : "Close"}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className={`twin-drawer__status ${theme.pulse ? "twin-drawer__status--alert" : ""}`}>
        <span className="material-symbols-outlined">{theme.icon}</span>
        <span>{statusLabel(status, isJa)}</span>
        {machine.alertSince && (
          <span className="twin-drawer__status-since">
            {new Date(machine.alertSince).toLocaleTimeString(isJa ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}〜
          </span>
        )}
      </div>

      <div className="twin-drawer__hero">
        <div className="twin-drawer__hero-value">
          {showPieces ? formatNumber(pieces) : formatNumber(cycles || 0)}
          <small>{showPieces ? (isJa ? "個" : "pcs") : (isJa ? "回" : "cycles")}</small>
        </div>
        <div className="twin-drawer__hero-sub">
          {machine.hasCycleSensor || partner?.hasCycleSensor
            ? showPieces
              ? `${formatNumber(cycles)} ${isJa ? "サイクル" : "cycles"} × ${counting?.pcPerCycle ?? machine.pcPerCycle ?? "?"} ${isJa ? "個/サイクル" : "pcs/cycle"}`
              : isJa ? "背番号が不明のため個数は計算できません" : "背番号 unknown, so pieces can't be calculated"
            : isJa ? "サイクルセンサー未設置" : "No cycle sensor on this machine"}
        </div>
      </div>

      <div className="twin-drawer__rows">
        <InfoRow icon="person" label={isJa ? "作業者" : "Worker"} value={worker} />
        <InfoRow icon="sell" label="背番号 / 品番" value={sebanggo ? `${sebanggo}${hinban ? `  ·  ${hinban}` : ""}` : ""} />
        <InfoRow icon="schedule" label={isJa ? "最後のサイクル" : "Last cycle"} value={formatAgo(secondsSince, isJa)} />
        {machine.tableLength && (
          <InfoRow
            icon="straighten"
            label={isJa ? "仕様" : "Spec"}
            value={`${machine.noOfHead || 1}${isJa ? "ヘッド" : " head"} · ${machine.tableLength}mm`}
          />
        )}
      </div>

      <div className="twin-drawer__actions">
        <button type="button" className="twin-btn twin-btn--ghost" onClick={onCamera}>
          <span className="material-symbols-outlined">videocam</span>
          {isJa ? "カメラ" : "Camera"}
        </button>
        <button type="button" className="twin-btn twin-btn--primary" onClick={onDetails}>
          <span className="material-symbols-outlined">open_in_new</span>
          {isJa ? "詳細" : "Details"}
        </button>
      </div>
    </aside>
  );
}
