import { useEffect, useMemo, useState } from "react";
import ModalShell from "../ModalShell";
import { fetchFinancials } from "../../services/financialsApi";

const nf = (v) => Number(v || 0).toLocaleString();
const yen = (v) => `¥${nf(v)}`;
const RECOVERY_BG = "rgba(250, 204, 21, 0.25)";
const FETCH_LIMIT = 100; // server cap per page

// Recovery is pre-applied server-side (row.recoveredNg); derive the adjusted per-row figures.
function adjustRow(row) {
  const recoveredNg = row.recoveredNg || 0;
  const created = row.created || 0;
  const ngAfterRecovery = Math.max((row.totalNg || 0) - recoveredNg, 0);
  return {
    ...row,
    recoveredNg,
    ngAfterRecovery,
    scrapLoss: ngAfterRecovery * (row.pricePerPc || 0),
    yieldPercent: created > 0 ? Math.round(((created - ngAfterRecovery) / created) * 10000) / 100 : 0,
  };
}

// target = { label, fromDate, toDate, chartScrapLoss, filters: { model, bans, factory } }
export default function FinancialsPeriodBreakdownModal({ target, onClose, onOpenBan, isJa }) {
  if (!target) return null;
  return <PeriodBody key={`${target.fromDate}|${target.toDate}`} target={target} onClose={onClose} onOpenBan={onOpenBan} isJa={isJa} />;
}

