import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FinancialsBreakdownModal from "../components/financials/FinancialsBreakdownModal";
import FinancialsChart from "../components/financials/FinancialsChart";
import FinancialsPeriodBreakdownModal from "../components/financials/FinancialsPeriodBreakdownModal";
import FinancialsProductSelectorModal from "../components/financials/FinancialsProductSelectorModal";
import { SearchableSelect } from "../components/AdvancedFilterSection";
import PageHeader from "../components/PageHeader";
import { useLanguage } from "../contexts/LanguageContext";
import { exportFinancialsCsv, fetchFinancials, fetchFinancialsFactories } from "../services/financialsApi";
import { fetchInventoryModels, fetchInventoryProducts } from "../services/inventoryApi";

const nf = (v) => Number(v || 0).toLocaleString();
const yen = (v) => `¥${nf(v)}`;
const PAGE_SIZES = [10, 25, 50];
const GRID = "rgba(148, 163, 184, 0.15)";

const RANGE_OPTIONS = [
  { key: "today", en: "Today", ja: "今日" },
  { key: "last7", en: "Last 7 Days", ja: "過去7日間" },
  { key: "last30", en: "Last 30 Days", ja: "過去30日間" },
  { key: "last90", en: "Last 3 Months", ja: "過去3ヶ月" },
  { key: "thisMonth", en: "This Month", ja: "今月" },
  { key: "lastMonth", en: "Last Month", ja: "先月" },
  { key: "custom", en: "Custom Range", ja: "カスタム範囲" },
];

function toDateInput(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeRange(key) {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);
  switch (key) {
    case "last7": start.setDate(today.getDate() - 6); break;
    case "last30": start.setDate(today.getDate() - 29); break;
    case "last90": start.setDate(today.getDate() - 89); break;
    case "thisMonth":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "lastMonth":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    default: break;
  }
  return { from: toDateInput(start), to: toDateInput(end) };
}

// Recovery is pre-applied server-side (row.recoveredNg); derive the adjusted per-row figures.
function adjustRow(row) {
  const recoveredNg = row.recoveredNg || 0;
  const pricePerPc = row.pricePerPc || 0;
  const created = row.created || 0;
  const ngAfterRecovery = Math.max((row.totalNg || 0) - recoveredNg, 0);
  const finalGood = created - ngAfterRecovery;
  const scrapLoss = ngAfterRecovery * pricePerPc;
  return {
    ...row,
    recoveredNg,
    ngAfterRecovery,
    finalGood,
    scrapLoss,
    value: (row.cost || 0) - scrapLoss,
    yieldPercent: Math.round((created > 0 ? (finalGood / created) * 100 : 0) * 100) / 100,
    defectRate: Math.round((created > 0 ? (ngAfterRecovery / created) * 100 : 0) * 100) / 100,
  };
}

// Trend label → { fromDate, toDate }. Daily labels are 'yyyy-mm-dd'; weekly ones '2026-W08'
// (week 1 = the Monday-based week containing Jan 4 of that year, same scheme as the server).
function labelToRange(label, rangeFrom, rangeTo) {
  const week = String(label).match(/^(\d{4})-W(\d{2})$/);
  if (!week) return { fromDate: label, toDate: label };
  const year = Number(week[1]);
  const jan4 = Date.UTC(year, 0, 4);
  const dayMs = 86400000;
  const week1 = jan4 - (((new Date(jan4).getUTCDay() || 7) - 1) * dayMs);
  const start = week1 + (Number(week[2]) - 1) * 7 * dayMs;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  let fromDate = iso(start);
  let toDate = iso(start + 6 * dayMs);
  if (rangeFrom && fromDate < rangeFrom) fromDate = rangeFrom;
  if (rangeTo && toDate > rangeTo) toDate = rangeTo;
  return { fromDate, toDate };
}

const EMPTY_SUMMARY = { totalValue: 0, scrapLoss: 0, totalCreated: 0, finalGood: 0, totalLoss: 0, defectRate: 0, yieldPercent: 0 };

const inputCls = "mt-1.5 h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)] disabled:cursor-not-allowed disabled:opacity-50";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]";
const btnCls = "rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

function Delta({ current, previous, lowerIsBetter, isJa }) {
  if (previous === null || previous === undefined || previous === 0) return <p className="mt-1 h-4 text-xs" />;
  const diff = current - previous;
  if (diff === 0) return <p className="mt-1 h-4 text-xs" />;
  const pct = Math.abs((diff / previous) * 100).toFixed(1);
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <p className="mt-1 h-4 text-xs">
      <span className={good ? "text-emerald-600" : "text-red-600"}>
        {diff > 0 ? "▲" : "▼"} {pct}% {isJa ? "前期間比" : "vs prev"}
      </span>
    </p>
  );
}

