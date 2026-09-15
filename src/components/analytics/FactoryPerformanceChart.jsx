import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function FactoryPerformanceChart({ factoryStats = [] }) {
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

    const labels = factoryStats.map((f) => f.factory || f._id || (isJa ? "不明" : "Unknown"));

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "生産量" : "Production",
            data: factoryStats.map((f) => f.totalProduction || 0),
            backgroundColor: "#10B981",
            borderRadius: 4,
            yAxisID: "y",
            order: 2,
          },
          {
            label: isJa ? "不良率 (%)" : "Defect Rate (%)",
            data: factoryStats.map((f) => Number((f.defectRate || 0).toFixed(2))),
            borderColor: "#EF4444",
            backgroundColor: "#EF4444",
            pointBackgroundColor: "#EF4444",
            borderWidth: 2,
            type: "line",
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          y: {
            type: "linear",
            display: true,
            position: "left",
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "生産量" : "Production",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              callback: (val) => Number(val).toLocaleString(),
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "不良率 (%)" : "Defect Rate (%)",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              callback: (val) => `${val}%`,
            },
          },
          x: {
            grid: {
              color: "rgba(148, 163, 184, 0.08)",
            },
            ticks: {
              font: { size: 12, weight: "500" },
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: "500" },
              color: "var(--text-secondary, #64748b)",
            },
          },
          tooltip: {
            enabled: true,
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(16, 185, 129, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctxItem) => {
                const label = ctxItem.dataset.label || "";
                const val = ctxItem.dataset.yAxisID === "y1"
                  ? `${ctxItem.parsed.y}%`
                  : Number(ctxItem.parsed.y || 0).toLocaleString();
                return `  ${label}: ${val}`;
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
  }, [factoryStats, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">domain</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "工場別 生産量・不良率比較" : "Factory Performance"}
          </h3>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {factoryStats.length} {isJa ? "工場" : "factories"}
        </span>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
