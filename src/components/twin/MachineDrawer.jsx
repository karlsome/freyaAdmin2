import { useEffect, useState } from "react";
import { fetchPlannerPlans } from "../../services/plannerApi";
import { fetchLiveProductionMachines } from "../../services/digitalTwinApi";
import { fetchRecordByKey } from "../../services/api";
import RecordDetailModal from "../RecordDetailModal";
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
export default function MachineDrawer({ machine, partner, isJa, factory, productionDate, refreshKey, onClose, onCamera, onDetails }) {
  const [hoveredSeg, setHoveredSeg] = useState(null);
  const [planned, setPlanned] = useState([]); // today's production plan products (same source as Factory Status)
  const [live, setLive] = useState([]); // live (unsubmitted) pieces per machine
  const [liveReadyFor, setLiveReadyFor] = useState(null); // machine id the live pieces were last loaded for
  const [recordModal, setRecordModal] = useState(null); // submitted pressDB record of a clicked run
  const [notice, setNotice] = useState("");

  async function openSubmittedRun(run) {
    setNotice("");
    const record = await fetchRecordByKey("Press", { 工場: factory, Date: productionDate, Time_start: run.start, 品番: run.hinban });
    if (record) setRecordModal(record);
    else setNotice(isJa ? `${run.sebanggo} の提出記録が見つかりません` : `Could not find the submitted record for ${run.sebanggo}`);
  }

  const machineId = machine?.id;
  const partnerId = machine?.pair?.together && partner ? partner.id : null;
  useEffect(() => {
    if (!machineId || !factory || !productionDate) { setPlanned([]); setLive([]); setLiveReadyFor(null); return undefined; }
    let cancelled = false;
    // Independent requests: the live pieces (slow) must not wait for the plan, and vice versa.
    fetchLiveProductionMachines(factory, productionDate).then((nextLive) => {
      if (cancelled) return;
      setLive(nextLive);
      setLiveReadyFor(machineId);
    }).catch(() => { if (!cancelled) setLiveReadyFor(machineId); });
    fetchPlannerPlans({ factory, date: productionDate }).catch(() => []).then((plans) => {
      if (cancelled) return;
      setPlanned(Array.isArray(plans?.[0]?.products) ? plans[0].products : []);
    });
    return () => { cancelled = true; };
  }, [machineId, partnerId, factory, productionDate, refreshKey]);

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
  // Pair: the cycle counter sits on one machine, so show the active run of whichever has the pieces (not always the clicked one)
  const baseActiveRun = together
    ? [machine.activeRun, partner.activeRun].filter(Boolean).sort((a, b) => (Number(b.pieces) || 0) - (Number(a.pieces) || 0))[0]
    : machine.activeRun;
  const rawTimeline = machine.timeline || [];
  const rawSummary = machine.timelineSummary;
  // The server fills the rest of the shift with idle. Time that has not happened yet is "Upcoming", not idle.
  const nowParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const nowMin = Number(nowParts.find((p) => p.type === "hour")?.value) * 60 + Number(nowParts.find((p) => p.type === "minute")?.value);
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  let futureIdleMin = 0;
  const timeline = rawTimeline.flatMap((seg) => {
    const fillable = seg.type === "idle" || seg.type === "setup" || seg.type === "off";
    if (!fillable || !Number.isFinite(seg.startMin) || !Number.isFinite(seg.endMin) || seg.endMin <= nowMin) return [seg];
    const futureStart = Math.max(seg.startMin, nowMin);
    if (seg.type !== "off") futureIdleMin += seg.endMin - futureStart;
    const future = { ...seg, type: "upcoming", startMin: futureStart, start: hhmm(futureStart), durationMin: seg.endMin - futureStart };
    if (seg.startMin >= nowMin) return [future];
    return [{ ...seg, endMin: nowMin, end: hhmm(nowMin), durationMin: nowMin - seg.startMin }, future];
  });
  const summary = rawSummary && futureIdleMin > 0
    ? (() => {
        const idleMin = Math.max(0, (rawSummary.idleMin || 0) - futureIdleMin);
        const operating = (rawSummary.runningMin || 0) + idleMin + (rawSummary.setupMin || 0) + (rawSummary.stopCallMin || 0) + (rawSummary.maintenanceMin || 0);
        return { ...rawSummary, idleMin, uptimePercent: operating > 0 ? Math.round(((rawSummary.runningMin || 0) / operating) * 100) : 0 };
      })()
    : rawSummary;
  const totalShiftMin = summary?.totalShiftMin || 660;

  // ── Today's goal progress (same rules as Factory Status → Production Status) ──
  const unitIds = [machine.id, together ? partner.id : null].filter(Boolean).map((id) => String(id).toUpperCase());
  const goal = planned
    .filter((item) => String(item.equipment || "").split(",").map((x) => x.trim().toUpperCase()).some((id) => unitIds.includes(id)))
    .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const submittedGood = completedRuns.reduce(
    (sum, run) => sum + (run.good != null ? Number(run.good) || 0 : Math.max(0, (Number(run.pieces) || 0) - (Number(run.ng) || 0))), 0);
  const liveMs = live.filter((m) => unitIds.includes(String(m.machine).toUpperCase()));
  const inProgressGross = liveMs.length
    ? liveMs.reduce((sum, m) => sum + (Number(m.pieces) || 0), 0)
    : (baseActiveRun ? Number(baseActiveRun.pieces) || 0 : 0);
  const liveNg = liveMs.length ? Math.max(0, ...liveMs.map((m) => Number(m.ng) || 0)) : 0;
  const inProgressGood = Math.max(0, inProgressGross - liveNg);
  // The In Progress card is per machine (the one clicked); Today's Goal above stays the summed pair total
  const ownLive = live.find((m) => String(m.machine).toUpperCase() === String(machine.id).toUpperCase());
  const ownRun = machine.activeRun || (together ? partner.activeRun : null);
  const ownPieces = ownLive ? Math.max(0, (Number(ownLive.pieces) || 0) - (Number(ownLive.ng) || 0)) : (machine.activeRun ? Number(machine.activeRun.pieces) || 0 : 0);
  const ownCycles = ownLive ? Number(ownLive.cycles) || 0 : (machine.activeRun ? Number(machine.activeRun.shots) || 0 : 0);
  const activeRun = ownRun || ownLive
    ? {
        ...(ownRun || { sebanggo: ownLive?.背番号 || "", hinban: machine.hinban || partner?.hinban || "", worker, start: "", end: "" }),
        pieces: ownPieces,
        shots: ownCycles,
      }
    : null;
  // Live pieces are still being calculated: show a loading card instead of rough snapshot numbers
  const liveLoading = liveReadyFor !== machineId && Boolean(ownRun || status === "running");
  const doneTotal = submittedGood + inProgressGood;
  const donePct = goal > 0 ? Math.round((doneTotal / goal) * 100) : 0;
  const submittedPct = goal > 0 ? Math.min(100, (submittedGood / goal) * 100) : 0;
  const inProgressPct = goal > 0 ? Math.min(100 - submittedPct, (inProgressGood / goal) * 100) : 0;

  return (
    <>
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

      {/* ── Today's Goal Progress ── */}
      {goal > 0 && (
        <section className="twin-drawer__section" aria-label={isJa ? "本日の進捗" : "Today's Progress"}>
          <div className="twin-drawer__section-header">
            <span className="twin-drawer__section-title">
              <span className="material-symbols-outlined">flag</span>
              {isJa ? "本日の目標達成率" : "Today's Goal"}
            </span>
            <span className="twin-drawer__uptime-badge">{donePct}%</span>
          </div>
          <div className="twin-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(donePct, 100)}>
            <div className="twin-goal-bar__seg twin-goal-bar__seg--submitted" style={{ width: `${submittedPct}%` }} />
            <div className="twin-goal-bar__seg twin-goal-bar__seg--progress" style={{ width: `${inProgressPct}%` }} />
          </div>
          <div className="twin-goal-stats">
            <div><span className="twin-goal-stats__dot" style={{ background: "var(--freya-blue, #2563eb)" }} />{isJa ? "目標" : "Goal"} <b>{formatNumber(goal)}</b></div>
            <div><span className="twin-goal-stats__dot" style={{ background: "#10b981" }} />{isJa ? "提出済み" : "Submitted"} <b>{formatNumber(submittedGood)}</b></div>
            <div><span className="twin-goal-stats__dot" style={{ background: "#f59e0b" }} />{isJa ? "生産中" : "In progress"} <b>{formatNumber(inProgressGood)}</b></div>
          </div>
        </section>
      )}

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

              return (
                <div
                  key={`${seg.type}-${idx}`}
                  className="twin-timeline-seg"
                  data-upcoming={seg.type === "upcoming" ? "true" : undefined}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: segTheme.color,
                  }}
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
            {completedRuns.length + (activeRun || liveLoading ? 1 : 0)} {isJa ? "件" : "runs"}
          </span>
        </div>

        {notice ? <div className="twin-runs-notice">{notice}</div> : null}
        <div className="twin-runs-list">
          {/* Ongoing In-Progress Run if any */}
          {liveLoading && (
            <div className="twin-run-card twin-run-card--active twin-run-card--loading" role="status" aria-live="polite">
              <div className="twin-run-card__header">
                <div className="twin-run-card__badge-row">
                  <span className="twin-run-card__sebanggo">{ownRun?.sebanggo || sebanggo || "—"}</span>
                  <span className="twin-run-card__live-chip">
                    <span className="twin-run-card__pulse-dot" />
                    {isJa ? "生産中" : "In Progress"}
                  </span>
                </div>
              </div>
              <div className="twin-run-card__loading-body">
                <span className="twin-run-card__spinner" aria-hidden="true" />
                <span>{isJa ? "ライブ数量を計算中…" : "Calculating live count…"}</span>
              </div>
            </div>
          )}
          {!liveLoading && activeRun && (
            <div className="twin-run-card twin-run-card--active">
              <div className="twin-run-card__header">
                <div className="twin-run-card__badge-row">
                  <span className="twin-run-card__sebanggo">{activeRun.sebanggo || "—"}</span>
                  {together && <span className="twin-run-card__order">{machine.id}</span>}
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
          {/* Newest first (just below In Progress); oldest (#1) at the very bottom */}
          {completedRuns.map((r, idx) => ({ r, idx })).reverse().map(({ r, idx }) => (
            <div
              key={`${r.sebanggo}-${r.start}-${idx}`}
              className="twin-run-card twin-run-card--clickable"
              role="button"
              tabIndex={0}
              title={isJa ? "提出記録を表示" : "View submitted record"}
              onClick={() => openSubmittedRun(r)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSubmittedRun(r); } }}
            >
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

          {!activeRun && !liveLoading && completedRuns.length === 0 && (
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
        <InfoRow icon="sell" label={isJa ? "背番号 / 品番" : "Part No. / Item"} value={sebanggo ? `${sebanggo}${hinban ? `  ·  ${hinban}` : ""}` : ""} />
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
    {recordModal ? <RecordDetailModal record={recordModal} processName="Press" onClose={() => setRecordModal(null)} /> : null}
    </>
  );
}

