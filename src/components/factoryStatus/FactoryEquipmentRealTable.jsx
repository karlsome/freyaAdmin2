import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRecordByKey } from "../../services/api";
import { fetchPlannerPlans } from "../../services/plannerApi";
import { fetchDigitalTwin, fetchLiveProductionMachines } from "../../services/digitalTwinApi";
import RecordDetailModal from "../RecordDetailModal";
import { PlannerInProgressModal } from "../planner/PlannerSessionModals";
import { buildUnits } from "../panels/twinUnits";
import { STATUS_THEME, formatAgo, formatNumber, statusLabel } from "../twin/twinTheme";

/**
 * Equipment table with the REAL numbers (replaces the tablet-log session table for the current production day).
 *   Submitted   = pressDB runs already submitted today (digital-twin completedRuns)
 *   In progress = the item running now: (cycle counter - this machine's submitted shots) x pcs/cycle (live-production route)
 *   Real total  = submitted + in progress
 * Machines running together (OZNC04 <-> OZNC06) are one row with one piece count.
 * Only meaningful for the current production day: for any other date it renders `fallback` (the log based table).
 */
// A counter only counts if its last cycle happened on the plan date (the DB keeps the last value forever, e.g. 55 from September)
function counterIsCurrent(machine, factory, date) {
  if (!machine?.lastCycleAt) return false;
  const zone = factory === "SCNA" ? "America/Los_Angeles" : "Asia/Tokyo";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(machine.lastCycleAt));
  return day >= date;
}

const runGood = (run) => (run.good != null ? Number(run.good) || 0 : Math.max(0, (Number(run.pieces) || 0) - (Number(run.ng) || 0)));

