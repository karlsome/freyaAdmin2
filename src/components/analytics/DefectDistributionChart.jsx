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

  const { activeLabels, activeData, activeColors, total } = useMemo(() => {
    const labels = [];
    const data = [];
    const colors = [];

    defectFields.forEach((field, i) => {
      const val = Number(analysis[field] || 0);
      if (val > 0) {
        labels.push(fullLabels[i] || `Counter ${i + 1}`);
        data.push(val);
        colors.push(DEFECT_COLORS[i % DEFECT_COLORS.length]);
      }
    });

    const sum = data.reduce((acc, v) => acc + v, 0);
    return { activeLabels: labels, activeData: data, activeColors: colors, total: sum };
  }, [analysis, defectFields, fullLabels]);

  const hasData = activeData.length > 0;

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

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "doughnut",
      data: {
        labels: hasData ? activeLabels : [isJa ? "データなし" : "No Data"],
        datasets: [
          {
            data: hasData ? activeData : [1],
            backgroundColor: hasData ? activeColors : ["#e2e8f0"],
            borderWidth: 2,
            borderColor: "var(--surface, #ffffff)",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            display: hasData,
            position: "right",
            labels: {
              boxWidth: 10,
              font: { size: 11 },
              color: "var(--text-secondary, #64748b)",
              padding: 8,
              generateLabels: (chart) => {
                const datasets = chart.data.datasets;
                if (!datasets.length) return [];
                return chart.data.labels.map((label, i) => {
                  const val = datasets[0].data[i] || 0;
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  const truncated = label.length > 14 ? label.slice(0, 13) + "…" : label;
                  return {
                    text: `${truncated} (${pct}%)`,
                    fillStyle: datasets[0].backgroundColor[i],
                    strokeStyle: datasets[0].borderColor,
                    lineWidth: 0,
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            enabled: hasData,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(236, 72, 153, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (ctxList) => {
                const idx = ctxList[0]?.dataIndex;
                return activeLabels[idx] || "";
              },
              label: (ctxItem) => {
                const count = Number(ctxItem.parsed || 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                return `  ${isJa ? "不良件数" : "Defects"}: ${count.toLocaleString()} (${pct}%)`;
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
  }, [hasData, activeLabels, activeData, activeColors, total, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
