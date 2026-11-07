import { useCallback, useEffect, useRef, useState } from "react";
import ModalShell from "../ModalShell";
import RecordDetailModal from "../RecordDetailModal";
import {
  fetchFinancialsBreakdown,
  fetchFinancialsBreakdownRecord,
  fetchFinancialsBreakdownRecords,
} from "../../services/financialsApi";

const SOURCES = ["press", "slit", "srs", "kensa", "recovery"];
const SOURCE_PROCESS = { press: "Press", slit: "Slit", srs: "SRS", kensa: "Kensa" };
const RECOVERY_BG = "rgba(250, 204, 21, 0.25)";

const nf = (v) => Number(v || 0).toLocaleString();

function sourceLabel(source, isJa) {
  return {
    press: isJa ? "プレス" : "Press",
    slit: isJa ? "スリット" : "Slit",
    srs: "SRS",
    kensa: isJa ? "検査" : "Kensa",
    recovery: isJa ? "回収NG" : "Recovered NG",
  }[source];
}

// focus = { hinban, factory, expected, metric } identifies the clicked ranking row
export default function FinancialsBreakdownModal({ target, onClose, isJa }) {
  if (!target) return null;
  return <BreakdownBody key={`${target.ban}|${target.hinban}|${target.factory}`} target={target} onClose={onClose} isJa={isJa} />;
}

function BreakdownBody({ target, onClose, isJa }) {
  const { ban, fromDate, toDate, factory, focus } = target;
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [source, setSource] = useState("press");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ field: "date", dir: "desc" });
  const [result, setResult] = useState(null); // { key, data?, error? } for the most recent response
  const [detail, setDetail] = useState(null); // { record, processName }
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    fetchFinancialsBreakdown({ ban, factory, fromDate, toDate })
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => { if (!cancelled) setSummaryError(err.message); });
    return () => { cancelled = true; };
  }, [ban, factory, fromDate, toDate]);

  const requestKey = JSON.stringify([ban, factory, fromDate, toDate, source, page, sort, reloadKey]);
  useEffect(() => {
    const requestId = ++requestRef.current;
    fetchFinancialsBreakdownRecords({
      ban, factory, fromDate, toDate, source, page, limit,
      sortField: sort.field, sortDir: sort.dir,
    })
      .then((data) => {
        if (requestId !== requestRef.current) return;
        setResult({ key: requestKey, data });
        if (data.page && data.page !== page) setPage(data.page);
      })
      .catch((err) => { if (requestId === requestRef.current) setResult({ key: requestKey, error: err.message }); });
  }, [ban, factory, fromDate, toDate, source, page, sort, reloadKey, requestKey]);

  const recordsLoading = result?.key !== requestKey;
  const records = result?.data || null;
  const recordsError = result?.key === requestKey ? (result.error || "") : "";

  function changeSource(next) {
    setSource(next);
    setPage(1);
    setSort({ field: "date", dir: "desc" });
  }

  function toggleSort(key, numeric) {
    setSort((prev) => ({
      field: key,
      dir: prev.field === key ? (prev.dir === "asc" ? "desc" : "asc") : (numeric ? "desc" : "asc"),
    }));
    setPage(1);
  }

  const openRecord = useCallback(async (src, id) => {
    try {
      const record = await fetchFinancialsBreakdownRecord(src, id);
      if (record) setDetail({ record, processName: SOURCE_PROCESS[src] });
    } catch (err) {
      window.alert(err.message);
    }
  }, []);

  const title = `${ban}${summary?.model ? ` (${summary.model})` : ""} — ${isJa ? "スクラップ損失の内訳" : "Scrap Loss Breakdown"}`;

  return (
    <>
      <ModalShell
        open
        onClose={onClose}
        title={title}
        subtitle={`${fromDate} → ${toDate}`}
        maxWidth="max-w-[96vw]"
        zIndex="z-[60]"
      >
        <div className="max-h-[78vh] space-y-5 overflow-y-auto px-6 py-4">
          <SummarySection summary={summary} error={summaryError} focus={focus} isJa={isJa} />
          <div>
            <div className="mb-3 flex flex-wrap gap-2 border-b border-[var(--border)]">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSource(s)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm ${s === source ? "border-[var(--freya-blue)] font-semibold text-[var(--freya-blue)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
                >
                  {sourceLabel(s, isJa)}
                </button>
              ))}
            </div>
            <RecordsSection
              data={records}
              error={recordsError}
              loading={recordsLoading}
              sort={sort}
              page={page}
              onPage={setPage}
              onSort={toggleSort}
              onOpen={openRecord}
              isJa={isJa}
            />
          </div>
        </div>
      </ModalShell>
      {detail ? (
        <RecordDetailModal
          record={detail.record}
          processName={detail.processName}
          onClose={() => setDetail(null)}
          onUpdated={() => setReloadKey((k) => k + 1)}
          zIndex="z-[10000]"
        />
      ) : null}
    </>
  );
}

