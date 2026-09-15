import React, { useEffect, useRef, useMemo } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";
import { resolveDefectLabels } from "./defectLabelUtils";

const DEFECT_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#6366F1",
  "#F43F5E", "#06B6D4"
];

export default function DefectBarChart({
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

  const labels = useMemo(() => {
    return resolveDefectLabels({
      collectionName,
      defectAnalysis,
      defectDefinitions,
      selectedModel: activeModel,
      isJa,
    });
  }, [collectionName, defectAnalysis, defectDefinitions, activeModel, isJa]);

  const data = useMemo(() => {
    return defectFields.map((field) => Number(analysis[field] || 0));
  }, [analysis, defectFields]);

  const totalDefects = useMemo(() => {
    return data.reduce((sum, v) => sum + v, 0);
  }, [data]);

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
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "不良数" : "Defect Count",
            data,
            backgroundColor: labels.map((_, i) => DEFECT_COLORS[i % DEFECT_COLORS.length] + "DD"),
            borderColor: labels.map((_, i) => DEFECT_COLORS[i % DEFECT_COLORS.length]),
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(239, 68, 68, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (ctxList) => {
                const idx = ctxList[0]?.dataIndex;
                return labels[idx] || ctxList[0]?.label || "";
              },
              label: (ctxItem) => {
                const count = Number(ctxItem.parsed.y || 0);
                const pct = totalDefects > 0 ? ((count / totalDefects) * 100).toFixed(1) : "0.0";
                return `  ${isJa ? "不良件数" : "Defect Count"}: ${count.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "不良数 (件)" : "Count",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              precision: 0,
              callback: (val) => Number(val).toLocaleString(),
            },
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              maxRotation: 45,
              minRotation: 25,
              font: { size: 11 },
              callback: function (val, index) {
                const label = labels[index] || "";
                return label.length > 10 ? label.slice(0, 9) + "…" : label;
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
  }, [labels, data, totalDefects, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-rose-500">bar_chart</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "不良種別件数" : "Defect Count by Type"}
          </h3>
          {activeModel && (
            <span className="rounded-[4px] border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
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

          <span className="rounded-[4px] bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {isJa ? "合計:" : "Total:"} {totalDefects.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
