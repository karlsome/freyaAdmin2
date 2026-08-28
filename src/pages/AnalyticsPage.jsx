import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import FormField from "../components/FormField";
import StatSummaryCard from "../components/StatSummaryCard";
import { useLanguage } from "../contexts/LanguageContext";
import { fetchMaterialLotAnalytics } from "../services/api";

function formatNumber(val) {
  if (val === undefined || val === null || Number.isNaN(Number(val))) return "0";
  return Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AnalyticsPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      totalDistinctLots: 0,
      totalMeters: 0,
      totalShots: 0,
      totalPieces: 0,
      totalPressRuns: 0,
      totalImagesCount: 0,
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

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [factory, setFactory] = useState("");
  const [machine, setMachine] = useState("");
  const [materialSeiban, setMaterialSeiban] = useState("");
  const [search, setSearch] = useState("");
  const [selectedImageModal, setSelectedImageModal] = useState(null);

  // Tab: 'cards' | 'table'
  const [activeTab, setActiveTab] = useState("cards");
  const [expandedLots, setExpandedLots] = useState(new Set());

  // Pagination for Runs Table
  const [runsPage, setRunsPage] = useState(1);
  const [runsPerPage, setRunsPerPage] = useState(25);

  // Fetch Data
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchMaterialLotAnalytics({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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
    loadData();
  }, [startDate, endDate, factory, machine, materialSeiban]);

  // Handle Search Debounce / Submit
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    loadData();
  };

  // Preset Date Handlers
  const handlePresetRange = (days) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(today));
  };

  const handleThisMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setFactory("");
    setMachine("");
    setMaterialSeiban("");
    setSearch("");
  };

  // Toggle Lot Expansion in Lot View
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

  // Expand all / Collapse all lots
  const expandAllLots = () => {
    setExpandedLots(new Set(data.lots.map((l) => l.key || l.lotNumber)));
  };

  const collapseAllLots = () => {
    setExpandedLots(new Set());
  };

  // Filtered Lots & Runs in Frontend
  const filteredLots = useMemo(() => {
    if (!search.trim()) return data.lots;
    const q = search.trim().toLowerCase();
    return data.lots.filter((lot) => {
      return (
        (lot.displayTitle && lot.displayTitle.toLowerCase().includes(q)) ||
        lot.lotNumber.toLowerCase().includes(q) ||
        (lot.materialSeiban && lot.materialSeiban.toLowerCase().includes(q)) ||
        (lot.materialHinban && lot.materialHinban.toLowerCase().includes(q)) ||
        (lot.materialName && lot.materialName.toLowerCase().includes(q)) ||
        lot.machines.some((m) => m.toLowerCase().includes(q)) ||
        (lot.products || []).some((p) => p.seiban?.toLowerCase().includes(q) || p.hinban?.toLowerCase().includes(q) || p.productName?.toLowerCase().includes(q)) ||
        lot.workers.some((w) => w.toLowerCase().includes(q)) ||
        lot.factories.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [data.lots, search]);

  const filteredRuns = useMemo(() => {
    if (!search.trim()) return data.runs;
    const q = search.trim().toLowerCase();
    return data.runs.filter((run) => {
      return (
        run.lotNumber.toLowerCase().includes(q) ||
        (run.materialSeiban && run.materialSeiban.toLowerCase().includes(q)) ||
        (run.materialHinban && run.materialHinban.toLowerCase().includes(q)) ||
        (run.materialName && run.materialName.toLowerCase().includes(q)) ||
        run.machine.toLowerCase().includes(q) ||
        run.hinban.toLowerCase().includes(q) ||
        run.seiban.toLowerCase().includes(q) ||
        run.worker.toLowerCase().includes(q) ||
        run.factory.toLowerCase().includes(q) ||
        (run.comment && run.comment.toLowerCase().includes(q))
      );
    });
  }, [data.runs, search]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      isJa ? "材料ロット番号" : "Material Lot Number",
      isJa ? "材料背番号" : "Material Seiban",
      isJa ? "材料品番" : "Material Hinban",
      isJa ? "材料名" : "Material Name",
      isJa ? "製品背番号" : "Product Seiban",
      isJa ? "製品品番" : "Product Hinban",
      isJa ? "品名" : "Product Name",
      isJa ? "設備" : "Machine",
      isJa ? "工場" : "Factory",
      isJa ? "日付" : "Date",
      isJa ? "開始時刻" : "Time Start",
      isJa ? "終了時刻" : "Time End",
      isJa ? "作業者" : "Worker",
      isJa ? "使用メーター数 (m)" : "Meters (m)",
      isJa ? "ショット数" : "Shots",
      isJa ? "生産個数" : "Pieces",
      isJa ? "送りピッチ (mm)" : "Feed Pitch (mm)",
      isJa ? "取り数" : "PC Per Cycle",
      isJa ? "不良数" : "Total NG",
      isJa ? "コメント" : "Comment",
      isJa ? "ラベル写真数" : "Label Photos Count",
    ];

    const rows = filteredRuns.map((r) => [
      `"${r.lotNumber || ""}"`,
      `"${r.materialSeiban || ""}"`,
      `"${r.materialHinban || ""}"`,
      `"${r.materialName || ""}"`,
      `"${r.seiban || ""}"`,
      `"${r.hinban || ""}"`,
      `"${(r.productName || "").replace(/"/g, '""')}"`,
      `"${r.machine || ""}"`,
      `"${r.factory || ""}"`,
      `"${r.date || ""}"`,
      `"${r.timeStart || ""}"`,
      `"${r.timeEnd || ""}"`,
      `"${r.worker || ""}"`,
      r.meters || 0,
      r.shots || 0,
      r.pieces || 0,
      r.feedPitch || "",
      r.pcPerCycle || "",
      r.totalNg || 0,
      `"${(r.comment || "").replace(/"/g, '""')}"`,
      (r.materialLabelImages || []).length,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `material_lot_traceability_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Runs Pagination
  const totalRunsPages = Math.ceil(filteredRuns.length / runsPerPage) || 1;
  const paginatedRuns = useMemo(() => {
    const start = (runsPage - 1) * runsPerPage;
    return filteredRuns.slice(start, start + runsPerPage);
  }, [filteredRuns, runsPage, runsPerPage]);

  return (
    <section className="h-screen overflow-y-auto px-6 pb-16 pt-24 scrollbar-hide md:px-8">
      {/* Header */}
      <PageHeader
        eyebrow={isJa ? "材料分析・トレーサビリティ" : "Material Analytics & Traceability"}
        eyebrowClassName="text-xs tracking-[0.18em]"
        title={isJa ? "材料ロット使用実績・分析" : "Material Lot Analytics"}
        className="mb-6"
        actionsClassName="flex-wrap items-center gap-2.5"
        actions={(
          <>
            <button
              type="button"
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container-high active:scale-95 shadow-xs"
            >
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>file_export</span>
              {isJa ? "CSV出力" : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface transition-all duration-150 hover:border-primary/30 hover:bg-surface-container-high active:scale-95 shadow-xs"
            >
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>refresh</span>
              {isJa ? "更新" : "Refresh"}
            </button>
          </>
        )}
      />

      {/* KPI Stats Grid */}
      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatSummaryCard
          title={isJa ? "材料ロット数" : "Material Lots"}
          value={`${formatNumber(data.summary.totalDistinctLots)}`}
          icon="inventory_2"
          tone="primary"
          subtitle={isJa ? "Lot_Details登録済みロット" : "Tracked material lots"}
        />
        <StatSummaryCard
          title={isJa ? "総消費メーター数" : "Total Meters Used"}
          value={`${formatNumber(data.summary.totalMeters)} m`}
          icon="straighten"
          tone="emerald"
          subtitle={isJa ? "材料ロール消費量" : "Total length consumed"}
        />
        <StatSummaryCard
          title={isJa ? "総ショット数" : "Total Press Shots"}
          value={`${formatNumber(data.summary.totalShots)}`}
          icon="offline_bolt"
          tone="amber"
          subtitle={isJa ? "金型ストローク総数" : "Total die stroke cycles"}
        />
        <StatSummaryCard
          title={isJa ? "総生産数量" : "Total Pieces"}
          value={`${formatNumber(data.summary.totalPieces)}`}
          icon="widgets"
          tone="blue"
          subtitle={isJa ? "加工完了製品ピース数" : "Finished parts produced"}
        />
        <StatSummaryCard
          title={isJa ? "材料種別 / 証拠写真" : "Material Types / Photos"}
          value={`${formatNumber(data.filterOptions.materialSeibans?.length || 0)} / ${formatNumber(data.summary.totalImagesCount)}`}
          icon="photo_camera"
          tone="purple"
          subtitle={isJa ? "材料背番号種別 / ラベル写真" : "Material codes / Label photos"}
        />
      </div>

      {/* Filter Card */}
      <div className="glass-card rounded-2xl p-5 relative z-20 mb-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3.5">
          {/* Search Box */}
          <div className="min-w-[260px] flex-1">
            <FormField label={isJa ? "キーワード検索 (ロット番号・材料背番号・品番・設備・作業者)" : "Search (Lot #, Material Code, Hinban, Machine, Worker)"}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit(e)}
                  placeholder={isJa ? "例: 260820-21, E1CM, 4TD, OZNC08, ベンジー..." : "e.g. 260820-21, E1CM, 4TD, OZNC08..."}
                  className="h-10 w-full rounded-xl border border-separator/40 bg-surface-container pl-9 pr-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
                />
              </div>
            </FormField>
          </div>

          {/* Material Seiban Selector */}
          <div className="min-w-[160px]">
            <FormField label={isJa ? "材料背番号 (Material)" : "Material Seiban"}>
              <select
                value={materialSeiban}
                onChange={(e) => setMaterialSeiban(e.target.value)}
                className="h-10 w-full rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40 font-mono"
              >
                <option value="">{isJa ? "すべての材料背番号" : "All Material Codes"}</option>
                {(data.filterOptions.materialSeibans || []).map((ms) => (
                  <option key={ms} value={ms}>{ms}</option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Factory Selector */}
          <div className="min-w-[130px]">
            <FormField label={isJa ? "工場" : "Factory"}>
              <select
                value={factory}
                onChange={(e) => setFactory(e.target.value)}
                className="h-10 w-full rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
              >
                <option value="">{isJa ? "すべての工場" : "All Factories"}</option>
                {(data.filterOptions.factories || []).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Machine Selector */}
          <div className="min-w-[140px]">
            <FormField label={isJa ? "設備" : "Machine"}>
              <select
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                className="h-10 w-full rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40 font-mono"
              >
                <option value="">{isJa ? "すべての設備" : "All Machines"}</option>
                {(data.filterOptions.machines || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Date Range Inputs */}
          <FormField label={isJa ? "開始日" : "From Date"}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            />
          </FormField>

          <FormField label={isJa ? "終了日" : "To Date"}>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 rounded-xl border border-separator/40 bg-surface-container px-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
            />
          </FormField>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => handlePresetRange(7)}
              className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high active:scale-95"
            >
              {isJa ? "7日間" : "7 Days"}
            </button>
            <button
              type="button"
              onClick={() => handlePresetRange(30)}
              className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high active:scale-95"
            >
              {isJa ? "30日間" : "30 Days"}
            </button>
            <button
              type="button"
              onClick={handleThisMonth}
              className="rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high active:scale-95"
            >
              {isJa ? "今月" : "This Month"}
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs font-semibold text-outline transition hover:bg-surface-container-high hover:text-on-surface active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
              {isJa ? "リセット" : "Reset"}
            </button>
          </div>
        </div>
      </div>

      {/* View Switcher & Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-separator/40 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "cards"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dashboard</span>
            <span>{isJa ? `材料ロット別カード (${filteredLots.length})` : `By Material Lot Cards (${filteredLots.length})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "table"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_rows</span>
            <span>{isJa ? `実績明細一覧 (${filteredRuns.length})` : `Detailed Runs Table (${filteredRuns.length})`}</span>
          </button>
        </div>

        {activeTab === "cards" && filteredLots.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAllLots}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-outline hover:text-on-surface transition"
            >
              {isJa ? "すべて展開" : "Expand All"}
            </button>
            <button
              type="button"
              onClick={collapseAllLots}
              className="rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-outline hover:text-on-surface transition"
            >
              {isJa ? "すべて折りたたむ" : "Collapse All"}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-32 text-outline">
          <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 36 }}>progress_activity</span>
          <span className="text-sm font-semibold">{isJa ? "材料ロット使用データを集計中…" : "Calculating material lot usage analytics…"}</span>
        </div>
      ) : filteredLots.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-outline border border-dashed border-outline-variant/30 rounded-2xl">
          <span className="material-symbols-outlined" style={{ fontSize: 44 }}>find_in_page</span>
          <p className="text-base font-bold text-on-surface">{isJa ? "該当する材料ロット実績が見つかりませんでした" : "No material lot records match your criteria"}</p>
          <p className="text-xs text-outline">{isJa ? "期間やフィルター条件を変更して再度検索してください。" : "Try adjusting date ranges or search terms."}</p>
        </div>
      ) : activeTab === "cards" ? (
        /* ================= CARD-BASED LOTS VIEW ================= */
        <div className="space-y-4">
          {filteredLots.map((lot) => {
            const lotKey = lot.key || lot.lotNumber;
            const isExpanded = expandedLots.has(lotKey);
            const matSeiban = lot.materialSeiban && lot.materialSeiban !== "—" ? lot.materialSeiban : null;
            const matName = lot.materialName && lot.materialName !== "—" ? lot.materialName : null;
            const matHinban = lot.materialHinban && lot.materialHinban !== "—" ? lot.materialHinban : null;

            return (
              <div
                key={lotKey}
                className="overflow-hidden rounded-2xl border border-separator/40 bg-surface/90 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                {/* Lot Card Header Bar */}
                <div
                  onClick={() => toggleLotExpand(lotKey)}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 cursor-pointer select-none hover:bg-surface-container/30 transition-colors"
                >
                  {/* Left: Lot Number & Material Seiban Badge */}
                  <div className="flex items-center gap-3.5 min-w-[320px]">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-xs border border-primary/20">
                      <span className="material-symbols-outlined" style={{ fontSize: 26 }}>qr_code_2</span>
                    </div>
                    <div>
                      {/* Material Tag Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {matSeiban ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono shadow-xs">
                            <span className="material-symbols-outlined text-[13px]">texture</span>
                            <span>{isJa ? `材料: ${matSeiban}` : `Material: ${matSeiban}`}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-bold text-outline">
                            {isJa ? "材料情報未登録" : "Unmapped Material"}
                          </span>
                        )}

                        {matName && (
                          <span className="text-xs font-semibold text-outline truncate max-w-[200px]" title={matName}>
                            {matName}
                          </span>
                        )}

                        {lot.factories.length > 0 && (
                          <span className="rounded-md bg-surface-container px-2 py-0.5 text-[10px] font-bold text-outline">
                            {lot.factories.join(", ")}
                          </span>
                        )}
                      </div>

                      {/* Lot Number Title */}
                      <h3 className="text-xl font-black tracking-tight text-on-surface font-mono flex items-center gap-2">
                        <span>{lot.displayTitle || (matSeiban ? `${matSeiban} - ${lot.lotNumber}` : lot.lotNumber)}</span>
                        {matHinban && (
                          <span className="text-xs font-mono font-medium text-outline font-normal">
                            ({matHinban})
                          </span>
                        )}
                      </h3>
                    </div>
                  </div>

                  {/* Right: Key Summary Stat Badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Total Meters */}
                    <div className="flex flex-col items-end rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                        {isJa ? "使用メーター数" : "Meters Used"}
                      </span>
                      <span className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono">
                        {formatNumber(lot.totalMeters)} m
                      </span>
                    </div>

                    {/* Total Shots */}
                    <div className="flex flex-col items-end rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        {isJa ? "総ショット数" : "Total Shots"}
                      </span>
                      <span className="text-base font-black text-amber-700 dark:text-amber-300 font-mono">
                        {formatNumber(lot.totalShots)}
                      </span>
                    </div>

                    {/* Total Pieces */}
                    <div className="flex flex-col items-end rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2">
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                        {isJa ? "総生産数量" : "Total Pieces"}
                      </span>
                      <span className="text-base font-black text-blue-700 dark:text-blue-300 font-mono">
                        {formatNumber(lot.totalPieces)}
                      </span>
                    </div>

                    {/* Machines */}
                    <div className="flex flex-col items-end rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2">
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                        {isJa ? "使用設備" : "Machines"}
                      </span>
                      <span className="text-sm font-black text-purple-700 dark:text-purple-300 font-mono">
                        {lot.machines.join(", ") || "—"}
                      </span>
                    </div>

                    {/* Expand Arrow Button */}
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-outline hover:text-on-surface transition ml-1"
                    >
                      <span
                        className="material-symbols-outlined transition-transform duration-200"
                        style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      >
                        expand_more
                      </span>
                    </button>
                  </div>
                </div>

                {/* Product Chips Preview Bar */}
                <div className="px-5 py-2.5 bg-surface-container-low/40 border-t border-separator/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-outline flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>category</span>
                      <span>{isJa ? "加工製品 (背番号):" : "Stamped Products:"}</span>
                    </span>
                    {(lot.products || []).map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-separator/40 px-2.5 py-1 font-mono text-xs font-bold text-on-surface shadow-2xs"
                      >
                        <span className="text-primary font-black">{p.seiban || "—"}</span>
                        <span className="text-[10px] text-outline font-normal">({formatNumber(p.totalShots)} {isJa ? "回" : "shots"} • {formatNumber(p.totalMeters)}m)</span>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-outline text-[11px]">
                    <span>{isJa ? `加工実績: ${lot.runsCount}回` : `${lot.runsCount} runs`}</span>
                    <span>•</span>
                    <span>{isJa ? `作業者: ${lot.workers.join(", ") || "—"}` : `Workers: ${lot.workers.join(", ") || "—"}`}</span>
                    {lot.images && lot.images.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-primary font-bold">
                          <span className="material-symbols-outlined text-[13px]">photo_camera</span>
                          <span>{lot.images.length} {isJa ? "枚" : "photos"}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Details & Runs Table */}
                {isExpanded && (
                  <div className="border-t border-separator/40 bg-surface-container-lowest p-5 space-y-5">
                    {/* Material Label Images Gallery */}
                    {lot.images && lot.images.length > 0 && (
                      <div className="rounded-xl border border-separator/40 bg-surface p-4 space-y-2.5">
                        <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>photo_library</span>
                          <span>{isJa ? `材料ラベル添付写真 (${lot.images.length}枚)` : `Material Label Photos (${lot.images.length})`}</span>
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {lot.images.map((imgUrl, iIdx) => (
                            <button
                              key={iIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageModal(imgUrl);
                              }}
                              className="group relative h-24 w-24 overflow-hidden rounded-xl border border-separator/40 bg-surface hover:border-primary/50 transition active:scale-95 shadow-xs"
                            >
                              <img
                                src={imgUrl}
                                alt={`Material Label ${iIdx + 1}`}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>zoom_in</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Run-by-run Detailed Breakdown Cards & Table */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-outline uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>history</span>
                        <span>{isJa ? "このロットを使用した加工実績明細" : "Press Runs Breakdown for this Lot"}</span>
                      </p>

                      <div className="overflow-x-auto rounded-xl border border-separator/40 bg-surface shadow-xs">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-separator/40 bg-surface-container/60 text-outline uppercase font-semibold">
                            <tr>
                              <th className="px-4 py-2.5">{isJa ? "加工日時" : "Date & Time"}</th>
                              <th className="px-4 py-2.5">{isJa ? "設備" : "Machine"}</th>
                              <th className="px-4 py-2.5">{isJa ? "背番号 / 品番" : "Seiban / Hinban"}</th>
                              <th className="px-4 py-2.5">{isJa ? "品名" : "Product Name"}</th>
                              <th className="px-4 py-2.5">{isJa ? "作業者" : "Worker"}</th>
                              <th className="px-4 py-2.5 text-right">{isJa ? "使用メーター" : "Meters"}</th>
                              <th className="px-4 py-2.5 text-right">{isJa ? "ショット数" : "Shots"}</th>
                              <th className="px-4 py-2.5 text-right">{isJa ? "生産数" : "Pieces"}</th>
                              <th className="px-4 py-2.5">{isJa ? "送り/取り数" : "Pitch/PC"}</th>
                              <th className="px-4 py-2.5">{isJa ? "ラベル写真" : "Photos"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-separator/20">
                            {lot.runs.map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-surface-container/40 transition-colors">
                                <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                  <div className="font-bold">{r.date}</div>
                                  {r.timeStart && (
                                    <div className="text-[10px] text-outline font-mono">
                                      {r.timeStart} ~ {r.timeEnd || ""}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 font-bold text-primary font-mono whitespace-nowrap">
                                  {r.machine}
                                </td>
                                <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                  <span className="font-black text-sm text-on-surface font-mono mr-1.5">{r.seiban}</span>
                                  <span className="text-[10px] text-outline font-mono">({r.hinban})</span>
                                </td>
                                <td className="px-4 py-2.5 text-outline max-w-[200px] truncate" title={r.productName}>
                                  {r.productName || "—"}
                                </td>
                                <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                                  {r.worker}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-emerald-700 dark:text-emerald-300 font-mono whitespace-nowrap">
                                  {formatNumber(r.meters)} m
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-amber-700 dark:text-amber-300 font-mono whitespace-nowrap">
                                  {formatNumber(r.shots)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-blue-700 dark:text-blue-300 font-mono whitespace-nowrap">
                                  {formatNumber(r.pieces)}
                                </td>
                                <td className="px-4 py-2.5 text-outline whitespace-nowrap font-mono">
                                  {r.feedPitch ? `${r.feedPitch}mm` : "—"} / {r.pcPerCycle ? `${r.pcPerCycle}個` : "—"}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {r.materialLabelImages && r.materialLabelImages.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedImageModal(r.materialLabelImages[0])}
                                      className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition active:scale-95"
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                                      <span>{r.materialLabelImages.length} {isJa ? "枚" : "photos"}</span>
                                    </button>
                                  ) : (
                                    <span className="text-outline/40">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= DETAILED RUNS TABLE VIEW ================= */
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-separator/40 bg-surface shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-separator/40 bg-surface-container/60 text-outline uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">{isJa ? "材料ロット番号" : "Lot Number"}</th>
                  <th className="px-4 py-3">{isJa ? "材料背番号" : "Material Code"}</th>
                  <th className="px-4 py-3">{isJa ? "製品 (背番号/品番)" : "Product (Seiban/Hinban)"}</th>
                  <th className="px-4 py-3">{isJa ? "日付" : "Date"}</th>
                  <th className="px-4 py-3">{isJa ? "設備" : "Machine"}</th>
                  <th className="px-4 py-3">{isJa ? "作業者" : "Worker"}</th>
                  <th className="px-4 py-3 text-right">{isJa ? "使用メーター数" : "Meters"}</th>
                  <th className="px-4 py-3 text-right">{isJa ? "ショット数" : "Shots"}</th>
                  <th className="px-4 py-3 text-right">{isJa ? "生産数" : "Pieces"}</th>
                  <th className="px-4 py-3">{isJa ? "送り / 取り数" : "Pitch / PC"}</th>
                  <th className="px-4 py-3">{isJa ? "ラベル写真" : "Label Photos"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator/20">
                {paginatedRuns.map((r, idx) => (
                  <tr key={idx} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-black text-sm text-primary whitespace-nowrap">
                      {r.lotNumber}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      {r.materialSeiban && r.materialSeiban !== "—" ? (
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5">
                          {r.materialSeiban}
                        </span>
                      ) : (
                        <span className="text-outline/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <span className="font-black text-sm text-on-surface font-mono mr-1">{r.seiban}</span>
                      <span className="text-[10px] text-outline font-mono">({r.hinban})</span>
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <div>{r.date}</div>
                      {r.timeStart && <div className="text-[10px] text-outline font-mono">{r.timeStart} ~ {r.timeEnd}</div>}
                    </td>
                    <td className="px-4 py-3 font-bold text-on-surface font-mono whitespace-nowrap">
                      {r.machine}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {r.worker}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-700 dark:text-emerald-300 font-mono whitespace-nowrap">
                      {formatNumber(r.meters)} m
                    </td>
                    <td className="px-4 py-3 text-right font-black text-amber-700 dark:text-amber-300 font-mono whitespace-nowrap">
                      {formatNumber(r.shots)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-blue-700 dark:text-blue-300 font-mono whitespace-nowrap">
                      {formatNumber(r.pieces)}
                    </td>
                    <td className="px-4 py-3 text-outline whitespace-nowrap font-mono">
                      {r.feedPitch ? `${r.feedPitch}mm` : "—"} / {r.pcPerCycle ? `${r.pcPerCycle}個` : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.materialLabelImages && r.materialLabelImages.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedImageModal(r.materialLabelImages[0])}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition active:scale-95"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                          <span>{r.materialLabelImages.length} {isJa ? "枚" : "photos"}</span>
                        </button>
                      ) : (
                        <span className="text-outline/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-outline px-2">
            <div>
              {isJa
                ? `全 ${filteredRuns.length} 件中 ${(runsPage - 1) * runsPerPage + 1} - ${Math.min(runsPage * runsPerPage, filteredRuns.length)} 件を表示`
                : `Showing ${(runsPage - 1) * runsPerPage + 1} to ${Math.min(runsPage * runsPerPage, filteredRuns.length)} of ${filteredRuns.length} entries`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={runsPage <= 1}
                onClick={() => setRunsPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container text-outline hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <span className="font-bold text-on-surface px-2">
                {runsPage} / {totalRunsPages}
              </span>
              <button
                type="button"
                disabled={runsPage >= totalRunsPages}
                onClick={() => setRunsPage((p) => Math.min(totalRunsPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container text-outline hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImageModal && (
        <div
          onClick={() => setSelectedImageModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-white/20 bg-surface shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-separator/40 bg-surface-container/60 px-4 py-3">
              <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>photo_library</span>
                <span>{isJa ? "材料ラベル写真" : "Material Label Image"}</span>
              </h4>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container text-outline hover:text-on-surface transition"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto">
              <img
                src={selectedImageModal}
                alt="Material Label Full"
                className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
