import { useEffect, useMemo, useState } from "react";
import ModalShell from "../ModalShell";
import LiquidSegmentedControl from "../LiquidSegmentedControl";
import StopCallLeaderboard, { aggregateLeaders } from "../StopCallLeaderboard";
import { flattenStopCalls } from "../../utils/stopCalls";
import { fetchStopCallSummary } from "../../services/api";
import { fmtWait } from "../../utils/dailyReportText";

function shiftDate(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "11:34" or "11:34 AM" → hour 0-23 (null if unreadable). */
function hourOf(t) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(String(t || "").trim());
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h;
}

/**
 * One leader's stop calls (when and where) for the report day or the 30 days before it.
 * Reuses the Stop Call page's leader card; clicking a call opens StopCallDetailModal via onOpenCall.
 */
export default function LeaderCallsModal({ leaderName, factory, date, isJa, onClose, onOpenCall }) {
  const [range, setRange] = useState("day");
  const [state, setState] = useState({ key: "", events: [], error: "" });
  const from = range === "day" ? date : shiftDate(date, -30);
  const key = `${from}|${date}|${factory}`;
  const loading = state.key !== key;

  useEffect(() => {
    let alive = true;
    fetchStopCallSummary({ dateFrom: from, dateTo: date, factory: factory || undefined })
      .then((records) => {
        if (!alive) return;
        const events = flattenStopCalls(Array.isArray(records) ? records : []).filter((e) => e.leaderName === leaderName);
        setState({ key, events, error: "" });
      })
      .catch((e) => alive && setState({ key, events: [], error: e.message || "Failed to load" }));
    return () => {
      alive = false;
    };
  }, [from, date, factory, leaderName, key]);

  const events = useMemo(() => (loading ? [] : state.events), [loading, state.events]);
  const leaders = useMemo(() => aggregateLeaders(events), [events]);

  const machines = useMemo(() => {
    const m = new Map();
    events.forEach((e) => m.set(e["設備"], (m.get(e["設備"]) || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const hours = useMemo(() => {
    const counts = new Array(24).fill(0);
    events.forEach((e) => {
      const h = hourOf(e.calledAt);
      if (h != null) counts[h] += 1;
    });
    const used = counts.map((c, h) => ({ h, c })).filter((x) => x.c > 0).map((x) => x.h);
    const lo = Math.min(7, ...used);
    const hi = Math.max(19, ...used);
    return counts.slice(lo, hi + 1).map((c, i) => ({ h: lo + i, c }));
  }, [events]);
  const maxHour = Math.max(1, ...hours.map((x) => x.c));

  const waits = events.map((e) => Number(e.waitSeconds) || 0);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null;
  const maxWait = waits.length ? Math.max(...waits) : null;

  const rangeItems = [
    { key: "day", label: isJa ? "この日" : "This day" },
    { key: "30d", label: isJa ? "直近30日" : "Last 30 days" },
  ];

  return (
    <ModalShell
      open
      onClose={onClose}
      eyebrow={factory}
      title={leaderName}
      subtitle={isJa ? "ストップコール対応（いつ・どこで）" : "Stop calls answered — when and where"}
      maxWidth="max-w-5xl"
      align="start"
      zIndex="z-[70]"
    >
      <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
        <LiquidSegmentedControl items={rangeItems} activeKey={range} onChange={setRange} />

        {state.error && !loading ? (
          <p className="text-sm text-[var(--status-defect)]">{state.error}</p>
        ) : loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-[8px] bg-[var(--surface-subtle)] animate-pulse" />
            <div className="h-40 rounded-[8px] bg-[var(--surface-subtle)] animate-pulse" />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
            <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 36 }}>phone_disabled</span>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
              {range === "day"
                ? isJa ? "この日はストップコール対応がありません" : "No stop calls answered on this day"
                : isJa ? "直近30日にストップコール対応がありません" : "No stop calls answered in the last 30 days"}
            </p>
            {range === "day" && (
              <button type="button" onClick={() => setRange("30d")} className="freya-btn-secondary mt-4">
                {isJa ? "直近30日を見る" : "Show the last 30 days"}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [isJa ? "対応件数" : "Calls", String(events.length)],
                [isJa ? "平均待ち" : "Avg wait", fmtWait(avgWait)],
                [isJa ? "最長待ち" : "Longest wait", fmtWait(maxWait)],
                [isJa ? "設備数" : "Machines", String(machines.length)],
              ].map(([label, value]) => (
                <div key={label} className="freya-card p-4">
                  <div className="freya-label">{label}</div>
                  <div className="freya-tabular mt-1.5 text-[24px] font-bold text-[var(--text-primary)]">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="freya-card p-4 space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{isJa ? "どこで（設備別）" : "Where (by machine)"}</h3>
                <div className="flex flex-wrap gap-2">
                  {machines.map(([m, c]) => (
                    <span key={m} className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]">
                      {m}
                      <span className="freya-tabular text-[var(--freya-blue)]">{c}</span>
                    </span>
                  ))}
                </div>
              </section>
              <section className="freya-card p-4 space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{isJa ? "いつ（時間帯別）" : "When (by hour)"}</h3>
                <div className="flex items-end gap-1 h-16" role="img" aria-label={isJa ? "時間帯別の件数" : "Calls by hour"}>
                  {hours.map(({ h, c }) => (
                    <div key={h} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5" title={`${h}:00 — ${c}`}>
                      {c > 0 && <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{c}</span>}
                      <span
                        className="block w-full rounded-[2px]"
                        style={{ height: c ? `${Math.max(8, (100 * c) / maxHour)}%` : 2, background: c ? "var(--freya-blue)" : "var(--border)" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  {hours.map(({ h }) => (
                    <span key={h} className="flex-1 text-center text-[10px] text-[var(--text-muted)]">{h}</span>
                  ))}
                </div>
              </section>
            </div>

            <div>
              <p className="mb-2 text-[12px] text-[var(--text-muted)]">
                {isJa ? "行をクリックするとストップコールの詳細を表示します" : "Click a call to see its details"}
              </p>
              <StopCallLeaderboard leaders={leaders} onClickRecord={onOpenCall} defaultExpanded />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
