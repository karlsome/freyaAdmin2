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

export default function PartMachineComparisonModal({
  isOpen,
  onClose,
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

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);

  // Master product image state
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

  // Load product image from masterDB
  useEffect(() => {
    if (!isOpen || !hinban) {
      setProductImage(null);
      setMasterData(null);
      setImageError(false);
      setImageLoading(false);
      return;
    }
    let cancelled = false;
    setImageLoading(true);
    setImageError(false);

    fetchMasterImage(hinban, seiban)
      .then((img) => {
        if (!cancelled) {
          setMasterData(img);
          // fetchMasterImage returns { imageURL, 品番, 背番号, 品名 } or null
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
  }, [isOpen, hinban, seiban]);

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

  // Fetch records across all machines for this part
  useEffect(() => {
    if (!isOpen || !hinban) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let fetchedRecords = null;
        try {
          // Try dedicated cross-machine endpoint first
          const dedicatedRes = await fetchPartCrossMachineComparison({
            hinban,
            seiban: seiban || undefined,
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
            startDate: activeDateRange.from || undefined,
            endDate: activeDateRange.to || undefined,
            hinban,
            seiban: seiban || undefined,
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
  }, [isOpen, hinban, seiban, activeDateRange]);

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
        });
      }
      const entry = map.get(eq);
      entry.records.push(r);
      const worker = r.Worker_Name || r["作業者"] || r.worker || r.operator;
      if (worker) entry.workers.add(worker);
      if (!entry.factory && r["工場"]) entry.factory = r["工場"];
    });

    let totalAllShots = 0;
    const list = Array.from(map.values()).map((item) => {
      const analytics = calculateEquipmentAnalytics(item.records);
      totalAllShots += analytics.totalShots || 0;
      return {
        ...item,
        analytics,
        workerList: Array.from(item.workers),
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
    const shotsData = machineStats.machines.map((m) => m.analytics.totalShots || 0);
    const defectRateData = machineStats.machines.map((m) => m.analytics.defectRate || 0);

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: isJa ? "総ショット数" : "Total Shots",
            data: shotsData,
            backgroundColor: "rgba(59, 130, 246, 0.75)",
            borderColor: "#3b82f6",
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: "y",
            order: 2,
          },
          {
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
          },
        ],
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
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-subtle)] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Product Master Thumbnail with Lazy Loading, Fallback & Click-to-Preview */}
              {imageLoading ? (
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
                      displayName: masterData?.["品名"] ?? hinban,
                      subtitle: `${hinban}${seiban ? ` / ${seiban}` : ""}`,
                      images: [{ url: productImage, label: masterData?.["品名"] ?? hinban }],
                      activeIndex: 0,
                    })
                  }
                  className="group relative h-12 w-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-black/5 dark:bg-white/5 flex items-center justify-center p-0.5 hover:border-[var(--freya-blue)] cursor-zoom-in transition-all shadow-2xs hover:shadow-sm"
                  title={isJa ? "クリックして拡大プレビュー" : "Click to preview image"}
                >
                  <img
                    src={productImage}
                    alt={masterData?.["品名"] ?? hinban}
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
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] font-mono truncate">
                    {hinban}
                  </h2>
                  {seiban && (
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-bold font-mono text-[var(--text-primary)] shadow-2xs">
                      {seiban}
                    </span>
                  )}
                  <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold border border-blue-500/20">
                    {isJa ? "全設備実績比較" : "Cross-Machine Benchmark"}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {isJa
                    ? "同一品番がどの設備でどれだけ生産され、品質・速度に差があるかを比較します。"
                    : "Compare volume, defect rate, and speed across all machines producing this part."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  const q = new URLSearchParams();
                  if (hinban) q.set("hinban", hinban);
                  if (seiban) q.set("seiban", seiban);
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
