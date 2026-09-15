import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { fetchAnalyticsData } from "../../services/api";
import { AnalyticsKpiCard } from "./AnalyticsKpiCards";
import QualityTrendChart from "./QualityTrendChart";
import DefectBarChart from "./DefectBarChart";
import DefectDistributionChart from "./DefectDistributionChart";
import FactoryDefectsChart from "./FactoryDefectsChart";
import { resolveDefectLabels } from "./defectLabelUtils";

const PROCESSES = [
  { key: "kensaDB", labelJa: "検査 (kensaDB)", labelEn: "Inspection (kensaDB)", icon: "search_check" },
  { key: "pressDB", labelJa: "プレス (pressDB)", labelEn: "Press (pressDB)", icon: "compress" },
  { key: "slitDB", labelJa: "スリット (slitDB)", labelEn: "Slit (slitDB)", icon: "content_cut" },
  { key: "SRSDB", labelJa: "SRS (SRSDB)", labelEn: "SRS (SRSDB)", icon: "layers" },
];

export default function QualityAnalyticsView({
  dateRange,
  factory,
  activeProcess = "kensaDB",
  onProcessChange,
  bans = [],
  partNumbers = [],
  advancedFilters = [],
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";

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
          console.error("Failed to load quality analytics:", err);
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
  const defectAnalysis = analyticsData?.defectAnalysis || [];
  const defectDefinitions = analyticsData?.defectDefinitions || [];

  const [activeModel, setActiveModel] = useState("");

  // Sync activeModel from advancedFilters if user specified a model
  useEffect(() => {
    if (Array.isArray(advancedFilters)) {
      for (const clause of advancedFilters) {
        if (clause && typeof clause === "object" && clause["モデル"]) {
          const m = Array.isArray(clause["モデル"]) ? clause["モデル"][0] : clause["モデル"];
          if (typeof m === "string" && m.trim()) {
            setActiveModel(m.trim());
            return;
          }
        }
      }
    }
  }, [advancedFilters]);

  const totalProduction = summary.totalProduction || 0;
  const totalDefects = summary.totalDefects || 0;
  const avgDefectRate = summary.avgDefectRate != null ? Number(summary.avgDefectRate.toFixed(2)) : 0;
  const yieldRate = totalProduction > 0 ? (((totalProduction - totalDefects) / totalProduction) * 100).toFixed(2) : "—";

  // Calculate highest defect mode from defectAnalysis using dynamic defect labels
  let topDefectName = "—";
  let topDefectCount = 0;
  if (defectAnalysis.length > 0) {
    const analysis = defectAnalysis[0];
    const labels = resolveDefectLabels({
      collectionName: collection,
      defectAnalysis,
      defectDefinitions,
      selectedModel: activeModel,
      isJa,
    });
    const fields = analysis.defectFields || [
      "counter1Total", "counter2Total", "counter3Total", "counter4Total",
      "counter5Total", "counter6Total", "counter7Total", "counter8Total",
      "counter9Total", "counter10Total", "counter11Total", "counter12Total"
    ];
    fields.forEach((field, i) => {
      const val = Number(analysis[field] || 0);
      if (val > topDefectCount) {
        topDefectCount = val;
        topDefectName = labels[i] || `Counter ${i + 1}`;
      }
    });
  }

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

      {/* ── Quality KPI Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnalyticsKpiCard
          title={isJa ? "総不良数" : "Total Defects"}
          value={totalDefects.toLocaleString()}
          subtext={isJa ? "全検出不良項目合計" : "Total defects recorded"}
          icon="error"
          color="rose"
        />
        <AnalyticsKpiCard
          title={isJa ? "平均不良率" : "Avg Defect Rate"}
          value={`${avgDefectRate}%`}
          subtext={isJa ? "全体不良発生比率" : "Overall scrap percentage"}
          icon="trending_down"
          color={avgDefectRate > 5 ? "rose" : avgDefectRate > 2 ? "amber" : "emerald"}
          badge={{
            text: avgDefectRate <= 2 ? (isJa ? "目標内" : "On Target") : (isJa ? "要注意" : "Warning"),
            style: avgDefectRate <= 2 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20",
          }}
        />
        <AnalyticsKpiCard
          title={isJa ? "良品率" : "First Pass Yield"}
          value={yieldRate !== "—" ? `${yieldRate}%` : "—"}
          subtext={isJa ? "歩留まり目標: 98.0%+" : "Target: 98.0%+"}
          icon="verified"
          color="emerald"
        />
        <AnalyticsKpiCard
          title={isJa ? "ワースト不良項目" : "Top Defect Mode"}
          value={topDefectName}
          subtext={topDefectCount > 0 ? `${topDefectCount.toLocaleString()} ${isJa ? "件" : "occurrences"}` : "—"}
          icon="warning"
          color="amber"
        />
        <AnalyticsKpiCard
          title={isJa ? "集計日数" : "Active Days"}
          value={`${dailyTrend.length} ${isJa ? "日間" : "days"}`}
          subtext={isJa ? "データ有効稼働日" : "Operating dates"}
          icon="calendar_today"
          color="blue"
        />
      </div>

      {/* ── Charts Grid (2 columns matching legacy layout) ────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Quality Trend (Defect Rate %) */}
        <div>
          <QualityTrendChart dailyTrend={dailyTrend} />
        </div>

        {/* 2. Factory Defect Volume Comparison */}
        <div>
          <FactoryDefectsChart factoryStats={factoryStats} />
        </div>

        {/* 3. Defect Count by Type */}
        <div>
          <DefectBarChart
            defectAnalysis={defectAnalysis}
            defectDefinitions={defectDefinitions}
            collectionName={collection}
            activeModel={activeModel}
            onModelChange={setActiveModel}
          />
        </div>

        {/* 4. Defect Distribution (by Process) */}
        <div>
          <DefectDistributionChart
            defectAnalysis={defectAnalysis}
            defectDefinitions={defectDefinitions}
            collectionName={collection}
            activeModel={activeModel}
            onModelChange={setActiveModel}
          />
        </div>
      </div>
    </div>
  );
}
