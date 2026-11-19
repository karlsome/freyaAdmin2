import { useEffect, useMemo, useState } from "react";
import ModalShell from "../ModalShell";
import { fetchReportRecords } from "../../services/api";
import { processLabel } from "../../utils/dailyReportText";

function shiftDate(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const md = (s) => (s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : "—");
const num = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString());
const isApproved = (r) => r.approvalStatus && !/pending|reject/i.test(r.approvalStatus);

/**
 * Records behind a people row (one worker, last 30 days: attendance strip + records)
 * or an approvals row (one factory + process on the report day, with approval status).
 * Each record opens the shared RecordDetailModal through onOpenRecord.
 */
export default function ReportRecordsModal({ target, date, isJa, onClose, onOpenRecord }) {
  const L = (en, ja) => (isJa ? ja : en);
  const isWorker = target.kind === "worker";
  const query = isWorker ? { worker: target.name } : { factory: target.factory, proc: target.proc };
  const key = JSON.stringify([date, query]);
  const [state, setState] = useState({ key: "", records: [], error: "" });
  const loading = state.key !== key;

  useEffect(() => {
    let alive = true;
    fetchReportRecords(date, query)
      .then((r) => alive && setState({ key, records: r.records || [], error: "" }))
      .catch((e) => alive && setState({ key, records: [], error: e.message || "Failed to load" }));
    return () => {
      alive = false;
    };
    // query is derived from key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const records = state.records;

  // Worker: one cell per calendar day in the 30-day window.
  const days = useMemo(() => {
    if (!isWorker) return [];
    const byDay = new Map();
    records.forEach((r) => byDay.set(r.Date, (byDay.get(r.Date) || 0) + 1));
    return Array.from({ length: 31 }, (_, i) => {
      const d = shiftDate(date, i - 30);
      const dow = new Date(`${d}T00:00:00`).getDay();
      return { d, n: byDay.get(d) || 0, weekend: dow === 0 || dow === 6 };
    });
  }, [isWorker, records, date]);

  const daysWorked = days.filter((x) => x.n > 0).length;
  const lastSeen = records[0]?.Date;
  const approved = records.filter(isApproved).length;
  const machines = new Set(records.map((r) => r["設備"]).filter(Boolean)).size;

  const tiles = isWorker
    ? [
        [L("Days worked (30 days)", "出勤日数（30日）"), String(daysWorked)],
        [L("Records", "レコード"), String(records.length)],
        [L("Last seen", "最終提出"), md(lastSeen)],
        [L("Machines", "設備数"), String(machines)],
      ]
    : [
        [L("Records", "レコード"), String(records.length)],
        [L("Approved", "承認済"), String(approved)],
        [L("Waiting", "承認待ち"), String(records.length - approved)],
        [L("Machines", "設備数"), String(machines)],
      ];

  const title = isWorker ? target.name : `${target.factory} · ${processLabel(target.proc, isJa)}`;
  const subtitle = isWorker
    ? L(`Attendance and records, ${md(shiftDate(date, -30))}–${md(date)}`, `出勤とレコード（${md(shiftDate(date, -30))}〜${md(date)}）`)
    : L(`Records on ${md(date)} and their approval status`, `${md(date)}のレコードと承認状況`);

  return (
    <ModalShell open onClose={onClose} eyebrow={isWorker ? target.factory : L("Approvals", "承認")} title={title} subtitle={subtitle} maxWidth="max-w-5xl" align="start" zIndex="z-[70]">
      <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
        {state.error && !loading ? (
          <p className="text-sm text-[var(--status-defect)]">{state.error}</p>
        ) : loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-[8px] bg-[var(--surface-subtle)] animate-pulse" />
            <div className="h-40 rounded-[8px] bg-[var(--surface-subtle)] animate-pulse" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {tiles.map(([label, value]) => (
                <div key={label} className="freya-card p-4">
                  <div className="freya-label">{label}</div>
                  <div className="freya-tabular mt-1.5 text-[24px] font-bold text-[var(--text-primary)]">{value}</div>
                </div>
              ))}
            </div>

            {isWorker && (
              <section className="freya-card p-4 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{L("Days with records", "提出のあった日")}</h3>
                  <span className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--freya-blue)]" />{L("worked", "出勤")}</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-[var(--border-strong)]" />{L("no records", "提出なし")}</span>
                  </span>
                </div>
                <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }} role="img" aria-label={L(`${daysWorked} days with records`, `${daysWorked}日提出あり`)}>
                  {days.map((x) => (
                    <div key={x.d} className="flex flex-col items-center gap-1" title={`${x.d}: ${x.n}`}>
                      <span
                        className="block h-6 w-full rounded-[3px]"
                        style={{
                          background: x.n ? "var(--freya-blue)" : x.weekend ? "var(--surface-subtle)" : "transparent",
                          border: x.n ? "none" : "1px solid var(--border-strong)",
                          opacity: x.n ? Math.min(1, 0.45 + x.n * 0.15) : 1,
                        }}
                      />
                      <span className={`text-[9px] ${x.d === date ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{Number(x.d.slice(8))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="freya-card p-4 space-y-2 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{L("Records", "レコード")}</h3>
                {records.length > 0 && <span className="text-[12px] text-[var(--text-muted)]">{L("Click a row to open the record", "行をクリックで詳細")}</span>}
              </div>
              {records.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">{L("No records", "レコードはありません")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        {[L("Date", "日付"), L("Process", "工程"), L("Machine", "設備"), "背番号", L("Worker", "作業者"), L("Time", "時間"), L("Qty", "数量"), "NG", L("Approval", "承認")].map((h) => (
                          <th key={h} scope="col" className="text-left px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] border-b border-[var(--border)] whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr
                          key={`${r._source}-${r._id}`}
                          tabIndex={0}
                          onClick={() => onOpenRecord(r)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenRecord(r)}
                          className="cursor-pointer hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--freya-blue)]"
                        >
                          <td className="freya-tabular px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{md(r.Date)}</td>
                          <td className="px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{processLabel(r._proc, isJa)}</td>
                          <td className="px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{r["設備"] || "—"}</td>
                          <td className="px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap font-semibold text-[var(--freya-blue)]">{r["背番号"] || "—"}</td>
                          <td className="px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{r.Worker_Name || "—"}</td>
                          <td className="freya-tabular px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{r.Time_start || "—"}–{r.Time_end || ""}</td>
                          <td className="freya-tabular px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{num(r.Process_Quantity ?? r.Total)}</td>
                          <td className="freya-tabular px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">{num(r.Total_NG)}</td>
                          <td className="px-2.5 py-2 border-b border-[var(--border)] whitespace-nowrap">
                            {isApproved(r) ? (
                              <span className="freya-badge freya-badge-normal">{L("Approved", "承認済")}</span>
                            ) : (
                              <span className="freya-badge freya-badge-warning">{L("Waiting", "承認待ち")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ModalShell>
  );
}
