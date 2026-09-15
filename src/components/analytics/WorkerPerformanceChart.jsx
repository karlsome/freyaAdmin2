import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function WorkerPerformanceChart({ workerStats = [] }) {
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

    const topWorkers = workerStats.slice(0, 10);
    const labels = topWorkers.map((w) => w.worker || w._id || (isJa ? "未設定" : "Unknown"));

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "生産量" : "Production",
            data: topWorkers.map((w) => w.totalProduction || 0),
            backgroundColor: "#3B82F6",
            borderRadius: 4,
            yAxisID: "y",
            order: 2,
          },
          {
            label: isJa ? "平均サイクルタイム (分)" : "Avg Cycle Time (min)",
            data: topWorkers.map((w) => Number((w.avgCycleTime || 0).toFixed(1))),
            borderColor: "#F59E0B",
            backgroundColor: "#F59E0B",
            pointBackgroundColor: "#F59E0B",
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
              text: isJa ? "サイクルタイム (分)" : "Cycle Time (min)",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              callback: (val) => `${val}m`,
            },
          },
          x: {
            grid: {
              color: "rgba(148, 163, 184, 0.08)",
            },
            ticks: {
              font: { size: 11 },
              maxRotation: 40,
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
            borderColor: "rgba(59, 130, 246, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctxItem) => {
                const label = ctxItem.dataset.label || "";
                const val = ctxItem.dataset.yAxisID === "y1"
                  ? `${ctxItem.parsed.y} min`
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
  }, [workerStats, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500">badge</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "作業者別パフォーマンス (上位10名)" : "Worker Performance (Top 10)"}
          </h3>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {workerStats.length} {isJa ? "名" : "workers"}
        </span>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
