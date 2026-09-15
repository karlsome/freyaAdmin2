import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchAnalyticsData } from "../../services/api";
import { AnalyticsKpiCard } from "./AnalyticsKpiCards";
import ProductionTrendChart from "./ProductionTrendChart";
import DedicatedProductionChart from "./DedicatedProductionChart";
import DedicatedDefectTrendChart from "./DedicatedDefectTrendChart";
import FactoryPerformanceChart from "./FactoryPerformanceChart";
import WorkerPerformanceChart from "./WorkerPerformanceChart";
import EquipmentEfficiencyChart from "./EquipmentEfficiencyChart";

const PROCESSES = [
  { key: "kensaDB", labelJa: "検査 (kensaDB)", labelEn: "Inspection (kensaDB)", icon: "search_check" },
  { key: "pressDB", labelJa: "プレス (pressDB)", labelEn: "Press (pressDB)", icon: "compress" },
  { key: "slitDB", labelJa: "スリット (slitDB)", labelEn: "Slit (slitDB)", icon: "content_cut" },
  { key: "SRSDB", labelJa: "SRS (SRSDB)", labelEn: "SRS (SRSDB)", icon: "layers" },
];

export default function ProductionAnalyticsView({
  dateRange,
  factory,
  activeProcess = "kensaDB",
  onProcessChange,
  bans = [],
  partNumbers = [],
  advancedFilters = [],
}) {
  const { language, t } = useLanguage();
  const isJa = language === "ja";
  const navigate = useNavigate();

  const [collectionName, setCollectionName] = useState(activeProcess || "kensaDB");
  const collection = activeProcess || collectionName;

  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [error, setError] = useState(null);

  const bansKey = JSON.stringify(bans);
  const partNumbersKey = JSON.stringify(partNumbers);
  const advancedFiltersKey = JSON.stringify(advancedFilters);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!dateRange?.from || !dateRange?.to) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetchAnalyticsData({
          fromDate: dateRange.from,
          toDate: dateRange.to,
          collectionName: collection,
          factoryFilter: factory || undefined,
          bans: bans.length > 0 ? bans : undefined,
          partNumbers: partNumbers.length > 0 ? partNumbers : undefined,
          advancedFilters: advancedFilters.length > 0 ? advancedFilters : undefined,
        });

        if (!isCancelled) {
          if (res?.success && res?.data) {
            setAnalyticsData(res.data);
          } else {
            setAnalyticsData(null);
            if (res?.error) setError(res.error);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load production analytics:", err);
          setError(err.message || "Failed to load data");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [dateRange.from, dateRange.to, factory, collection, bansKey, partNumbersKey, advancedFiltersKey]);

  const summary = analyticsData?.summary?.[0] || {};
  const dailyTrend = analyticsData?.dailyTrend || [];
  const factoryStats = analyticsData?.factoryStats || [];
  const workerStats = analyticsData?.workerStats || [];
  const equipmentStats = analyticsData?.equipmentStats || [];

  const totalProduction = summary.totalProduction || 0;
  const totalDefects = summary.totalDefects || 0;
  const avgCycleTime = summary.avgCycleTime != null ? Number(summary.avgCycleTime.toFixed(1)) : 0;
  const yieldRate = totalProduction > 0 ? (((totalProduction - totalDefects) / totalProduction) * 100).toFixed(1) : "—";
  const totalFactories = summary.totalFactories || factoryStats.length || 0;
  const totalWorkers = summary.totalWorkers || workerStats.length || 0;

  return (
    <div className="space-y-6">
      {/* ── Process Selector Pills ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {isJa ? "対象工程 / プロセス:" : "Target Process:"}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PROCESSES.map((proc) => {
              const active = collection === proc.key;
              return (
                <button
                  key={proc.key}
                  type="button"
                  onClick={() => {
                    if (onProcessChange) {
                      onProcessChange(proc.key);
                    } else {
                      setCollectionName(proc.key);
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[var(--freya-blue)] text-white shadow-xs"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{proc.icon}</span>
                  <span>{isJa ? proc.labelJa : proc.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--freya-blue)]">
              <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              <span>{isJa ? "読み込み中..." : "Loading..."}</span>
            </div>
          )}
          {!loading && (
            <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
              {dateRange.from} ~ {dateRange.to} {factory ? `• ${factory}` : ""}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">
          <span className="font-semibold">{isJa ? "エラー:" : "Error:"}</span> {error}
        </div>
      )}

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnalyticsKpiCard
          title={isJa ? "総生産量" : "Total Production"}
          value={totalProduction.toLocaleString()}
          subtext={isJa ? "良品・不良品合計" : "Total units processed"}
          icon="precision_manufacturing"
          color="blue"
        />
        <AnalyticsKpiCard
          title={isJa ? "良品率" : "First Pass Yield"}
          value={yieldRate !== "—" ? `${yieldRate}%` : "—"}
          subtext={isJa ? "総合出来高歩留まり" : "Overall yield rate"}
          icon="check_circle"
          color="emerald"
        />
        <AnalyticsKpiCard
          title={isJa ? "稼働工場数" : "Active Factories"}
          value={totalFactories}
          subtext={factory ? factory : (isJa ? "集計対象全工場" : "All active facilities")}
          icon="domain"
          color="purple"
        />
        <AnalyticsKpiCard
          title={isJa ? "作業者数" : "Active Workers"}
          value={totalWorkers}
          subtext={isJa ? "記録された作業者" : "Operators recorded"}
          icon="groups"
          color="indigo"
        />
        <AnalyticsKpiCard
          title={isJa ? "平均サイクルタイム" : "Avg Cycle Time"}
          value={avgCycleTime > 0 ? `${avgCycleTime}m` : "—"}
          subtext={isJa ? "1個あたりの処理時間" : "Average per unit"}
          icon="schedule"
          color="amber"
        />
      </div>

      {/* ── Charts Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Production & Defect Combined Trend */}
        <div className="lg:col-span-2">
          <ProductionTrendChart dailyTrend={dailyTrend} />
        </div>

        {/* 2. Dedicated Production Output Trend */}
        <div>
          <DedicatedProductionChart dailyTrend={dailyTrend} />
        </div>

        {/* 3. Dedicated Defect Trend */}
        <div>
          <DedicatedDefectTrendChart dailyTrend={dailyTrend} />
        </div>

        {/* 4. Factory Performance Comparison */}
        <div>
          <FactoryPerformanceChart factoryStats={factoryStats} />
        </div>

        {/* 3. Worker Performance (Top 10) */}
        <div>
          <WorkerPerformanceChart workerStats={workerStats} />
        </div>

        {/* 4. Equipment Efficiency (Top 10) */}
        <div className="lg:col-span-2">
          <EquipmentEfficiencyChart equipmentStats={equipmentStats} />
        </div>
      </div>

      {/* ── Quick Shortcut: Part Benchmarking Across Fleet ──────────────── */}
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)]/70 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--freya-blue)]/10 text-[var(--freya-blue)] flex items-center justify-center border border-[var(--freya-blue)]/20 shrink-0">
            <span className="material-symbols-outlined text-[22px]">category</span>
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              {isJa ? "品番・背番号ごとの設備横断比較" : "Cross-Machine Part Benchmarking"}
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isJa
                ? "同一品番がどの設備で最も効率良く、低不良率で生産されているかを設備間で比較・分析します。"
                : "Compare volume, defect rates, and operating pace for specific parts across all machines in your fleet."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/analytics/parts")}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--freya-blue)] text-white hover:opacity-90 transition shadow-xs shrink-0 self-end sm:self-center"
        >
          <span>{isJa ? "品番・設備比較を開く" : "Open Part Benchmarking"}</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