function SummarySection({ summary, error, focus, isJa }) {
  if (error) return <div className="text-sm text-[var(--status-danger)]">{error}</div>;
  if (!summary) return <div className="text-sm text-[var(--text-muted)]">{isJa ? "読み込み中..." : "Loading..."}</div>;
  if (!summary.rows?.length) return <div className="text-sm text-[var(--text-muted)]">{isJa ? "データがありません" : "No data."}</div>;

  const tot = summary.totals || {};
  let match = null;
  if (focus && focus.expected != null) {
    const focusRow = summary.rows.find((r) => r.hinban === focus.hinban && r.factory === focus.factory);
    const actual = focusRow ? focusRow[focus.metric || "scrapLoss"] : null;
    const ok = actual != null && Math.abs(actual - focus.expected) < 1;
    match = ok
      ? <span className="text-emerald-600">✔ {isJa ? "テーブルの値と一致" : "Matches the table value"} (¥{nf(focus.expected)})</span>
      : <span className="text-amber-600">⚠ {isJa ? "テーブルの値と異なります" : "Differs from the table value"} (¥{nf(focus.expected)} vs ¥{nf(actual ?? 0)}) — {isJa ? "ページ読み込み後にデータが変更された可能性があります" : "data may have changed since the page loaded"}</span>;
  }

  const notes = [];
  if (summary.skippedNoPrice?.length) {
    notes.push(`${isJa ? "除外 (masterDBにpricePerPcなし)" : "Excluded (no pricePerPc in masterDB)"}: ${summary.skippedNoPrice.map((s) => `${s.hinban} (${nf(s.created)} / NG ${nf(s.totalNg)})`).join(", ")}`);
  }
  if (summary.unallocatedRecoveryDocs > 0) {
    notes.push(`${nf(summary.unallocatedRecoveryDocs)} ${isJa ? "件の回収エントリを行に紐付けできませんでした" : "recovery entries could not be matched to a row"}`);
  }

  return (
    <div className="space-y-3">
      {summary.rows.map((r) => {
        const isFocus = focus && r.hinban === focus.hinban && r.factory === focus.factory;
        return (
          <div key={`${r.hinban}|${r.factory}`} className={`rounded-[8px] border p-4 ${isFocus ? "border-red-300 bg-red-500/5" : "border-[var(--border)]"}`}>
            <div className="mb-2 flex flex-wrap justify-between gap-2">
              <div className="font-semibold text-[var(--text-primary)]">
                {r.hinban} <span className="text-xs font-normal text-[var(--text-muted)]">/ {r.factory}</span>
              </div>
              <div className="text-lg font-bold text-red-600">¥{nf(r.scrapLoss)}</div>
            </div>
            <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--text-secondary,var(--text-primary))]">
              <li>{isJa ? "生産数" : "Created"}: <b>{nf(r.created)}</b> pcs</li>
              <li>
                {isJa ? "総NG" : "Total NG"}: {isJa ? "プレス" : "Press"} {nf(r.pressNg)} + {isJa ? "スリット" : "Slit"} {nf(r.slitNg)} + SRS {nf(r.srsNg)} + {isJa ? "検査" : "Kensa"} {nf(r.kensaNg)} = <b>{nf(r.totalNg)}</b>
                {r.mergedZeroCreatedNg ? <span className="text-xs text-[var(--text-muted)]"> ({isJa ? "生産数0のロットから統合されたNG" : "incl. NG merged from lots with 0 created"}: {nf(r.mergedZeroCreatedNg)})</span> : null}
              </li>
              <li>
                {isJa ? "回収NG" : "Recovered NG"}: <span className="rounded px-1" style={{ background: RECOVERY_BG }}>− {nf(r.recoveredNg)}</span>{" "}
                <span className="text-xs text-[var(--text-muted)]">({nf(r.recoveryDocCount)} {isJa ? "件の回収エントリ" : "recovery entries"})</span> → {isJa ? "正味NG" : "Net NG"} <b>{nf(r.ngAfterRecovery)}</b>
              </li>
              <li>{isJa ? "単価" : "Unit price"}: <b>¥{nf(r.pricePerPc)}</b> <span className="text-xs text-[var(--text-muted)]">(masterDB.pricePerPc, 品番 {r.hinban})</span></li>
              <li>{isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)"} = {nf(r.ngAfterRecovery)} × ¥{nf(r.pricePerPc)} = <b className="text-red-600">¥{nf(r.scrapLoss)}</b></li>
              <li>{isJa ? "歩留まり %" : "Yield %"} = ({nf(r.created)} − {nf(r.ngAfterRecovery)}) ÷ {nf(r.created)} = <b>{nf(r.yieldPercent)}%</b></li>
            </ol>
            <DefectShares row={r} isJa={isJa} />
          </div>
        );
      })}
      {summary.rows.length > 1 ? (
        <div className="border-t border-[var(--border)] pt-2 text-sm text-[var(--text-primary)]">
          <b>{isJa ? "合計" : "Total"}</b>: {isJa ? "生産数" : "Created"} {nf(tot.created)} · NG {nf(tot.totalNg)} − {isJa ? "回収NG" : "Recovered NG"} {nf(tot.recoveredNg)} = {nf(tot.ngAfterRecovery)} ·{" "}
          {isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)"} <b className="text-red-600">¥{nf(tot.scrapLoss)}</b> · {isJa ? "歩留まり %" : "Yield %"} {nf(tot.yieldPercent)}%
        </div>
      ) : null}
      {match ? <div className="text-sm">{match}</div> : null}
      {notes.map((x) => <div key={x} className="text-xs text-[var(--text-muted)]">{x}</div>)}
    </div>
  );
}