function KpiCard({ label, value, tone, children }) {
  const toneCls = { red: "text-red-600", green: "text-emerald-600", blue: "text-blue-600", indigo: "text-indigo-600" }[tone] || "text-[var(--text-muted)]";
  const valCls = { red: "text-red-700 dark:text-red-400", green: "text-emerald-700 dark:text-emerald-400", blue: "text-blue-700 dark:text-blue-400", indigo: "text-indigo-700 dark:text-indigo-400" }[tone] || "text-[var(--text-primary)]";
  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className={`text-xs font-medium ${toneCls}`}>{label}</p>
      <p className={`truncate text-base font-bold ${valCls}`}>{value}</p>
      {children}
    </div>
  );
}

function ChartCard({ title, children, right }) {
  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {right}
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}

function RankTable({ title, tone, headers, rows, emptyText, onRowClick, rightFrom = 3 }) {
  const accent = tone === "green" ? "border-emerald-500/30" : "border-[var(--border)]";
  const titleCls = tone === "green" ? "text-emerald-700 dark:text-emerald-400" : "text-[var(--text-primary)]";
  return (
    <div className={`freya-card rounded-[8px] border ${accent} bg-[var(--surface)] p-4`}>
      <h3 className={`mb-3 text-sm font-semibold ${titleCls}`}>{title}</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]">
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={`px-3 py-2 ${i >= rightFrom ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-3 text-xs text-[var(--text-muted)]">{emptyText}</td></tr>
          ) : rows.map((r, i) => (
            <tr
              key={r.key}
              onClick={onRowClick ? () => onRowClick(r.raw) : undefined}
              className={`${onRowClick ? "cursor-pointer hover:bg-[var(--surface-hover)]" : ""} ${i === 0 && r.highlight ? r.highlight : ""}`}
            >
              {r.cells.map((c, ci) => (
                <td key={ci} className={`px-3 py-2 ${ci >= rightFrom ? "text-right" : ""} ${c.cls || ""}`}>{c.text}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FinancialsPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const initialRange = useMemo(() => computeRange("last30"), []);
  const [rangeKey, setRangeKey] = useState("last30");
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [filterType, setFilterType] = useState("model");
  const [model, setModel] = useState("");
  const [factory, setFactory] = useState("");
  const [selectedBans, setSelectedBans] = useState([]);
  const [models, setModels] = useState([]);
  const [factories, setFactories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const [sort, setSort] = useState({ field: "hinban", dir: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [periodTarget, setPeriodTarget] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    fetchInventoryModels().then(setModels).catch(() => setModels([]));
    fetchFinancialsFactories().then(setFactories).catch(() => setFactories([]));
    fetchInventoryProducts().then(setAllProducts).catch(() => setAllProducts([]));
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) return undefined;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    fetchFinancials({
      fromDate, toDate, model, bans: selectedBans, factory,
      page, limit, sortField: sort.field, sortDir: sort.dir,
    })
      .then((result) => {
        if (requestId !== requestRef.current) return;
        setData(result);
        if (result.page && result.page !== page) setPage(result.page);
      })
      .catch((err) => {
        if (requestId !== requestRef.current) return;
        setData(null);
        setError(err.message || "Failed to load financials");
      })
      .finally(() => { if (requestId === requestRef.current) setLoading(false); });
    return undefined;
  }, [fromDate, toDate, model, selectedBans, factory, page, limit, sort, refreshNonce]);

  const resetPage = useCallback(() => setPage(1), []);

  function handleRangeChange(key) {
    setRangeKey(key);
    if (key !== "custom") {
      const r = computeRange(key);
      setFromDate(r.from);
      setToDate(r.to);
    }
    resetPage();
  }

  function handleDateChange(setter, value) {
    setter(value);
    setRangeKey("custom");
    resetPage();
  }

  function handleFilterTypeChange(type) {
    setFilterType(type);
    setModel("");
    setSelectedBans([]);
    resetPage();
  }

  function handleModelChange(value) {
    setModel(value);
    setSelectedBans(value ? allProducts.filter((p) => p.モデル === value).map((p) => p.背番号).filter(Boolean) : []);
    resetPage();
  }

  function toggleSort(field) {
    setSort((prev) => ({ field, dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc" }));
    resetPage();
  }

  const rows = useMemo(() => (data?.rows || []).map(adjustRow), [data]);
  const summary = useMemo(() => {
    const s = { ...EMPTY_SUMMARY, ...(data?.adjustedSummary || data?.summary || {}) };
    s.finalGoodYen = (s.totalValue || 0) - (s.scrapLoss || 0);
    return s;
  }, [data]);
  const prev = data?.previousSummary || {};
  const costRecovery = summary.totalValue > 0
    ? Number((((summary.totalValue - (summary.scrapLoss || 0)) / summary.totalValue) * 100).toFixed(2))
    : 0;
  const factoryTotals = useMemo(() => data?.factoryTotals || {}, [data]);
  const trend = data?.trend;
  const totalRows = data?.totalRows || 0;
  const totalPages = data?.totalPages || 0;

  const factoryRows = useMemo(() => (factoryTotals.factories || []).map((name, i) => ({
    name,
    created: factoryTotals.created?.[i] || 0,
    finalGoodPcs: factoryTotals.finalGood?.[i] || 0,
    scrapLoss: factoryTotals.scrapLoss?.[i] || 0,
    finalGoodYen: Number(((factoryTotals.totalValue?.[i] || 0) - (factoryTotals.scrapLoss?.[i] || 0)).toFixed(2)),
  })), [factoryTotals]);

  const openBreakdown = useCallback((raw, metric) => {
    if (!raw?.ban) return;
    setBreakdown({
      ban: raw.ban,
      hinban: raw.hinban,
      fromDate,
      toDate,
      factory,
      focus: { hinban: raw.hinban, factory: raw.factory, expected: Number(metric === "value" ? raw.value : raw.scrapLoss) || 0, metric },
    });
  }, [fromDate, toDate, factory]);

  // Click a trend point/bar → breakdown of that day (or week) across all 背番号
  const openPeriod = useCallback((index) => {
    const rawLabel = trend?.labels?.[index];
    if (rawLabel === undefined) return;
    const { fromDate: f, toDate: t } = labelToRange(rawLabel, fromDate, toDate);
    setPeriodTarget({
      label: rawLabel,
      fromDate: f,
      toDate: t,
      chartScrapLoss: trend.scrapLoss?.[index] || 0,
      filters: { model, bans: selectedBans, factory },
    });
  }, [trend, fromDate, toDate, model, selectedBans, factory]);

  // factory = the page's factory filter (not the row's): the server folds NG from zero-created lots
  // into the row across factories, so narrowing to the row's factory would drop that NG.
  const openPeriodBan = useCallback((row, f, t, pageFactory) => {
    setBreakdown({
      ban: row.ban,
      hinban: row.hinban,
      fromDate: f,
      toDate: t,
      factory: pageFactory || "",
      focus: { hinban: row.hinban, factory: row.factory, expected: row.scrapLoss || 0, metric: "scrapLoss" },
    });
  }, []);

  // Shared click/hover wiring for the two trend charts (nearest column on the x axis)
  const periodClickOptions = useMemo(() => ({
    interaction: { mode: "index", axis: "x", intersect: false },
    onClick: (evt, _elements, chart) => {
      const hit = chart.getElementsAtEventForMode(evt, "index", { axis: "x", intersect: false }, false);
      if (hit.length) openPeriod(hit[0].index);
    },
    onHover: (evt, elements) => {
      const target = evt?.native?.target;
      if (target) target.style.cursor = elements.length ? "pointer" : "default";
    },
  }), [openPeriod]);

  // ── Chart configs ──────────────────────────────────────────────────────────
  const yenTick = (v) => `¥${Number(v).toLocaleString()}`;
  const barOptions = (tick, tooltip, legend = false) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: legend ? { position: "bottom" } : { display: false }, tooltip: { callbacks: { label: tooltip } } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: GRID }, ticks: { callback: tick } } },
  });

  const factoryLabels = factoryTotals.factories || [];

  const createdVsGoodCfg = useMemo(() => ({
    type: "bar",
    data: {
      labels: factoryLabels,
      datasets: [
        { label: isJa ? "生産数 (pcs)" : "Created (pcs)", data: factoryTotals.created || [], backgroundColor: "rgba(34,197,94,0.7)", borderColor: "rgb(34,197,94)", borderWidth: 1 },
        { label: isJa ? "最終良品 (pcs)" : "Final Good (pcs)", data: factoryTotals.finalGood || [], backgroundColor: "rgba(37,99,235,0.7)", borderColor: "rgb(37,99,235)", borderWidth: 1 },
      ],
    },
    options: barOptions((v) => `${Number(v).toLocaleString()} pcs`, (c) => `${c.dataset.label}: ${c.raw.toLocaleString()} pcs`, true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [factoryTotals, isJa]);

  const sbp = data?.scrapByProcess || {};
  const scrapByProcessCfg = useMemo(() => ({
    type: "bar",
    data: {
      labels: [isJa ? "プレス" : "Press", isJa ? "スリット" : "Slit", "SRS", isJa ? "検査" : "Inspection"],
      datasets: [{
        label: isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)",
        data: [sbp.press || 0, sbp.slit || 0, sbp.srs || 0, sbp.kensa || 0],
        backgroundColor: ["#f97316", "#0ea5e9", "#8b5cf6", "#22c55e"],
      }],
    },
    options: barOptions(yenTick, (c) => yen(c.raw)),
  }), [sbp.press, sbp.slit, sbp.srs, sbp.kensa, isJa]);

  const valueByFactoryCfg = useMemo(() => ({
    type: "bar",
    data: {
      labels: factoryLabels,
      datasets: [{ label: isJa ? "総額 (¥)" : "Total Value (¥)", data: factoryTotals.totalValue || [], backgroundColor: "rgba(37,99,235,0.6)" }],
    },
    options: barOptions(yenTick, (c) => yen(c.raw)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [factoryTotals, isJa]);

  const scrapByFactoryCfg = useMemo(() => ({
    type: "bar",
    data: {
      labels: factoryLabels,
      datasets: [{ label: isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)", data: factoryTotals.scrapLoss || [], backgroundColor: "rgba(220,38,38,0.6)" }],
    },
    options: barOptions(yenTick, (c) => yen(c.raw)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [factoryTotals, isJa]);

  // 'yyyy-mm-dd' → 'M/D'; weekly labels like '2026-W08' pass through
  const trendLabels = useMemo(() => (trend?.labels || []).map((l) => {
    const m = String(l).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${parseInt(m[2], 10)}/${parseInt(m[3], 10)}` : l;
  }), [trend]);

  const trendCfg = useMemo(() => ({
    type: "line",
    data: {
      labels: trendLabels,
      datasets: [
        { label: isJa ? "コスト (¥)" : "Cost (¥)", data: trend?.cost || [], borderColor: "rgb(37,99,235)", backgroundColor: "rgba(37,99,235,0.05)", borderWidth: 2, tension: 0.3, fill: true, pointRadius: 3 },
        { label: isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)", data: trend?.scrapLoss || [], borderColor: "rgb(220,38,38)", backgroundColor: "rgba(220,38,38,0.05)", borderWidth: 2, tension: 0.3, fill: true, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...periodClickOptions,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${yen(c.raw)}`, footer: () => (isJa ? "クリックで内訳を表示" : "Click for breakdown") } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: GRID }, ticks: { callback: yenTick } } },
    },
  }), [trend, trendLabels, isJa, periodClickOptions]);

  const posNegCfg = useMemo(() => ({
    type: "bar",
    data: {
      labels: trendLabels,
      datasets: [
        { label: isJa ? "コスト (¥)" : "Cost (¥)", data: trend?.cost || [], backgroundColor: "rgba(22,163,74,0.75)", borderColor: "rgb(22,163,74)", borderWidth: 1, borderRadius: 3, stack: "stack" },
        // negated so the bars drop below zero
        { label: isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)", data: (trend?.scrapLoss || []).map((v) => -(v || 0)), backgroundColor: "rgba(220,38,38,0.75)", borderColor: "rgb(220,38,38)", borderWidth: 1, borderRadius: 3, stack: "stack" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...periodClickOptions,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${yen(Math.abs(c.raw || 0))}`, footer: () => (isJa ? "クリックで内訳を表示" : "Click for breakdown") } } },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: GRID },
          ticks: {
            maxTicksLimit: 10,
            callback: (v) => {
              const abs = Math.abs(v);
              if (abs === 0) return "¥0";
              if (abs >= 1000000) return `${v < 0 ? "-" : ""}¥${abs / 1000000}M`;
              return `${v < 0 ? "-" : ""}¥${abs / 1000}K`;
            },
          },
        },
      },
    },
  }), [trend, trendLabels, isJa, periodClickOptions]);

  // ── Exports ────────────────────────────────────────────────────────────────
  async function handleExportCsv() {
    if (!fromDate || !toDate) return;
    setExporting(true);
    try {
      const blob = await exportFinancialsCsv({
        fromDate, toDate, model, factory, bans: selectedBans, sortField: sort.field, sortDir: sort.dir,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financials_${fromDate}_to_${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`${isJa ? "エクスポートに失敗しました" : "Export failed"}: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  function handleExportPdf() {
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const cards = [
      ["Total Cost (¥)", yen(summary.totalValue), ""],
      ["Scrap Loss (¥)", yen(summary.scrapLoss), "color:#dc2626"],
      ["Final Good (¥)", yen(summary.finalGoodYen), "color:#16a34a"],
      ["Cost Recovery Rate", `${nf(costRecovery)}%`, "color:#4f46e5"],
      ["Yield %", `${nf(summary.yieldPercent)}%`, ""],
      ["Total Created (pcs)", `${nf(summary.totalCreated)} pcs`, "color:#16a34a"],
      ["Total Loss (pcs)", `${nf(summary.totalLoss)} pcs`, "color:#dc2626"],
      ["Final Good (pcs)", `${nf(summary.finalGood)} pcs`, "color:#2563eb"],
      ["Defect Rate", `${nf(summary.defectRate)}%`, ""],
    ].map(([l, v, s]) => `<div class="card"><div class="cl">${l}</div><div class="cv" style="${s}">${esc(v)}</div></div>`).join("");

    const top5 = (data?.top5 || []).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.ban)}</td><td>${esc(r.model)}</td><td>${yen(r.scrapLoss)}</td><td>${nf(r.yieldPercent)}%</td></tr>`).join("");
    const ranking = [...factoryRows].sort((a, b) => b.scrapLoss - a.scrapLoss).map((r, i) => {
      const y = r.created > 0 ? ((r.finalGoodPcs / r.created) * 100).toFixed(1) : "0.0";
      return `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${nf(r.created)}</td><td>${yen(r.scrapLoss)}</td><td>${y}%</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Financials ${fromDate} to ${toDate}</title>
<style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:20px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}.card{border:1px solid #ddd;border-radius:6px;padding:10px}.cl{font-size:10px;color:#666}.cv{font-size:16px;font-weight:bold}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}th{background:#f5f5f5;padding:6px 8px;text-align:left;border:1px solid #ddd}td{padding:5px 8px;border:1px solid #ddd}h2{font-size:13px;margin:16px 0 8px}@media print{body{padding:10px}}</style>
</head><body>
<h1>Financials Report</h1><div class="sub">${fromDate} to ${toDate}</div>
<div class="cards">${cards}</div>
<h2>Top 5 Highest Scrap Loss (背番号)</h2>
<table><thead><tr><th>#</th><th>背番号</th><th>Model</th><th>Scrap Loss (¥)</th><th>Yield %</th></tr></thead><tbody>${top5}</tbody></table>
<h2>Factory Scrap Loss Ranking</h2>
<table><thead><tr><th>#</th><th>Factory</th><th>Created</th><th>Scrap Loss (¥)</th><th>Yield %</th></tr></thead><tbody>${ranking}</tbody></table>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  }

  // ── Detail table ───────────────────────────────────────────────────────────
  const detailCols = [
    { key: "hinban", label: "品番" },
    { key: "ban", label: "背番号" },
    { key: "model", label: isJa ? "モデル" : "Model" },
    { key: "factory", label: "工場" },
    { key: "created", label: isJa ? "生産数 (pcs)" : "Created (pcs)" },
    { key: "pressNg", label: isJa ? "プレスNG" : "Press NG" },
    { key: "slitNg", label: isJa ? "スリットNG" : "Slit NG" },
    { key: "srsNg", label: isJa ? "SRS NG" : "SRS NG" },
    { key: "kensaNg", label: isJa ? "検査NG" : "Kensa NG" },
    { key: "totalNg", label: isJa ? "総NG" : "Total NG" },
    { key: "recoveredNg", label: isJa ? "回収NG" : "Recovered NG", recovery: true },
    { key: "ngAfterRecovery", label: isJa ? "回収後NG" : "NG After Recovery" },
    { key: "finalGood", label: isJa ? "最終良品 (pcs)" : "Final Good (pcs)" },
    { key: "yieldPercent", label: isJa ? "歩留まり %" : "Yield %" },
    { key: "pricePerPc", label: isJa ? "単価 (¥)" : "pricePerPiece (¥)" },
    { key: "cost", label: isJa ? "コスト (¥)" : "Cost (¥)" },
    { key: "scrapLoss", label: isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)" },
    { key: "value", label: isJa ? "価値 (¥)" : "Value (¥)" },
  ];
  const sortIcon = (field) => (sort.field !== field ? "↕" : sort.dir === "asc" ? "↑" : "↓");
  const pageStart = totalRows ? (page - 1) * limit + 1 : 0;
  const pageEnd = Math.min(page * limit, totalRows);
  const noData = isJa ? "データがありません" : "No data.";

  const rangeDisplay = fromDate && toDate ? `${fromDate} → ${toDate}` : (isJa ? "期間を選択" : "Select a date range");
  const selectedCount = selectedBans.length;

  return (
    <div className="h-screen w-full space-y-6 overflow-y-auto px-4 pb-16 pt-20 sm:px-6 md:px-8">
      <div className="w-full">
        <PageHeader
          eyebrow={isJa ? "生産価値" : "Production Value"}
          eyebrowClassName="tracking-[0.04em] text-[var(--freya-blue)] uppercase font-semibold text-xs"
          title={isJa ? "財務" : "Financials"}
          subtitle={isJa ? "生産価値とスクラップ分析" : "Production value and scrap analysis"}
          subtitleClassName="max-w-3xl text-xs text-[var(--text-muted)]"
          titleMeta={<span className="text-xs font-medium text-[var(--freya-blue)]">{rangeDisplay}</span>}
          className="md:flex-row md:items-start md:justify-between"
          actions={(
            <>
              <button type="button" onClick={handleExportPdf} disabled={loading || !data} className={btnCls}>
                {isJa ? "PDFエクスポート" : "PDF Export"}
              </button>
              <button
                type="button"
                onClick={() => { resetPage(); setRefreshNonce((n) => n + 1); }}
                disabled={loading}
                className="rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--freya-blue-hover)] disabled:opacity-50"
              >
                {isJa ? "更新" : "Update"}
              </button>
            </>
          )}
        />

        {error ? (
          <div className="mb-6 rounded-[8px] border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/5 px-4 py-3 text-xs font-medium text-[var(--status-danger)]">{error}</div>
        ) : null}

        {/* Filters */}
        <div className="freya-card mb-6 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="block">
              <span className={labelCls}>{isJa ? "期間選択" : "Period Selection"}</span>
              <select value={rangeKey} onChange={(e) => handleRangeChange(e.target.value)} className={inputCls}>
                {RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{isJa ? o.ja : o.en}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>{isJa ? "開始日" : "Start Date"}</span>
              <input type="date" value={fromDate} onChange={(e) => handleDateChange(setFromDate, e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{isJa ? "終了日" : "End Date"}</span>
              <input type="date" value={toDate} onChange={(e) => handleDateChange(setToDate, e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>{isJa ? "フィルター種別" : "Filter Type"}</span>
              <select value={filterType} onChange={(e) => handleFilterTypeChange(e.target.value)} className={inputCls}>
                <option value="model">モデル (Model)</option>
                <option value="sebanggo">背番号 (Serial Number)</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>{isJa ? "工場" : "Factory"}</span>
              <select value={factory} onChange={(e) => { setFactory(e.target.value); resetPage(); }} className={inputCls}>
                <option value="">{isJa ? "すべての工場" : "All Factories"}</option>
                {factories.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {filterType === "model" ? (
              <div>
                <span className={labelCls}>{isJa ? "モデル" : "Model"}</span>
                <div className="mt-1.5">
                  <SearchableSelect
                    value={model}
                    options={models}
                    onChange={({ value }) => handleModelChange(value || "")}
                    placeholder={isJa ? "すべてのモデル (選択または検索...)" : "All Models (select or search...)"}
                    className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] text-xs text-[var(--text-primary)] outline-none transition hover:border-[var(--freya-blue)]"
                  />
                </div>
              </div>
            ) : (
              <div>
                <span className={labelCls}>{isJa ? "背番号" : "Serial Numbers"}</span>
                <button type="button" onClick={() => setSelectorOpen(true)} className={`${inputCls} text-left hover:bg-[var(--surface-hover)]`}>
                  {selectedCount ? `${selectedCount} ${isJa ? "件選択中" : "selected"}` : (isJa ? "製品を選択..." : "Select products...")}
                </button>
              </div>
            )}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <span className={labelCls}>{isJa ? "選択中の製品" : "Selected Products"}</span>
                <button type="button" onClick={() => setSelectorOpen(true)} className="text-xs text-[var(--freya-blue)] hover:underline">
                  {isJa ? "すべて表示" : "Show all"}
                </button>
              </div>
              <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs text-[var(--text-primary)]">
                {selectedCount === 0 ? (
                  <span className="text-[var(--text-muted)]">{isJa ? "未選択" : "None selected"}</span>
                ) : (
                  <>
                    {selectedBans.slice(0, 10).map((ban) => (
                      <span key={ban} className="inline-flex items-center gap-1 rounded-full bg-[var(--freya-blue)]/10 px-2.5 py-0.5 text-[var(--freya-blue)]">
                        {ban}
                        <button type="button" aria-label="remove" onClick={() => { setSelectedBans((cur) => cur.filter((b) => b !== ban)); resetPage(); }} className="leading-none hover:opacity-70">×</button>
                      </span>
                    ))}
                    {selectedCount > 10 ? (
                      <button type="button" onClick={() => setSelectorOpen(true)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        +{selectedCount - 10} {isJa ? "件 (すべて表示)" : "more (Show all)"}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className={`mb-6 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5 ${loading ? "opacity-70" : ""}`}>
          <KpiCard label={isJa ? "総コスト (¥)" : "Total Cost (¥)"} value={yen(summary.totalValue)}>
            <Delta current={summary.totalValue} previous={prev.totalValue} isJa={isJa} />
          </KpiCard>
          <KpiCard tone="red" label={isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)"} value={yen(summary.scrapLoss)}>
            <Delta current={summary.scrapLoss} previous={prev.scrapLoss} lowerIsBetter isJa={isJa} />
          </KpiCard>
          <KpiCard tone="green" label={isJa ? "最終良品 (¥)" : "Final Good (¥)"} value={yen(summary.finalGoodYen)}>
            <p className="text-xs text-[var(--text-muted)]">{isJa ? "(コスト − スクラップ損失)" : "(Cost - Scrap Loss)"}</p>
          </KpiCard>
          <KpiCard tone="indigo" label={isJa ? "コスト回収率" : "Cost Recovery Rate"} value={`${nf(costRecovery)}%`}>
            <Delta current={costRecovery} previous={prev.costRecoveryRate} isJa={isJa} />
          </KpiCard>
          <KpiCard label={isJa ? "歩留まり %" : "Yield %"} value={`${nf(summary.yieldPercent)}%`}>
            <Delta current={summary.yieldPercent} previous={prev.yieldPercent} isJa={isJa} />
          </KpiCard>
          <KpiCard tone="green" label={isJa ? "総生産数 (pcs)" : "Total Created (pcs)"} value={`${nf(summary.totalCreated)} pcs`}>
            <Delta current={summary.totalCreated} previous={prev.totalCreated} isJa={isJa} />
          </KpiCard>
          <KpiCard tone="red" label={isJa ? "総ロス (pcs)" : "Total Loss (pcs)"} value={`${nf(summary.totalLoss)} pcs`}>
            <Delta current={summary.totalLoss} previous={prev.totalLoss} lowerIsBetter isJa={isJa} />
          </KpiCard>
          <KpiCard tone="blue" label={isJa ? "最終良品 (pcs)" : "Final Good (pcs)"} value={`${nf(summary.finalGood)} pcs`}>
            <p className="text-xs text-[var(--text-muted)]">{isJa ? "(生産数 − 総NG)" : "(Created - Total NG)"}</p>
          </KpiCard>
          <KpiCard label={isJa ? "不良率" : "Defect Rate"} value={`${nf(summary.defectRate)}%`}>
            <Delta current={summary.defectRate} previous={prev.defectRate} lowerIsBetter isJa={isJa} />
          </KpiCard>
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title={isJa ? "工場別 生産数 vs 最終良品" : "Created vs Final Good by Factory"}><FinancialsChart config={createdVsGoodCfg} /></ChartCard>
          <ChartCard title={isJa ? "工程別スクラップ" : "Scrap by Process"}><FinancialsChart config={scrapByProcessCfg} /></ChartCard>
          <ChartCard title={isJa ? "工場別 価値" : "Value by Factory"}><FinancialsChart config={valueByFactoryCfg} /></ChartCard>
          <ChartCard title={isJa ? "工場別 スクラップ損失" : "Scrap Loss by Factory"}><FinancialsChart config={scrapByFactoryCfg} /></ChartCard>
        </div>

        <div className="mb-6 space-y-4">
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{isJa ? "スクラップ損失とコストの推移" : "Scrap Loss & Cost Trend"}</h3>
              <span className="rounded bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
                {trend?.granularity === "weekly" ? (isJa ? "週次" : "Weekly") : (isJa ? "日次" : "Daily")}
              </span>
            </div>
            <div className="h-64"><FinancialsChart config={trendCfg} /></div>
          </div>

          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {trend?.granularity === "weekly"
                  ? (isJa ? "コスト vs スクラップ損失 (週次バー)" : "Cost vs Scrap Loss (Weekly Bar)")
                  : (isJa ? "コスト vs スクラップ損失 (日次バー)" : "Cost vs Scrap Loss (Daily Bar)")}
              </h3>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#16a34a" }} />{isJa ? "コスト (¥)" : "Cost (¥)"}</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#dc2626" }} />{isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)"}</span>
              </div>
            </div>
            <div className="h-64"><FinancialsChart config={posNegCfg} /></div>
          </div>
        </div>

        {/* Rankings */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RankTable
            title={isJa ? "スクラップ損失 上位5件 (背番号)" : "Top 5 Highest Scrap Loss (背番号)"}
            headers={["#", "背番号", isJa ? "モデル" : "Model", isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)", isJa ? "歩留まり %" : "Yield %"]}
            emptyText={noData}
            onRowClick={(raw) => openBreakdown(raw, "scrapLoss")}
            rows={(data?.top5 || []).map((r, i) => ({
              key: `${r.ban}-${r.hinban}-${r.factory}-${i}`,
              raw: r,
              highlight: "bg-red-500/10",
              cells: [
                { text: i + 1, cls: "text-xs text-[var(--text-muted)]" },
                { text: r.ban || "-", cls: "font-medium" },
                { text: r.model || "-", cls: "text-xs text-[var(--text-muted)]" },
                { text: yen(r.scrapLoss), cls: "font-semibold text-red-600" },
                { text: `${nf(r.yieldPercent)}%` },
              ],
            }))}
          />
          <RankTable
            title={isJa ? "工場別スクラップ損失ランキング" : "Factory Scrap Loss Ranking"}
            headers={["#", isJa ? "工場" : "Factory", isJa ? "生産数" : "Created", isJa ? "スクラップ損失 (¥)" : "Scrap Loss (¥)", isJa ? "歩留まり %" : "Yield %"]}
            emptyText={noData}
            rightFrom={2}
            rows={[...factoryRows].sort((a, b) => b.scrapLoss - a.scrapLoss).map((r, i) => ({
              key: r.name,
              cells: [
                { text: i + 1, cls: "text-xs text-[var(--text-muted)]" },
                { text: r.name, cls: "font-medium" },
                { text: nf(r.created) },
                { text: yen(r.scrapLoss), cls: "font-semibold text-red-600" },
                { text: `${r.created > 0 ? ((r.finalGoodPcs / r.created) * 100).toFixed(1) : "0.0"}%` },
              ],
            }))}
          />
          <RankTable
            tone="green"
            title={isJa ? "最終良品 上位5件 (背番号)" : "Top 5 Highest Final Good (背番号)"}
            headers={["#", "背番号", isJa ? "モデル" : "Model", isJa ? "最終良品 (¥)" : "Final Good (¥)", isJa ? "歩留まり %" : "Yield %"]}
            emptyText={noData}
            onRowClick={(raw) => openBreakdown(raw, "value")}
            rows={(data?.top5Value || []).map((r, i) => ({
              key: `${r.ban}-${r.hinban}-${r.factory}-${i}`,
              raw: r,
              highlight: "bg-emerald-500/10",
              cells: [
                { text: i + 1, cls: "text-xs text-[var(--text-muted)]" },
                { text: r.ban || "-", cls: "font-medium" },
                { text: r.model || "-", cls: "text-xs text-[var(--text-muted)]" },
                { text: yen(r.value), cls: "font-semibold text-emerald-600" },
                { text: `${nf(r.yieldPercent)}%` },
              ],
            }))}
          />
          <RankTable
            tone="green"
            title={isJa ? "工場別最終良品ランキング" : "Factory Final Good Ranking"}
            headers={["#", isJa ? "工場" : "Factory", isJa ? "生産数" : "Created", isJa ? "最終良品 (¥)" : "Final Good (¥)", isJa ? "歩留まり %" : "Yield %"]}
            emptyText={noData}
            rightFrom={2}
            rows={[...factoryRows].sort((a, b) => b.finalGoodYen - a.finalGoodYen).map((r, i) => ({
              key: r.name,
              cells: [
                { text: i + 1, cls: "text-xs text-[var(--text-muted)]" },
                { text: r.name, cls: "font-medium" },
                { text: nf(r.created) },
                { text: yen(r.finalGoodYen), cls: "font-semibold text-emerald-600" },
                { text: `${r.created > 0 ? ((r.finalGoodPcs / r.created) * 100).toFixed(1) : "0.0"}%` },
              ],
            }))}
          />
        </div>

        {/* Detail table */}
        <div className="freya-card relative rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          {loading ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[8px] bg-[var(--surface)]/75">
              <svg className="h-9 w-9 animate-spin text-[var(--freya-blue)]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40 20" strokeLinecap="round" />
              </svg>
              <span className="mt-2 text-xs font-medium text-[var(--text-muted)]">{isJa ? "読み込み中..." : "Loading..."}</span>
            </div>
          ) : null}
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{isJa ? "品番別の詳細内訳" : "Detail Breakdown by 品番"}</h3>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="rounded-[6px] bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {exporting ? (isJa ? "エクスポート中..." : "Exporting...") : (isJa ? "CSVエクスポート" : "Export CSV")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-subtle)] text-[var(--text-muted)]">
                <tr>
                  {detailCols.map((c) => (
                    <th key={c.key} className="px-4 py-2" style={c.recovery ? { background: "rgba(250,204,21,0.25)" } : undefined}>
                      <button type="button" onClick={() => toggleSort(c.key)} className="flex items-center gap-1 whitespace-nowrap hover:text-[var(--text-primary)]">
                        {c.label} <span>{sortIcon(c.key)}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.length === 0 ? (
                  <tr><td colSpan={detailCols.length} className="px-4 py-3 text-[var(--text-muted)]">{loading ? (isJa ? "読み込み中..." : "Loading...") : (isJa ? "データが読み込まれていません" : "No data loaded.")}</td></tr>
                ) : rows.map((row) => (
                  <tr
                    key={`${row.hinban}|${row.ban}|${row.factory}`}
                    onClick={() => openBreakdown(row, "scrapLoss")}
                    title={isJa ? "クリックして計算内訳を表示" : "Click to see how this was calculated"}
                    className="cursor-pointer whitespace-nowrap hover:bg-[var(--surface-hover)]"
                  >
                    <td className="px-4 py-3">{row.hinban || "-"}</td>
                    <td className="px-4 py-3">{row.ban || "-"}</td>
                    <td className="px-4 py-3">{row.model || "-"}</td>
                    <td className="px-4 py-3">{row.factory || "-"}</td>
                    <td className="px-4 py-3">{nf(row.created)}</td>
                    <td className="px-4 py-3">{nf(row.pressNg)}</td>
                    <td className="px-4 py-3">{nf(row.slitNg)}</td>
                    <td className="px-4 py-3">{nf(row.srsNg)}</td>
                    <td className="px-4 py-3">{nf(row.kensaNg)}</td>
                    <td className="px-4 py-3">{nf(row.totalNg)}</td>
                    <td className="px-4 py-3 font-semibold" style={{ background: "rgba(250,204,21,0.25)" }}>{nf(row.recoveredNg)}</td>
                    <td className="px-4 py-3">{nf(row.ngAfterRecovery)}</td>
                    <td className="px-4 py-3">{nf(row.finalGood)}</td>
                    <td className="px-4 py-3">{nf(row.yieldPercent)}%</td>
                    <td className="px-4 py-3">{yen(row.pricePerPc)}</td>
                    <td className="px-4 py-3">{yen(row.cost)}</td>
                    <td className="px-4 py-3">{yen(row.scrapLoss)}</td>
                    <td className="px-4 py-3">{yen(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-[var(--text-muted)]">
              {totalRows === 0
                ? (isJa ? "0件中 0-0件を表示" : "Showing 0-0 of 0")
                : (isJa ? `${totalRows}件中 ${pageStart}-${pageEnd}件を表示` : `Showing ${pageStart}-${pageEnd} of ${totalRows}`)}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className={btnCls}>{isJa ? "前へ" : "Prev"}</button>
              <button type="button" disabled={totalPages === 0 || page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className={btnCls}>{isJa ? "次へ" : "Next"}</button>
              <select
                value={limit}
                onChange={(e) => { setLimit(Math.max(parseInt(e.target.value, 10) || 10, 1)); resetPage(); }}
                className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--text-primary)]"
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <FinancialsProductSelectorModal
        open={selectorOpen}
        products={allProducts}
        initialSelected={selectedBans}
        modelFilter={filterType === "model" ? model : ""}
        isJa={isJa}
        onClose={() => setSelectorOpen(false)}
        onConfirm={(bans) => { setSelectedBans(bans); setSelectorOpen(false); resetPage(); }}
      />
      <FinancialsPeriodBreakdownModal target={periodTarget} onClose={() => setPeriodTarget(null)} onOpenBan={openPeriodBan} isJa={isJa} />
      <FinancialsBreakdownModal target={breakdown} onClose={() => setBreakdown(null)} isJa={isJa} />
    </div>
  );
}