function PeriodBody({ target, onClose, onOpenBan, isJa }) {
  const { fromDate, toDate, label, chartScrapLoss, filters } = target;
  const [result, setResult] = useState(null);
  const requestKey = `${fromDate}|${toDate}`;

  useEffect(() => {
    let cancelled = false;
    fetchFinancials({
      fromDate, toDate, ...filters,
      page: 1, limit: FETCH_LIMIT, sortField: "scrapLoss", sortDir: "desc",
    })
      .then((data) => { if (!cancelled) setResult({ key: requestKey, data }); })
      .catch((err) => { if (!cancelled) setResult({ key: requestKey, error: err.message }); });
    return () => { cancelled = true; };
  }, [fromDate, toDate, filters, requestKey]);

  const loading = result?.key !== requestKey;
  const data = result?.data;
  const error = result?.error || "";
  const rows = useMemo(
    () => (data?.rows || []).map(adjustRow).filter((r) => r.scrapLoss > 0 || r.totalNg > 0).sort((a, b) => b.scrapLoss - a.scrapLoss),
    [data],
  );

  const summary = data?.adjustedSummary || data?.summary || {};
  const netScrap = summary.scrapLoss || 0;
  const recoveryAdj = (chartScrapLoss || 0) - netScrap;
  const byProcess = data?.scrapByProcess || {};
  const processTiles = [
    { key: "press", label: isJa ? "プレス" : "Press", color: "#f97316" },
    { key: "slit", label: isJa ? "スリット" : "Slit", color: "#0ea5e9" },
    { key: "srs", label: "SRS", color: "#8b5cf6" },
    { key: "kensa", label: isJa ? "検査" : "Inspection", color: "#22c55e" },
  ];
  const range = fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`;
  const truncated = (data?.totalRows || 0) > FETCH_LIMIT;

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`${label} — ${isJa ? "スクラップ損失の内訳" : "Scrap Loss Breakdown"}`}
      subtitle={range}
      maxWidth="max-w-6xl"
      zIndex="z-50"
    >
      <div className="max-h-[78vh] space-y-5 overflow-y-auto px-6 py-4">
        {error ? <div className="text-sm text-[var(--status-danger)]">{error}</div> : null}
        {loading ? <div className="text-sm text-[var(--text-muted)]">{isJa ? "読み込み中..." : "Loading..."}</div> : null}

        {data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[8px] border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--text-muted)]">{isJa ? "グラフの値 (回収前)" : "Chart value (before recovery)"}</div>
                <div className="text-lg font-bold text-red-600">{yen(chartScrapLoss)}</div>
              </div>
              <div className="rounded-[8px] border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--text-muted)]">{isJa ? "回収NG・調整" : "Recovered NG & adjustments"}</div>
                <div className="text-lg font-bold" style={{ background: RECOVERY_BG, display: "inline-block", padding: "0 4px", borderRadius: 4 }}>− {yen(Math.max(recoveryAdj, 0))}</div>
              </div>
              <div className="rounded-[8px] border border-[var(--border)] p-3">
                <div className="text-xs text-[var(--text-muted)]">{isJa ? "正味スクラップ損失" : "Net scrap loss"}</div>
                <div className="text-lg font-bold text-red-600">{yen(netScrap)}</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{isJa ? "工程別スクラップ (回収前)" : "Scrap by process (before recovery)"}</div>
              <div className="grid gap-3 sm:grid-cols-4">
                {processTiles.map((p) => (
                  <div key={p.key} className="rounded-[8px] border border-[var(--border)] p-3" style={{ borderLeft: `4px solid ${p.color}` }}>
                    <div className="text-xs text-[var(--text-muted)]">{p.label}</div>
                    <div className="text-base font-bold text-[var(--text-primary)]">{yen(byProcess[p.key] || 0)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  {isJa ? "背番号別スクラップ損失 — 行をクリックして計算内訳を表示" : "Scrap loss by 背番号 — click a row for the calculation"}
                </div>
                {truncated ? (
                  <div className="text-xs text-amber-600">
                    {isJa ? `上位${FETCH_LIMIT}件を表示 (全${nf(data.totalRows)}件)` : `Showing top ${FETCH_LIMIT} of ${nf(data.totalRows)}`}
                  </div>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full whitespace-nowrap text-sm">
                  <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">背番号</th>
                      <th className="px-3 py-2 text-left">品番</th>
                      <th className="px-3 py-2 text-left">{isJa ? "モデル" : "Model"}</th>
                      <th className="px-3 py-2 text-left">{isJa ? "工場" : "Factory"}</th>
                      <th className="px-3 py-2 text-right">{isJa ? "生産数" : "Created"}</th>
                      <th className="px-3 py-2 text-right">{isJa ? "総NG" : "Total NG"}</th>
                      <th className="px-3 py-2 text-right">{isJa ? "回収NG" : "Recovered NG"}</th>
                      <th className="px-3 py-2 text-right">{isJa ? "正味NG" : "Net NG"}</th>
                      <th className="px-3 py-2 text-right">{isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)"}</th>
                      <th className="px-3 py-2 text-right">{isJa ? "歩留まり %" : "Yield %"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.length === 0 ? (
                      <tr><td colSpan={11} className="px-3 py-4 text-[var(--text-muted)]">{isJa ? "データがありません" : "No data."}</td></tr>
                    ) : rows.map((r, i) => (
                      <tr
                        key={`${r.hinban}|${r.ban}|${r.factory}`}
                        onClick={() => onOpenBan(r, fromDate, toDate)}
                        className={`cursor-pointer hover:bg-[var(--surface-hover)] ${i === 0 ? "bg-red-500/10" : ""}`}
                        title={isJa ? "クリックして計算内訳を表示" : "Click to see how this was calculated"}
                      >
                        <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.ban || "-"}</td>
                        <td className="px-3 py-2">{r.hinban || "-"}</td>
                        <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{r.model || "-"}</td>
                        <td className="px-3 py-2">{r.factory || "-"}</td>
                        <td className="px-3 py-2 text-right">{nf(r.created)}</td>
                        <td className="px-3 py-2 text-right">{nf(r.totalNg)}</td>
                        <td className="px-3 py-2 text-right" style={{ background: RECOVERY_BG }}>{nf(r.recoveredNg)}</td>
                        <td className="px-3 py-2 text-right">{nf(r.ngAfterRecovery)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600">{yen(r.scrapLoss)}</td>
                        <td className="px-3 py-2 text-right">{nf(r.yieldPercent)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
