import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

const DEFECT_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#6366F1",
  "#F43F5E", "#06B6D4"
];

export default function DefectDistributionChart({ defectAnalysis = [] }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const { language } = useLanguage();
  const isJa = language === "ja";

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

    const analysis = defectAnalysis[0] || {};
    const defaultLabels = isJa
      ? ["カウンター1", "カウンター2", "カウンター3", "カウンター4", "カウンター5", "カウンター6", "カウンター7", "カウンター8", "カウンター9", "カウンター10", "カウンター11", "カウンター12"]
      : ["Counter 1", "Counter 2", "Counter 3", "Counter 4", "Counter 5", "Counter 6", "Counter 7", "Counter 8", "Counter 9", "Counter 10", "Counter 11", "Counter 12"];

    const fullLabels = analysis.defectLabels && analysis.defectLabels.length > 0
      ? analysis.defectLabels
      : defaultLabels;

    const defectFields = analysis.defectFields || [
      "counter1Total", "counter2Total", "counter3Total", "counter4Total",
      "counter5Total", "counter6Total", "counter7Total", "counter8Total",
      "counter9Total", "counter10Total", "counter11Total", "counter12Total"
    ];

    const activeLabels = [];
    const activeData = [];
    const activeColors = [];

    defectFields.forEach((field, i) => {
      const val = Number(analysis[field] || 0);
      if (val > 0) {
        activeLabels.push(fullLabels[i] || `Counter ${i + 1}`);
        activeData.push(val);
        activeColors.push(DEFECT_COLORS[i % DEFECT_COLORS.length]);
      }
    });

    const hasData = activeData.length > 0;
    const total = activeData.reduce((sum, v) => sum + v, 0);

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
              padding: 10,
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
              label: (ctxItem) => {
                const count = Number(ctxItem.parsed || 0);
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                return `  ${count.toLocaleString()} (${pct}%)`;
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
  }, [defectAnalysis, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-pink-500">pie_chart</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "不良分布 (プロセス別)" : "Defect Distribution (by Process)"}
          </h3>
        </div>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
