import { Fragment, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import LiquidSegmentedControl from "../components/LiquidSegmentedControl";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchMaterialLotAnalytics } from "../services/api";

function formatNumber(val) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return "0";
  return Number(val).toLocaleString();
}

function fmtMeters(val) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return "0.0";
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ─── Date Range Utilities ───────────────────────────────────────────────────
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function todayStr() {
  return fmtDate(new Date());
}

function getPastDaysRange(days = 7) {
  const today = new Date();
  const past = new Date(today);
  past.setDate(today.getDate() - (days - 1));
  return { from: fmtDate(past), to: fmtDate(today) };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon);
  return { from: fmtDate(monday), to: todayStr() };
}

function getYesterdayRange() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const s = fmtDate(d);
  return { from: s, to: s };
}

function getLastWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMon - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: fmtDate(monday), to: fmtDate(sunday) };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmtDate(first), to: fmtDate(last) };
}

function getLastMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: fmtDate(first), to: fmtDate(last) };
}

function formatShortDate(dateStr, timeStr, isJa) {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const datePart = isJa ? `${m}月${d}日` : `${months[m - 1] || parts[1]} ${d}`;
      return timeStr ? `${datePart} ${timeStr}` : datePart;
    }
  } catch {
    // fallback
  }
  return timeStr ? `${dateStr} ${timeStr}` : dateStr;
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function MetricTile({ label, value, unit, icon, tone = "neutral", emphasis = false }) {
  const toneClasses = {
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };

  return (
    <div
      className={joinClasses(
        "min-h-[70px] rounded-[8px] border px-3.5 py-3 shadow-2xs",
        toneClasses[tone] || toneClasses.neutral,
        emphasis ? "sm:col-span-2 lg:col-span-2" : ""
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-current opacity-70">{label}</span>
        {icon ? <span className="material-symbols-outlined text-[17px] text-current opacity-75">{icon}</span> : null}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1 font-mono">
        <span className={joinClasses("font-black tracking-tight", emphasis ? "text-2xl" : "text-lg")}>{value}</span>
        {unit ? <span className="text-[11px] font-bold text-current opacity-70">{unit}</span> : null}
      </div>
    </div>
  );
}

function TraceBadge({ children, icon, tone = "neutral", title }) {
  const toneClasses = {
    neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };

  return (
    <span
      title={title}
      className={joinClasses(
        "inline-flex h-6 items-center gap-1 rounded-[5px] border px-2 text-[11px] font-bold",
        toneClasses[tone] || toneClasses.neutral
      )}
    >
      {icon ? <span className="material-symbols-outlined text-[13px]">{icon}</span> : null}
      {children}
    </span>
  );
}

export default function AnalyticsPage() {
  const { language, t } = useLanguage();
  const isJa = language === "ja";

  // ── Top-Level Analytics Module Tabs ───────────────────────────────────────
  const [moduleTab, setModuleTab] = useState("materialLots");

  // ── Inner View Mode: 'table' (DEFAULT per spec) vs 'cards' ────────────────
  const [viewMode, setViewMode] = useState("table");

  // ── Loading & Data State ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      totalDistinctLots: 0,
      totalMeters: 0,
      totalShots: 0,
      totalPieces: 0,
      totalPressRuns: 0,
      totalImagesCount: 0,
      totalDefectImagesCount: 0,
    },
    lots: [],
    runs: [],
    filterOptions: {
      materialSeibans: [],
      materialHinbans: [],
      materialNames: [],
      factories: [],
      machines: [],
      hinbanList: [],
      seibanList: [],
      workers: [],
      lotNumbers: [],
    },
  });

  // ── Date Preset & Filter States (Default: 1 Week / "thisWeek") ────────────
  const [rangePreset, setRangePreset] = useState("thisWeek");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [factory, setFactory] = useState("");
  const [machine, setMachine] = useState("");
  const [materialSeiban, setMaterialSeiban] = useState("");
  const [search, setSearch] = useState("");

  // Lightbox Modal for Full Image View: { url, title, type: 'label'|'defect' }
  const [selectedImageModal, setSelectedImageModal] = useState(null);

  // Expanded Lots in Table / Card
  const [expandedLots, setExpandedLots] = useState(new Set());

  // Sorting state for table
  const [sortField, setSortField] = useState("latestDate");
  const [sortDir, setSortDir] = useState("desc");

  // Compute Active Date Range from Preset
  const dateRange = useMemo(() => {
    if (rangePreset === "today") {
      const d = todayStr();
      return { from: d, to: d };
    }
    if (rangePreset === "yesterday") return getYesterdayRange();
    if (rangePreset === "thisWeek") return getWeekRange();
    if (rangePreset === "last7Days") return getPastDaysRange(7);
    if (rangePreset === "thisMonth") return getMonthRange();
    if (rangePreset === "lastWeek") return getLastWeekRange();
    if (rangePreset === "lastMonth") return getLastMonthRange();
    // custom
    return { from: customFrom || getPastDaysRange(7).from, to: customTo || todayStr() };
  }, [rangePreset, customFrom, customTo]);

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchMaterialLotAnalytics({
        startDate: dateRange.from,
        endDate: dateRange.to,
        factory: factory || undefined,
        machine: machine || undefined,
        materialSeiban: materialSeiban || undefined,
        search: search.trim() || undefined,
      });
      if (res && res.success) {
        setData(res);
      }
    } catch (err) {
      console.error("Failed to load material lots analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (moduleTab === "materialLots") {
      loadData();
    }
  }, [dateRange.from, dateRange.to, factory, machine, materialSeiban, moduleTab]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    loadData();
  };

  const handleResetFilters = () => {
    setRangePreset("thisWeek");
    setCustomFrom("");
    setCustomTo("");
    setFactory("");
    setMachine("");
    setMaterialSeiban("");
    setSearch("");
  };

  // Toggle Lot Expansion in Table / Card
  const toggleLotExpand = (lotKey) => {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(lotKey)) {
        next.delete(lotKey);
      } else {
        next.add(lotKey);
      }
      return next;
    });
  };

  // Sort Column Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // ── Filtered & Sorted Lots ────────────────────────────────────────────────
  const filteredLots = useMemo(() => {
    let list = data.lots || [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((lot) => {
        return (
          (lot.displayTitle && lot.displayTitle.toLowerCase().includes(q)) ||
          lot.lotNumber.toLowerCase().includes(q) ||
          (lot.materialSeiban && lot.materialSeiban.toLowerCase().includes(q)) ||
          (lot.materialHinban && lot.materialHinban.toLowerCase().includes(q)) ||
          (lot.materialName && lot.materialName.toLowerCase().includes(q)) ||
          lot.machines.some((m) => m.toLowerCase().includes(q)) ||
          (lot.products || []).some(
            (p) =>
              p.seiban?.toLowerCase().includes(q) ||
              p.hinban?.toLowerCase().includes(q) ||
              p.productName?.toLowerCase().includes(q)
          ) ||
          lot.workers.some((w) => w.toLowerCase().includes(q)) ||
          lot.factories.some((f) => f.toLowerCase().includes(q))
        );
      });
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "latestDate") {
        cmp = (b.latestDate || "").localeCompare(a.latestDate || "");
        if (cmp === 0) cmp = (b.totalMeters || 0) - (a.totalMeters || 0);
      } else if (sortField === "meters") {
        cmp = (b.totalMeters || 0) - (a.totalMeters || 0);
      } else if (sortField === "pieces") {
        cmp = (b.totalPieces || 0) - (a.totalPieces || 0);
      } else if (sortField === "runs") {
        cmp = (b.runsCount || 0) - (a.runsCount || 0);
      } else if (sortField === "lot") {
        cmp = (a.lotNumber || "").localeCompare(b.lotNumber || "");
      } else if (sortField === "material") {
        cmp = (a.materialSeiban || "").localeCompare(b.materialSeiban || "");
      }
      return sortDir === "asc" ? -cmp : cmp;
    });
  }, [data.lots, search, sortField, sortDir]);

  // Aggregate Totals of current filtered lots
  const filteredSummary = useMemo(() => {
    let meters = 0;
    let pieces = 0;
    let shots = 0;
    let runs = 0;
    const machines = new Set();
    const products = new Set();
    let defects = 0;

    filteredLots.forEach((l) => {
      meters += l.totalMeters || 0;
      pieces += l.totalPieces || 0;
      shots += l.totalShots || 0;
      runs += l.runsCount || 0;
      (l.machines || []).forEach((m) => machines.add(m));
      (l.products || []).forEach((p) => {
        if (p.hinban) products.add(p.hinban);
        else if (p.seiban) products.add(p.seiban);
      });
      defects += (l.defectImages || []).length;
    });

    return {
      lotsCount: filteredLots.length,
      meters: Number(meters.toFixed(1)),
      pieces,
      shots,
      runs,
      machinesCount: machines.size,
      productsCount: products.size,
      defectsCount: defects,
    };
  }, [filteredLots]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      isJa ? "材料背番号" : "Material Code",
      isJa ? "材料ロット番号" : "Lot Number",
      isJa ? "消費メーター数 (m)" : "Meters Used (m)",
      isJa ? "生産個数" : "Pieces",
      isJa ? "加工回数" : "Runs",
      isJa ? "加工設備" : "Machines",
      isJa ? "製品背番号" : "Product Seiban",
      isJa ? "製品品番" : "Product Hinban",
      isJa ? "品名" : "Product Name",
      isJa ? "最終使用日時" : "Last Used",
      isJa ? "作業者" : "Workers",
      isJa ? "ラベル写真数" : "Label Photos",
      isJa ? "不良写真数" : "Defect Photos",
    ];

    const rows = filteredLots.map((l) => [
      `"${l.materialSeiban || ""}"`,
      `"${l.lotNumber || ""}"`,
      l.totalMeters || 0,
      l.totalPieces || 0,
      l.runsCount || 0,
      `"${l.machines.join(", ")}"`,
      `"${l.products.map((p) => p.seiban).filter(Boolean).join(", ")}"`,
      `"${l.products.map((p) => p.hinban).filter(Boolean).join(", ")}"`,
      `"${l.materialName || ""}"`,
      `"${l.latestDate || ""}"`,
      `"${l.workers.join(", ")}"`,
      (l.labelImages || []).length,
      (l.defectImages || []).length,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `material_usage_ledger_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="w-full h-screen overflow-y-auto space-y-4 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow={isJa ? "トレーサビリティ台帳" : "Traceability Ledger"}
        eyebrowClassName="text-xs tracking-[0.18em]"
        title={
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[var(--freya-blue)]">receipt_long</span>
            <span>{isJa ? "材料使用実績" : "Material Usage"}</span>
          </div>
        }
        subtitle={`${dateRange.from} 〜 ${dateRange.to}`}
        className="mb-1 md:flex-row md:items-center md:justify-between"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {moduleTab === "materialLots" && (
              <button
                type="button"
                onClick={exportToCSV}
                className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>file_export</span>
                {isJa ? "CSV出力" : "Export CSV"}
              </button>
            )}
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>refresh</span>
              {isJa ? "更新" : "Refresh"}
            </button>
          </div>
        }
      />

      {/* ── Top-Level Analytics Module Tabs ──────────────────────────────────── */}
      <div className="border-b border-[var(--border)] pb-2">
        <LiquidSegmentedControl
          items={[
            {
              key: "materialLots",
              label: t("materialAnalytics"),
              icon: "inventory_2",
              badge: filteredLots.length > 0 ? filteredLots.length : undefined,
            },
            {
              key: "production",
              label: t("productionAnalytics"),
              icon: "precision_manufacturing",
              badge: t("comingSoon"),
            },
            {
              key: "quality",
              label: t("qualityAnalytics"),
              icon: "fact_check",
              badge: t("comingSoon"),
            },
            {
              key: "machines",
              label: t("machineAnalytics"),
              icon: "speed",
              badge: t("comingSoon"),
            },
          ]}
          activeKey={moduleTab}
          onChange={setModuleTab}
        />
      </div>

      {/* ── Placeholder for Future Analytics Modules ──────────────────────────── */}
      {moduleTab !== "materialLots" && (
        <div className="freya-card rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-sm space-y-4 max-w-2xl mx-auto my-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20">
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
              {moduleTab === "production" ? "precision_manufacturing" : moduleTab === "quality" ? "fact_check" : "speed"}
            </span>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {moduleTab === "production"
                ? (isJa ? "生産ライン稼働率・出来高分析" : "Production & Line Output Analytics")
                : moduleTab === "quality"
                ? (isJa ? "不良率・品質トレンド分析" : "Defect Rate & Quality Analytics")
                : (isJa ? "設備総合効率 (OEE) & ダウンタイム分析" : "Machine OEE & Downtime Analytics")}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-md mx-auto">
              {isJa
                ? "このアナリティクスモジュールは近日統合予定です。リアルタイムKPI、工程別推移、およびAIによる傾向分析がここに追加されます。"
                : "This analytics section is planned for upcoming release. It will feature real-time line metrics, AI trend predictions, and granular efficiency logs."}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setModuleTab("materialLots")}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] text-white px-4 py-2 text-xs font-semibold shadow-sm hover:opacity-90 transition"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              <span>{isJa ? "材料分析に戻る" : "Back to Material Analytics"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Material Usage Ledger Content ─────────────────────────────────────── */}
      {moduleTab === "materialLots" && (
        <div className="space-y-3.5">
          {/* ── 1. Compact Summary Header (Clean Counts per Spec Section 7) ──── */}
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Left Context Info: Simplified to counts */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                    {isJa ? "材料使用サマリー" : "Material Usage Summary"}
                  </span>
                  <span className="rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-1.5 py-0.2 text-[10px] font-mono text-[var(--text-muted)]">
                    {dateRange.from} 〜 {dateRange.to}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                  <div>
                    <span className="text-[var(--text-secondary)] mr-1">{isJa ? "材料:" : "Material:"}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {materialSeiban || (isJa ? `全種別 (${data.filterOptions.materialSeibans?.length || 0})` : `All (${data.filterOptions.materialSeibans?.length || 0})`)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)] mr-1">{isJa ? "製品:" : "Products:"}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{filteredSummary.productsCount}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)] mr-1">{isJa ? "設備:" : "Machines:"}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{filteredSummary.machinesCount}</span>
                  </div>
                </div>
              </div>

              {/* Right Key Metrics: TOTAL USED as dominant KPI */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* TOTAL USED (Meters): Primary Metric Emphasis */}
                <div className="flex flex-col items-end rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-mono">
                    {isJa ? "総消費メーター数" : "Total Used"}
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                    {fmtMeters(filteredSummary.meters)} <span className="text-xs font-semibold">m</span>
                  </span>
                </div>

                {/* LOTS */}
                <div className="flex flex-col items-end rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 min-w-[70px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {isJa ? "ロット数" : "Lots"}
                  </span>
                  <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                    {formatNumber(filteredSummary.lotsCount)}
                  </span>
                </div>

                {/* PIECES */}
                <div className="flex flex-col items-end rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 min-w-[80px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {isJa ? "生産個数" : "Pieces"}
                  </span>
                  <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                    {formatNumber(filteredSummary.pieces)}
                  </span>
                </div>

                {/* RUNS */}
                <div className="flex flex-col items-end rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5 min-w-[70px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {isJa ? "実績数" : "Runs"}
                  </span>
                  <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                    {formatNumber(filteredSummary.runs)}
                  </span>
                </div>

                {/* QC DEFECTS (Red only if defects exist per Spec) */}
                {filteredSummary.defectsCount > 0 ? (
                  <div className="flex flex-col items-end rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 font-mono">
                      {isJa ? "不良写真" : "QC Defects"}
                    </span>
                    <span className="text-sm font-bold font-mono text-rose-700 dark:text-rose-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">report_problem</span>
                      <span>{filteredSummary.defectsCount}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {isJa ? "品質" : "QC"}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-muted)] font-mono">
                      0 NG
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. Compact Filter Bar (No Expand All per Section 8) ───────────── */}
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2.5">
              {/* Left Filters */}
              <div className="flex flex-wrap items-end gap-2 flex-1">
                {/* Date Preset Dropdown */}
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {t("date")}
                  </label>
                  <div className="relative">
                    <select
                      value={rangePreset}
                      onChange={(e) => setRangePreset(e.target.value)}
                      className="h-8 min-w-[120px] appearance-none rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] pl-2.5 pr-7 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)] cursor-pointer"
                    >
                      <option value="today">{t("todayLabel")}</option>
                      <option value="yesterday">{t("yesterday")}</option>
                      <option value="thisWeek">{t("thisWeek")}</option>
                      <option value="last7Days">{t("last7Days")}</option>
                      <option value="thisMonth">{t("thisMonth")}</option>
                      <option value="lastWeek">{t("lastWeek")}</option>
                      <option value="lastMonth">{t("lastMonth")}</option>
                      <option value="custom">{t("custom")}</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[16px]">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Custom Date Pickers */}
                {rangePreset === "custom" && (
                  <>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        {isJa ? "開始日" : "From"}
                      </label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                        {isJa ? "終了日" : "To"}
                      </label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
                      />
                    </div>
                  </>
                )}

                {/* Material Code Filter */}
                <div className="min-w-[130px]">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa ? "材料背番号" : "Material"}
                  </label>
                  <div className="relative">
                    <select
                      value={materialSeiban}
                      onChange={(e) => setMaterialSeiban(e.target.value)}
                      className="h-8 w-full appearance-none rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] pl-2.5 pr-7 text-xs font-semibold text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)] cursor-pointer"
                    >
                      <option value="">{isJa ? "すべての材料" : "All Materials"}</option>
                      {(data.filterOptions.materialSeibans || []).map((ms) => (
                        <option key={ms} value={ms}>{ms}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[16px]">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Machine Filter */}
                <div className="min-w-[110px]">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa ? "設備" : "Machine"}
                  </label>
                  <div className="relative">
                    <select
                      value={machine}
                      onChange={(e) => setMachine(e.target.value)}
                      className="h-8 w-full appearance-none rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] pl-2.5 pr-7 text-xs font-semibold text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)] cursor-pointer"
                    >
                      <option value="">{isJa ? "すべての設備" : "All Machines"}</option>
                      {(data.filterOptions.machines || []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[16px]">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Factory Filter */}
                <div className="min-w-[100px]">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {t("factory")}
                  </label>
                  <div className="relative">
                    <select
                      value={factory}
                      onChange={(e) => setFactory(e.target.value)}
                      className="h-8 w-full appearance-none rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] pl-2.5 pr-7 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)] cursor-pointer"
                    >
                      <option value="">{t("all")}</option>
                      {(data.filterOptions.factories || []).map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[16px]">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Search Box */}
                <div className="min-w-[190px] flex-1">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    {isJa ? "検索" : "Search"}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[15px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit(e)}
                      placeholder={isJa ? "ロット番号・品番・QRコード..." : "Lot #, Code, Hinban, QR..."}
                      className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] pl-7 pr-7 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--freya-blue)]"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Reset */}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shadow-2xs inline-flex items-center gap-1"
                  title={isJa ? "リセット" : "Reset"}
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  <span>{t("reset")}</span>
                </button>
              </div>

              {/* Right: View Mode Toggle (Table Default vs Cards) */}
              <div className="self-end">
                <div className="inline-flex rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-semibold transition ${
                      viewMode === "table"
                        ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">table_rows</span>
                    <span>{t("listView")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-semibold transition ${
                      viewMode === "cards"
                        ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">grid_view</span>
                    <span>{t("cardView")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. Main Content: Ledger Table or Cards ────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-28 text-[var(--text-muted)]">
              <span className="material-symbols-outlined animate-spin text-[var(--freya-blue)]" style={{ fontSize: 36 }}>
                progress_activity
              </span>
              <span className="text-sm font-semibold">
                {isJa ? "材料使用データを読込・集計中…" : "Loading material usage ledger…"}
              </span>
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="freya-card flex flex-col items-center justify-center gap-3 py-20 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-[8px]">
              <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 36 }}>
                find_in_page
              </span>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {isJa ? "該当する材料ロット実績が見つかりませんでした" : "No material lot records found"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {isJa ? "日付範囲または検索条件を変更してください。" : "Adjust your date range or search filters."}
              </p>
            </div>
          ) : viewMode === "table" ? (
            /* =========================================================================
               MATERIAL LOT USAGE LEDGER TABLE (STRICT TABLE-FIXED WITH COLGROUP)
               ========================================================================= */
            <div className="freya-card overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse table-fixed min-w-[900px]">
                  {/* Strict Column Widths (Section 3) */}
                  <colgroup>
                    <col style={{ width: "8%" }} />   {/* Material */}
                    <col style={{ width: "12%" }} />  {/* Lot */}
                    <col style={{ width: "10%" }} />  {/* Used (right-aligned, bold) */}
                    <col style={{ width: "27%" }} />  {/* Product / Seiban */}
                    <col style={{ width: "6%" }} />   {/* Runs (right-aligned) */}
                    <col style={{ width: "11%" }} />  {/* Machines */}
                    <col style={{ width: "8%" }} />   {/* Pieces (right-aligned) */}
                    <col style={{ width: "10%" }} />  {/* Last Used */}
                    <col style={{ width: "8%" }} />   {/* Evidence */}
                  </colgroup>

                  {/* Table Header */}
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] uppercase text-[11px] font-semibold tracking-[0.04em] sticky top-0 z-10 select-none">
                    <tr>
                      {/* Material */}
                      <th
                        onClick={() => handleSort("material")}
                        className="px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)] transition"
                      >
                        <div className="flex items-center gap-1">
                          <span>{isJa ? "材料" : "MATERIAL"}</span>
                          {sortField === "material" && (
                            <span className="material-symbols-outlined text-[13px]">
                              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          )}
                        </div>
                      </th>

                      {/* Lot */}
                      <th
                        onClick={() => handleSort("lot")}
                        className="px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)] transition"
                      >
                        <div className="flex items-center gap-1">
                          <span>{isJa ? "ロット番号" : "LOT"}</span>
                          {sortField === "lot" && (
                            <span className="material-symbols-outlined text-[13px]">
                              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          )}
                        </div>
                      </th>

                      {/* USED (Right-aligned, primary metric per Section 4 & 5) */}
                      <th
                        onClick={() => handleSort("meters")}
                        className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--text-primary)] transition font-bold"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{isJa ? "使用量 (m)" : "USED"}</span>
                          {sortField === "meters" && (
                            <span className="material-symbols-outlined text-[13px]">
                              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          )}
                        </div>
                      </th>

                      {/* PRODUCT / SEIBAN */}
                      <th className="px-3 py-2.5">{isJa ? "製品 / 背番号" : "PRODUCT / SEIBAN"}</th>

                      {/* RUNS (Right-aligned per Section 4) */}
                      <th
                        onClick={() => handleSort("runs")}
                        className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--text-primary)] transition"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{isJa ? "実績" : "RUNS"}</span>
                          {sortField === "runs" && (
                            <span className="material-symbols-outlined text-[13px]">
                              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          )}
                        </div>
                      </th>

                      {/* MACHINES */}
                      <th className="px-3 py-2.5">{isJa ? "設備" : "MACHINES"}</th>

                      {/* PIECES (Right-aligned per Section 4) */}
                      <th
                        onClick={() => handleSort("pieces")}
                        className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--text-primary)] transition"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{isJa ? "生産数" : "PIECES"}</span>
                          {sortField === "pieces" && (
                            <span className="material-symbols-outlined text-[13px]">
                              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          )}
                        </div>
                      </th>

                      {/* LAST USED */}
                      <th
                        onClick={() => handleSort("latestDate")}
                        className="px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)] transition"
                      >
                        <div className="flex items-center gap-1">
                          <span>{isJa ? "最終使用" : "LAST USED"}</span>
                          {sortField === "latestDate" && (
                            <span className="material-symbols-outlined text-[13px]">
                              {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          )}
                        </div>
                      </th>

                      {/* EVIDENCE */}
                      <th className="px-3 py-2.5 text-center">{isJa ? "証拠" : "EVIDENCE"}</th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredLots.map((lot) => {
                      const lotKey = lot.key || lot.lotNumber;
                      const isExpanded = expandedLots.has(lotKey);
                      const matSeiban = lot.materialSeiban && lot.materialSeiban !== "—" ? lot.materialSeiban : null;
                      const labelImgs = lot.labelImages || [];
                      const defectImgs = lot.defectImages || [];

                      // Clean Product Display (Section 6: C74 · C76 · C75 +2)
                      const distinctSeibans = Array.from(
                        new Set(
                          (lot.products || [])
                            .map((p) => p.seiban)
                            .filter(Boolean)
                        )
                      );
                      const visibleSeibans = distinctSeibans.slice(0, 3);
                      const extraCount = distinctSeibans.length - 3;
                      const fullProductsTooltip = (lot.products || [])
                        .map((p) => `${p.seiban || ""}${p.hinban ? ` (${p.hinban})` : ""}`)
                        .filter(Boolean)
                        .join(", ");

                      return (
                        <Fragment key={lotKey}>
                          <tr
                            onClick={() => toggleLotExpand(lotKey)}
                            className={`cursor-pointer transition-colors select-none ${
                              isExpanded ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-hover)]"
                            }`}
                          >
                            {/* 1. Material */}
                            <td className="px-3 py-2.5 font-mono font-bold text-xs text-[var(--text-primary)] truncate" title={lot.materialName || matSeiban}>
                              {matSeiban || <span className="text-[var(--text-muted)] font-normal">—</span>}
                            </td>

                            {/* 2. Lot Number (+ future physical ID support) */}
                            <td className="px-3 py-2.5 font-mono font-bold text-xs text-[var(--text-primary)] truncate">
                              {lot.lotNumber}
                            </td>

                            {/* 3. Used (Meters): Primary Metric Emphasis, Right-Aligned, 1 Decimal */}
                            <td className="px-3 py-2.5 text-right font-mono text-[13px] font-black text-[var(--text-primary)] dark:text-emerald-300 whitespace-nowrap">
                              {fmtMeters(lot.totalMeters)} <span className="text-[11px] font-semibold text-[var(--text-muted)]">m</span>
                            </td>

                            {/* 4. Product / Seiban (Section 6: Clean C74 · C76 format with tooltip) */}
                            <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] font-mono truncate" title={fullProductsTooltip}>
                              {visibleSeibans.length > 0 ? (
                                <div className="flex items-center gap-1 truncate">
                                  <span className="font-bold text-[var(--text-primary)]">
                                    {visibleSeibans.join(" · ")}
                                  </span>
                                  {extraCount > 0 && (
                                    <span className="rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-1 py-0.2 text-[10px] text-[var(--text-muted)] font-medium">
                                      +{extraCount}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[var(--text-muted)]">—</span>
                              )}
                            </td>

                            {/* 5. Runs (Right-Aligned per Section 4) */}
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--text-secondary)]">
                              {lot.runsCount}
                            </td>

                            {/* 6. Machines */}
                            <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)] truncate" title={lot.machines.join(", ")}>
                              {lot.machines.join(", ") || "—"}
                            </td>

                            {/* 7. Pieces (Right-Aligned, Comma Formatted per Section 4) */}
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-[var(--text-secondary)]">
                              {formatNumber(lot.totalPieces)}
                            </td>

                            {/* 8. Last Used */}
                            <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] font-mono whitespace-nowrap">
                              {formatShortDate(lot.latestDate, lot.runs[0]?.timeStart, isJa)}
                            </td>

                            {/* 9. Evidence Action Pills (Section 12: Compact indicators) */}
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {labelImgs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedImageModal({
                                        url: labelImgs[0],
                                        title: `${lot.lotNumber} • ${isJa ? "材料ラベル" : "Label Photo"}`,
                                        type: "label",
                                      })
                                    }
                                    className="inline-flex items-center gap-0.5 rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-secondary)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] transition"
                                    title={isJa ? "材料ラベル写真" : "Label photo"}
                                  >
                                    <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                                    <span>{labelImgs.length}</span>
                                  </button>
                                )}

                                {defectImgs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedImageModal({
                                        url: defectImgs[0],
                                        title: `${lot.lotNumber} • ${isJa ? "不良証拠写真" : "Defect Photo"}`,
                                        type: "defect",
                                      })
                                    }
                                    className="inline-flex items-center gap-0.5 rounded-[4px] bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition"
                                    title={isJa ? "不良証拠写真" : "QC Defect photo"}
                                  >
                                    <span className="material-symbols-outlined text-[12px]">report_problem</span>
                                    <span>{defectImgs.length}</span>
                                  </button>
                                )}

                                {labelImgs.length === 0 && defectImgs.length === 0 && (
                                  <span className="text-[var(--text-muted)]/30 text-[10px]">—</span>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* ── Sub-Row: Usage History (Section 9, 10, 11) ── */}
                          {isExpanded && (
                            <tr className="bg-[var(--surface-subtle)]/70">
                              <td colSpan={9} className="p-4 border-t border-[var(--border)]">
                                <div className="space-y-2.5 max-w-5xl">
                                  {/* Sub-Header with Totals */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[var(--border)] pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                                        LOT: {lot.lotNumber}
                                      </span>
                                      <span className="text-[var(--text-muted)]">•</span>
                                      <span className="text-xs text-[var(--text-muted)]">
                                        {isJa ? "材料:" : "Material:"}{" "}
                                        <strong className="text-[var(--text-primary)] font-mono">{lot.materialSeiban || "—"}</strong>
                                        {lot.materialName && ` (${lot.materialName})`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 font-mono text-xs">
                                      <span>
                                        {isJa ? "ロット総使用:" : "Total Used:"}{" "}
                                        <strong className="text-emerald-700 dark:text-emerald-300 text-sm">
                                          {fmtMeters(lot.totalMeters)} m
                                        </strong>
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {isJa ? "生産個数:" : "Pieces:"}{" "}
                                        <strong className="text-[var(--text-primary)]">{formatNumber(lot.totalPieces)}</strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Usage History Table (Section 9) */}
                                  <div className="overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
                                    <table className="w-full text-left text-xs border-collapse">
                                      <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider">
                                        <tr>
                                          <th className="px-3 py-1.5">{isJa ? "加工日時" : "DATE / TIME"}</th>
                                          <th className="px-3 py-1.5">{isJa ? "設備" : "MACHINE"}</th>
                                          <th className="px-3 py-1.5">{isJa ? "品番" : "PRODUCT"}</th>
                                          <th className="px-3 py-1.5">{isJa ? "背番号" : "SEIBAN"}</th>
                                          <th className="px-3 py-1.5 text-right font-black text-[var(--text-primary)]">
                                            {isJa ? "使用量 (m)" : "USED"}
                                          </th>
                                          <th className="px-3 py-1.5 text-right">{isJa ? "ショット" : "SHOTS"}</th>
                                          <th className="px-3 py-1.5 text-right">{isJa ? "生産数" : "PIECES"}</th>
                                          <th className="px-3 py-1.5">{isJa ? "作業者" : "WORKER"}</th>
                                          <th className="px-3 py-1.5 text-center">{isJa ? "添付証拠" : "EVIDENCE"}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[var(--border)] font-mono">
                                        {lot.runs.map((r, rIdx) => (
                                          <tr key={rIdx} className="hover:bg-[var(--surface-hover)] transition-colors">
                                            <td className="px-3 py-1.5 whitespace-nowrap text-[var(--text-primary)]">
                                              {formatShortDate(r.date, r.timeStart, isJa)}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap font-bold text-[var(--text-primary)]">
                                              {r.machine}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap text-[var(--text-muted)]">
                                              {r.hinban || "—"}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap font-bold text-[var(--text-primary)]">
                                              {r.seiban || "—"}
                                            </td>
                                            {/* Used Meters in this run */}
                                            <td className="px-3 py-1.5 text-right whitespace-nowrap font-black text-emerald-700 dark:text-emerald-300">
                                              {fmtMeters(r.meters)} m
                                            </td>
                                            <td className="px-3 py-1.5 text-right whitespace-nowrap text-[var(--text-secondary)]">
                                              {formatNumber(r.shots)}
                                            </td>
                                            <td className="px-3 py-1.5 text-right whitespace-nowrap text-[var(--text-secondary)]">
                                              {formatNumber(r.pieces)}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap text-[var(--text-secondary)] font-sans">
                                              {r.worker}
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap text-center">
                                              <div className="flex items-center justify-center gap-1 font-sans">
                                                {r.labelImage && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setSelectedImageModal({
                                                        url: r.labelImage,
                                                        title: `${r.lotNumber} • ${isJa ? "材料ラベル" : "Label Photo"}`,
                                                        type: "label",
                                                      })
                                                    }
                                                    className="inline-flex items-center gap-0.5 rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] transition"
                                                  >
                                                    <span className="material-symbols-outlined text-[12px]">photo_camera</span>
                                                    <span>{isJa ? "ラベル" : "Label"}</span>
                                                  </button>
                                                )}
                                                {r.defectImages && r.defectImages.length > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setSelectedImageModal({
                                                        url: r.defectImages[0],
                                                        title: `${r.lotNumber} • ${isJa ? "不良証拠写真" : "Defect Photo"}`,
                                                        type: "defect",
                                                      })
                                                    }
                                                    className="inline-flex items-center gap-0.5 rounded-[4px] bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition"
                                                  >
                                                    <span className="material-symbols-outlined text-[12px]">report_problem</span>
                                                    <span>{r.defectImages.length}</span>
                                                  </button>
                                                )}
                                                {!r.labelImage && (!r.defectImages || r.defectImages.length === 0) && (
                                                  <span className="text-[var(--text-muted)]/30">—</span>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      {/* Usage History Total Footer (Section 11) */}
                                      <tfoot className="border-t border-[var(--border)] bg-[var(--surface-subtle)] font-mono text-xs font-bold">
                                        <tr>
                                          <td colSpan={4} className="px-3 py-1.5 text-right uppercase text-[10px] text-[var(--text-muted)]">
                                            {isJa ? "合計消費メーター:" : "TOTAL USED:"}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-black text-emerald-700 dark:text-emerald-300">
                                            {fmtMeters(lot.totalMeters)} m
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">
                                            {formatNumber(lot.totalShots)}
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-[var(--text-secondary)]">
                                            {formatNumber(lot.totalPieces)}
                                          </td>
                                          <td colSpan={2}></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>

                  {/* Main Table Total Footer */}
                  <tfoot className="border-t-2 border-[var(--border)] bg-[var(--surface-subtle)] font-mono text-xs font-bold text-[var(--text-primary)]">
                    <tr>
                      <td className="px-3 py-2.5">TOTAL</td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)] text-[11px] font-normal">
                        {filteredSummary.lotsCount} lots
                      </td>
                      {/* Total Used Meters (Right-Aligned) */}
                      <td className="px-3 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-300">
                        {fmtMeters(filteredSummary.meters)} <span className="text-[11px] font-semibold">m</span>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)] text-[11px] font-normal">
                        {filteredSummary.productsCount} {isJa ? "製品" : "products"}
                      </td>
                      {/* Runs (Right-Aligned) */}
                      <td className="px-3 py-2.5 text-right">{filteredSummary.runs}</td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)] text-[11px] font-normal truncate">
                        {filteredSummary.machinesCount} {isJa ? "台" : "machines"}
                      </td>
                      {/* Pieces (Right-Aligned) */}
                      <td className="px-3 py-2.5 text-right">{formatNumber(filteredSummary.pieces)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* =========================================================================
               CARD VIEW (SECONDARY OPTION per Spec)
               ========================================================================= */
            <div className="space-y-2.5">
              {filteredLots.map((lot) => {
                const lotKey = lot.key || lot.lotNumber;
                const isExpanded = expandedLots.has(lotKey);
                const matSeiban = lot.materialSeiban && lot.materialSeiban !== "—" ? lot.materialSeiban : null;
                const defectImgs = lot.defectImages || [];

                return (
                  <div
                    key={lotKey}
                    className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden transition hover:border-[var(--border-strong)]"
                  >
                    {/* Card Header Bar */}
                    <div
                      onClick={() => toggleLotExpand(lotKey)}
                      className="p-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-[var(--surface-subtle)]/40 transition"
                    >
                      {/* Left: Material & Lot */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-[var(--surface-subtle)] border border-[var(--border)] font-mono font-bold text-xs text-[var(--text-primary)]">
                          {matSeiban ? matSeiban.slice(0, 3) : "LOT"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                              {lot.lotNumber}
                            </span>
                            {matSeiban && (
                              <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
                                ({matSeiban})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono">
                            {lot.machines.join(", ") || "—"} • {lot.products.map((p) => p.seiban).filter(Boolean).join(", ") || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Right: Metrics with Meters as Primary */}
                      <div className="flex items-center gap-3.5">
                        {/* Meters Used */}
                        <div className="text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {isJa ? "使用量" : "Used"}
                          </div>
                          <div className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
                            {fmtMeters(lot.totalMeters)} m
                          </div>
                        </div>

                        {/* Pieces */}
                        <div className="text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {isJa ? "生産数" : "Pieces"}
                          </div>
                          <div className="text-xs font-bold font-mono text-[var(--text-primary)]">
                            {formatNumber(lot.totalPieces)}
                          </div>
                        </div>

                        {/* Runs */}
                        <div className="text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {isJa ? "実績" : "Runs"}
                          </div>
                          <div className="text-xs font-bold font-mono text-[var(--text-primary)]">
                            {lot.runsCount}
                          </div>
                        </div>

                        {/* Defect indicator */}
                        {defectImgs.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300">
                            <span className="material-symbols-outlined text-[12px]">report_problem</span>
                            <span>{defectImgs.length}</span>
                          </span>
                        )}

                        <span
                          className="material-symbols-outlined text-[var(--text-muted)] transition-transform duration-200"
                          style={{
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            fontSize: 18,
                          }}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Card Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)]/50 p-3.5 space-y-2.5">
                        <div className="overflow-x-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
                          <table className="w-full text-left text-xs font-mono">
                            <thead className="border-b border-[var(--border)] bg-[var(--surface-subtle)] text-[10px] font-bold text-[var(--text-muted)] uppercase">
                              <tr>
                                <th className="px-3 py-1.5">{isJa ? "日時" : "Date / Time"}</th>
                                <th className="px-3 py-1.5">{isJa ? "設備" : "Machine"}</th>
                                <th className="px-3 py-1.5">{isJa ? "品番" : "Product"}</th>
                                <th className="px-3 py-1.5">{isJa ? "背番号" : "Seiban"}</th>
                                <th className="px-3 py-1.5 text-right font-bold text-[var(--text-primary)]">{isJa ? "メーター" : "Meters"}</th>
                                <th className="px-3 py-1.5 text-right">{isJa ? "生産数" : "Pieces"}</th>
                                <th className="px-3 py-1.5 font-sans">{isJa ? "作業者" : "Worker"}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                              {lot.runs.map((r, rIdx) => (
                                <tr key={rIdx} className="hover:bg-[var(--surface-hover)]">
                                  <td className="px-3 py-1.5 text-[var(--text-primary)]">{formatShortDate(r.date, r.timeStart, isJa)}</td>
                                  <td className="px-3 py-1.5 font-bold text-[var(--text-primary)]">{r.machine}</td>
                                  <td className="px-3 py-1.5 text-[var(--text-muted)]">{r.hinban || "—"}</td>
                                  <td className="px-3 py-1.5 font-bold text-[var(--text-primary)]">{r.seiban || "—"}</td>
                                  <td className="px-3 py-1.5 text-right font-black text-emerald-700 dark:text-emerald-300">{fmtMeters(r.meters)} m</td>
                                  <td className="px-3 py-1.5 text-right">{formatNumber(r.pieces)}</td>
                                  <td className="px-3 py-1.5 font-sans">{r.worker}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Image Lightbox Modal ─────────────────────────────────────────────── */}
      {selectedImageModal && (
        <div
          onClick={() => setSelectedImageModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-[92vw] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] shadow-2xl flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined ${
                    selectedImageModal.type === "defect" ? "text-rose-500" : "text-emerald-500"
                  }`}
                  style={{ fontSize: 18 }}
                >
                  {selectedImageModal.type === "defect" ? "report_problem" : "photo_camera"}
                </span>
                <h4 className="text-xs font-bold text-[var(--text-primary)] font-mono">
                  {selectedImageModal.title || (isJa ? "証拠写真" : "Evidence Image")}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedImageModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-6 px-2 items-center justify-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                  <span>{isJa ? "原本" : "Original"}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedImageModal(null)}
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                </button>
              </div>
            </div>

            {/* Modal Image Content */}
            <div className="p-3 flex items-center justify-center max-h-[82vh] overflow-auto bg-black/5 dark:bg-black/30">
              <img
                src={selectedImageModal.url}
                alt="Evidence Preview"
                className="max-h-[76vh] max-w-full rounded-[6px] border border-[var(--border)] object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
