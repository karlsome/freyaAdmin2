import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import ChartJS from "./chartSetup";
import { fetchEquipmentData, fetchPartCrossMachineComparison, fetchMasterImage } from "../../services/api";
import { calculateEquipmentAnalytics, getFactoryBadgeStyle } from "./equipmentAnalyticsUtils";
import RecordDetailModal from "../RecordDetailModal";
import SensorDevicePhotoPreviewModal from "../SensorDevicePhotoPreviewModal";

function getMonthEndDate(ym) {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}

const PALETTE = [
  { bg: "rgba(59, 130, 246, 0.8)", border: "#3b82f6" },
  { bg: "rgba(168, 85, 247, 0.8)", border: "#a855f7" },
  { bg: "rgba(16, 185, 129, 0.8)", border: "#10b981" },
  { bg: "rgba(245, 158, 11, 0.8)", border: "#f59e0b" },
  { bg: "rgba(236, 72, 153, 0.8)", border: "#ec4899" },
  { bg: "rgba(14, 165, 233, 0.8)", border: "#0ea5e9" },
];

export default function PartMachineComparisonModal({
  isOpen,
  onClose,
  parts,
  hinban,
  seiban,
  monthA = "2026-09",
  monthB = "2026-08",
  isJa = true,
  zIndex = "z-[10000]",
}) {
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = useState("bothMonths");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });

  // Normalise parts array: Array<{ hinban, seiban }>
  const activeParts = useMemo(() => {
    if (Array.isArray(parts) && parts.length > 0) return parts;
    if (hinban) {
      const hList = String(hinban).split(",").map((h) => h.trim()).filter(Boolean);
      const sList = seiban ? String(seiban).split(",").map((s) => s.trim()) : [];
      return hList.map((h, i) => ({ hinban: h, seiban: sList[i] || "" }));
    }
    return [];
  }, [parts, hinban, seiban]);

  const [chartDisplayMode, setChartDisplayMode] = useState("stacked");

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);

  // Master product image state (for single part)
  const [productImage, setProductImage] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Expanded machine for inspecting individual records
  const [expandedMachine, setExpandedMachine] = useState(null);

  // Record Detail Modal
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (photoPreview) {
          setPhotoPreview(null);
        } else if (selectedRecordForDetail) {
          setSelectedRecordForDetail(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, photoPreview, selectedRecordForDetail]);

  // Load product image from masterDB if exactly 1 part
  useEffect(() => {
    if (!isOpen || activeParts.length !== 1) {
      setProductImage(null);
      setMasterData(null);
      setImageError(false);
      setImageLoading(false);
      return;
    }
    const single = activeParts[0];
    let cancelled = false;
    setImageLoading(true);
    setImageError(false);

    fetchMasterImage(single.hinban, single.seiban)
      .then((img) => {
        if (!cancelled) {
          setMasterData(img);
          const url = typeof img === "string" ? img : img?.imageURL || null;
          setProductImage(url);
          setImageLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProductImage(null);
          setMasterData(null);
          setImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeParts]);

  // Compute active date range
  const activeDateRange = useMemo(() => {
    if (datePreset === "monthA") {
      return { from: `${monthA}-01`, to: getMonthEndDate(monthA) };
    }
    if (datePreset === "monthB") {
      return { from: `${monthB}-01`, to: getMonthEndDate(monthB) };
    }
    if (datePreset === "bothMonths") {
      const start = monthA < monthB ? `${monthA}-01` : `${monthB}-01`;
      const endA = getMonthEndDate(monthA);
      const endB = getMonthEndDate(monthB);
      const end = endA > endB ? endA : endB;
      return { from: start, to: end };
    }
    if (datePreset === "last30Days") {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      return { from: past.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
    }
    if (datePreset === "last90Days") {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      return { from: past.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
    }
    if (datePreset === "allTime") {
      return { from: "2020-01-01", to: "2099-12-31" };
    }
    return customRange;
  }, [datePreset, monthA, monthB, customRange]);

  // Fetch records across all machines for active part(s)
  useEffect(() => {
    if (!isOpen || activeParts.length === 0) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let fetchedRecords = null;
        const partsPayload = activeParts.map((p) => ({
          hinban: p.hinban,
          seiban: p.seiban || undefined,
        }));

        try {
          // Try dedicated cross-machine endpoint first
          const dedicatedRes = await fetchPartCrossMachineComparison({
            parts: partsPayload,
            startDate: activeDateRange.from || undefined,
            endDate: activeDateRange.to || undefined,
          });
          if (dedicatedRes?.success && Array.isArray(dedicatedRes.records)) {
            fetchedRecords = dedicatedRes.records;
          }
        } catch {
          // Endpoint might not be running if server not restarted yet
        }

        if (!fetchedRecords) {
          // Fallback to fetchEquipmentData
          const res = await fetchEquipmentData({
            parts: partsPayload,
            startDate: activeDateRange.from || undefined,
            endDate: activeDateRange.to || undefined,
          });
          if (res?.success && Array.isArray(res.data)) {
            fetchedRecords = res.data;
          }
        }

        if (cancelled) return;

        if (fetchedRecords) {
          setRecords(fetchedRecords);
        } else {
          setRecords([]);
        }
      } catch (err) {
        console.error("Failed to load cross-machine part data:", err);
        if (!cancelled) setError(err.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeParts, activeDateRange]);

  // Group records by machine
  const machineStats = useMemo(() => {
    const map = new Map();

    records.forEach((r) => {
      const eq = r["設備"] || "Unknown";
      if (!map.has(eq)) {
        map.set(eq, {
          machine: eq,
          factory: r["工場"] || "",
          records: [],
          workers: new Set(),
          partsMap: new Map(),
        });
      }
      const entry = map.get(eq);
      entry.records.push(r);
      const worker = r.Worker_Name || r["作業者"] || r.worker || r.operator;
      if (worker) entry.workers.add(worker);
      if (!entry.factory && r["工場"]) entry.factory = r["工場"];

      // Track by part within this machine
      const h = r["品番"] || "";
      const s = r["背番号"] || "";
      const pKey = `${h}::${s}`;
      if (!entry.partsMap.has(pKey)) {
        entry.partsMap.set(pKey, { hinban: h, seiban: s, shots: 0, defects: 0 });
      }
      const pEntry = entry.partsMap.get(pKey);
      pEntry.shots += Number(r.Total_Count || r.totalCount || r.良品数 || 0);
      pEntry.defects += Number(r.Bad_Count || r.badCount || r.不良数 || 0);
    });

    let totalAllShots = 0;
    const list = Array.from(map.values()).map((item) => {
      const analytics = calculateEquipmentAnalytics(item.records);
      totalAllShots += analytics.totalShots || 0;
      return {
        ...item,
        analytics,
        workerList: Array.from(item.workers),
        partsBreakdown: Array.from(item.partsMap.values()).sort((a, b) => b.shots - a.shots),
      };
    });

    // Add share percentage
    list.forEach((item) => {
      item.share =
        totalAllShots > 0
          ? Number(((item.analytics.totalShots / totalAllShots) * 100).toFixed(1))
          : 0;
    });

    // Sort by shots descending
    list.sort((a, b) => (b.analytics.totalShots || 0) - (a.analytics.totalShots || 0));

    return {
      machines: list,
      totalAllShots,
      totalRecords: records.length,
    };
  }, [records]);

  // Summary Highlights
  const highlights = useMemo(() => {
    const list = machineStats.machines;
    if (list.length === 0) {
      return { topMachine: null, bestQualityMachine: null, totalDefects: 0, overallDefectRate: 0 };
    }

    const topMachine = list[0];

    // Find best quality machine (lowest defect rate with at least some production)
    const withProduction = list.filter((m) => (m.analytics.totalProcessQuantity || 0) > 0);
    const bestQualityMachine = withProduction.length > 0
      ? [...withProduction].sort((a, b) => (a.analytics.defectRate || 0) - (b.analytics.defectRate || 0))[0]
      : null;

    let totalProduction = 0;
    let totalDefects = 0;
    list.forEach((m) => {
      totalProduction += m.analytics.totalProcessQuantity || 0;
      totalDefects += m.analytics.totalDefects || 0;
    });

    const overallDefectRate =
      totalProduction > 0 ? Number(((totalDefects / totalProduction) * 100).toFixed(2)) : 0;

    return {
      topMachine,
      bestQualityMachine,
      totalDefects,
      overallDefectRate,
      machineCount: list.length,
    };
  }, [machineStats]);

  // Render Comparative Chart
  useEffect(() => {
    if (!chartCanvasRef.current || machineStats.machines.length === 0) return;
    const ctx = chartCanvasRef.current.getContext("2d");

    const existing = ChartJS.getChart(chartCanvasRef.current);
    if (existing) existing.destroy();
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = machineStats.machines.map((m) => `${m.machine} (${m.factory || "—"})`);
    const defectRateData = machineStats.machines.map((m) => m.analytics.defectRate || 0);

    const datasets = [];

    if (activeParts.length > 1 && chartDisplayMode === "stacked") {
      activeParts.forEach((part, pIdx) => {
        const color = PALETTE[pIdx % PALETTE.length];
        const partShotsData = machineStats.machines.map((m) => {
          const match = m.partsBreakdown.find((p) => p.hinban === part.hinban);
          return match ? match.shots : 0;
        });

        datasets.push({
          type: "bar",
          label: `${part.hinban}${part.seiban ? ` (${part.seiban})` : ""}`,
          data: partShotsData,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          borderRadius: 4,
          stack: "shotsStack",
          yAxisID: "y",
          order: 2 + pIdx,
        });
      });
    } else {
      const shotsData = machineStats.machines.map((m) => m.analytics.totalShots || 0);
      datasets.push({
        type: "bar",
        label: isJa ? "総ショット数" : "Total Shots",
        data: shotsData,
        backgroundColor: "rgba(59, 130, 246, 0.75)",
        borderColor: "#3b82f6",
        borderWidth: 1.5,
        borderRadius: 4,
        yAxisID: "y",
        order: 2,
      });
    }

    // Defect line
    datasets.push({
      type: "line",
      label: isJa ? "不良率 (%)" : "Defect Rate (%)",
      data: defectRateData,
      borderColor: "#ef4444",
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: "#ef4444",
      yAxisID: "y1",
      order: 1,
    });

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { font: { size: 11, weight: "bold" }, boxWidth: 12 },
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            callbacks: {
              label: (item) => {
                if (item.dataset.yAxisID === "y1") {
                  return `  ${item.dataset.label}: ${item.raw}%`;
                }
                return `  ${item.dataset.label}: ${Number(item.raw).toLocaleString()} shots`;
              },
            },
          },
        },
        scales: {
          y: {
            type: "linear",
            position: "left",
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "ショット数 (Shots)" : "Total Shots",
              color: "#64748b",
              font: { size: 10 },
            },
            grid: { color: "rgba(148, 163, 184, 0.12)" },
            ticks: {
              callback: (val) => `${Number(val).toLocaleString()}`,
              font: { size: 10 },
            },
          },
          y1: {
            type: "linear",
            position: "right",
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "不良率 (%)" : "Defect Rate (%)",
              color: "#ef4444",
              font: { size: 10 },
            },
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (val) => `${val}%`,
              font: { size: 10 },
              color: "#ef4444",
            },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: "bold" } },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [machineStats, isJa]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-5xl bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* ── 1. Modal Header ─────────────────────────────────────────── */}
          <div className="px-6 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface-subtle)] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {activeParts.length > 1 ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-2xs">
                  <span className="material-symbols-outlined text-[24px]">view_in_ar</span>
                </div>
              ) : imageLoading ? (
                <div className="h-12 w-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)] animate-spin">
                    progress_activity
                  </span>
                </div>
              ) : productImage && !imageError ? (
                <button
                  type="button"
                  onClick={() =>
                    setPhotoPreview({
                      eyebrow: isJa ? "マスター画像" : "Master Image",
                      displayName: masterData?.["品名"] ?? activeParts[0]?.hinban,
                      subtitle: `${activeParts[0]?.hinban}${activeParts[0]?.seiban ? ` / ${activeParts[0]?.seiban}` : ""}`,
                      images: [{ url: productImage, label: masterData?.["品名"] ?? activeParts[0]?.hinban }],
                      activeIndex: 0,
                    })
                  }
                  className="group relative h-12 w-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-black/5 dark:bg-white/5 flex items-center justify-center p-0.5 hover:border-[var(--freya-blue)] cursor-zoom-in transition-all shadow-2xs hover:shadow-sm"
                  title={isJa ? "クリックして拡大プレビュー" : "Click to preview image"}
                >
                  <img
                    src={productImage}
                    alt={masterData?.["品名"] ?? activeParts[0]?.hinban}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageError(true)}
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-end justify-end p-0.5">
                    <span className="material-symbols-outlined text-[12px] text-white bg-black/60 rounded-xs p-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      zoom_in
                    </span>
                  </div>
                </button>
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20 shadow-2xs">
                  <span className="material-symbols-outlined text-[24px]">category</span>
                </div>
              )}

              <div className="min-w-0">
                {activeParts.length > 1 ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                        {isJa ? "複数品番パッケージ横断比較" : "Multi-Part Bundle Benchmark"}
                      </h2>
                      <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold border border-purple-500/20">
                        {activeParts.length} {isJa ? "品番" : "parts"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {activeParts.map((p) => (
                        <span
                          key={`${p.hinban}-${p.seiban}`}
                          className="px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-primary)] font-bold shadow-2xs"
                        >
                          {p.hinban}{p.seiban ? ` (${p.seiban})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] font-mono truncate">
                        {activeParts[0]?.hinban || hinban}
                      </h2>
                      {(activeParts[0]?.seiban || seiban) && (
                        <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-bold font-mono text-[var(--text-primary)] shadow-2xs">
                          {activeParts[0]?.seiban || seiban}
                        </span>
                      )}
                      <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold border border-blue-500/20">
                        {isJa ? "全設備実績比較" : "Cross-Machine Benchmark"}
                      </span>
                    </div>
                    {masterData?.["品名"] && (
                      <p className="text-xs font-medium text-[var(--text-secondary)] mt-0.5 truncate">
                        {masterData["品名"]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {activeParts.length > 1 && (
                <div className="flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setChartDisplayMode("stacked")}
                    className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                      chartDisplayMode === "stacked"
                        ? "bg-[var(--surface-subtle)] text-[var(--freya-blue)] shadow-2xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {isJa ? "内訳" : "Stacked"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartDisplayMode("combined")}
                    className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                      chartDisplayMode === "combined"
                        ? "bg-[var(--surface-subtle)] text-[var(--freya-blue)] shadow-2xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {isJa ? "合算" : "Combined"}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const q = new URLSearchParams();
                  if (activeParts.length > 0) {
                    q.set("hinban", activeParts.map((p) => p.hinban).join(","));
                    const seibans = activeParts.map((p) => p.seiban || "").join(",");
                    if (seibans.replace(/,/g, "")) {
                      q.set("seiban", seibans);
                    }
                  } else {
                    if (hinban) q.set("hinban", hinban);
                    if (seiban) q.set("seiban", seiban);
                  }
                  navigate(`/analytics/parts?${q.toString()}`);
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition shadow-2xs"
                title={isJa ? "専用タブ（全画面）で開く" : "Open in dedicated tab"}
              >
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                <span>{isJa ? "全画面タブで開く" : "Full View"}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* ── 2. Filter Bar (Date Range Selector) ────────────────────── */}
          <div className="px-6 py-2.5 border-b border-[var(--border)]/70 bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs overflow-x-auto scrollbar-none">
              <span className="text-[var(--text-muted)] font-semibold shrink-0">
                {isJa ? "対象期間:" : "Period:"}
              </span>
              <button
                type="button"
                onClick={() => setDatePreset("bothMonths")}
                className={`rounded-full px-2.5 py-1 font-semibold transition cursor-pointer shrink-0 ${
                  datePreset === "bothMonths"
                    ? "bg-[var(--freya-blue)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {monthA} & {monthB} ({isJa ? "両月合計" : "Both Months"})
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("monthA")}
                className={`rounded-full px-2.5 py-1 font-semibold transition cursor-pointer shrink-0 ${
                  datePreset === "monthA"
                    ? "bg-[var(--freya-blue)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {monthA} ({isJa ? "当月のみ" : "Month A"})
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("monthB")}
                className={`rounded-full px-2.5 py-1 font-semibold transition cursor-pointer shrink-0 ${
                  datePreset === "monthB"
                    ? "bg-[var(--freya-blue)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {monthB} ({isJa ? "先月のみ" : "Month B"})
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("last30Days")}
                className={`rounded-full px-2.5 py-1 font-semibold transition cursor-pointer shrink-0 ${
                  datePreset === "last30Days"
                    ? "bg-[var(--freya-blue)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {isJa ? "直近30日間" : "Last 30 Days"}
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("allTime")}
                className={`rounded-full px-2.5 py-1 font-semibold transition cursor-pointer shrink-0 ${
                  datePreset === "allTime"
                    ? "bg-[var(--freya-blue)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {isJa ? "全期間" : "All Time"}
              </button>
            </div>

            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {activeDateRange.from} 〜 {activeDateRange.to} • {machineStats.totalRecords} {isJa ? "件" : "records"}
            </span>
          </div>

          {/* ── 3. Modal Scrollable Content ─────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                <span className="material-symbols-outlined text-[32px] animate-spin text-[var(--freya-blue)] mb-2 block">
                  refresh
                </span>
                <p>{isJa ? "全設備の実績を集計中..." : "Analyzing cross-machine production records..."}</p>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600">
                {error}
              </div>
            ) : machineStats.machines.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                <span className="material-symbols-outlined text-[36px] mb-2 block">search_off</span>
                <p className="font-semibold text-sm">
                  {isJa ? "指定期間にこの品番の実績は見つかりませんでした" : "No production records found for this part in the selected range."}
                </p>
              </div>
            ) : (
              <>
                {/* 4 Summary KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Total Part Volume */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-1">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block">
                      {isJa ? "全設備 総生産ショット" : "Total Part Shots"}
                    </span>
                    <span className="text-2xl font-black text-blue-900 dark:text-blue-100 tabular-nums block">
                      {machineStats.totalAllShots.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-blue-600/70 block">
                      {highlights.machineCount} {isJa ? "台の設備で生産" : "machines active"}
                    </span>
                  </div>

                  {/* Top Volume Machine */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-1">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                      {isJa ? "最多生産設備 (TOP)" : "Top Volume Machine"}
                    </span>
                    <span className="text-xl font-black text-emerald-900 dark:text-emerald-100 truncate block">
                      {highlights.topMachine?.machine || "—"}
                    </span>
                    <span className="text-[11px] text-emerald-600/80 block font-mono">
                      {(highlights.topMachine?.analytics.totalShots || 0).toLocaleString()} shots (
                      {highlights.topMachine?.share || 0}%)
                    </span>
                  </div>

                  {/* Best Quality Machine */}
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-1">
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 block">
                      {isJa ? "最高品質設備 (最低不良率)" : "Best Quality Machine"}
                    </span>
                    <span className="text-xl font-black text-purple-900 dark:text-purple-100 truncate block">
                      {highlights.bestQualityMachine?.machine || "—"}
                    </span>
                    <span className="text-[11px] text-purple-600/80 block font-mono">
                      {highlights.bestQualityMachine ? `${highlights.bestQualityMachine.analytics.defectRate}% 不良率` : "—"}
                    </span>
                  </div>

                  {/* Overall Defect Rate */}
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">
                      {isJa ? "全体平均不良率" : "Overall Defect Rate"}
                    </span>
                    <span className="text-2xl font-black text-amber-900 dark:text-amber-100 tabular-nums block">
                      {highlights.overallDefectRate}%
                    </span>
                    <span className="text-[11px] text-amber-600/80 block font-mono">
                      {isJa ? "不良数:" : "NG count:"} {highlights.totalDefects.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Comparative Chart */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {isJa ? "設備別ショット数 & 不良率 比較" : "Equipment Volume & Defect Rate Benchmark"}
                    </h4>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isJa ? "青: ショット数 (左軸) / 赤: 不良率 (右軸)" : "Blue: Shots (Left) / Red: Defect Rate (Right)"}
                    </span>
                  </div>
                  <div className="h-56 w-full relative">
                    <canvas ref={chartCanvasRef} />
                  </div>
                </div>

                {/* Detailed Equipment Breakdown Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {isJa ? "設備別パフォーマンス詳細" : "Detailed Machine Performance Breakdown"}
                    </h4>
                    <span className="text-xs text-[var(--text-muted)]">
                      {isJa ? "行をクリックで詳細記録を展開" : "Click row to expand production runs"}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold select-none">
                        <tr>
                          <th className="px-3 py-2.5">{isJa ? "設備名" : "Machine"}</th>
                          <th className="px-3 py-2.5">{isJa ? "所属工場" : "Factory"}</th>
                          <th className="px-3 py-2.5 text-right">{isJa ? "総ショット数" : "Total Shots"}</th>
                          <th className="px-3 py-2.5 text-right">{isJa ? "処理数量" : "Process Qty"}</th>
                          <th className="px-3 py-2.5 text-right">{isJa ? "不良数 / 不良率" : "Defects / Rate"}</th>
                          <th className="px-3 py-2.5 text-right">{isJa ? "品質評価" : "Quality Status"}</th>
                          <th className="px-3 py-2.5 text-right">{isJa ? "実稼働時間" : "Work Hours"}</th>
                          <th className="px-3 py-2.5 text-right">{isJa ? "稼働日数" : "Days"}</th>
                          <th className="px-3 py-2.5 text-center">{isJa ? "アクション" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-primary)]">
                        {machineStats.machines.map((item) => {
                          const facStyle = getFactoryBadgeStyle(item.factory);
                          const defRate = item.analytics.defectRate || 0;
                          const isExpanded = expandedMachine === item.machine;

                          return (
                            <React.Fragment key={item.machine}>
                              <tr
                                onClick={() => setExpandedMachine(isExpanded ? null : item.machine)}
                                className="hover:bg-blue-500/5 dark:hover:bg-blue-500/10 cursor-pointer transition-colors group/row"
                              >
                                <td className="px-3 py-2.5 font-bold text-[var(--text-primary)] group-hover/row:text-[var(--freya-blue)] transition-colors">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] transition-transform duration-200 ${
                                        isExpanded ? "rotate-90 text-[var(--freya-blue)]" : ""
                                      }`}
                                    >
                                      chevron_right
                                    </span>
                                    <span>{item.machine}</span>
                                  </div>
                                  {activeParts.length > 1 && item.partsBreakdown?.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 mt-1 font-normal">
                                      {item.partsBreakdown.map((pb) => (
                                        <span
                                          key={`${pb.hinban}-${pb.seiban}`}
                                          className="px-1.5 py-0.2 rounded bg-[var(--surface-subtle)] border border-[var(--border)] text-[9px] text-[var(--text-muted)]"
                                        >
                                          {pb.hinban.slice(-5)}: {pb.shots.toLocaleString()}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>

                                <td className="px-3 py-2.5">
                                  {item.factory ? (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-[4px] ${facStyle.bg} ${facStyle.text} px-2 py-0.5 text-[10px] font-semibold border ${facStyle.border}`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${facStyle.dot}`} />
                                      {item.factory}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>

                                <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                                  <div className="flex flex-col items-end">
                                    <span>{(item.analytics.totalShots || 0).toLocaleString()}</span>
                                    <span className="text-[10px] text-[var(--text-muted)] font-normal">
                                      {item.share}% {isJa ? "シェア" : "share"}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                                  {(item.analytics.totalProcessQuantity || 0).toLocaleString()}
                                </td>

                                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                                  <div className="flex flex-col items-end">
                                    <span className={defRate > 1.5 ? "text-rose-500 font-bold" : ""}>
                                      {defRate}%
                                    </span>
                                    <span className="text-[10px] text-[var(--text-muted)]">
                                      {(item.analytics.totalDefects || 0).toLocaleString()} NG
                                    </span>
                                  </div>
                                </td>

                                <td className="px-3 py-2.5 text-right">
                                  {defRate <= 0.5 ? (
                                    <span className="inline-block rounded-[4px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                                      {isJa ? "良好 (Optimal)" : "Optimal"}
                                    </span>
                                  ) : defRate <= 1.5 ? (
                                    <span className="inline-block rounded-[4px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold border border-blue-500/20">
                                      {isJa ? "標準 (Standard)" : "Standard"}
                                    </span>
                                  ) : (
                                    <span className="inline-block rounded-[4px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[10px] font-bold border border-rose-500/20 animate-pulse">
                                      {isJa ? "要調整 (Inspect)" : "Needs Inspection"}
                                    </span>
                                  )}
                                </td>

                                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                                  {item.analytics.workingHours || 0}h
                                </td>

                                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                                  {item.analytics.totalDays || 0} {isJa ? "日" : "d"}
                                </td>

                                <td className="px-3 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedMachine(isExpanded ? null : item.machine);
                                    }}
                                    className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
                                  >
                                    {isExpanded ? (isJa ? "閉じる" : "Hide") : (isJa ? "内訳" : "Runs")} (
                                    {item.records.length})
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Individual Runs for this Machine */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={9} className="bg-[var(--surface-subtle)]/60 p-4">
                                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="material-symbols-outlined text-[16px] text-[var(--freya-blue)]">
                                            list_alt
                                          </span>
                                          <h5 className="text-xs font-bold text-[var(--text-primary)]">
                                            {item.machine} — {isJa ? "生産記録一覧" : "Production Runs"} (
                                            {item.records.length} {isJa ? "件" : "runs"})
                                          </h5>
                                          <span className="text-[11px] text-[var(--text-muted)]">
                                            ({isJa ? "クリックでRecord Detailsを表示" : "Click to view full Record Details"})
                                          </span>
                                        </div>

                                        {item.workerList.length > 0 && (
                                          <span className="text-[11px] text-[var(--text-muted)]">
                                            {isJa ? "作業者:" : "Operators:"} {item.workerList.join(", ")}
                                          </span>
                                        )}
                                      </div>

                                      <div className="overflow-x-auto max-h-56">
                                        <table className="w-full text-[11px] text-left">
                                          <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                                            <tr>
                                              <th className="py-1 px-2">{isJa ? "日付" : "Date"}</th>
                                              <th className="py-1 px-2">{isJa ? "時間" : "Time"}</th>
                                              <th className="py-1 px-2">{isJa ? "作業者" : "Worker"}</th>
                                              <th className="py-1 px-2 text-right">{isJa ? "ショット数" : "Shots"}</th>
                                              <th className="py-1 px-2 text-right">{isJa ? "数量" : "Qty"}</th>
                                              <th className="py-1 px-2 text-right">{isJa ? "不良" : "Defects"}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[var(--border)]/60">
                                            {item.records.map((r, rIdx) => (
                                              <tr
                                                key={r._id ? (r._id.$oid || r._id) : rIdx}
                                                onClick={() =>
                                                  setSelectedRecordForDetail({
                                                    ...r,
                                                    _source: "pressDB",
                                                    _process: "Press",
                                                    _id: r._id?.$oid || r._id,
                                                  })
                                                }
                                                className="hover:bg-blue-500/10 cursor-pointer transition-colors"
                                              >
                                                <td className="py-1 px-2 font-mono text-[var(--text-secondary)]">
                                                  {r.Date}
                                                </td>
                                                <td className="py-1 px-2 font-mono text-[var(--text-muted)]">
                                                  {r.Time_start && r.Time_end
                                                    ? `${r.Time_start} ~ ${r.Time_end}`
                                                    : "—"}
                                                </td>
                                                <td className="py-1 px-2 font-medium text-[var(--text-primary)]">
                                                  {r.Worker_Name || r["作業者"] || r.worker || "—"}
                                                </td>
                                                <td className="py-1 px-2 text-right font-mono font-bold tabular-nums">
                                                  {Number(r["ショット数"] || 0).toLocaleString()}
                                                </td>
                                                <td className="py-1 px-2 text-right font-mono tabular-nums">
                                                  {Number(r.Process_Quantity || 0).toLocaleString()}
                                                </td>
                                                <td className="py-1 px-2 text-right font-mono tabular-nums">
                                                  {Number(r.Total_NG || 0) > 0 ? (
                                                    <span className="text-rose-500 font-bold">
                                                      {Number(r.Total_NG).toLocaleString()}
                                                    </span>
                                                  ) : (
                                                    "0"
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Record Details Modal on Top ───────────────────────────────── */}
      {selectedRecordForDetail && (
        <RecordDetailModal
          record={selectedRecordForDetail}
          processName="Press"
          onClose={() => setSelectedRecordForDetail(null)}
          zIndex="z-[10001]"
        />
      )}

      {/* ── Photo Preview Modal on Highest Layer ───────────────────────── */}
      {photoPreview && (
        <SensorDevicePhotoPreviewModal
          preview={photoPreview}
          onClose={() => setPhotoPreview(null)}
          zIndex="z-[10002]"
        />
      )}
    </>,
    document.body
  );
}