export default function FactoryEquipmentRealTable({ factory, date, refreshNonce = 0, onLiveTotals, isJa, fallback = null }) {
  const [twin, setTwin] = useState(null);
  const [live, setLive] = useState([]);
  const [planned, setPlanned] = useState([]); // products of today's production plan (productionPlansDB)
  const [failed, setFailed] = useState(false);
  const [recordModal, setRecordModal] = useState(null); // submitted pressDB record (same modal as the factory overview)
  const [sessionModal, setSessionModal] = useState(null); // in-progress tablet session
  const [notice, setNotice] = useState("");
  const liveTotalsRef = useRef(onLiveTotals);
  useEffect(() => { liveTotalsRef.current = onLiveTotals; });

  async function openSubmittedRun(run) {
    setNotice("");
    const record = await fetchRecordByKey("Press", { 工場: factory, Date: date, Time_start: run.start, 品番: run.hinban });
    if (record) setRecordModal(record);
    else setNotice(isJa ? `${run.sebanggo} の提出記録が見つかりません` : `Could not find the submitted record for ${run.sebanggo}`);
  }

  function openInProgress(row) {
    if (!row.sessionID) return;
    const now = new Date();
    const slot = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setSessionModal({ equipment: row.fullLabel, slot, session: { sessionID: row.sessionID } });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextTwin = await fetchDigitalTwin(factory);
        const planDate = nextTwin.productionDate || date;
        const [nextLive, plans] = await Promise.all([
          fetchLiveProductionMachines(factory, planDate),
          fetchPlannerPlans({ factory, date: planDate }).catch(() => []),
        ]);
        if (cancelled) return;
        setTwin(nextTwin);
        setLive(nextLive);
        setPlanned(Array.isArray(plans?.[0]?.products) ? plans[0].products : []);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [factory, date, refreshNonce]);

  const rows = useMemo(() => {
    if (!twin) return [];
    const byId = Object.fromEntries((twin.machines || []).map((m) => [m.id, m]));
    return buildUnits(byId, Object.keys(byId)).map((unit) => {
      const primary = byId[unit.id];
      const together = unit.together;
      const runs = (together ? primary?.pair?.completedRuns : primary?.completedRuns) || [];
      const submitted = runs.reduce((sum, run) => sum + runGood(run), 0);
      // Planned = what the planner scheduled on this machine/pair today, in schedule order
      const plannedItems = planned
        .filter((item) => String(item.equipment || "").split(",").map((x) => x.trim().toUpperCase()).some((id) => unit.ids.includes(id)))
        .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")))
        .map((item) => ({ serial: item.背番号 || "", quantity: Number(item.quantity) || 0, startTime: item.startTime || "" }));
      const plannedTotal = plannedItems.reduce((sum, item) => sum + item.quantity, 0);
      const liveMs = live.filter((m) => unit.ids.includes(m.machine));
      const hasLive = liveMs.length > 0;
      const activeRuns = unit.ids.map((id) => byId[id]?.activeRun).filter(Boolean);
      const inProgress = hasLive
        ? liveMs.reduce((sum, m) => sum + (Number(m.pieces) || 0), 0)
        : activeRuns.reduce((sum, r) => sum + (Number(r.pieces) || 0), 0);
      const ng = hasLive ? Math.max(0, ...liveMs.map((m) => Number(m.ng) || 0)) : 0;
      const cycles = hasLive
        ? liveMs.reduce((sum, m) => sum + (Number(m.cycles) || 0), 0)
        : activeRuns.reduce((sum, r) => sum + (Number(r.shots) || 0), 0);
      const runningSerial = hasLive ? liveMs[0].背番号 : (activeRuns[0]?.sebanggo || "");
      const runningHinban = (twin.machines || []).find((m) => unit.ids.includes(m.id) && m.sebanggo === runningSerial)?.hinban || "";
      const counters = unit.ids.map((id) => (counterIsCurrent(byId[id], factory, date) ? byId[id]?.cycle : null));
      const lastCycle = Math.min(...unit.ids.map((id) => byId[id]?.secondsSinceCycle ?? Infinity));
      return {
        ...unit,
        runs,
        plannedItems,
        plannedTotal,
        submitted,
        inProgress,
        ng,
        cycles,
        runningSerial,
        runningHinban,
        inProgressGood: Math.max(0, inProgress - ng),
        total: submitted + Math.max(0, inProgress - ng),
        counters,
        lastCycle: Number.isFinite(lastCycle) ? lastCycle : null,
        source: hasLive ? liveMs[0].source : null,
        sessionID: hasLive ? liveMs[0].sessionID || "" : "",
      };
    });
  }, [twin, live, planned, factory, date]);

  // Tell the page how many live (unsubmitted) pieces/NG this factory has, so its header chips include them
  const showingReal = Boolean(twin) && !failed && (!twin.productionDate || twin.productionDate === date);
  const liveGross = showingReal ? rows.reduce((sum, r) => sum + r.inProgress, 0) : 0;
  const liveNg = showingReal ? rows.reduce((sum, r) => sum + r.ng, 0) : 0;
  useEffect(() => {
    liveTotalsRef.current?.(factory, { pieces: liveGross, ng: liveNg });
    return () => liveTotalsRef.current?.(factory, null);
  }, [factory, liveGross, liveNg]);

  // The live numbers only exist for the current production day
  if (failed || (twin && twin.productionDate && twin.productionDate !== date)) return fallback;
  if (!twin) {
    return <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-xs text-[var(--text-muted)]">{isJa ? "読み込み中..." : "Loading..."}</div>;
  }

  const totals = rows.reduce((acc, r) => ({
    submitted: acc.submitted + r.submitted,
    inProgress: acc.inProgress + r.inProgressGood,
    total: acc.total + r.total,
    planned: acc.planned + r.plannedTotal,
  }), { submitted: 0, inProgress: 0, total: 0, planned: 0 });

  const th = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <table className="min-w-full border-separate border-spacing-0 text-xs">
        <thead className="bg-[var(--surface-subtle)]">
          <tr>
            <th className={th}>{isJa ? "設備" : "Equipment"}</th>
            <th className={th}>{isJa ? "ステータス" : "Status"}</th>
            <th className={th} title={isJa ? "本日の生産計画の数量" : "Quantity scheduled in today's production plan"}>{isJa ? "計画数量" : "Planned qty"}</th>
            <th className={th}>{isJa ? "作業者" : "Operator"}</th>
            <th className={th} title={isJa ? "良品数（NG除く）" : "Good pieces (NG excluded)"}>{isJa ? "進行中" : "In progress"}</th>
            <th className={th} title={isJa ? "良品数（NG除く）" : "Good pieces (NG excluded)"}>{isJa ? "提出済み" : "Submitted"}</th>
            <th className={`${th} text-right`}>{isJa ? "実数（合計）" : "Real total"}</th>
            <th className={th}>{isJa ? "カウンタ" : "Counter"}</th>
            <th className={th}>{isJa ? "最終サイクル" : "Last cycle"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const theme = STATUS_THEME[row.status] || STATUS_THEME.off;
            return (
              <tr key={row.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-hover)]">
                <td className="border-t border-[var(--border)] px-3 py-2.5 font-semibold text-[var(--text-primary)] whitespace-nowrap">{row.fullLabel}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider" style={{ color: theme.color, background: `${theme.color}1f` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{theme.icon}</span>
                    {statusLabel(row.status, isJa)}
                  </span>
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5">
                  {row.plannedItems.length ? (
                    <div className="flex flex-wrap gap-1">
                      {row.plannedItems.map((item, index) => (
                        <span
                          key={`${item.serial}-${item.startTime}-${index}`}
                          title={item.startTime ? `${isJa ? "開始" : "Starts"} ${item.startTime}` : undefined}
                          className="rounded-[4px] border border-[var(--freya-blue)]/25 bg-[var(--freya-blue)]/5 px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
                        >
                          {item.serial} <span className="font-semibold text-[var(--freya-blue)]">{formatNumber(item.quantity)}</span>
                        </span>
                      ))}
                      {row.plannedItems.length > 1 ? (
                        <span
                          title={isJa ? "計画数量の合計" : "Total planned quantity"}
                          className="rounded-[4px] border border-[var(--freya-blue)] bg-[var(--freya-blue)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-white"
                        >
                          {isJa ? "合計" : "Total"} {formatNumber(row.plannedTotal)}
                        </span>
                      ) : null}
                    </div>
                  ) : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 text-[var(--text-primary)]">{row.worker || "—"}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5">
                  {row.runningSerial && row.inProgress > 0 ? (
                    <button
                      type="button"
                      onClick={() => openInProgress(row)}
                      disabled={!row.sessionID}
                      title={row.sessionID ? (isJa ? "進行中セッションの詳細を表示" : "View the in-progress session") : undefined}
                      className={`text-left ${row.sessionID ? "cursor-pointer rounded-[4px] px-1 -mx-1 hover:bg-amber-500/10" : "cursor-default"}`}
                    >
                      <div className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {row.runningSerial} · {formatNumber(row.inProgressGood)} {isJa ? "個" : "pcs"}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {formatNumber(row.cycles)} {isJa ? "サイクル" : "cycles"}{row.ng > 0 ? ` · NG ${formatNumber(row.ng)}` : ""}
                        {row.source === "submitted-shots" ? "" : row.source ? " · start" : ""}
                      </div>
                    </button>
                  ) : "—"}
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5">
                  {row.runs.length ? (
                    <div className="flex flex-wrap gap-1">
                      {row.runs.map((run, index) => (
                        <button
                          type="button"
                          key={`${run.sebanggo}-${run.start}-${index}`}
                          onClick={() => openSubmittedRun(run)}
                          title={`${run.start}–${run.end} · ${run.shots} ${isJa ? "ショット" : "shots"}${run.ng ? ` · NG ${run.ng}` : ""} — ${isJa ? "提出記録を表示" : "view submitted record"}`}
                          className="cursor-pointer rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)] hover:border-emerald-500/50 hover:bg-emerald-500/10"
                        >
                          {run.sebanggo} <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(runGood(run))}</span>
                        </button>
                      ))}
                    </div>
                  ) : "—"}
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 text-right font-mono font-bold text-[var(--freya-blue)] freya-tabular">{formatNumber(row.total)}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 font-mono text-[var(--text-secondary)] whitespace-nowrap">{row.counters.some((c) => c !== null && c !== undefined) ? row.counters.map((c) => (c ?? "—")).join(" / ") : "—"}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 text-[var(--text-muted)] whitespace-nowrap">{formatAgo(row.lastCycle, isJa)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-[var(--surface-subtle)]">
          <tr>
            <td colSpan={2} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "合計" : "Total"}</td>
            <td className="px-3 py-2 font-mono font-semibold text-[var(--freya-blue)]">{formatNumber(totals.planned)}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 font-mono font-semibold text-amber-600 dark:text-amber-400">{formatNumber(totals.inProgress)}</td>
            <td className="px-3 py-2 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(totals.submitted)}</td>
            <td className="px-3 py-2 text-right font-mono font-bold text-[var(--freya-blue)] freya-tabular">{formatNumber(totals.total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      {notice ? <div className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--status-danger)]">{notice}</div> : null}
      {recordModal ? <RecordDetailModal record={recordModal} processName="Press" onClose={() => setRecordModal(null)} /> : null}
      {sessionModal ? <PlannerInProgressModal target={sessionModal} onClose={() => setSessionModal(null)} /> : null}
    </div>
  );
}
