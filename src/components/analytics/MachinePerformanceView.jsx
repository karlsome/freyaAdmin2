import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchEquipmentList, fetchEquipmentData } from "../../services/api";
import {
  getBusinessDayRange,
  calculateEquipmentAnalytics,
  groupRecordsByEquipment,
} from "./equipmentAnalyticsUtils";
import MachineCard from "./MachineCard";
import MachineComparisonChart from "./MachineComparisonChart";
import MachineDetailModal from "./MachineDetailModal";
import MachineSelectorModal from "./MachineSelectorModal";
import { AnalyticsKpiCard } from "./AnalyticsKpiCards";

export default function MachinePerformanceView() {
  const { language } = useLanguage();
  const isJa = language === "ja";

  // Date Range state: defaults to past 7 business days
  const [dateRange, setDateRange] = useState(() => {
    const initial = getBusinessDayRange(7);
    return { from: initial.startDate, to: initial.endDate };
  });
  const [rangePreset, setRangePreset] = useState("last7BusinessDays");

  // Equipment List & Factory Groupings from server
  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [equipmentByFactory, setEquipmentByFactory] = useState({});
  const [selectedEquipment, setSelectedEquipment] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("equipmentFilterPreferences");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed?.selectedEquipment)) {
            return parsed.selectedEquipment;
          }
        }
      } catch (e) {
        console.error("Failed to load equipment preferences", e);
      }
    }
    return []; // Empty means all selected initially
  });

  // Machine Selector Pop-up Modal state
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState("shotsDesc");

  // Data states
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);

  // Detail Modal state
  const [activeMachineDetail, setActiveMachineDetail] = useState(null);

  // Load equipment list once on mount
  useEffect(() => {
    let cancelled = false;
    async function loadList() {
      try {
        const res = await fetchEquipmentList();
        if (!cancelled && res?.success) {
          const all = res.allEquipment || [];
          const byFactory = res.equipmentByFactory || {};
          setAvailableEquipment(all);
          setEquipmentByFactory(byFactory);

          // If no previous selection, default to select all
          setSelectedEquipment((prev) => (prev.length === 0 ? all : prev));
        }
      } catch (err) {
        console.error("Failed to load equipment list:", err);
      }
    }
    loadList();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save selected equipment to localStorage
  const handleSaveEquipmentPreferences = useCallback((newSelection) => {
    setSelectedEquipment(newSelection);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "equipmentFilterPreferences",
          JSON.stringify({ selectedEquipment: newSelection })
        );
      } catch (e) {
        console.error("Failed to save equipment preferences", e);
      }
    }
  }, []);

  // Handle Date Range Presets
  const handlePresetChange = (preset) => {
    setRangePreset(preset);
    const today = new Date();
    const format = (d) => d.toISOString().slice(0, 10);

    if (preset === "last7BusinessDays") {
      const r = getBusinessDayRange(7);
      setDateRange({ from: r.startDate, to: r.endDate });
    } else if (preset === "thisWeek") {
      const start = new Date(today);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      setDateRange({ from: format(start), to: format(today) });
    } else if (preset === "last7Days") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setDateRange({ from: format(start), to: format(today) });
    } else if (preset === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateRange({ from: format(start), to: format(today) });
    } else if (preset === "last30Days") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setDateRange({ from: format(start), to: format(today) });
    }
  };

  // Load production records for equipment
  const loadData = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchEquipmentData({
        startDate: dateRange.from,
        endDate: dateRange.to,
        equipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
      });

      if (res?.success && Array.isArray(res.data)) {
        setRecords(res.data);
      } else {
        setRecords([]);
        if (res?.message) setError(res.message);
      }
    } catch (err) {
      console.error("Failed to fetch equipment data:", err);
      setError(err.message || "Failed to load equipment data");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, selectedEquipment]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group records by equipment
  const groupedRecords = useMemo(() => {
    return groupRecordsByEquipment(records);
  }, [records]);

  // Map equipment to factory
  const equipToFactory = useMemo(() => {
    const map = {};
    Object.entries(equipmentByFactory).forEach(([fac, list]) => {
      list.forEach((eq) => {
        map[eq] = fac;
      });
    });
    return map;
  }, [equipmentByFactory]);

  // Compute analytics for each selected equipment
  const machineCardsData = useMemo(() => {
    const targetEquipList =
      selectedEquipment.length > 0 ? selectedEquipment : availableEquipment;

    const cards = targetEquipList.map((machine) => {
      const equipRecords = groupedRecords[machine] || [];
      const analytics = calculateEquipmentAnalytics(equipRecords);
      const factory = equipToFactory[machine] || equipRecords[0]?.工場 || "";
      return {
        machine,
        factory,
        analytics,
        records: equipRecords,
      };
    });

    // Sort cards
    cards.sort((a, b) => {
      const shA = a.analytics.totalShots || 0;
      const shB = b.analytics.totalShots || 0;
      if (sortBy === "shotsDesc") return shB - shA;
      if (sortBy === "shotsAsc") return shA - shB;
      if (sortBy === "shotsPerDay") return (b.analytics.avgShotsPerDay || 0) - (a.analytics.avgShotsPerDay || 0);
      if (sortBy === "shotsPerHour") return (b.analytics.avgShotsPerHour || 0) - (a.analytics.avgShotsPerHour || 0);
      if (sortBy === "workingHours") return (b.analytics.workingHours || 0) - (a.analytics.workingHours || 0);
      if (sortBy === "name") return a.machine.localeCompare(b.machine);
      return 0;
    });

    return cards;
  }, [selectedEquipment, availableEquipment, groupedRecords, equipToFactory, sortBy]);

  // Fleet Summary Metrics
  const fleetSummary = useMemo(() => {
    let totalFleetShots = 0;
    let activeCount = 0;
    let maxShots = 0;
    let topMachine = null;

    machineCardsData.forEach((m) => {
      const shots = m.analytics.totalShots || 0;
      totalFleetShots += shots;
      if (shots > 0) {
        activeCount++;
        if (shots > maxShots) {
          maxShots = shots;
          topMachine = m;
        }
      }
    });

    const fleetAvgShotsPerDay =
      activeCount > 0
        ? Math.round(
            machineCardsData.reduce((acc, m) => acc + (m.analytics.avgShotsPerDay || 0), 0) /
              activeCount
          )
        : 0;

    return {
      totalFleetShots,
      activeCount,
      totalCount: machineCardsData.length,
      fleetAvgShotsPerDay,
      topMachine,
      maxShots,
    };
  }, [machineCardsData]);

  // Find active machine for modal
  const selectedModalData = useMemo(() => {
    if (!activeMachineDetail) return null;
    return (
      machineCardsData.find((m) => m.machine === activeMachineDetail) || {
        machine: activeMachineDetail,
        factory: equipToFactory[activeMachineDetail] || "",
        analytics: calculateEquipmentAnalytics([]),
        records: [],
      }
    );
  }, [activeMachineDetail, machineCardsData, equipToFactory]);

  return (
    <div className="space-y-6">
      {/* ── 1. Machine Performance Filter Bar ───────────────────────────────── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] border border-[var(--freya-blue)]/20">
              <span className="material-symbols-outlined text-[22px]">speed</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isJa ? "設備稼働・ショット数分析" : "Equipment & Machine Performance"}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isJa
                  ? "各設備のショット数、稼働時間、および生産効率を比較・分析します。"
                  : "Monitor and compare machine shot volume, operating hours, and cadence."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Pop-up Machine Selector Modal Trigger Button */}
            <button
              type="button"
              onClick={() => setIsMachineModalOpen(true)}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] shadow-xs transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--freya-blue)]">
                precision_manufacturing
              </span>
              <span>{isJa ? "設備を選択 (工場別)" : "Select Machines"}</span>
              <span className="rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-muted)]">
                {selectedEquipment.length} / {availableEquipment.length}
              </span>
            </button>

            {/* Refresh / Apply Button */}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md bg-[var(--freya-blue)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  loading ? "animate-spin" : ""
                }`}
              >
                refresh
              </span>
              <span>{loading ? (isJa ? "集計中..." : "Loading...") : isJa ? "更新" : "Apply"}</span>
            </button>
          </div>
        </div>

        {/* Date Range & Sort Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[var(--border)]/60">
          {/* Preset Selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              {isJa ? "期間プリセット" : "Date Preset"}
            </label>
            <select
              value={rangePreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="freya-input h-9 text-xs cursor-pointer w-full"
            >
              <option value="last7BusinessDays">
                {isJa ? "過去7営業日 (デフォルト)" : "Last 7 Business Days"}
              </option>
              <option value="thisWeek">{isJa ? "今週 (月〜今日)" : "This Week"}</option>
              <option value="last7Days">{isJa ? "直近7日間" : "Last 7 Days"}</option>
              <option value="thisMonth">{isJa ? "今月" : "This Month"}</option>
              <option value="last30Days">{isJa ? "直近30日間" : "Last 30 Days"}</option>
              <option value="custom">{isJa ? "カスタム指定" : "Custom Range"}</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              {isJa ? "開始日" : "Start Date"}
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => {
                setRangePreset("custom");
                setDateRange((prev) => ({ ...prev, from: e.target.value }));
              }}
              className="freya-input h-9 text-xs w-full"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              {isJa ? "終了日" : "End Date"}
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => {
                setRangePreset("custom");
                setDateRange((prev) => ({ ...prev, to: e.target.value }));
              }}
              className="freya-input h-9 text-xs w-full"
            />
          </div>

          {/* Sort Order Selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              {isJa ? "並び替え" : "Sort By"}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="freya-input h-9 text-xs cursor-pointer w-full"
            >
              <option value="shotsDesc">{isJa ? "総ショット数 (多い順)" : "Total Shots (High → Low)"}</option>
              <option value="shotsAsc">{isJa ? "総ショット数 (少ない順)" : "Total Shots (Low → High)"}</option>
              <option value="shotsPerDay">{isJa ? "平均ショット / 日" : "Avg Shots / Day"}</option>
              <option value="shotsPerHour">{isJa ? "平均ショット / 時" : "Avg Shots / Hour"}</option>
              <option value="workingHours">{isJa ? "稼働時間 (長い順)" : "Working Hours"}</option>
              <option value="name">{isJa ? "設備名順 (A-Z)" : "Machine Name (A-Z)"}</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">
          <span className="font-semibold">{isJa ? "エラー:" : "Error:"}</span> {error}
        </div>
      )}

      {/* ── 2. Fleet Overview KPI Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiCard
          title={isJa ? "フリート総ショット数" : "Total Fleet Shots"}
          value={fleetSummary.totalFleetShots.toLocaleString()}
          subtext={isJa ? `${dateRange.from} 〜 ${dateRange.to}` : "Cumulative in period"}
          icon="precision_manufacturing"
          color="blue"
        />
        <AnalyticsKpiCard
          title={isJa ? "稼働設備比率" : "Active Machine Ratio"}
          value={`${fleetSummary.activeCount} / ${fleetSummary.totalCount}`}
          subtext={isJa ? "期間内実績あり" : "Equipment with shots"}
          icon="power"
          color="emerald"
        />
        <AnalyticsKpiCard
          title={isJa ? "設備平均 / 日" : "Fleet Avg / Day"}
          value={fleetSummary.fleetAvgShotsPerDay.toLocaleString()}
          subtext={isJa ? "稼働機1台あたり日平均" : "Average per active machine"}
          icon="speed"
          color="purple"
        />
        <AnalyticsKpiCard
          title={isJa ? "最高生産設備 (TOP)" : "Top Machine"}
          value={fleetSummary.topMachine ? fleetSummary.topMachine.machine : "—"}
          subtext={
            fleetSummary.topMachine
              ? `${(fleetSummary.topMachine.analytics.totalShots || 0).toLocaleString()} shots (${
                  fleetSummary.topMachine.factory
                })`
              : "—"
          }
          icon="trophy"
          color="amber"
        />
      </div>

      {/* ── 3. Fleet Comparison Ranking Chart ──────────────────────────────── */}
      <MachineComparisonChart
        machines={machineCardsData}
        onSelectMachine={(machineName) => setActiveMachineDetail(machineName)}
        isJa={isJa}
      />

      {/* ── 4. Machine Comparison Cards Grid ───────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--freya-blue)]">grid_view</span>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {isJa ? "設備別ショット数・稼働サマリー" : "Machine Performance Summary Cards"}
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              ({machineCardsData.length} {isJa ? "設備" : "machines"})
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            {isJa ? "カードをクリックで詳細実績を表示" : "Click card to view detailed records"}
          </span>
        </div>

        {/* Responsive Grid */}
        {machineCardsData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {machineCardsData.map((item) => (
              <MachineCard
                key={item.machine}
                machine={item.machine}
                factory={item.factory}
                analytics={item.analytics}
                maxFleetShots={fleetSummary.maxShots}
                onClick={() => setActiveMachineDetail(item.machine)}
                isJa={isJa}
              />
            ))}
          </div>
        ) : (
          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-[36px] mb-2 block text-[var(--text-muted)]">
              search_off
            </span>
            <p className="text-sm font-semibold">
              {isJa ? "表示する設備がありません" : "No machines match the selected filter."}
            </p>
            <p className="text-xs mt-1">
              {isJa
                ? "「設備選択」から対象設備をチェックしてください。"
                : "Please select machines from the filter modal above."}
            </p>
          </div>
        )}
      </div>

      {/* ── 5. Machine Detail Modal / Drawer (Progressive Disclosure) ────────── */}
      {activeMachineDetail && selectedModalData && (
        <MachineDetailModal
          machine={selectedModalData.machine}
          factory={selectedModalData.factory}
          records={selectedModalData.records}
          analytics={selectedModalData.analytics}
          dateRange={dateRange}
          onClose={() => setActiveMachineDetail(null)}
          isJa={isJa}
        />
      )}

      {/* ── 6. Pop-up Machine Selector Modal ──────────────────────────────── */}
      <MachineSelectorModal
        isOpen={isMachineModalOpen}
        onClose={() => setIsMachineModalOpen(false)}
        equipmentByFactory={equipmentByFactory}
        allEquipment={availableEquipment}
        selectedEquipment={selectedEquipment}
        onConfirm={handleSaveEquipmentPreferences}
      />
    </div>
  );
}
