import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import ChartJS from "./chartSetup";
import {
  fetchEquipmentData,
  fetchPartCrossMachineComparison,
  fetchMasterImage,
  fetchMasterDbProducts,
} from "../../services/api";
import { calculateEquipmentAnalytics, getFactoryBadgeStyle } from "./equipmentAnalyticsUtils";
import RecordDetailModal from "../RecordDetailModal";
import SensorDevicePhotoPreviewModal from "../SensorDevicePhotoPreviewModal";

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

function getMonthEndDate(ym) {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}

const PALETTE = [
  { bg: "rgba(59, 130, 246, 0.8)", border: "#3b82f6", label: "Blue" },
  { bg: "rgba(168, 85, 247, 0.8)", border: "#a855f7", label: "Purple" },
  { bg: "rgba(16, 185, 129, 0.8)", border: "#10b981", label: "Emerald" },
  { bg: "rgba(245, 158, 11, 0.8)", border: "#f59e0b", label: "Amber" },
  { bg: "rgba(236, 72, 153, 0.8)", border: "#ec4899", label: "Pink" },
  { bg: "rgba(14, 165, 233, 0.8)", border: "#0ea5e9", label: "Sky" },
];

export default function PartBenchmarkingView({ isJa = true }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Multi-Part Selection: Array<{ hinban: string, seiban?: string, name?: string, model?: string, imageURL?: string }>
  const [selectedParts, setSelectedParts] = useState(() => {
    const rawHinban = searchParams.get("hinban");
    const rawSeiban = searchParams.get("seiban");
    if (!rawHinban) return [];
    const hinbans = rawHinban.split(",").map((h) => h.trim()).filter(Boolean);
    const seibans = rawSeiban ? rawSeiban.split(",").map((s) => s.trim()) : [];
    return hinbans.map((h, idx) => ({
      hinban: h,
      seiban: seibans[idx] || "",
    }));
  });

  // Chart display mode when multiple parts are selected: "stacked" (breakdown per part) vs "combined" (total shots)
  const [chartDisplayMode, setChartDisplayMode] = useState("stacked");

  // Month selectors for MoM
  const availableMonths = useMemo(() => getRecentMonths(18), []);
  const [monthA, setMonthA] = useState(() => availableMonths[0] || "2026-09");
  const [monthB, setMonthB] = useState(() => availableMonths[1] || "2026-08");

  // Date range presets
  const [datePreset, setDatePreset] = useState("bothMonths");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });

  // Master products list for autocomplete
  const [masterProducts, setMasterProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Data states
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Single product master info & photo preview (for primary or previewed part)
  const [primaryMasterData, setPrimaryMasterData] = useState(null);
  const [primaryImage, setPrimaryImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Drilldown states
  const [expandedMachine, setExpandedMachine] = useState(null);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Sync URL search params when selection changes
  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedParts.length > 0) {
      nextParams.set("hinban", selectedParts.map((p) => p.hinban).join(","));
      const seibans = selectedParts.map((p) => p.seiban || "").join(",");
      if (seibans.replace(/,/g, "")) {
        nextParams.set("seiban", seibans);
      } else {
        nextParams.delete("seiban");
      }
    } else {
      nextParams.delete("hinban");
      nextParams.delete("seiban");
    }
    setSearchParams(nextParams, { replace: true });
  }, [selectedParts, setSearchParams]);

  // Click outside search dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load master products for autocomplete
  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      setProductsLoading(true);
      try {
        const res = await fetchMasterDbProducts();
        if (cancelled) return;
        const list = res?.success && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        setMasterProducts(list);
      } catch (err) {
        console.error("Failed to load master products:", err);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered products for dropdown
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return masterProducts.slice(0, 15);
    const q = searchQuery.toLowerCase().trim();
    return masterProducts
      .filter((p) => {
        const h = String(p.品番 || "").toLowerCase();
        const s = String(p.背番号 || "").toLowerCase();
        const n = String(p.品名 || "").toLowerCase();
        const m = String(p.モデル || "").toLowerCase();
        return h.includes(q) || s.includes(q) || n.includes(q) || m.includes(q);
      })
      .slice(0, 20);
  }, [masterProducts, searchQuery]);

  // Top popular products quick chips
  const quickPartChips = useMemo(() => {
    return masterProducts
      .filter((p) => p.品番)
      .slice(0, 6)
      .map((p) => ({
        hinban: p.品番,
        seiban: p.背番号 || "",
        name: p.品名 || "",
        model: p.モデル || "",
        imageURL: p.imageURL || null,
      }));
  }, [masterProducts]);

  // Load master image and details for the first selected part
  useEffect(() => {
    if (selectedParts.length === 0) {
      setPrimaryImage(null);
      setPrimaryMasterData(null);
      setImageLoading(false);
      return;
    }

    const first = selectedParts[0];
    let cancelled = false;
    setImageLoading(true);

    fetchMasterImage(first.hinban, first.seiban)
      .then((img) => {
        if (!cancelled) {
          setPrimaryMasterData(img);
          const url = typeof img === "string" ? img : img?.imageURL || null;
          setPrimaryImage(url);
          setImageLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrimaryImage(null);
          setPrimaryMasterData(null);
          setImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedParts]);

  // Calculate active date range
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

  // Fetch cross-machine data for all selected parts
  useEffect(() => {
    if (selectedParts.length === 0) {
      setRecords([]);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        let fetchedRecords = null;
        const partsPayload = selectedParts.map((p) => ({
          hinban: p.hinban,
          seiban: p.seiban || undefined,
        }));

        try {
          const dedicatedRes = await fetchPartCrossMachineComparison({
            parts: partsPayload,
            startDate: activeDateRange.from || undefined,
            endDate: activeDateRange.to || undefined,
          });
          if (dedicatedRes?.success && Array.isArray(dedicatedRes.records)) {
            fetchedRecords = dedicatedRes.records;
          }
        } catch {
          // Fallback if dedicated endpoint not running
        }

        if (!fetchedRecords) {
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
        setRecords(fetchedRecords || []);
      } catch (err) {
        console.error("Failed to load part cross-machine data:", err);
        if (!cancelled) setError(err.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [selectedParts, activeDateRange]);

  // Group records by machine & calculate analytics per machine and per part
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
        entry.partsMap.set(pKey, { hinban: h, seiban: s, shots: 0, defects: 0, recordsCount: 0 });
      }
      const pEntry = entry.partsMap.get(pKey);
      const shots = Number(r.Total_Count || r.totalCount || r.良品数 || 0);
      const defects = Number(r.Bad_Count || r.badCount || r.不良数 || 0);
      pEntry.shots += shots;
      pEntry.defects += defects;
      pEntry.recordsCount += 1;
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

    list.forEach((item) => {
      item.share =
        totalAllShots > 0
          ? Number(((item.analytics.totalShots / totalAllShots) * 100).toFixed(1))
          : 0;
    });

    list.sort((a, b) => (b.analytics.totalShots || 0) - (a.analytics.totalShots || 0));

    return {
      machines: list,
      totalAllShots,
      totalRecords: records.length,
    };
  }, [records]);

  // Key Highlights
  const highlights = useMemo(() => {
    const list = machineStats.machines;
    if (list.length === 0) {
      return { topMachine: null, bestQualityMachine: null, totalDefects: 0, overallDefectRate: 0 };
    }

    let topMachine = list[0];
    let bestQualityMachine = null;
    let lowestDefectRate = Infinity;
    let totalDefects = 0;

    list.forEach((m) => {
      const shots = m.analytics.totalShots || 0;
      const defects = m.analytics.totalDefects || 0;
      const rate = m.analytics.defectRate || 0;
      totalDefects += defects;

      if (shots >= 50 && rate < lowestDefectRate) {
        lowestDefectRate = rate;
        bestQualityMachine = m;
      }
    });

    if (!bestQualityMachine) bestQualityMachine = list[0];

    const overallDefectRate =
      machineStats.totalAllShots > 0
        ? Number(((totalDefects / machineStats.totalAllShots) * 100).toFixed(2))
        : 0;

    return {
      topMachine,
      bestQualityMachine,
      totalDefects,
      overallDefectRate,
    };
  }, [machineStats]);

  // Render Dual-Axis / Multi-Part Chart
  useEffect(() => {
    if (!chartCanvasRef.current || machineStats.machines.length === 0) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    const ctx = chartCanvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = machineStats.machines.map((m) => m.machine);
    const defectRates = machineStats.machines.map((m) => m.analytics?.defectRate || 0);

    const isDarkMode = document.documentElement.classList.contains("dark");
    const textColor = isDarkMode ? "#94a3b8" : "#64748b";
    const gridColor = isDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)";

    // Build datasets
    const datasets = [];

    if (selectedParts.length > 1 && chartDisplayMode === "stacked") {
      // Stacked Bar per part
      selectedParts.forEach((part, pIdx) => {
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
          yAxisID: "yShots",
          order: 2 + pIdx,
        });
      });
    } else {
      // Combined Bar
      const shotsData = machineStats.machines.map((m) => m.analytics?.totalShots || 0);
      datasets.push({
        type: "bar",
        label: isJa ? "総生産ショット数" : "Total Shots",
        data: shotsData,
        backgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.75)" : "rgba(37, 99, 235, 0.8)",
        hoverBackgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.95)" : "rgba(37, 99, 235, 1)",
        borderRadius: 6,
        yAxisID: "yShots",
        order: 2,
      });
    }

    // Right Axis Line: Defect Rate %
    datasets.push({
      type: "line",
      label: isJa ? "不良率 (%)" : "Defect Rate (%)",
      data: defectRates,
      borderColor: "#ef4444",
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      borderWidth: 2.5,
      pointBackgroundColor: "#ef4444",
      pointBorderColor: "#ffffff",
      pointBorderWidth: 1.5,
      pointRadius: 4.5,
      pointHoverRadius: 6.5,
      tension: 0.2,
      yAxisID: "yRate",
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
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: textColor,
              font: { size: 11, weight: "bold" },
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.dataset.yAxisID === "yRate") {
                  return ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
                }
                return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString()} shots`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: selectedParts.length > 1 && chartDisplayMode === "stacked",
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { size: 11, weight: "bold", family: "monospace" },
            },
          },
          yShots: {
            type: "linear",
            position: "left",
            stacked: selectedParts.length > 1 && chartDisplayMode === "stacked",
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 10 },
              callback: (val) => Number(val).toLocaleString(),
            },
            title: {
              display: true,
              text: isJa ? "生産ショット数" : "Shots Produced",
              color: textColor,
              font: { size: 11 },
            },
          },
          yRate: {
            type: "linear",
            position: "right",
            beginAtZero: true,
            grid: { display: false },
            ticks: {
              color: "#ef4444",
              font: { size: 10 },
              callback: (val) => `${val}%`,
            },
            title: {
              display: true,
              text: isJa ? "不良率 (%)" : "Defect Rate (%)",
              color: "#ef4444",
              font: { size: 11 },
            },
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
  }, [machineStats, selectedParts, chartDisplayMode, isJa]);

  // Get all unique models from currently selected parts
  const selectedModels = useMemo(() => {
    const models = new Set();
    selectedParts.forEach((p) => {
      if (p.model) models.add(p.model);
    });
    return Array.from(models);
  }, [selectedParts]);

  const handleAddAllWithModel = (modelName) => {
    if (!modelName) return;
    const matches = masterProducts.filter((p) => p.モデル === modelName && p.品番);
    setSelectedParts((prev) => {
      const merged = [...prev];
      matches.forEach((m) => {
        if (!merged.some((p) => p.hinban === m.品番 && p.seiban === (m.背番号 || ""))) {
          merged.push({
            hinban: m.品番,
            seiban: m.背番号 || "",
            name: m.品名 || "",
            model: m.モデル || "",
            imageURL: m.imageURL || null,
          });
        }
      });
      return merged;
    });
  };

  const handleTogglePart = (product) => {
    const h = (product.品番 || product.hinban || "").trim();
    const s = (product.背番号 || product.seiban || "").trim();
    if (!h) return;

    const exists = selectedParts.some((p) => p.hinban === h && p.seiban === s);
    if (exists) {
      handleRemovePart(h, s);
    } else {
      setSelectedParts((prev) => [
        ...prev,
        {
          hinban: h,
          seiban: s,
          name: product.品名 || product.name || "",
          model: product.モデル || product.model || "",
          imageURL: product.imageURL || null,
        },
      ]);
    }
  };

  const handleAddPart = (product) => {
    handleTogglePart(product);
  };

  const handleSelectAllVisible = () => {
    setSelectedParts((prev) => {
      const merged = [...prev];
      filteredProducts.forEach((product) => {
        const h = (product.品番 || product.hinban || "").trim();
        const s = (product.背番号 || product.seiban || "").trim();
        if (h && !merged.some((p) => p.hinban === h && p.seiban === s)) {
          merged.push({
            hinban: h,
            seiban: s,
            name: product.品名 || product.name || "",
            model: product.モデル || product.model || "",
            imageURL: product.imageURL || null,
          });
        }
      });
      return merged;
    });
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      const tokens = searchQuery.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      if (tokens.length > 0) {
        setSelectedParts((prev) => {
          const merged = [...prev];
          tokens.forEach((tok) => {
            const match = masterProducts.find(
              (p) =>
                String(p.品番 || "").toLowerCase() === tok.toLowerCase() ||
                String(p.背番号 || "").toLowerCase() === tok.toLowerCase()
            );
            if (match) {
              if (!merged.some((p) => p.hinban === match.品番 && p.seiban === (match.背番号 || ""))) {
                merged.push({
                  hinban: match.品番,
                  seiban: match.背番号 || "",
                  name: match.品名 || "",
                  model: match.モデル || "",
                  imageURL: match.imageURL || null,
                });
              }
            } else {
              if (!merged.some((p) => p.hinban === tok)) {
                merged.push({
                  hinban: tok,
                  seiban: "",
                });
              }
            }
          });
          return merged;
        });
        setSearchQuery("");
      }
    }
  };

  const handleRemovePart = (hinban, seiban) => {
    setSelectedParts((prev) => prev.filter((p) => !(p.hinban === hinban && p.seiban === seiban)));
  };

  const handleClearAllParts = () => {
    setSelectedParts([]);
    setPrimaryMasterData(null);
    setPrimaryImage(null);
    setRecords([]);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* ── 1. Top Search & Filter Bar ─────────────────────────────────────────── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Part Search Autocomplete */}
          <div className="relative flex-1 max-w-xl" ref={searchContainerRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                {isJa ? "品番・背番号を追加（複数選択・一括入力可）" : "Add Parts / Back No (Multi-select / Paste List)"}
              </label>
              {selectedParts.length > 0 && (
                <span className="text-[11px] font-bold text-[var(--freya-blue)]">
                  {selectedParts.length} {isJa ? "品番選択中" : "parts selected"}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setShowDropdown(true)}
                placeholder={
                  selectedParts.length > 0
                    ? isJa
                      ? "さらに品番を追加検索（カンマ区切りで一括入力も可能）..."
                      : "Add more parts (or paste comma-separated list)..."
                    : isJa
                    ? "品番、背番号、品名を入力（カンマ区切りで複数一括入力可）..."
                    : "Enter part number, back number, or paste multiple..."
                }
                className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--surface-subtle)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--freya-blue)] text-[var(--text-primary)] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Dropdown Suggestions with Multi-Select */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
                  {productsLoading ? (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                      {isJa ? "製品リストを読み込み中..." : "Loading products..."}
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((p, idx) => {
                      const isAlreadySelected = selectedParts.some(
                        (sp) => sp.hinban === p.品番 && sp.seiban === (p.背番号 || "")
                      );
                      return (
                        <div
                          key={`${p.品番}-${p.背番号 || idx}`}
                          onClick={() => handleTogglePart(p)}
                          className={`p-2.5 hover:bg-blue-500/10 cursor-pointer flex items-center justify-between transition-colors text-xs ${
                            isAlreadySelected ? "bg-blue-500/10 font-semibold" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Checkbox indicator */}
                            <div
                              className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                                isAlreadySelected
                                  ? "bg-[var(--freya-blue)] border-[var(--freya-blue)] text-white"
                                  : "border-[var(--border)] bg-[var(--surface)]"
                              }`}
                            >
                              {isAlreadySelected && (
                                <span className="material-symbols-outlined text-[13px] font-bold">check</span>
                              )}
                            </div>

                            <div className="h-8 w-10 shrink-0 bg-black/5 dark:bg-white/5 rounded border border-[var(--border)] overflow-hidden flex items-center justify-center">
                              {p.imageURL ? (
                                <img src={p.imageURL} alt={p.品番} className="h-full w-full object-contain" />
                              ) : (
                                <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)]">
                                  category
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 truncate">
                              <span className="font-mono font-bold text-[var(--text-primary)] mr-2">{p.品番}</span>
                              {p.背番号 && (
                                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--border)] font-mono text-[10px] mr-2">
                                  {p.背番号}
                                </span>
                              )}
                              <span className="text-[var(--text-muted)] truncate">{p.品名}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {p.モデル && (
                              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded border border-[var(--border)]">
                                {p.モデル}
                              </span>
                            )}
                            {isAlreadySelected ? (
                              <span className="text-[11px] text-emerald-600 font-bold">✓ {isJa ? "選択中" : "Selected"}</span>
                            ) : (
                              <span className="text-[11px] text-[var(--freya-blue)] font-bold">+ {isJa ? "追加" : "Add"}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                      {isJa ? "該当する品番が見つかりません" : "No matching parts found"}
                    </div>
                  )}
                </div>

                {/* Dropdown Multi-Select Action Bar */}
                <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)]">
                      {selectedParts.length} {isJa ? "件選択中" : "selected"}
                    </span>
                    {filteredProducts.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllVisible}
                        className="text-[11px] text-[var(--freya-blue)] hover:underline font-semibold"
                      >
                        {isJa ? "表示中を全選択" : "Select all visible"}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(false)}
                    className="px-3 py-1 bg-[var(--freya-blue)] text-white rounded font-bold text-xs shadow-2xs hover:opacity-90 transition"
                  >
                    {isJa ? "完了 (閉じる)" : "Done"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Date Presets Selector */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">
              {isJa ? "期間:" : "Period:"}
            </span>
            {[
              { key: "bothMonths", label: `${monthA} & ${monthB} (${isJa ? "両月" : "Both"})` },
              { key: "monthA", label: `${monthA} (${isJa ? "当月" : "Month A"})` },
              { key: "monthB", label: `${monthB} (${isJa ? "先月" : "Month B"})` },
              { key: "last30Days", label: isJa ? "直近30日" : "30 Days" },
              { key: "allTime", label: isJa ? "全期間" : "All Time" },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setDatePreset(preset.key)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                  datePreset === preset.key
                    ? "bg-[var(--freya-blue)] text-white border-[var(--freya-blue)] shadow-xs"
                    : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Part Tags / Chips */}
        {selectedParts.length > 0 ? (
          <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] font-semibold shrink-0">
              {isJa ? "選択中品番:" : "Selected parts:"}
            </span>
            {selectedParts.map((p, pIdx) => {
              const color = PALETTE[pIdx % PALETTE.length];
              return (
                <div
                  key={`${p.hinban}-${p.seiban}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-2xs group"
                  style={{ borderLeftColor: color.border, borderLeftWidth: 3 }}
                >
                  <span className="text-[var(--text-primary)]">{p.hinban}</span>
                  {p.seiban && (
                    <span className="px-1.5 py-0.2 rounded bg-[var(--surface-subtle)] border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                      {p.seiban}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemovePart(p.hinban, p.seiban)}
                    className="ml-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
                    title={isJa ? "削除" : "Remove"}
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              );
            })}

            {/* Quick add other parts in same model family */}
            {selectedModels.map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => handleAddAllWithModel(model)}
                className="px-2.5 py-0.8 text-[11px] font-semibold rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition inline-flex items-center gap-1"
                title={isJa ? `同一モデル「${model}」の品番をすべて追加` : `Add all parts with model ${model}`}
              >
                <span className="material-symbols-outlined text-[13px]">group_add</span>
                <span>{isJa ? `同モデル「${model}」を一括追加` : `+ Add Model ${model}`}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={handleClearAllParts}
              className="px-2 py-0.8 text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline transition ml-auto sm:ml-0"
            >
              {isJa ? "すべてクリア" : "Clear all"}
            </button>
          </div>
        ) : (
          /* Quick Part Chips (When no parts selected) */
          quickPartChips.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {isJa ? "クイック選択:" : "Quick select:"}
              </span>
              {quickPartChips.map((chip) => (
                <button
                  key={`${chip.hinban}-${chip.seiban}`}
                  type="button"
                  onClick={() => handleAddPart(chip)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-md bg-[var(--surface-subtle)] hover:bg-blue-500/10 text-[var(--text-primary)] hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] transition shadow-2xs"
                >
                  <span>+ {chip.hinban}</span>
                  {chip.seiban && (
                    <span className="px-1 py-0.2 rounded bg-black/5 dark:bg-white/5 text-[10px] text-[var(--text-muted)]">
                      {chip.seiban}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── 2. Header Cards: Single Part OR Multi-Part Package ──────────────────── */}
      {selectedParts.length === 1 && (
        /* Single Part Header Card */
        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {imageLoading ? (
                <div className="h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-subtle)] flex items-center justify-center animate-pulse">
                  <span className="material-symbols-outlined text-[20px] text-[var(--text-muted)] animate-spin">
                    progress_activity
                  </span>
                </div>
              ) : primaryImage ? (
                <button
                  type="button"
                  onClick={() =>
                    setPhotoPreview({
                      eyebrow: isJa ? "マスター画像" : "Master Image",
                      displayName: primaryMasterData?.["品名"] ?? selectedParts[0].hinban,
                      subtitle: `${selectedParts[0].hinban}${selectedParts[0].seiban ? ` / ${selectedParts[0].seiban}` : ""}`,
                      images: [{ url: primaryImage, label: primaryMasterData?.["品名"] ?? selectedParts[0].hinban }],
                      activeIndex: 0,
                    })
                  }
                  className="group relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-black/5 dark:bg-white/5 flex items-center justify-center p-1 hover:border-[var(--freya-blue)] cursor-zoom-in transition-all shadow-2xs hover:shadow-sm"
                  title={isJa ? "クリックして拡大表示" : "Click to view image"}
                >
                  <img
                    src={primaryImage}
                    alt={selectedParts[0].hinban}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-end justify-end p-0.5">
                    <span className="material-symbols-outlined text-[12px] text-white bg-black/60 rounded-xs p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      zoom_in
                    </span>
                  </div>
                </button>
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20 shadow-2xs">
                  <span className="material-symbols-outlined text-[28px]">category</span>
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black font-mono text-[var(--text-primary)]">
                    {selectedParts[0].hinban}
                  </h2>
                  {selectedParts[0].seiban && (
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs font-bold font-mono text-[var(--text-primary)] shadow-2xs">
                      {selectedParts[0].seiban}
                    </span>
                  )}
                  {primaryMasterData?.["モデル"] && (
                    <span className="rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[11px] font-bold">
                      {primaryMasterData["モデル"]}
                    </span>
                  )}
                </div>
                {primaryMasterData?.["品名"] && (
                  <p className="text-sm font-semibold text-[var(--text-secondary)] mt-0.5 truncate">
                    {primaryMasterData["品名"]}
                  </p>
                )}
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {isJa
                    ? `過去全設備での生産実績: 合計 ${machineStats.totalRecords} ロット / ${machineStats.machines.length} 設備稼働`
                    : `Cross-machine history: ${machineStats.totalRecords} runs across ${machineStats.machines.length} machines`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handleClearAllParts}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
              >
                {isJa ? "品番変更" : "Change Part"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedParts.length > 1 && (
        /* Multi-Part Package Card */
        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-xs">
                <span className="material-symbols-outlined text-[26px]">view_in_ar</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                    {isJa ? "複数品番パッケージ分析" : "Multi-Part Bundle Analysis"}
                  </h2>
                  <span className="rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2.5 py-0.5 text-xs font-bold">
                    {selectedParts.length} {isJa ? "品番選択中" : "parts"}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {isJa
                    ? `選択された ${selectedParts.length} 品番の合計実績: ${machineStats.totalRecords} ロット / ${machineStats.machines.length} 設備で稼働`
                    : `Aggregating ${selectedParts.length} parts: ${machineStats.totalRecords} total runs across ${machineStats.machines.length} machines`}
                </p>
              </div>
            </div>

            {/* Chart Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-[var(--surface-subtle)] p-1 rounded-lg border border-[var(--border)] self-end sm:self-center">
              <button
                type="button"
                onClick={() => setChartDisplayMode("stacked")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  chartDisplayMode === "stacked"
                    ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isJa ? "品番別内訳 (Stacked)" : "By Part"}
              </button>
              <button
                type="button"
                onClick={() => setChartDisplayMode("combined")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  chartDisplayMode === "combined"
                    ? "bg-[var(--surface)] text-[var(--freya-blue)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isJa ? "合算合計 (Combined)" : "Combined"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Empty State (When No Part Selected) ────────────────────────────── */}
      {selectedParts.length === 0 && (
        <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-xs">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] flex items-center justify-center border border-[var(--freya-blue)]/20 shadow-xs">
            <span className="material-symbols-outlined text-[36px]">compare_arrows</span>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {isJa ? "品番・背番号を選択して設備横断比較を開始" : "Select Part Number(s) to Compare Across Machines"}
          </h3>
          <p className="mt-1.5 max-w-md mx-auto text-xs text-[var(--text-secondary)]">
            {isJa
              ? "単一の品番だけでなく、左右ペアや製品グループなど複数の品番を同時選択して合算・内訳比較が可能です。"
              : "Compare volume share, defect rates, and operating speeds for single parts or multiple part bundles across your entire fleet."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (quickPartChips[0]) handleAddPart(quickPartChips[0]);
              }}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--freya-blue)] text-white shadow-sm hover:opacity-90 transition"
            >
              {isJa ? "サンプル品番で比較を見る" : "View Sample Part"}
            </button>
            {quickPartChips.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  handleAddPart(quickPartChips[0]);
                  handleAddPart(quickPartChips[1]);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition"
              >
                {isJa ? "複数品番ペアで比較を見る" : "View 2-Part Bundle"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 4. Main Analytics Content (When Part(s) Selected) ──────────────────── */}
      {selectedParts.length > 0 && (
        <>
          {loading ? (
            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-16 text-center shadow-xs">
              <span className="material-symbols-outlined text-[36px] text-[var(--text-muted)] animate-spin mb-3">
                progress_activity
              </span>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                {isJa ? "設備横断実績データを集計中..." : "Aggregating cross-machine fleet data..."}
              </p>
            </div>
          ) : machineStats.machines.length === 0 ? (
            <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-xs">
              <span className="material-symbols-outlined text-[36px] text-[var(--text-muted)] mb-2">
                info
              </span>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {isJa ? "選択された期間の生産実績がありません" : "No production records found for this period"}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {isJa ? "上部の期間セレクターを「全期間」に変更してお試しください。" : "Try changing the period preset to 'All Time'."}
              </p>
            </div>
          ) : (
            <>
              {/* ── Summary KPI Cards ───────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold">
                    <span>{isJa ? "総生産ショット数" : "Total Part Shots"}</span>
                    <span className="material-symbols-outlined text-[18px] text-blue-500">production_quantity_limits</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-[var(--text-primary)] mt-1.5">
                    {(machineStats.totalAllShots || 0).toLocaleString()}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {isJa
                      ? `${machineStats.machines.length} 設備で加工実績あり`
                      : `${machineStats.machines.length} active machines`}
                  </p>
                </div>

                <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold">
                    <span>{isJa ? "最多生産設備 (シェア)" : "Top Volume Machine"}</span>
                    <span className="material-symbols-outlined text-[18px] text-emerald-500">leaderboard</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1.5">
                    {highlights.topMachine?.machine || "—"}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {highlights.topMachine
                      ? `${(highlights.topMachine.analytics?.totalShots || 0).toLocaleString()} shots (${highlights.topMachine.share}%)`
                      : "—"}
                  </p>
                </div>

                <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold">
                    <span>{isJa ? "最良品質設備 (ベンチマーク)" : "Best Quality Machine"}</span>
                    <span className="material-symbols-outlined text-[18px] text-purple-500">verified</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1.5">
                    {highlights.bestQualityMachine?.machine || "—"}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {highlights.bestQualityMachine
                      ? `${highlights.bestQualityMachine.analytics?.defectRate || 0}% ${isJa ? "不良率" : "defect rate"}`
                      : "—"}
                  </p>
                </div>

                <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold">
                    <span>{isJa ? "全体平均不良率" : "Overall Defect Rate"}</span>
                    <span className="material-symbols-outlined text-[18px] text-rose-500">pie_chart</span>
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-500 mt-1.5">
                    {highlights.overallDefectRate}%
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {isJa
                      ? `累計不良数: ${(highlights.totalDefects || 0).toLocaleString()} 個`
                      : `Total defects: ${(highlights.totalDefects || 0).toLocaleString()}`}
                  </p>
                </div>
              </div>

              {/* ── Dual-Axis Chart ─────────────────────────────────────────── */}
              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {isJa ? "設備別 生産ショット数 ＆ 不良率 比較" : "Fleet Volume vs. Defect Rate Comparison"}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {selectedParts.length > 1
                        ? isJa
                          ? `選択中 ${selectedParts.length} 品番の各設備での生産割合と不良率を比較します。`
                          : `Comparing production allocation and defect rates for ${selectedParts.length} selected parts.`
                        : isJa
                        ? "どの設備が主力で生産されており、品質（不良率）が安定しているかを可視化します。"
                        : "Compare production allocation and quality stability across all assigned machines."}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    {machineStats.machines.length} {isJa ? "設備" : "machines"}
                  </span>
                </div>
                <div className="h-72 w-full">
                  <canvas ref={chartCanvasRef} />
                </div>
              </div>

              {/* ── Machine Breakdown Table ─────────────────────────────────── */}
              <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {isJa ? "設備別 生産・品質ベンチマーク一覧" : "Machine Fleet Benchmark Breakdown"}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {isJa
                        ? "行を展開（▼）すると、品番別内訳や担当作業者の記録を確認できます。"
                        : "Expand (▼) to inspect individual part breakdown and operator run records."}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold select-none">
                      <tr>
                        <th className="px-3 py-2.5">{isJa ? "設備名" : "Machine"}</th>
                        <th className="px-3 py-2.5 text-right">{isJa ? "生産ショット数" : "Total Shots"}</th>
                        <th className="px-3 py-2.5 text-right">{isJa ? "全体シェア" : "Share"}</th>
                        <th className="px-3 py-2.5 text-right">{isJa ? "不良数 / 不良率" : "Defects / Rate"}</th>
                        <th className="px-3 py-2.5 text-right">{isJa ? "稼働時間" : "Operating Hours"}</th>
                        <th className="px-3 py-2.5 text-right">{isJa ? "ペース (ショット/h)" : "Pace"}</th>
                        <th className="px-3 py-2.5 text-center">{isJa ? "ロット詳細" : "Details"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] font-medium text-[var(--text-primary)]">
                      {machineStats.machines.map((m) => {
                        const analytics = m.analytics;
                        const isExpanded = expandedMachine === m.machine;
                        const rate = analytics?.defectRate || 0;
                        const badgeStyle = getFactoryBadgeStyle(m.factory);

                        let qualityBadge = {
                          text: isJa ? "良好" : "Optimal",
                          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                        };
                        if (rate >= 3.0) {
                          qualityBadge = {
                            text: isJa ? "要調整" : "Inspect",
                            color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                          };
                        } else if (rate >= 1.0) {
                          qualityBadge = {
                            text: isJa ? "標準" : "Standard",
                            color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                          };
                        }

                        return (
                          <React.Fragment key={m.machine}>
                            <tr
                              onClick={() => setExpandedMachine(isExpanded ? null : m.machine)}
                              className="hover:bg-blue-500/5 dark:hover:bg-blue-500/10 cursor-pointer transition-colors"
                            >
                              <td className="px-3 py-2 font-mono whitespace-nowrap font-bold text-[var(--text-primary)]">
                                <div className="flex items-center gap-2">
                                  <span>{m.machine}</span>
                                  {m.factory && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-sans font-medium border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                                    >
                                      {m.factory}
                                    </span>
                                  )}
                                </div>
                                {/* In multi-part mode, show small pill preview of parts that ran on this machine */}
                                {selectedParts.length > 1 && m.partsBreakdown.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {m.partsBreakdown.map((pb) => (
                                      <span
                                        key={`${pb.hinban}-${pb.seiban}`}
                                        className="inline-block px-1.5 py-0.2 rounded bg-[var(--surface-subtle)] border border-[var(--border)] text-[9px] text-[var(--text-muted)] font-normal"
                                      >
                                        {pb.hinban.slice(-5)}: {pb.shots.toLocaleString()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                                {(analytics?.totalShots || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="w-12 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${Math.min(100, m.share)}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-[11px]">{m.share}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>{(analytics?.totalDefects || 0).toLocaleString()}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${qualityBadge.color}`}
                                  >
                                    {rate}% ({qualityBadge.text})
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                                {analytics?.workingHours ?? 0}h
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                                {(analytics?.avgShotsPerHour || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedMachine(isExpanded ? null : m.machine);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.8 text-[11px] font-semibold rounded bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition"
                                >
                                  <span>{m.records.length} {isJa ? "ロット" : "runs"}</span>
                                  <span
                                    className={`material-symbols-outlined text-[14px] transition-transform duration-200 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  >
                                    expand_more
                                  </span>
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Records Sub-table */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} className="px-4 py-3 bg-[var(--surface-subtle)]/70 border-y border-[var(--border)]">
                                  <div className="space-y-3">
                                    {/* If multiple parts, show part summary breakdown for this machine */}
                                    {selectedParts.length > 1 && m.partsBreakdown.length > 1 && (
                                      <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] space-y-1.5">
                                        <div className="text-[11px] font-bold text-[var(--text-primary)]">
                                          {isJa ? "この設備での品番別集計内訳:" : "Part Breakdown on this Machine:"}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                          {m.partsBreakdown.map((pb) => {
                                            const pRate = pb.shots > 0 ? ((pb.defects / pb.shots) * 100).toFixed(2) : "0.00";
                                            return (
                                              <div
                                                key={`${pb.hinban}-${pb.seiban}`}
                                                className="p-2 rounded border border-[var(--border)] bg-[var(--surface-subtle)]/50 text-[10px]"
                                              >
                                                <div className="font-mono font-bold text-[var(--text-primary)] truncate">
                                                  {pb.hinban}
                                                </div>
                                                <div className="flex items-center justify-between text-[var(--text-secondary)] mt-0.5">
                                                  <span>{pb.shots.toLocaleString()} shots</span>
                                                  <span className={Number(pRate) > 1.5 ? "text-rose-500 font-bold" : ""}>
                                                    {pRate}% NG
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Individual Run Records */}
                                    <div>
                                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-semibold mb-1">
                                        <span>
                                          {m.machine} {isJa ? "の作業実績一覧 (クリックで実績詳細を開く)" : "Run Records (Click to inspect)"}
                                        </span>
                                        <span>{m.records.length} {isJa ? "件" : "records"}</span>
                                      </div>
                                      <div className="overflow-x-auto rounded border border-[var(--border)] bg-[var(--surface)] max-h-56 overflow-y-auto">
                                        <table className="w-full text-[11px] text-left">
                                          <thead className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[var(--text-muted)] sticky top-0">
                                            <tr>
                                              <th className="px-2.5 py-1.5">{isJa ? "品番" : "Part"}</th>
                                              <th className="px-2.5 py-1.5">{isJa ? "日付" : "Date"}</th>
                                              <th className="px-2.5 py-1.5">{isJa ? "時間帯" : "Time"}</th>
                                              <th className="px-2.5 py-1.5">{isJa ? "作業者" : "Worker"}</th>
                                              <th className="px-2.5 py-1.5 text-right">{isJa ? "ショット数" : "Shots"}</th>
                                              <th className="px-2.5 py-1.5 text-right">{isJa ? "不良数" : "Defects"}</th>
                                              <th className="px-2.5 py-1.5 text-center">{isJa ? "詳細" : "Details"}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[var(--border)]">
                                            {m.records.map((r, rIdx) => {
                                              const shots = Number(r.Total_Count || r.totalCount || r.良品数 || 0);
                                              const defects = Number(r.Bad_Count || r.badCount || r.不良数 || 0);
                                              const worker = r.Worker_Name || r["作業者"] || "—";
                                              const h = r["品番"] || "—";
                                              const s = r["背番号"] || "";

                                              return (
                                                <tr
                                                  key={r._id || `${r.Date}-${rIdx}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRecordForDetail(r);
                                                  }}
                                                  className="hover:bg-blue-500/10 cursor-pointer transition-colors"
                                                >
                                                  <td className="px-2.5 py-1.5 font-mono font-bold text-[var(--text-primary)]">
                                                    {h} {s ? `(${s})` : ""}
                                                  </td>
                                                  <td className="px-2.5 py-1.5 font-mono">{r.Date || "—"}</td>
                                                  <td className="px-2.5 py-1.5 font-mono text-[var(--text-secondary)]">
                                                    {r.Time_start && r.Time_end ? `${r.Time_start} ~ ${r.Time_end}` : "—"}
                                                  </td>
                                                  <td className="px-2.5 py-1.5 font-medium">{worker}</td>
                                                  <td className="px-2.5 py-1.5 text-right font-mono font-bold">
                                                    {shots.toLocaleString()}
                                                  </td>
                                                  <td className="px-2.5 py-1.5 text-right font-mono">
                                                    {defects > 0 ? (
                                                      <span className="text-rose-500 font-bold">{defects}</span>
                                                    ) : (
                                                      <span className="text-[var(--text-muted)]">0</span>
                                                    )}
                                                  </td>
                                                  <td className="px-2.5 py-1.5 text-center text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                                                    {isJa ? "開く ➔" : "View ➔"}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
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
        </>
      )}

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
    </div>
  );
}