// Per-process defect quantities and their share (%) of the row's total NG (before recovery)
function DefectShares({ row, isJa }) {
  const pct = (qty) => (row.totalNg > 0 ? (qty / row.totalNg) * 100 : 0);
  const yen = (qty) => `¥${nf(Math.round(qty * (row.pricePerPc || 0) * 100) / 100)}`;
  const processes = (row.defectsByProcess || []).filter((p) => p.ng > 0);
  if (!processes.length) return null;

  const Line = ({ name, qty, muted }) => (
    <div className={`mb-1 ${muted ? "text-[var(--text-muted)] opacity-70" : ""}`}>
      <div className="flex justify-between gap-3 text-xs">
        <span>{name}</span>
        <span className="whitespace-nowrap"><b>{nf(qty)}</b> <span className="text-[var(--text-muted)]">({pct(qty).toFixed(1)}%)</span> · <span className={muted ? "" : "text-red-600"}>{yen(qty)}</span></span>
      </div>
      <div className="h-1 rounded bg-[var(--surface-subtle)]">
        <div className={`h-1 rounded ${muted ? "bg-slate-400" : "bg-red-400"}`} style={{ width: `${Math.min(pct(qty), 100).toFixed(1)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="mt-3">
      <div className="mb-1 text-xs text-[var(--text-muted)]">
        {isJa ? "不良別NG — 数量、総NGに対する割合、金額" : "NG by defect — quantity, % of total NG and ¥"} ({nf(row.totalNg)})
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(18rem,1fr))" }}>
        {processes.map((p) => (
          <div key={p.process} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 flex justify-between text-sm font-semibold text-[var(--text-primary)]">
              <span>{sourceLabel(p.process, isJa)}</span>
              <span>{nf(p.ng)} <span className="text-xs font-normal text-[var(--text-muted)]">({pct(p.ng).toFixed(1)}%)</span> · <span className="text-red-600">{yen(p.ng)}</span></span>
            </div>
            {(p.items || []).map((d) => (
              <Line key={d.label} name={(!isJa && d.label_en) ? d.label_en : d.label} qty={d.qty} />
            ))}
            {p.unclassified > 0 ? <Line name={isJa ? "未分類" : "Unclassified"} qty={p.unclassified} muted /> : null}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-[var(--text-muted)]">
        {isJa ? "NG総額" : "Gross NG value"} {nf(row.totalNg)} × ¥{nf(row.pricePerPc)} = <b>{yen(row.totalNg)}</b>
        {" "}− {isJa ? "回収NG" : "Recovered NG"}{" "}
        <span className="rounded px-1" style={{ background: RECOVERY_BG }}>{nf(row.recoveredNg)} × ¥{nf(row.pricePerPc)} = {yen(row.recoveredNg)}</span>
        {" "}= <b className="text-red-600">¥{nf(row.scrapLoss)}</b>
      </div>
    </div>
  );
}

function RecordsSection({ data, error, loading, sort, page, onPage, onSort, onOpen, isJa }) {
  if (error) return <div className="py-4 text-sm text-[var(--status-danger)]">{error}</div>;
  if (!data) return <div className="py-4 text-sm text-[var(--text-muted)]">{isJa ? "読み込み中..." : "Loading..."}</div>;

  const isRecovery = data.source === "recovery";
  const defectCols = isRecovery ? [] : (data.defectColumns || []);
  const defectLabel = (c) => ((!isJa && c.label_en) ? c.label_en : c.label);
  const showMachine = data.source !== "kensa"; // kensa 設備 is a long table name that only wastes width

  // { label, key } — key is the server-side sort key (null = not sortable)
  const cols = isRecovery
    ? [
      { label: isJa ? "ロット日" : "Lot date", key: "date" }, { label: isJa ? "ロット" : "Lot", key: "lot" },
      { label: "品番", key: "hinban" }, { label: isJa ? "工場" : "Factory", key: "factory" },
      { label: isJa ? "不良種別" : "Defect types", key: null }, { label: isJa ? "数量" : "Qty", key: "quantity" },
    ]
    : [
      { label: isJa ? "ロット日" : "Lot date", key: "date" }, { label: isJa ? "ロット" : "Lot", key: "lot" },
      { label: "品番", key: "hinban" }, { label: isJa ? "工場" : "Factory", key: "factory" },
      ...(showMachine ? [{ label: isJa ? "設備" : "Machine", key: "machine" }] : []),
      { label: isJa ? "作業者" : "Worker", key: "worker" },
      { label: isJa ? "生産数" : "Produced", key: ["press", "kensa"].includes(data.source) ? "quantity" : null },
      { label: "NG", key: "ng" },
      ...defectCols.map((c) => ({ label: defectLabel(c), key: `defect:${c.key}` })),
    ];
  const textCols = isRecovery ? 5 : (showMachine ? 6 : 5);
  const from = data.total ? (data.page - 1) * data.limit + 1 : 0;
  const to = Math.min(data.page * data.limit, data.total);
  const totalPages = Math.max(data.totalPages || 1, 1);

  return (
    <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="overflow-x-auto">
        <table className="min-w-full whitespace-nowrap text-sm">
          <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]">
            <tr>
              {cols.map((c, i) => {
                const active = c.key && sort.field === c.key;
                const numeric = i >= textCols;
                return (
                  <th
                    key={`${c.key}-${i}`}
                    onClick={c.key ? () => onSort(c.key, numeric) : undefined}
                    className={`select-none px-3 py-2 ${numeric ? "text-right" : "text-left"} ${c.key ? "cursor-pointer hover:text-[var(--text-primary)]" : ""} ${active ? "text-[var(--freya-blue)]" : ""}`}
                    style={i >= textCols + 2 && !isRecovery ? { minWidth: "7rem", whiteSpace: "normal" } : undefined}
                  >
                    {c.label}{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.records.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-3 py-4 text-[var(--text-muted)]">{isJa ? "データがありません" : "No data."}</td></tr>
            ) : data.records.map((r) => (isRecovery ? (
              <tr key={r._id}>
                <td className="px-3 py-2">{r.lotDate || (r.createdAt || "").slice(0, 10)}</td>
                <td className="px-3 py-2">{r.lot}</td>
                <td className="px-3 py-2">{r.hinban}</td>
                <td className="px-3 py-2">{r.factory}</td>
                <td className="px-3 py-2">{(r.recoveries || []).map((x) => `${x.defectType}: ${nf(x.quantity)}`).join(", ")}</td>
                <td className="px-3 py-2 text-right font-semibold" style={{ background: RECOVERY_BG }}>{nf(r.quantity)}</td>
              </tr>
            ) : (
              <tr
                key={r._id}
                onClick={() => onOpen(data.source, r._id)}
                className="cursor-pointer hover:bg-[var(--surface-hover)]"
                title={isJa ? "生産記録詳細" : "Production Record Details"}
              >
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">{r.lot}</td>
                <td className="px-3 py-2">{r.hinban}</td>
                <td className="px-3 py-2">{r.factory}</td>
                {showMachine ? <td className="px-3 py-2">{r.machine}</td> : null}
                <td className="px-3 py-2">{r.worker}</td>
                <td className="px-3 py-2 text-right">{r.quantity == null ? "-" : nf(r.quantity)}</td>
                <td className="px-3 py-2 text-right font-semibold">{nf(r.ng)}</td>
                {defectCols.map((c) => {
                  const v = r.defects?.[c.key] || 0;
                  return <td key={c.key} className={`px-3 py-2 text-right ${v ? "font-medium text-red-600" : "text-[var(--text-muted)] opacity-40"}`}>{nf(v)}</td>;
                })}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-[var(--text-muted)]">
        <span>{from}–{to} / {nf(data.total)}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} className="rounded-[6px] border border-[var(--border)] px-3 py-1 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">‹</button>
          <span>{data.page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)} className="rounded-[6px] border border-[var(--border)] px-3 py-1 hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">›</button>
        </div>
      </div>
    </div>
  );
}
