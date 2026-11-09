import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ChartJS from "./chartSetup";
import { fetchEquipmentData } from "../../services/api";
import { calculateEquipmentAnalytics } from "./equipmentAnalyticsUtils";
import PartMachineComparisonModal from "./PartMachineComparisonModal";

/**
 * Generate a list of recent months (YYYY-MM)
 */
function getRecentMonths(count = 12) {
  const result = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    result.push(`${yyyy}-${mm}`);
  }
  return result;
}

function formatMonthLabel(ym, isJa) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return isJa
    ? `${y}年${Number(m)}月`
    : `${new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "short" })} ${y}`;
}

function getMonthEndDate(ym) {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}

export default function MachineMoMComparisonView({
  machine,
  factory,
  isJa = true,
  onOpenRecord,
}) {
  const availableMonths = useMemo(() => getRecentMonths(18), []);

  // Month A: Target (Defaults to current month)
  // Month B: Baseline (Defaults to previous month)
  const [monthA, setMonthA] = useState(() => availableMonths[0] || "2026-09");
  const [monthB, setMonthB] = useState(() => availableMonths[1] || "2026-08");

  const navigate = useNavigate();

  // Chart mode: "cumulative" (Pace) vs "daily" (Side-by-side)
  const [chartMode, setChartMode] = useState("cumulative");

  // Cross-machine part comparison state (single object or array of objects)
  const [selectedPartForComparison, setSelectedPartForComparison] = useState(null);

  // Multi-part selection state: Array<{ hinban, seiban }>
  const [selectedMultiParts, setSelectedMultiParts] = useState([]);

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recordsA, setRecordsA] = useState([]);
  const [recordsB, setRecordsB] = useState([]);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Reset multi-part selection on machine or months change
  useEffect(() => {
    setSelectedMultiParts([]);
  }, [machine, monthA, monthB]);

  // Swap months
  const handleSwapMonths = () => {
    setMonthA(monthB);
    setMonthB(monthA);
  };

  const handleToggleSelectPart = (p) => {
    setSelectedMultiParts((prev) => {
      const exists = prev.some((item) => item.hinban === p.hinban && item.seiban === p.seiban);
      if (exists) {
        return prev.filter((item) => !(item.hinban === p.hinban && item.seiban === p.seiban));
      }
      return [...prev, { hinban: p.hinban, seiban: p.seiban }];
    });
  };

  const handleSelectAllParts = () => {
    if (selectedMultiParts.length === partMixComparison.length) {
      setSelectedMultiParts([]);
    } else {
      setSelectedMultiParts(partMixComparison.map((p) => ({ hinban: p.hinban, seiban: p.seiban })));
    }
  };

  // Fetch records for both months
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!machine || !monthA || !monthB) return;
      setLoading(true);
      setError(null);

      try {
        const startA = `${monthA}-01`;
        const endA = getMonthEndDate(monthA);
        const startB = `${monthB}-01`;
        const endB = getMonthEndDate(monthB);

        const overallStart = startA < startB ? startA : startB;
        const overallEnd = endA > endB ? endA : endB;

        const res = await fetchEquipmentData({
          startDate: overallStart,
          endDate: overallEnd,
          equipment: [machine],
        });

        if (cancelled) return;

        if (res?.success && Array.isArray(res.data)) {
          const allRecs = res.data;
          const aList = allRecs.filter((r) => String(r.Date || "").startsWith(monthA));
          const bList = allRecs.filter((r) => String(r.Date || "").startsWith(monthB));
          setRecordsA(aList);
          setRecordsB(bList);
        } else {
          setRecordsA([]);
          setRecordsB([]);
          if (res?.message) setError(res.message);
        }
      } catch (err) {
        console.error("Failed to fetch MoM data:", err);
        if (!cancelled) setError(err.message || "Failed to load comparison data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [machine, monthA, monthB]);

  // Calculate analytics
  const analyticsA = useMemo(() => calculateEquipmentAnalytics(recordsA), [recordsA]);
  const analyticsB = useMemo(() => calculateEquipmentAnalytics(recordsB), [recordsB]);

  // Delta calculations
  const deltas = useMemo(() => {
    const shotsA = analyticsA.totalShots || 0;
    const shotsB = analyticsB.totalShots || 0;
    const diffShots = shotsA - shotsB;
    const pctShots =
      shotsB > 0
        ? ((diffShots / shotsB) * 100).toFixed(1)
        : shotsA > 0
        ? "+100"
        : "0.0";

    const avgA = analyticsA.avgShotsPerDay || 0;
    const avgB = analyticsB.avgShotsPerDay || 0;
    const diffAvg = Number((avgA - avgB).toFixed(1));

    const hoursA = analyticsA.workingHours || 0;
    const hoursB = analyticsB.workingHours || 0;
    const diffHours = Number((hoursA - hoursB).toFixed(1));

    const defRateA = analyticsA.defectRate || 0;
    const defRateB = analyticsB.defectRate || 0;
    const diffDefRate = Number((defRateA - defRateB).toFixed(2));

    return {
      diffShots,
      pctShots,
      diffAvg,
      diffHours,
      diffDefRate,
    };
  }, [analyticsA, analyticsB]);

  // Day-by-day trajectory data (Days 1..31)
  const trajectoryData = useMemo(() => {
    const today = new Date();
    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const isCurrentMonthA = monthA === currentYM;
    const currentDay = today.getDate();

    // Group by day of month
    const shotsPerDayA = {};
    const shotsPerDayB = {};

    recordsA.forEach((r) => {
      if (!r.Date) return;
      const dayNum = parseInt(r.Date.slice(8, 10), 10);
      if (dayNum >= 1 && dayNum <= 31) {
        shotsPerDayA[dayNum] = (shotsPerDayA[dayNum] || 0) + Number(r["ショット数"] || 0);
      }
    });

    recordsB.forEach((r) => {
      if (!r.Date) return;
      const dayNum = parseInt(r.Date.slice(8, 10), 10);
      if (dayNum >= 1 && dayNum <= 31) {
        shotsPerDayB[dayNum] = (shotsPerDayB[dayNum] || 0) + Number(r["ショット数"] || 0);
      }
    });

    const labels = [];
    const dailyA = [];
    const dailyB = [];
    const cumA = [];
    const cumB = [];

    let sumA = 0;
    let sumB = 0;

    for (let d = 1; d <= 31; d++) {
      labels.push(`${d}${isJa ? "日" : ""}`);

      const sA = shotsPerDayA[d] || 0;
      const sB = shotsPerDayB[d] || 0;

      dailyB.push(sB);
      sumB += sB;
      cumB.push(sumB);

      // If Month A is the current month and day is in the future, don't plot future zero-lines
      if (isCurrentMonthA && d > currentDay) {
        dailyA.push(null);
        cumA.push(null);
      } else {
        dailyA.push(sA);
        sumA += sA;
        cumA.push(sumA);
      }
    }

    return {
      labels,
      dailyA,
      dailyB,
      cumA,
      cumB,
    };
  }, [recordsA, recordsB, monthA, isJa]);

  // Render Trajectory Chart
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    const ctx = chartCanvasRef.current.getContext("2d");

    const existing = ChartJS.getChart(chartCanvasRef.current);
    if (existing) existing.destroy();
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labelA = formatMonthLabel(monthA, isJa);
    const labelB = formatMonthLabel(monthB, isJa);

    if (chartMode === "cumulative") {
      chartInstanceRef.current = new ChartJS(ctx, {
        type: "line",
        data: {
          labels: trajectoryData.labels,
          datasets: [
            {
              label: `${labelA} (${isJa ? "対象月" : "Target"})`,
              data: trajectoryData.cumA,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderWidth: 2.5,
              pointRadius: 2.5,
              pointHoverRadius: 5,
              tension: 0.25,
              fill: true,
            },
            {
              label: `${labelB} (${isJa ? "比較月" : "Baseline"})`,
              data: trajectoryData.cumB,
              borderColor: "#a855f7",
              backgroundColor: "transparent",
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 2,
              pointHoverRadius: 4,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              position: "top",
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                font: { size: 11, weight: "bold" },
              },
            },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              titleColor: "#ffffff",
              bodyColor: "#f1f5f9",
              borderColor: "rgba(59, 130, 246, 0.4)",
              borderWidth: 1,
              padding: 10,
              cornerRadius: 6,
              callbacks: {
                label: (item) => {
                  const val = item.raw;
                  if (val == null) return null;
                  return `  ${item.dataset.label}: ${Number(val).toLocaleString()} shots`;
                },
                afterBody: (items) => {
                  const valA = items[0]?.raw;
                  const valB = items[1]?.raw;
                  if (valA != null && valB != null) {
                    const diff = valA - valB;
                    const sign = diff >= 0 ? "+" : "";
                    return [
                      "",
                      `  ${isJa ? "累積差異" : "Variance"}: ${sign}${Number(diff).toLocaleString()} shots`,
                    ];
                  }
                  return [];
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(148, 163, 184, 0.12)" },
              ticks: {
                callback: (val) => `${Number(val).toLocaleString()}`,
                font: { size: 10 },
              },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, maxRotation: 0 },
            },
          },
        },
      });
    } else {
      // Daily side-by-side bar comparison
      chartInstanceRef.current = new ChartJS(ctx, {
        type: "bar",
        data: {
          labels: trajectoryData.labels,
          datasets: [
            {
              label: `${labelA} (${isJa ? "対象月" : "Target"})`,
              data: trajectoryData.dailyA,
              backgroundColor: "rgba(59, 130, 246, 0.8)",
              borderColor: "#3b82f6",
              borderWidth: 1,
              borderRadius: 3,
            },
            {
              label: `${labelB} (${isJa ? "比較月" : "Baseline"})`,
              data: trajectoryData.dailyB,
              backgroundColor: "rgba(168, 85, 247, 0.7)",
              borderColor: "#a855f7",
              borderWidth: 1,
              borderRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { boxWidth: 12, font: { size: 11, weight: "bold" } },
            },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              callbacks: {
                label: (item) => {
                  if (item.raw == null) return null;
                  return `  ${item.dataset.label}: ${Number(item.raw).toLocaleString()} shots`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "rgba(148, 163, 184, 0.12)" },
              ticks: {
                callback: (val) => `${Number(val).toLocaleString()}`,
                font: { size: 10 },
              },
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 10 }, maxRotation: 0 },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [trajectoryData, chartMode, monthA, monthB, isJa]);

  // Part Mix Shift breakdown
  const partMixComparison = useMemo(() => {
    const partMap = new Map();

    const addRecord = (r, isMonthA) => {
      const hinban = r["品番"] || "Unknown";
      const seiban = r["背番号"] || "";
      const key = `${hinban}__${seiban}`;

      if (!partMap.has(key)) {
        partMap.set(key, {
          hinban,
          seiban,
          shotsA: 0,
          shotsB: 0,
          qtyA: 0,
          qtyB: 0,
          sampleRecord: r,
        });
      }

      const entry = partMap.get(key);
      const shots = Number(r["ショット数"] || 0);
      const qty = Number(r.Process_Quantity || 0);

      if (isMonthA) {
        entry.shotsA += shots;
        entry.qtyA += qty;
      } else {
        entry.shotsB += shots;
        entry.qtyB += qty;
      }
    };

    recordsA.forEach((r) => addRecord(r, true));
    recordsB.forEach((r) => addRecord(r, false));

    const totalA = analyticsA.totalShots || 1;
    const totalB = analyticsB.totalShots || 1;

    const list = Array.from(partMap.values()).map((p) => {
      const diffShots = p.shotsA - p.shotsB;
      const shareA = totalA > 0 ? (p.shotsA / totalA) * 100 : 0;
      const shareB = totalB > 0 ? (p.shotsB / totalB) * 100 : 0;
      const shareDiff = shareA - shareB;
      return {
        ...p,
        diffShots,
        shareA: shareA.toFixed(1),
        shareB: shareB.toFixed(1),
        shareDiff: shareDiff.toFixed(1),
      };
    });

    // Sort by largest production volume in month A
    list.sort((a, b) => Math.max(b.shotsA, b.shotsB) - Math.max(a.shotsA, a.shotsB));
    return list;
  }, [recordsA, recordsB, analyticsA.totalShots, analyticsB.totalShots]);

  return (
    <div className="space-y-6">
      {/* ── Month Selection Bar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]/70 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[var(--freya-blue)]">
              calendar_month
            </span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {isJa ? "対象月 (当月):" : "Target Month:"}
            </span>
            <select
              value={monthA}
              onChange={(e) => setMonthA(e.target.value)}
              className="freya-input h-8 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
            >
              {availableMonths.map((ym, idx) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym, isJa)} {idx === 0 ? (isJa ? "(当月)" : "(Current)") : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwapMonths}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
            title={isJa ? "比較対象を入れ替え" : "Swap Months"}
          >
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)]">vs</span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {isJa ? "比較月 (先月):" : "Baseline Month:"}
            </span>
            <select
              value={monthB}
              onChange={(e) => setMonthB(e.target.value)}
              className="freya-input h-8 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
            >
              {availableMonths.map((ym, idx) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym, isJa)} {idx === 1 ? (isJa ? "(前月)" : "(Prev)") : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading status or record counts */}
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {loading ? (
            <span className="flex items-center gap-1 text-[var(--freya-blue)]">
              <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
              <span>{isJa ? "集計中..." : "Calculating..."}</span>
            </span>
          ) : (
            <span className="font-mono">
              {formatMonthLabel(monthA, isJa)} ({recordsA.length} {isJa ? "件" : "records"}) vs{" "}
              {formatMonthLabel(monthB, isJa)} ({recordsB.length} {isJa ? "件" : "records"})
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Variance / Delta KPI Comparison Cards ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Total Shots Delta */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {isJa ? "総ショット数" : "Total Shots"}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[11px] font-bold ${
                deltas.diffShots >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">
                {deltas.diffShots >= 0 ? "trending_up" : "trending_down"}
              </span>
              <span>{deltas.diffShots >= 0 ? `+${deltas.pctShots}%` : `${deltas.pctShots}%`}</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {(analyticsA.totalShots || 0).toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              vs {(analyticsB.totalShots || 0).toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] font-mono">
            {isJa ? "差分:" : "Variance:"}{" "}
            <span className={deltas.diffShots >= 0 ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>
              {deltas.diffShots >= 0 ? `+${deltas.diffShots.toLocaleString()}` : deltas.diffShots.toLocaleString()}
            </span>{" "}
            shots
          </p>
        </div>

        {/* 2. Avg Shots / Day Delta */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {isJa ? "稼働日平均ショット" : "Avg Shots / Day"}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[11px] font-bold ${
                deltas.diffAvg >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              {deltas.diffAvg >= 0 ? `+${deltas.diffAvg}` : deltas.diffAvg}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {(analyticsA.avgShotsPerDay || 0).toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              vs {(analyticsB.avgShotsPerDay || 0).toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {analyticsA.totalDays || 0} {isJa ? "稼働日" : "days"} vs {analyticsB.totalDays || 0}{" "}
            {isJa ? "稼働日" : "days"}
          </p>
        </div>

        {/* 3. Working Hours Delta */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {isJa ? "実稼働時間" : "Working Hours"}
            </span>
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              {deltas.diffHours >= 0 ? `+${deltas.diffHours}h` : `${deltas.diffHours}h`}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {analyticsA.workingHours || 0}
              <span className="text-xs font-medium ml-0.5">h</span>
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              vs {analyticsB.workingHours || 0}h
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {isJa ? "1日平均:" : "Daily avg:"} {analyticsA.avgWorkingHoursPerDay || 0}h vs{" "}
            {analyticsB.avgWorkingHoursPerDay || 0}h
          </p>
        </div>

        {/* 4. Defect Rate Delta (Lower is better!) */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {isJa ? "不良率" : "Defect Rate"}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[11px] font-bold ${
                deltas.diffDefRate <= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              {deltas.diffDefRate <= 0 ? `${deltas.diffDefRate}% (改善)` : `+${deltas.diffDefRate}%`}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {analyticsA.defectRate || 0}%
            </span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              vs {analyticsB.defectRate || 0}%
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {isJa ? "不良数:" : "NG count:"} {(analyticsA.totalDefects || 0).toLocaleString()} vs{" "}
            {(analyticsB.totalDefects || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── Day-by-Day Pace Chart (Cumulative vs Daily) ────────────────── */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {chartMode === "cumulative"
                ? isJa
                  ? "日次累積生産ペース比較 (ペース軌跡)"
                  : "Cumulative Production Pace Trajectory"
                : isJa
                ? "日別ショット数 比較 (日次実績)"
                : "Daily Shot Count Comparison"}
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {chartMode === "cumulative"
                ? isJa
                  ? "同じ経過日数時点における累計ショット数を比較し、前月に対する進捗ペースを可視化します。"
                  : "Compare cumulative production day-by-day to see if the machine is ahead or behind pace."
                : isJa
                ? "各日（1日〜31日）のショット数を左右比較します。"
                : "Side-by-side comparison for each calendar day."}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChartMode("cumulative")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                chartMode === "cumulative"
                  ? "bg-[var(--freya-blue)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isJa ? "累積ペース" : "Cumulative Pace"}
            </button>
            <button
              type="button"
              onClick={() => setChartMode("daily")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                chartMode === "daily"
                  ? "bg-[var(--freya-blue)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isJa ? "日別比較" : "Daily Bars"}
            </button>
          </div>
        </div>

        <div className="h-64 w-full relative">
          <canvas ref={chartCanvasRef} />
        </div>
      </div>

      {/* ── Part Mix Shift Breakdown Table ────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              {isJa ? "生産品番・背番号 内訳比較 (品目シフト)" : "Part Number & Model Mix Shift"}
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isJa
                ? "本設備で両月に生産された品番ごとのショット数およびシェアの変化を確認します。"
                : "Compare shot volume and production share per part number between periods."}
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {partMixComparison.length} {isJa ? "品番" : "parts"}
          </span>
        </div>

        {/* Multi-Part Selection Floating Action Bar */}
        {selectedMultiParts.length > 0 && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[var(--freya-blue)]">
                checklist
              </span>
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {selectedMultiParts.length} {isJa ? "品番を選択中" : "parts selected"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const hinbans = selectedMultiParts.map((p) => p.hinban).join(",");
                  const seibans = selectedMultiParts.map((p) => p.seiban || "").join(",");
                  navigate(`/analytics/parts?hinban=${encodeURIComponent(hinbans)}&seiban=${encodeURIComponent(seibans)}`);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--freya-blue)] text-white hover:opacity-90 transition shadow-xs cursor-pointer"
              >
                <span>{isJa ? "全画面で横断比較" : "Benchmark in Full View"}</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPartForComparison(selectedMultiParts)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition shadow-2xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">view_in_ar</span>
                <span>{isJa ? "モーダルで比較" : "Compare in Modal"}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMultiParts([])}
                className="text-xs text-[var(--text-muted)] hover:text-rose-500 font-semibold px-2 py-1 transition cursor-pointer"
              >
                {isJa ? "選択解除" : "Deselect"}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold select-none">
              <tr>
                <th className="w-9 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={partMixComparison.length > 0 && selectedMultiParts.length === partMixComparison.length}
                    onChange={handleSelectAllParts}
                    className="rounded border-[var(--border)] text-[var(--freya-blue)] focus:ring-[var(--freya-blue)] cursor-pointer"
                    title={isJa ? "すべて選択 / 解除" : "Select / Deselect all"}
                  />
                </th>
                <th className="px-3 py-2.5">{isJa ? "品番" : "Part Number"}</th>
                <th className="px-3 py-2.5">{isJa ? "背番号" : "Back No"}</th>
                <th className="px-3 py-2.5 text-right">
                  {formatMonthLabel(monthA, isJa)} ({isJa ? "ショット" : "Shots"})
                </th>
                <th className="px-3 py-2.5 text-right">
                  {formatMonthLabel(monthB, isJa)} ({isJa ? "ショット" : "Shots"})
                </th>
                <th className="px-3 py-2.5 text-right">{isJa ? "ショット差分 (Δ)" : "Variance (Δ)"}</th>
                <th className="px-3 py-2.5 text-right">{isJa ? "シェア変化" : "Share Shift"}</th>
                <th className="px-3 py-2.5 text-center">{isJa ? "全設備比較" : "Benchmark"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-primary)]">
              {partMixComparison.length > 0 ? (
                partMixComparison.map((p) => {
                  const diff = p.diffShots;
                  const isPositive = diff >= 0;
                  const isChecked = selectedMultiParts.some(
                    (item) => item.hinban === p.hinban && item.seiban === p.seiban
                  );

                  return (
                    <tr
                      key={`${p.hinban}-${p.seiban}`}
                      className={`hover:bg-blue-500/5 dark:hover:bg-blue-500/10 transition-colors group ${
                        isChecked ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="w-9 px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectPart(p)}
                          className="rounded border-[var(--border)] text-[var(--freya-blue)] focus:ring-[var(--freya-blue)] cursor-pointer"
                        />
                      </td>
                      <td 
                        onClick={() => setSelectedPartForComparison({ hinban: p.hinban, seiban: p.seiban })}
                        className="px-3 py-2 font-mono whitespace-nowrap font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        title={isJa ? "クリックして全設備比較モーダルを開く" : "Click to benchmark across machines"}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{p.hinban}</span>
                          <svg className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {p.seiban ? (
                          <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 border border-[var(--border)]">
                            {p.seiban}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                        {p.shotsA > 0 ? p.shotsA.toLocaleString() : "—"}
                        {p.shotsA > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)] font-normal ml-1">
                            ({p.shareA}%)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                        {p.shotsB > 0 ? p.shotsB.toLocaleString() : "—"}
                        {p.shotsB > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)] font-normal ml-1">
                            ({p.shareB}%)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                        <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}>
                          {isPositive ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        <span
                          className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                            Number(p.shareDiff) >= 0
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-slate-500/10 text-[var(--text-muted)]"
                          }`}
                        >
                          {Number(p.shareDiff) >= 0 ? `+${p.shareDiff}%` : `${p.shareDiff}%`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPartForComparison({ hinban: p.hinban, seiban: p.seiban })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:border-blue-500/30 transition-colors shadow-xs"
                            title={isJa ? `この品番 (${p.hinban}) を他設備と比較` : `Compare ${p.hinban} across machines`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>{isJa ? "他設備比較" : "Compare"}</span>
                          </button>
                          {p.sampleRecord && (
                            <button
                              type="button"
                              onClick={() => onOpenRecord?.(p.sampleRecord)}
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
                              title={isJa ? "この設備の直近実績詳細を開く" : "View latest record details"}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                    {isJa ? "生産品目データがありません" : "No part records found for selected months"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cross-Machine Part Comparison Modal ── */}
      {selectedPartForComparison && (
        <PartMachineComparisonModal
          isOpen={!!selectedPartForComparison}
          onClose={() => setSelectedPartForComparison(null)}
          parts={Array.isArray(selectedPartForComparison) ? selectedPartForComparison : undefined}
          hinban={Array.isArray(selectedPartForComparison) ? undefined : selectedPartForComparison.hinban}
          seiban={Array.isArray(selectedPartForComparison) ? undefined : selectedPartForComparison.seiban}
          monthA={monthA}
          monthB={monthB}
          isJa={isJa}
          zIndex="z-[10000]"
        />
      )}
    </div>
  );
}
