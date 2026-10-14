import { useState } from "react";
import { STATUS_THEME, TIMELINE_THEME, effectiveStatus, formatAgo, formatNumber, statusLabel, timelineLabel } from "./twinTheme";

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
 * Side drawer shown after tapping a machine:
 * - Big status & hero numbers
 * - Interactive Shift Timeline bar with hoverable segments and uptime summary
 * - Production Breakdown: completed runs with accurate pieces + live active run
 * - Specification facts and quick actions
 */
export default function MachineDrawer({ machine, partner, isJa, onClose, onCamera, onDetails }) {
  const [hoveredSeg, setHoveredSeg] = useState(null);

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

  // Timeline & production breakdown data (prefer shared pair data if paired)
  const completedRuns = (together && machine.pair?.completedRuns?.length)
    ? machine.pair.completedRuns
    : (machine.completedRuns || []);
  const activeRun = machine.activeRun;
  const timeline = machine.timeline || [];
  const summary = machine.timelineSummary;
  const totalShiftMin = summary?.totalShiftMin || 660;

  return (
    <aside className="twin-drawer" style={{ "--status": theme.color }} aria-label={title}>
      {/* Header */}
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

      {/* Live Status Badge */}
      <div className={`twin-drawer__status ${theme.pulse ? "twin-drawer__status--alert" : ""}`}>
        <span className="material-symbols-outlined">{theme.icon}</span>
        <span>{statusLabel(status, isJa)}</span>
        {machine.alertSince && (
          <span className="twin-drawer__status-since">
            {new Date(machine.alertSince).toLocaleTimeString(isJa ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}〜
          </span>
        )}
      </div>

      {/* Big Hero Metric */}
      <div className="twin-drawer__hero">
        <div className="twin-drawer__hero-value">
          {showPieces ? formatNumber(pieces) : formatNumber(cycles || 0)}
          <small>{showPieces ? (isJa ? "個" : "pcs") : (isJa ? "回" : "cycles")}</small>
        </div>
        <div className="twin-drawer__hero-sub">
          {completedRuns.length > 0
            ? isJa
              ? `本日完了 ${completedRuns.length} ロット${activeRun ? " + 生産中 1 ロット" : ""}`
              : `${completedRuns.length} completed run(s)${activeRun ? " + 1 active" : ""}`
            : machine.hasCycleSensor || partner?.hasCycleSensor
              ? showPieces
                ? `${formatNumber(cycles)} ${isJa ? "サイクル" : "cycles"} × ${counting?.pcPerCycle ?? machine.pcPerCycle ?? "?"} ${isJa ? "個/サイクル" : "pcs/cycle"}`
                : isJa ? "背番号が不明のため個数は計算できません" : "背番号 unknown, so pieces can't be calculated"
              : isJa ? "サイクルセンサー未設置" : "No cycle sensor on this machine"}
        </div>
      </div>

      {/* ── Interactive Shift Timeline ── */}
      {timeline.length > 0 && (
        <section className="twin-drawer__section" aria-label={isJa ? "稼働タイムライン" : "Shift Timeline"}>
          <div className="twin-drawer__section-header">
            <span className="twin-drawer__section-title">
              <span className="material-symbols-outlined">view_timeline</span>
              {isJa ? "稼働タイムライン" : "Shift Timeline"}
            </span>
            {summary?.uptimePercent !== undefined && (
              <span className="twin-drawer__uptime-badge">
                {isJa ? `稼働率 ${summary.uptimePercent}%` : `${summary.uptimePercent}% uptime`}
              </span>
            )}
          </div>

          {/* Timeline Bar */}
          <div className="twin-timeline-bar" role="meter" aria-label="Shift Timeline">
            {timeline.map((seg, idx) => {
              const dur = seg.durationMin || 0;
              if (dur <= 0) return null;
              const widthPct = (dur / totalShiftMin) * 100;
              const segTheme = TIMELINE_THEME[seg.type] || TIMELINE_THEME.off;
              const tooltip = `${timelineLabel(seg.type, isJa)}: ${seg.start}〜${seg.end} (${dur}${isJa ? "分" : "m"})${seg.sebanggo ? ` · 背番号: ${seg.sebanggo}` : ""}${seg.pieces ? ` · ${formatNumber(seg.pieces)}${isJa ? "個" : "pcs"}` : ""}`;

              return (
                <div
                  key={`${seg.type}-${idx}`}
                  className="twin-timeline-seg"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: segTheme.color,
                  }}
                  title={tooltip}
                  onMouseEnter={() => setHoveredSeg({ ...seg, widthPct, label: timelineLabel(seg.type, isJa) })}
                  onMouseLeave={() => setHoveredSeg(null)}
                />
              );
            })}
          </div>

          {/* Active Hover / Segment Details */}
          {hoveredSeg ? (
            <div className="twin-timeline-hover">
              <span className="twin-timeline-hover__dot" style={{ background: (TIMELINE_THEME[hoveredSeg.type] || TIMELINE_THEME.off).color }} />
              <div className="min-w-0 flex-1">
                <b>{hoveredSeg.label}{hoveredSeg.sebanggo ? ` (${hoveredSeg.sebanggo})` : ""}:</b>{" "}
                <span>{hoveredSeg.start}〜{hoveredSeg.end} ({hoveredSeg.durationMin}{isJa ? "分" : "m"})</span>
                {hoveredSeg.pieces ? <span> · {formatNumber(hoveredSeg.pieces)}{isJa ? "個" : "pcs"}</span> : null}
              </div>
            </div>
          ) : (
            <div className="twin-timeline-pills">
              <span className="twin-timeline-pill">
                <span className="twin-timeline-pill__dot" style={{ background: TIMELINE_THEME.running.color }} />
                {isJa ? "稼働" : "Run"}: {summary?.runningMin ?? 0}{isJa ? "分" : "m"}
              </span>
              <span className="twin-timeline-pill">
                <span className="twin-timeline-pill__dot" style={{ background: TIMELINE_THEME.idle.color }} />
                {isJa ? "待機" : "Idle"}: {(summary?.idleMin ?? 0) + (summary?.setupMin ?? 0)}{isJa ? "分" : "m"}
              </span>
              <span className="twin-timeline-pill">
                <span className="twin-timeline-pill__dot" style={{ background: TIMELINE_THEME.break.color }} />
                {isJa ? "休憩" : "Break"}: {summary?.breakMin ?? 0}{isJa ? "分" : "m"}
              </span>
              {(summary?.stopCallMin || summary?.maintenanceMin) ? (
                <span className="twin-timeline-pill twin-timeline-pill--alert">
                  <span className="twin-timeline-pill__dot" style={{ background: TIMELINE_THEME.stopCall.color }} />
                  {isJa ? "停止" : "Stop"}: {(summary.stopCallMin || 0) + (summary.maintenanceMin || 0)}{isJa ? "分" : "m"}
                </span>
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* ── Production Breakdown (Per-Run Lots) ── */}
      <section className="twin-drawer__section" aria-label={isJa ? "生産内訳" : "Production Breakdown"}>
        <div className="twin-drawer__section-header">
          <span className="twin-drawer__section-title">
            <span className="material-symbols-outlined">format_list_bulleted</span>
            {isJa ? "生産内訳・ロット実績" : "Production Breakdown"}
          </span>
          <span className="twin-drawer__badge">
            {completedRuns.length + (activeRun ? 1 : 0)} {isJa ? "件" : "runs"}
          </span>
        </div>

        <div className="twin-runs-list">
          {/* Ongoing In-Progress Run if any */}
          {activeRun && (
            <div className="twin-run-card twin-run-card--active">
              <div className="twin-run-card__header">
                <div className="twin-run-card__badge-row">
                  <span className="twin-run-card__sebanggo">{activeRun.sebanggo || "—"}</span>
                  <span className="twin-run-card__live-chip">
                    <span className="twin-run-card__pulse-dot" />
                    {isJa ? "生産中" : "In Progress"}
                  </span>
                </div>
                {activeRun.hinban && <div className="twin-run-card__hinban">{activeRun.hinban}</div>}
              </div>
              <div className="twin-run-card__body">
                <div className="twin-run-card__metric">
                  <div className="twin-run-card__value">
                    {formatNumber(activeRun.pieces)} <small>{isJa ? "個" : "pcs"}</small>
                  </div>
                  <div className="twin-run-card__sub">
                    {formatNumber(activeRun.shots)} {isJa ? "サイクル" : "cycles"}
                  </div>
                </div>
                <div className="twin-run-card__meta">
                  <div className="twin-run-card__time">
                    <span className="material-symbols-outlined">schedule</span>
                    {activeRun.start}〜{isJa ? "現在" : "now"}
                  </div>
                  {activeRun.worker && (
                    <div className="twin-run-card__worker">
                      <span className="material-symbols-outlined">person</span>
                      {activeRun.worker}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Completed Runs */}
          {completedRuns.map((r, idx) => (
            <div key={`${r.sebanggo}-${r.start}-${idx}`} className="twin-run-card">
              <div className="twin-run-card__header">
                <div className="twin-run-card__badge-row">
                  <span className="twin-run-card__sebanggo">{r.sebanggo || "—"}</span>
                  <span className="twin-run-card__order">#{idx + 1}</span>
                </div>
                {r.hinban && <div className="twin-run-card__hinban">{r.hinban}</div>}
              </div>
              <div className="twin-run-card__body">
                <div className="twin-run-card__metric">
                  <div className="twin-run-card__value">
                    {formatNumber(r.pieces)} <small>{isJa ? "個" : "pcs"}</small>
                  </div>
                  <div className="twin-run-card__sub">
                    {formatNumber(r.shots)} {isJa ? "サイクル" : "cycles"}
                  </div>
                </div>
                <div className="twin-run-card__meta">
                  <div className="twin-run-card__time">
                    <span className="material-symbols-outlined">schedule</span>
                    {r.start}〜{r.end} {r.durationMin ? `(${r.durationMin}${isJa ? "分" : "m"})` : ""}
                  </div>
                  {r.worker && (
                    <div className="twin-run-card__worker">
                      <span className="material-symbols-outlined">person</span>
                      {r.worker}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {!activeRun && completedRuns.length === 0 && (
            <div className="twin-runs-empty">
              <span className="material-symbols-outlined">inventory_2</span>
              <span>{isJa ? "本日の完了ロットはまだありません" : "No completed runs yet today"}</span>
            </div>
          )}
        </div>
      </section>

      {/* Info Rows */}
      <div className="twin-drawer__rows">
        <InfoRow icon="person" label={isJa ? "現在の作業者" : "Current Worker"} value={worker} />
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

      {/* Bottom Actions */}
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

