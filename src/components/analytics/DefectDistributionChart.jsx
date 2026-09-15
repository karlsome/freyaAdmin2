import React, { useEffect, useRef, useMemo } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";
import { resolveDefectLabels } from "./defectLabelUtils";

const DEFECT_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#6366F1",
  "#F43F5E", "#06B6D4"
];

export default function DefectDistributionChart({
  defectAnalysis = [],
  defectDefinitions = [],
  collectionName = "kensaDB",
  activeModel = "",
  onModelChange,
}) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const { language } = useLanguage();
  const isJa = language === "ja";

  const availableModels = useMemo(() => {
    if (!Array.isArray(defectDefinitions)) return [];
    return defectDefinitions.map((d) => d?.モデル).filter(Boolean);
  }, [defectDefinitions]);

  const analysis = defectAnalysis[0] || {};
  const defectFields = analysis.defectFields || [
    "counter1Total", "counter2Total", "counter3Total", "counter4Total",
    "counter5Total", "counter6Total", "counter7Total", "counter8Total",
    "counter9Total", "counter10Total", "counter11Total", "counter12Total"
  ];

  const fullLabels = useMemo(() => {
    return resolveDefectLabels({
      collectionName,
      defectAnalysis,
      defectDefinitions,
      selectedModel: activeModel,
      isJa,
    });
  }, [collectionName, defectAnalysis, defectDefinitions, activeModel, isJa]);

  const { items, total } = useMemo(() => {
    const list = [];
    defectFields.forEach((field, i) => {
      const val = Number(analysis[field] || 0);
      if (val > 0) {
        list.push({
          index: i,
          field,
          label: fullLabels[i] || `Counter ${i + 1}`,
          count: val,
          color: DEFECT_COLORS[i % DEFECT_COLORS.length],
        });
      }
    });

    const sum = list.reduce((acc, it) => acc + it.count, 0);

    const withPct = list.map((it) => ({
      ...it,
      percentage: sum > 0 ? ((it.count / sum) * 100).toFixed(1) : "0.0",
    }));

    // Sort descending by defect count for the legend
    withPct.sort((a, b) => b.count - a.count);

    return { items: withPct, total: sum };
  }, [analysis, defectFields, fullLabels]);

  const hasData = items.length > 0;

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    const existing = ChartJS.getChart(canvasRef.current);
    if (existing) {
      existing.destroy();
    }
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const chartLabels = hasData ? items.map((it) => it.label) : [isJa ? "データなし" : "No Data"];
    const chartData = hasData ? items.map((it) => it.count) : [1];
    const chartColors = hasData ? items.map((it) => it.color) : ["#e2e8f0"];

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "doughnut",
      data: {
        labels: chartLabels,
        datasets: [
          {
            data: chartData,
            backgroundColor: chartColors,
            borderWidth: 2,
            borderColor: "var(--surface, #ffffff)",
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            display: false, // Use rich HTML legend on the side to prevent text truncation
          },
          tooltip: {
            enabled: hasData,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(236, 72, 153, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (ctxList) => {
                const idx = ctxList[0]?.dataIndex;
                return items[idx]?.label || "";
              },
              label: (ctxItem) => {
                const item = items[ctxItem.dataIndex];
                if (!item) return "";
                return `  ${isJa ? "不良件数" : "Defects"}: ${item.count.toLocaleString()} (${item.percentage}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (canvasRef.current) {
        const existingChart = ChartJS.getChart(canvasRef.current);
        if (existingChart) {
          existingChart.destroy();
        }
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [hasData, items, total, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-pink-500">pie_chart</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "不良分布 (プロセス別)" : "Defect Distribution (by Process)"}
          </h3>
          {activeModel && (
            <span className="rounded-[4px] border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 text-[11px] font-semibold text-pink-600 dark:text-pink-400">
              {activeModel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {collectionName === "kensaDB" && availableModels.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-[var(--text-muted)] hidden sm:inline">
                {isJa ? "モデル定義:" : "Model Def:"}
              </span>
              <select
                value={activeModel}
                onChange={(e) => onModelChange && onModelChange(e.target.value)}
                className="h-7 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--freya-blue)] focus:outline-none cursor-pointer"
              >
                <option value="">{isJa ? "汎用カウンター" : "Generic Counters"}</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="rounded-[4px] bg-pink-500/10 px-2 py-0.5 text-xs font-semibold text-pink-600 dark:text-pink-400">
            {isJa ? "合計:" : "Total:"} {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Main Content: Doughnut Chart on Left, Full-name Legend on Right */}
      <div className="flex flex-col md:flex-row items-center gap-4 h-80 sm:h-96 w-full">
        {/* Doughnut Canvas with Centered Metric */}
        <div className="relative w-full md:w-5/12 h-64 md:h-full flex items-center justify-center shrink-0">
          <canvas ref={canvasRef} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)]">
              {isJa ? "不良合計" : "Total Def"}
            </span>
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Full-Defect-Name Legend List */}
        <div className="w-full md:w-7/12 flex-1 flex flex-col gap-1.5 h-full overflow-y-auto pr-1">
          {hasData ? (
            items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2.5 p-2 rounded-lg bg-[var(--surface-subtle)]/60 hover:bg-[var(--surface-hover)] border border-[var(--border)]/40 hover:border-[var(--border)] transition-colors group cursor-default"
                onMouseEnter={() => {
                  if (chartInstanceRef.current) {
                    chartInstanceRef.current.setActiveElements([{ datasetIndex: 0, index: idx }]);
                    chartInstanceRef.current.tooltip?.setActiveElements([{ datasetIndex: 0, index: idx }]);
                    chartInstanceRef.current.update();
                  }
                }}
                onMouseLeave={() => {
                  if (chartInstanceRef.current) {
                    chartInstanceRef.current.setActiveElements([]);
                    chartInstanceRef.current.tooltip?.setActiveElements([]);
                    chartInstanceRef.current.update();
                  }
                }}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <span
                    className="w-3 h-3 rounded-full mt-0.5 shrink-0 shadow-xs ring-1 ring-black/5"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)] leading-snug break-words">
                    {item.label}
                  </span>
                </div>
                <div className="flex flex-col items-end shrink-0 pl-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                    {item.count.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--text-muted)]">
              <span className="material-symbols-outlined text-[28px] text-[var(--text-muted)] mb-1">check_circle</span>
              <span>{isJa ? "不良データはありません" : "No defect records found"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

