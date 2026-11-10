import { useEffect, useMemo, useState } from "react";
import { fetchDigitalTwin, fetchLiveProductionMachines } from "../../services/digitalTwinApi";
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
export default function FactoryEquipmentRealTable({ factory, date, refreshNonce = 0, onRowClick, isJa, fallback = null }) {
  const [twin, setTwin] = useState(null);
  const [live, setLive] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextTwin = await fetchDigitalTwin(factory);
        const nextLive = await fetchLiveProductionMachines(factory, nextTwin.productionDate || date);
        if (cancelled) return;
        setTwin(nextTwin);
        setLive(nextLive);
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
      const submitted = runs.reduce((sum, run) => sum + (Number(run.pieces) || 0), 0);
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
      const counters = unit.ids.map((id) => byId[id]?.cycle).filter((c) => c !== null && c !== undefined);
      const lastCycle = Math.min(...unit.ids.map((id) => byId[id]?.secondsSinceCycle ?? Infinity));
      return {
        ...unit,
        runs,
        submitted,
        inProgress,
        ng,
        cycles,
        runningSerial,
        runningHinban,
        total: submitted + Math.max(0, inProgress - ng),
        counters,
        lastCycle: Number.isFinite(lastCycle) ? lastCycle : null,
        source: hasLive ? liveMs[0].source : null,
      };
    });
  }, [twin, live]);

  // The live numbers only exist for the current production day
  if (failed || (twin && twin.productionDate && twin.productionDate !== date)) return fallback;
  if (!twin) {
    return <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6 text-xs text-[var(--text-muted)]">{isJa ? "読み込み中..." : "Loading..."}</div>;
  }

  const totals = rows.reduce((acc, r) => ({
    submitted: acc.submitted + r.submitted,
    inProgress: acc.inProgress + r.inProgress,
    total: acc.total + r.total,
  }), { submitted: 0, inProgress: 0, total: 0 });

  const th = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] whitespace-nowrap";

  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <table className="min-w-full border-separate border-spacing-0 text-xs">
        <thead className="bg-[var(--surface-subtle)]">
          <tr>
            <th className={th}>{isJa ? "設備" : "Equipment"}</th>
            <th className={th}>{isJa ? "ステータス" : "Status"}</th>
            <th className={th}>{isJa ? "作業者" : "Operator"}</th>
            <th className={th}>{isJa ? "進行中" : "In progress"}</th>
            <th className={th}>{isJa ? "提出済み" : "Submitted"}</th>
            <th className={`${th} text-right`}>{isJa ? "実数（合計）" : "Real total"}</th>
            <th className={th}>{isJa ? "カウンタ" : "Counter"}</th>
            <th className={th}>{isJa ? "最終サイクル" : "Last cycle"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const theme = STATUS_THEME[row.status] || STATUS_THEME.off;
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.ids[0])}
                className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-hover)]"
              >
                <td className="border-t border-[var(--border)] px-3 py-2.5 font-semibold text-[var(--text-primary)] whitespace-nowrap">{row.fullLabel}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider" style={{ color: theme.color, background: `${theme.color}1f` }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{theme.icon}</span>
                    {statusLabel(row.status, isJa)}
                  </span>
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 text-[var(--text-primary)]">{row.worker || "—"}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5">
                  {row.runningSerial && row.inProgress > 0 ? (
                    <div>
                      <div className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {row.runningSerial} · {formatNumber(row.inProgress)} {isJa ? "個" : "pcs"}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {formatNumber(row.cycles)} {isJa ? "サイクル" : "cycles"}{row.ng > 0 ? ` · NG ${formatNumber(row.ng)}` : ""}
                        {row.source === "submitted-shots" ? "" : row.source ? " · start" : ""}
                      </div>
                    </div>
                  ) : "—"}
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5">
                  {row.runs.length ? (
                    <div className="flex flex-wrap gap-1">
                      {row.runs.map((run, index) => (
                        <span
                          key={`${run.sebanggo}-${run.start}-${index}`}
                          title={`${run.start}–${run.end} · ${run.shots} ${isJa ? "ショット" : "shots"}`}
                          className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
                        >
                          {run.sebanggo} <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(run.pieces)}</span>
                        </span>
                      ))}
                    </div>
                  ) : "—"}
                </td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 text-right font-mono font-bold text-[var(--freya-blue)] freya-tabular">{formatNumber(row.total)}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 font-mono text-[var(--text-secondary)] whitespace-nowrap">{row.counters.length ? row.counters.join(" / ") : "—"}</td>
                <td className="border-t border-[var(--border)] px-3 py-2.5 text-[var(--text-muted)] whitespace-nowrap">{formatAgo(row.lastCycle, isJa)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-[var(--surface-subtle)]">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "合計" : "Total"}</td>
            <td className="px-3 py-2 font-mono font-semibold text-amber-600 dark:text-amber-400">{formatNumber(totals.inProgress)}</td>
            <td className="px-3 py-2 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(totals.submitted)}</td>
            <td className="px-3 py-2 text-right font-mono font-bold text-[var(--freya-blue)] freya-tabular">{formatNumber(totals.total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
