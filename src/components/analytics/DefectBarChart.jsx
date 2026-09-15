import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

const DEFECT_COLORS = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#84CC16", "#6366F1",
  "#F43F5E", "#06B6D4"
];

export default function DefectBarChart({ defectAnalysis = [], collectionName = "kensaDB" }) {
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

    const labels = analysis.defectLabels && analysis.defectLabels.length > 0
      ? analysis.defectLabels
      : defaultLabels;

    const defectFields = analysis.defectFields || [
      "counter1Total", "counter2Total", "counter3Total", "counter4Total",
      "counter5Total", "counter6Total", "counter7Total", "counter8Total",
      "counter9Total", "counter10Total", "counter11Total", "counter12Total"
    ];

    const data = defectFields.map((field) => Number(analysis[field] || 0));
    const totalDefects = data.reduce((sum, v) => sum + v, 0);

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
              label: (ctxItem) => {
                const count = Number(ctxItem.parsed.y || 0);
                const pct = totalDefects > 0 ? ((count / totalDefects) * 100).toFixed(1) : "0.0";
                return `  ${isJa ? "件数" : "Count"}: ${count.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "不良数" : "Count",
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
              minRotation: 30,
              font: { size: 11 },
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
  }, [defectAnalysis, collectionName, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-rose-500">bar_chart</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "不良種別件数" : "Defect Count by Type"}
          </h3>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {collectionName}
        </span>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
